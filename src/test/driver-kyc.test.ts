import * as dotenv from "dotenv"
dotenv.config()

import { db } from "../db"
import {
  users,
  driverProfiles,
  vehicleTypes,
  driverDocuments,
} from "../db/schema"
import { eq } from "drizzle-orm"
import {
  getVehicleTypes,
  getOrCreateDriverProfile,
  getDriverProfile,
  submitDriverKyc,
  getDriverKycStatus,
  setDriverOnlineStatus,
} from "../lib/driverService"
import {
  getPendingKycDrivers,
  getDriverKycDetail,
  approveDriverKyc,
  rejectDriverKyc,
} from "../lib/adminService"
import { generateToken } from "../lib/auth"
import { authenticate, authorizeRoles } from "../middleware/authMiddleware"

async function runDriverKycTests() {
  console.log("🚛 ========================================================")
  console.log("   BẮT ĐẦU KIỂM THỬ: QUY TRÌNH KYC TÀI XẾ & TRẠNG THÁI ONLINE")
  console.log("==========================================================\n")

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`)
      passed++
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`)
      failed++
    }
  }

  try {
    // 1. Kiểm tra danh mục loại xe
    console.log("1. Kiểm tra danh mục loại xe:")
    const vTypes = await getVehicleTypes()
    assert(
      vTypes.length >= 4,
      `Lấy danh sách loại xe thành công (tìm thấy ${vTypes.length} loại xe)`,
    )
    const selectedVehicleType = vTypes[0]

    // 2. Chuẩn bị tài khoản tài xế mẫu
    console.log("\n2. Khởi tạo tài khoản và hồ sơ tài xế kiểm thử:")
    const testPhone = "0988776655"
    // Xóa dữ liệu cũ nếu có
    const oldUsers = await db
      .select()
      .from(users)
      .where(eq(users.phone, testPhone))
    if (oldUsers.length > 0) {
      await db.delete(users).where(eq(users.phone, testPhone))
    }

    const [driverUser] = await db
      .insert(users)
      .values({
        phone: testPhone,
        fullName: "Nguyễn Văn Tài (Tài xế Test)",
        role: "DRIVER",
        status: "ACTIVE",
      })
      .returning()

    assert(!!driverUser.id, "Tạo tài khoản tài xế thành công")

    const initialProfile = await getOrCreateDriverProfile(driverUser.id)
    assert(
      initialProfile.kycStatus === "PENDING" &&
        initialProfile.isOnline === false,
      "Hồ sơ khởi tạo có kycStatus = PENDING và isOnline = false",
    )

    // 3. RÀNG BUỘC NGHIÊM NGẶT: Thử bật Online khi CHƯA DUYỆT KYC
    console.log("\n3. Kiểm tra chặn bật Online khi hồ sơ chưa duyệt:")
    let onlineBlocked = false
    let blockErrorCode = ""
    try {
      await setDriverOnlineStatus(driverUser.id, true)
    } catch (err: any) {
      onlineBlocked = true
      blockErrorCode = err.code
    }
    assert(
      onlineBlocked && blockErrorCode === "KYC_NOT_APPROVED",
      "Hệ thống chặn bật Trực tuyến với mã lỗi KYC_NOT_APPROVED",
    )

    // 4. Tài xế nộp hồ sơ KYC
    console.log("\n4. Tài xế nộp hồ sơ KYC (Giấy tờ + Biển số + Số GPLX):")
    const kycSubmission = await submitDriverKyc(driverUser.id, {
      vehicleTypeId: selectedVehicleType.id,
      licensePlate: "51C-888.99",
      driverLicenseNo: "GPLX-790123456",
      documents: [
        {
          docType: "CCCD_FRONT",
          fileUrl:
            "https://res.cloudinary.com/demo/image/upload/cccd_front_sample.jpg",
          docNumber: "079201001234",
        },
        {
          docType: "CCCD_BACK",
          fileUrl:
            "https://res.cloudinary.com/demo/image/upload/cccd_back_sample.jpg",
        },
        {
          docType: "DRIVER_LICENSE",
          fileUrl:
            "https://res.cloudinary.com/demo/image/upload/driver_license_sample.jpg",
          docNumber: "GPLX-790123456",
        },
        {
          docType: "VEHICLE_REGISTRATION",
          fileUrl:
            "https://res.cloudinary.com/demo/image/upload/vehicle_registration_sample.jpg",
          docNumber: "CAVET-51C88899",
        },
        {
          docType: "PORTRAIT",
          fileUrl:
            "https://res.cloudinary.com/demo/image/upload/portrait_sample.jpg",
        },
      ],
    })

    assert(
      kycSubmission !== null && kycSubmission.documents.length === 5,
      "Nộp 5 loại giấy tờ KYC thành công",
    )
    assert(
      kycSubmission?.licensePlate === "51C-888.99" &&
        kycSubmission?.kycStatus === "PENDING",
      "Hồ sơ cập nhật biển số xe và trạng thái PENDING",
    )

    // 5. Thử bật Online khi hồ sơ đang PENDING
    console.log("\n5. Thử bật Online khi hồ sơ đang PENDING:")
    let pendingOnlineBlocked = false
    try {
      await setDriverOnlineStatus(driverUser.id, true)
    } catch (err: any) {
      pendingOnlineBlocked = err.code === "KYC_NOT_APPROVED"
    }
    assert(
      pendingOnlineBlocked,
      "Vẫn chặn bật Trực tuyến khi hồ sơ đang ở trạng thái PENDING",
    )

    // 6. Admin kiểm tra danh sách chờ duyệt
    console.log("\n6. Admin kiểm tra danh sách chờ duyệt KYC:")
    const pendingList = await getPendingKycDrivers(1, 10)
    const foundInPending = pendingList.drivers.some(
      (d) => d.userId === driverUser.id,
    )
    assert(
      foundInPending,
      "Tài xế xuất hiện trong danh sách chờ duyệt của Quản trị viên",
    )

    // 7. Admin từ chối hồ sơ kèm lý do
    console.log("\n7. Admin từ chối hồ sơ kèm lý do (REJECT):")
    const rejectReason =
      "Ảnh chụp mặt trước CCCD bị lóa sáng, vui lòng chụp lại rõ nét."
    const rejectedResult = await rejectDriverKyc(
      initialProfile.id,
      rejectReason,
    )
    assert(
      rejectedResult.kycStatus === "REJECTED" &&
        rejectedResult.rejectionReason === rejectReason,
      "Hồ sơ bị từ chối và lưu đúng lý do từ chối",
    )

    // 8. Tài xế kiểm tra trạng thái KYC sau khi bị từ chối
    console.log("\n8. Tài xế kiểm tra trạng thái sau khi bị từ chối:")
    const statusAfterReject = await getDriverKycStatus(driverUser.id)
    assert(
      statusAfterReject.kycStatus === "REJECTED" &&
        statusAfterReject.rejectionReason === rejectReason &&
        statusAfterReject.canGoOnline === false,
      "Tài xế nhìn thấy trạng thái REJECTED, lý do từ chối và canGoOnline = false",
    )

    // 9. Tài xế nộp lại giấy tờ đã khắc phục (Re-submit)
    console.log("\n9. Tài xế nộp lại hồ sơ KYC đã sửa:")
    const resubmit = await submitDriverKyc(driverUser.id, {
      documents: [
        {
          docType: "CCCD_FRONT",
          fileUrl:
            "https://res.cloudinary.com/demo/image/upload/cccd_front_clear_fix.jpg",
          docNumber: "079201001234",
        },
      ],
    })
    assert(
      resubmit?.kycStatus === "PENDING" && resubmit?.rejectionReason === null,
      "Nộp lại thành công: trạng thái quay về PENDING và lý do từ chối cũ được reset",
    )

    // 10. Admin duyệt hồ sơ (APPROVE)
    console.log("\n10. Admin phê duyệt hồ sơ KYC (APPROVE):")
    const approveResult = await approveDriverKyc(initialProfile.id)
    assert(
      approveResult.kycStatus === "APPROVED",
      "Admin phê duyệt hồ sơ thành công (APPROVED)",
    )

    // 11. Tài xế kiểm tra quyền bật Trực tuyến
    console.log("\n11. Kiểm tra trạng thái sau khi duyệt:")
    const approvedStatus = await getDriverKycStatus(driverUser.id)
    assert(
      approvedStatus.kycStatus === "APPROVED" &&
        approvedStatus.canGoOnline === true,
      "Tài xế đã đạt điều kiện canGoOnline = true",
    )

    // 12. Tài xế BẬT Trực tuyến (Online Toggle)
    console.log("\n12. Tài xế BẬT trạng thái Trực tuyến:")
    const onlineResult = await setDriverOnlineStatus(driverUser.id, true)
    assert(
      onlineResult.isOnline === true,
      "Bật trạng thái Trực tuyến thành công!",
    )

    // 13. Tài xế TẮT Trực tuyến (Offline Toggle)
    console.log("\n13. Tài xế TẮT trạng thái Trực tuyến:")
    const offlineResult = await setDriverOnlineStatus(driverUser.id, false)
    assert(
      offlineResult.isOnline === false,
      "Tắt trạng thái Trực tuyến (chuyển sang Ngoại tuyến) thành công!",
    )

    // 14. Kiểm tra phân quyền JWT (Role Authorization)
    console.log("\n14. Kiểm tra phân quyền truy cập:")
    const customerToken = generateToken({
      userId: "22222222-3333-4444-5555-666666666666",
      role: "CUSTOMER",
      phone: "0911222333",
    })
    const driverToken = generateToken({
      userId: driverUser.id,
      role: "DRIVER",
      phone: testPhone,
    })
    const adminToken = generateToken({
      userId: "33333333-4444-5555-6666-777777777777",
      role: "ADMIN",
      phone: "0900000001",
    })

    // Customer không thể vào API Driver
    let customerBlockedFromDriver = false
    try {
      const decodedCustomer = authenticate(`Bearer ${customerToken}`)
      authorizeRoles(decodedCustomer, ["DRIVER", "ADMIN"])
    } catch {
      customerBlockedFromDriver = true
    }
    assert(
      customerBlockedFromDriver,
      "Chặn tài khoản CUSTOMER truy cập API của Tài xế",
    )

    // Driver không thể vào API Admin
    let driverBlockedFromAdmin = false
    try {
      const decodedDriver = authenticate(`Bearer ${driverToken}`)
      authorizeRoles(decodedDriver, ["ADMIN"])
    } catch {
      driverBlockedFromAdmin = true
    }
    assert(
      driverBlockedFromAdmin,
      "Chặn tài khoản DRIVER truy cập API Quản trị Admin",
    )

    // Admin có quyền truy cập API Admin
    let adminAllowed = false
    try {
      const decodedAdmin = authenticate(`Bearer ${adminToken}`)
      authorizeRoles(decodedAdmin, ["ADMIN"])
      adminAllowed = true
    } catch {
      adminAllowed = false
    }
    assert(adminAllowed, "ADMIN có đầy đủ quyền thao tác")

    // Dọn dẹp dữ liệu test
    await db.delete(users).where(eq(users.id, driverUser.id))

    console.log("\n==========================================================")
    console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`)
    console.log("==========================================================\n")

    if (failed > 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error("❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:", err)
    process.exit(1)
  }
}

runDriverKycTests()
