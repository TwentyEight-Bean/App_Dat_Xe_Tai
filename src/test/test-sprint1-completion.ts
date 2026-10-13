import * as dotenv from "dotenv"
dotenv.config()

import express from "express"
import authRoutes from "../api/routes/auth"
import driverRoutes from "../api/routes/driver"
import { errorHandler } from "../api/middleware"
import { db } from "../db"
import { users, driverProfiles, driverDocuments } from "../db/schema"
import { eq } from "drizzle-orm"
import { generateToken } from "../lib/auth"

async function runSprint1CompletionTests() {
  console.log("🚀 ========================================================")
  console.log("   KIỂM THỬ HOÀN THIỆN SPRINT 1: PROFILE & DRIVER KYC")
  console.log("==========================================================\n")

  const app = express()
  app.use(express.json())
  app.use("/api/v1/auth", authRoutes)
  app.use("/api/v1/driver", driverRoutes)
  app.use(errorHandler)

  const PORT = 9882
  const server = app.listen(PORT)
  const baseUrl = `http://127.0.0.1:${PORT}/api/v1`

  let customerUser: any
  let customerToken: string
  let driverUser: any
  let driverToken: string

  try {
    // 1. Chuẩn bị tài khoản kiểm thử
    console.log("1. Khởi tạo tài khoản Customer & Driver kiểm thử trong database:")
    const testCustomerPhone = `0911${Date.now().toString().slice(-6)}`
    const [c] = await db
      .insert(users)
      .values({
        phone: testCustomerPhone,
        fullName: "Khách Test Ban Đầu",
        role: "CUSTOMER",
        status: "ACTIVE",
      })
      .returning()
    customerUser = c
    customerToken = generateToken({
      userId: c.id,
      phone: c.phone,
      role: "CUSTOMER",
    })

    const testDriverPhone = `0922${Date.now().toString().slice(-6)}`
    const [d] = await db
      .insert(users)
      .values({
        phone: testDriverPhone,
        fullName: "Tài Xế Test KYC",
        role: "DRIVER",
        status: "ACTIVE",
      })
      .returning()
    driverUser = d
    driverToken = generateToken({
      userId: d.id,
      phone: d.phone,
      role: "DRIVER",
    })
    console.log(`  - Customer ID: ${customerUser.id} (${customerUser.phone})`)
    console.log(`  - Driver ID: ${driverUser.id} (${driverUser.phone})`)
    console.log("  ✅ [PASS] Khởi tạo tài khoản thành công.")

    // 2. Kiểm thử PUT /api/v1/auth/me
    console.log("\n2. Kiểm thử PUT /api/v1/auth/me - Cập nhật Họ tên, Email, Avatar vào DB:")
    const updatePayload = {
      fullName: "Nguyễn Văn Hoàn Thiện",
      email: `hoanthien_${Date.now()}@fastdrop.vn`,
      avatarUrl: "https://res.cloudinary.com/fastdrop/image/upload/v12345/avatar.jpg",
    }

    const putRes = await fetch(`${baseUrl}/auth/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify(updatePayload),
    })

    const putData = await putRes.json()
    console.log(`  Status: ${putRes.status}, Message: "${putData.message}"`)
    if (putRes.status !== 200 || !putData.success) {
      throw new Error(`PUT /auth/me thất bại: ${JSON.stringify(putData)}`)
    }
    if (putData.user.fullName !== updatePayload.fullName || putData.user.email !== updatePayload.email) {
      throw new Error(`Dữ liệu trả về không khớp payload: ${JSON.stringify(putData)}`)
    }
    console.log("  ✅ [PASS] PUT /api/v1/auth/me trả về 200 và thông tin cập nhật.")

    // Xác minh trực tiếp trong cơ sở dữ liệu PostgreSQL
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, customerUser.id))
      .limit(1)

    if (dbUser.fullName !== updatePayload.fullName || dbUser.email !== updatePayload.email || dbUser.avatarUrl !== updatePayload.avatarUrl) {
      throw new Error("Dữ liệu trong bảng users không được cập nhật chính xác!")
    }
    console.log("  ✅ [PASS] PostgreSQL users table đã lưu vĩnh viễn Họ tên, Email và Avatar.")

    // 3. Kiểm thử GET /api/v1/auth/me sau khi cập nhật
    console.log("\n3. Kiểm thử GET /api/v1/auth/me - Đọc thông tin mới nhất từ DB:")
    const getRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    })
    const getData = await getRes.json()
    if (getData.user.fullName !== updatePayload.fullName) {
      throw new Error("GET /auth/me không trả về họ tên đã cập nhật")
    }
    console.log("  ✅ [PASS] GET /api/v1/auth/me đồng bộ chuẩn xác.")

    // 4. Kiểm thử POST /api/v1/driver/kyc/submit
    console.log("\n4. Kiểm thử POST /api/v1/driver/kyc/submit - Nộp 5 tài liệu Cloudinary:")
    const plateNo = `51D-${Date.now().toString().slice(-5)}`
    const licenseNo = `GPLX-${Date.now().toString().slice(-6)}`
    const kycPayload = {
      licensePlate: plateNo,
      driverLicenseNo: licenseNo,
      documents: [
        {
          docType: "CCCD_FRONT",
          fileUrl: "https://res.cloudinary.com/fastdrop/licenses/cccd_front.jpg",
          docNumber: "079090123456",
        },
        {
          docType: "CCCD_BACK",
          fileUrl: "https://res.cloudinary.com/fastdrop/licenses/cccd_back.jpg",
          docNumber: "079090123456",
        },
        {
          docType: "PORTRAIT",
          fileUrl: "https://res.cloudinary.com/fastdrop/licenses/portrait.jpg",
        },
        {
          docType: "DRIVER_LICENSE",
          fileUrl: "https://res.cloudinary.com/fastdrop/licenses/gplx.jpg",
          docNumber: licenseNo,
        },
        {
          docType: "VEHICLE_REGISTRATION",
          fileUrl: "https://res.cloudinary.com/fastdrop/licenses/cavet.jpg",
          docNumber: plateNo,
        },
      ],
    }

    const kycRes = await fetch(`${baseUrl}/driver/kyc/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify(kycPayload),
    })

    const kycData = await kycRes.json()
    console.log(`  Status: ${kycRes.status}, Message: "${kycData.message}"`)
    if (kycRes.status !== 200 || !kycData.success) {
      throw new Error(`POST /driver/kyc/submit thất bại: ${JSON.stringify(kycData)}`)
    }
    if (kycData.data.kycStatus !== "PENDING") {
      throw new Error(`Trạng thái kycStatus không phải PENDING: ${kycData.data.kycStatus}`)
    }
    console.log("  ✅ [PASS] Nộp hồ sơ KYC thành công, chuyển sang PENDING.")

    // 5. Kiểm thử GET /api/v1/driver/kyc/status
    console.log("\n5. Kiểm thử GET /api/v1/driver/kyc/status - Kiểm tra trạng thái và thông tin xe:")
    const statusRes = await fetch(`${baseUrl}/driver/kyc/status`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    })
    const statusData = await statusRes.json()
    if (statusData.data.kycStatus !== "PENDING" || statusData.data.licensePlate !== plateNo) {
      throw new Error(`Dữ liệu kyc/status không khớp: ${JSON.stringify(statusData)}`)
    }
    console.log(`  - KYC Status: ${statusData.data.kycStatus}`)
    console.log(`  - Biển số: ${statusData.data.licensePlate}`)
    console.log(`  - Số GPLX: ${statusData.data.driverLicenseNo}`)
    console.log("  ✅ [PASS] GET /driver/kyc/status phản hồi chính xác.")

    // 6. Kiểm tra các tài liệu trong bảng driver_documents
    console.log("\n6. Kiểm tra danh sách 5 tài liệu trong bảng PostgreSQL driver_documents:")
    const docsInDb = await db
      .select()
      .from(driverDocuments)
      .where(eq(driverDocuments.driverId, kycData.data.id))

    console.log(`  - Số lượng tài liệu đã lưu: ${docsInDb.length}/5`)
    if (docsInDb.length !== 5) {
      throw new Error(`Số lượng tài liệu không đủ 5: ${docsInDb.length}`)
    }
    console.log("  ✅ [PASS] Tất cả 5 tài liệu (CCCD 2 mặt, Chân dung, GPLX, Cà vẹt xe) đã lưu vào DB.")

    console.log("\n==========================================================")
    console.log("🎉 TẤT CẢ KIỂM THỬ HOÀN THIỆN SPRINT 1: THÀNH CÔNG 100%!")
    console.log("==========================================================\n")
  } finally {
    // Dọn dẹp dữ liệu test
    if (customerUser?.id) {
      await db.delete(users).where(eq(users.id, customerUser.id))
    }
    if (driverUser?.id) {
      await db.delete(users).where(eq(users.id, driverUser.id))
    }
    server.close()
  }
}

runSprint1CompletionTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test thất bại với lỗi:", err)
    process.exit(1)
  })
