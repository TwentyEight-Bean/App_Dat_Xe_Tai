import * as dotenv from "dotenv"
dotenv.config()

import express from "express"
import authRoutes from "../api/routes/auth"
import { errorHandler } from "../api/middleware"
import { authenticate } from "../middleware/authMiddleware"

async function runAdminAuthTests() {
  console.log("🔐 ========================================================")
  console.log("   KIỂM THỬ XÁC THỰC & PHÂN QUYỀN QUẢN TRỊ VIÊN (ADMIN AUTH)")
  console.log("==========================================================\n")

  const app = express()
  app.use(express.json())
  app.use("/api/v1/auth", authRoutes)
  app.use(errorHandler)

  const PORT = 9879
  const server = app.listen(PORT)
  const baseUrl = `http://127.0.0.1:${PORT}/api/v1/auth`

  try {
    // Test 1: Bỏ trống email hoặc password -> 400
    console.log("1. Kiểm tra validation: Bỏ trống email hoặc password")
    const resEmpty = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "", password: "" }),
    })
    const dataEmpty = await resEmpty.json()
    console.log(`  Status: ${resEmpty.status}, Message: "${dataEmpty.message}"`)
    if (resEmpty.status !== 400) {
      throw new Error("Test 1 thất bại: Không chặn khi thiếu thông tin đăng nhập")
    }
    console.log("  ✅ [PASS] Chặn chuẩn 400 khi thiếu thông tin đăng nhập.")

    // Test 2: Đăng nhập sai mật khẩu -> 401
    console.log("\n2. Kiểm tra xác thực sai mật khẩu (bcrypt so khớp sai):")
    const resWrongPass = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@fastdrop.vn",
        password: "wrong_password_999",
      }),
    })
    const dataWrongPass = await resWrongPass.json()
    console.log(`  Status: ${resWrongPass.status}, Message: "${dataWrongPass.message}"`)
    if (resWrongPass.status !== 401) {
      throw new Error("Test 2 thất bại: Không từ chối khi nhập sai mật khẩu")
    }
    console.log("  ✅ [PASS] Từ chối chuẩn 401 khi mật khẩu không đúng.")

    // Test 3: Đăng nhập thành công với tài khoản quản trị viên mặc định
    console.log("\n3. Kiểm tra đăng nhập thành công với mật khẩu hợp lệ (admin@fastdrop.vn / admin123):")
    const resSuccess = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@fastdrop.vn",
        password: "admin123",
      }),
    })
    const dataSuccess = await resSuccess.json()
    console.log(`  Status: ${resSuccess.status}, Message: "${dataSuccess.message}"`)
    if (resSuccess.status !== 200 || !dataSuccess.token) {
      throw new Error(`Test 3 thất bại: ${JSON.stringify(dataSuccess)}`)
    }
    if (dataSuccess.user.role !== "ADMIN") {
      throw new Error(`Test 3 thất bại: Role không phải ADMIN: ${dataSuccess.user.role}`)
    }
    console.log("  ✅ [PASS] Đăng nhập thành công, phát hành JWT token:")
    console.log("            - Admin ID:", dataSuccess.user.id)
    console.log("            - Email:", dataSuccess.user.email)
    console.log("            - Role:", dataSuccess.user.role)

    // Test 4: Xác thực JWT Token vừa nhận được qua authMiddleware
    console.log("\n4. Kiểm tra phân quyền JWT Token bằng authenticate():")
    const adminToken = dataSuccess.token
    const authPayload = authenticate(`Bearer ${adminToken}`)
    console.log("  Payload giải mã từ JWT:", authPayload)
    if (authPayload.role !== "ADMIN") {
      throw new Error("Test 4 thất bại: Token payload không chứa role ADMIN")
    }
    console.log("  ✅ [PASS] Token hợp lệ và mang đầy đủ đặc quyền ADMIN.")

    console.log("\n==========================================================")
    console.log("🎉 TẤT CẢ KIỂM THỬ XÁC THỰC ADMIN: HOÀN THÀNH XUẤT SẮC!")
    console.log("==========================================================\n")
  } finally {
    server.close()
  }
}

runAdminAuthTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test thất bại với lỗi:", err)
    process.exit(1)
  })
