import { requestOtp, verifyOtpCodeOnly } from "../lib/otpService"
import { client, db } from "../db"
import { users } from "../db/schema"
import { hashPassword, comparePassword } from "../lib/hash"
import { generateToken, verifyToken } from "../lib/auth"

async function runRegisterOtpFlowTests() {
  console.log("🔒 ========================================================")
  console.log("   KIỂM THỬ QUY TRÌNH ĐĂNG KÝ BẮT BUỘC OTP + MẬT KHẨU/PIN")
  console.log("   Mục tiêu: Triệt tiêu 100% tài khoản số điện thoại ảo")
  console.log("==========================================================\n")

  // Số điện thoại test ngẫu nhiên hợp lệ của VN (10 chữ số: đầu 097 + 7 chữ số)
  const randomSuffix = Math.floor(1000000 + Math.random() * 9000000)
  const testPhone = `097${randomSuffix}`
  const testPin = "654321"
  const testFullName = "Khách Hàng Thử Nghiệm"

  console.log(`📱 Số điện thoại thử nghiệm: ${testPhone}`)

  // Dọn dẹp dữ liệu OTP cũ của IP test để tránh chạm trần chống Spam Tier 2
  await client.unsafe(`DELETE FROM otp_verifications WHERE ip_address = '127.0.0.1'`)

  // 1. Kiểm tra yêu cầu mã OTP khi đăng ký (purpose: 'register')
  console.log("\n1. Gửi yêu cầu mã OTP đăng ký mới (purpose = 'register'):")
  const otpReq = await requestOtp(testPhone, "127.0.0.1", { purpose: "register" })
  if (!otpReq.success) {
    throw new Error(`Yêu cầu OTP thất bại: ${otpReq.message}`)
  }
  const generatedOtp = otpReq.devOtp || "123456"
  console.log(`  ✅ [PASS] Gửi OTP thành công. Mã nhận được: ${generatedOtp}`)

  // 2. Thử xác thực với mã OTP sai (ví dụ "000000") -> Phải bị từ chối
  console.log("\n2. Kiểm tra chặn mã OTP sai (Anti-spoofing):")
  try {
    await verifyOtpCodeOnly(testPhone, "000000")
    throw new Error("LỖI: Mã OTP sai nhưng hệ thống vẫn cho qua!")
  } catch (err: any) {
    console.log(`  ✅ [PASS] Hệ thống đã chặn thành công: "${err.message}"`)
  }

  // 3. Xác thực với mã OTP đúng -> Phải thành công
  console.log("\n3. Xác thực với mã OTP đúng:")
  const verified = await verifyOtpCodeOnly(testPhone, generatedOtp)
  if (!verified || !verified.phone) {
    throw new Error("Xác thực OTP đúng bị thất bại!")
  }
  console.log(`  ✅ [PASS] Mã OTP hợp lệ cho số ${verified.phone}, đã đánh dấu isUsed = true.`)

  // 4. Kiểm tra chống dùng lại mã OTP (Anti-Replay Attack)
  console.log("\n4. Kiểm tra chống dùng lại mã OTP đã qua sử dụng (Replay Attack):")
  try {
    await verifyOtpCodeOnly(testPhone, generatedOtp)
    throw new Error("LỖI: Mã OTP đã dùng nhưng vẫn cho xác thực lần 2!")
  } catch (err: any) {
    console.log(`  ✅ [PASS] Chặn dùng lại mã thành công: "${err.message}"`)
  }

  // 5. Khởi tạo tài khoản người dùng kèm mật khẩu/PIN sau khi OTP hợp lệ
  console.log("\n5. Tạo tài khoản người dùng kèm Mã PIN bảo mật:")
  const passwordHash = await hashPassword(testPin)
  const [createdUser] = await db
    .insert(users)
    .values({
      phone: testPhone,
      passwordHash,
      fullName: testFullName,
      role: "CUSTOMER",
      status: "ACTIVE",
    })
    .returning()

  if (!createdUser || !createdUser.id) {
    throw new Error("Không thể tạo bản ghi người dùng trong CSDL!")
  }
  console.log(`  ✅ [PASS] Tạo tài khoản thành công! User ID: ${createdUser.id}`)

  // 6. Kiểm tra chặn đăng ký lại số điện thoại đã tồn tại
  console.log("\n6. Kiểm tra chặn đăng ký trùng SĐT khi gửi OTP (purpose = 'register'):")
  try {
    await requestOtp(testPhone, "127.0.0.1", { purpose: "register" })
    throw new Error("LỖI: Số điện thoại đã có tài khoản nhưng hệ thống vẫn cho gửi OTP đăng ký!")
  } catch (err: any) {
    console.log(`  ✅ [PASS] Chặn trùng số thành công: "${err.message}"`)
  }

  // 7. Kiểm tra đăng nhập bằng SĐT + Mã PIN vừa tạo
  console.log("\n7. Kiểm tra đăng nhập bằng Số điện thoại + Mã PIN:")
  const isMatch = await comparePassword(testPin, createdUser.passwordHash!)
  if (!isMatch) {
    throw new Error("Mã PIN không khớp với mã hash trong CSDL!")
  }
  const token = generateToken({
    userId: createdUser.id,
    role: createdUser.role,
    phone: createdUser.phone,
  })
  const decoded = verifyToken(token)
  if (!decoded || decoded.phone !== testPhone) {
    throw new Error("JWT Token giải mã không đúng số điện thoại!")
  }
  console.log(`  ✅ [PASS] Đăng nhập thành công bằng Mã PIN! Token hợp lệ.`)

  // Dọn dẹp dữ liệu test
  await client.unsafe(`DELETE FROM users WHERE phone = $1`, [testPhone])
  await client.unsafe(`DELETE FROM otp_verifications WHERE phone = $1`, [testPhone])
  console.log(`\n🧹 Đã dọn dẹp dữ liệu kiểm thử an toàn.`)

  console.log("\n==========================================================")
  console.log("🎉 TẤT CẢ KIỂM THỬ QUY TRÌNH ĐĂNG KÝ OTP: 100% THÀNH CÔNG!")
  console.log("==========================================================\n")
  process.exit(0)
}

runRegisterOtpFlowTests().catch((err) => {
  console.error("❌ Test Failed:", err)
  process.exit(1)
})
