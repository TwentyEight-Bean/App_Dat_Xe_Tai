import { requestOtp, verifyOtp } from "../lib/otpService"
import { verifyToken } from "../lib/auth"
import { client } from "../db"

async function runDriverAuthTests() {
  console.log("🚚 ========================================================")
  console.log("   KIỂM THỬ XÁC THỰC & PHÂN QUYỀN TÀI XẾ (DRIVER AUTHENTICATION)")
  console.log("==========================================================\n")

  const testPhone = "0908815624"

  // 1. Request OTP cho tài xế
  console.log("1. Kiểm tra yêu cầu mã OTP đối tác tài xế:")
  const otpReq = await requestOtp(testPhone, "127.0.0.1")
  if (!otpReq.success) {
    throw new Error("Không thể yêu cầu OTP cho tài xế")
  }
  console.log("  ✅ [PASS] Yêu cầu OTP thành công cho SĐT:", testPhone)

  // 2. Xác thực OTP với quyền DRIVER
  console.log("\n2. Kiểm tra xác thực OTP với role: DRIVER:")
  const otpVerify = await verifyOtp(testPhone, "123456", "DRIVER")
  if (!otpVerify.success || !otpVerify.token) {
    throw new Error("Xác thực OTP thất bại")
  }
  console.log("  ✅ [PASS] Xác thực OTP thành công. User ID:", otpVerify.user.id)
  console.log("  ✅ [PASS] User Role được cấp:", otpVerify.user.role)

  if (otpVerify.user.role !== "DRIVER") {
    throw new Error(`Kỳ vọng role DRIVER nhưng nhận được: ${otpVerify.user.role}`)
  }

  // 3. Giải mã JWT Token để xác thực claim role trong Token
  console.log("\n3. Kiểm tra payload trong JWT Token:")
  const decoded = verifyToken(otpVerify.token)
  if (!decoded || decoded.role !== "DRIVER") {
    throw new Error(`Token không chứa role DRIVER: ${JSON.stringify(decoded)}`)
  }
  console.log("  ✅ [PASS] JWT Token mang đúng payload role DRIVER:")
  console.log("            - User ID:", decoded.userId)
  console.log("            - Role:", decoded.role)
  console.log("            - Phone:", decoded.phone)

  // 4. Kiểm tra bản ghi trong bảng driver_profiles
  console.log("\n4. Kiểm tra hồ sơ tài xế trong CSDL (driver_profiles):")
  const driverRows = await client.unsafe(
    `SELECT id, user_id, kyc_status, is_online, is_active FROM driver_profiles WHERE user_id = $1::uuid`,
    [decoded.userId],
  )
  if (driverRows.length === 0) {
    throw new Error("Không tìm thấy bản ghi driver_profiles cho tài xế vừa tạo!")
  }
  console.log("  ✅ [PASS] Tự động khởi tạo driver_profiles thành công:")
  console.log("            - Profile ID:", driverRows[0].id)
  console.log("            - KYC Status:", driverRows[0].kyc_status)
  console.log("            - Trạng thái Online:", driverRows[0].is_online)

  console.log("\n==========================================================")
  console.log("🎉 TẤT CẢ KIỂM THỬ XÁC THỰC TÀI XẾ: HOÀN THÀNH XUẤT SẮC!")
  console.log("==========================================================\n")
  process.exit(0)
}

runDriverAuthTests().catch((err) => {
  console.error("❌ Test Failed:", err)
  process.exit(1)
})
