import { validateAndNormalizePhone } from "../lib/sms/types"
import { MockSmsProvider } from "../lib/sms/mock"
import { generateToken, verifyToken } from "../lib/auth"
import { authenticate, authorizeRoles } from "../middleware/authMiddleware"

async function runTests() {
  console.log("🧪 BẮT ĐẦU KIỂM THỬ HỆ THỐNG OTP & XÁC THỰC...\n")
  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`)
      passed++
    } else {
      console.error(`  ❌ [FAIL] ${testName}`)
      failed++
    }
  }

  // TEST 1: Phone Validation
  console.log("1. Kiểm tra chuẩn hóa và validate Số điện thoại Việt Nam:")
  const valid1 = validateAndNormalizePhone("0901234567")
  assert(
    valid1.valid && valid1.standardPhone === "0901234567",
    "Định dạng 10 số thông thường (0901234567)",
  )

  const valid2 = validateAndNormalizePhone("+84901234567")
  assert(
    valid2.valid && valid2.standardPhone === "0901234567",
    "Định dạng quốc tế (+84901234567)",
  )

  const valid3 = validateAndNormalizePhone("090 123 4567")
  assert(
    valid3.valid && valid3.standardPhone === "0901234567",
    "Định dạng có khoảng cách (090 123 4567)",
  )

  const invalid1 = validateAndNormalizePhone("0123456789")
  assert(!invalid1.valid, "Từ chối đầu số cố định/không tồn tại (0123456789)")

  const invalid2 = validateAndNormalizePhone("123456")
  assert(!invalid2.valid, "Từ chối số điện thoại quá ngắn (123456)")

  // TEST 2: Mock SMS Provider
  console.log("\n2. Kiểm tra Mock SMS Provider (0 VNĐ):")
  const mockSms = new MockSmsProvider()
  const smsResult = await mockSms.sendOtp("0901234567", "123456")
  assert(
    smsResult.success && !!smsResult.messageId,
    "Gửi Mock SMS thành công và trả về messageId",
  )

  // TEST 3: JWT Token Generation & Verification
  console.log("\n3. Kiểm tra cấp phát và giải mã JWT:")
  const testPayload = {
    userId: "11111111-2222-3333-4444-555555555555",
    role: "CUSTOMER" as const,
    phone: "0901234567",
  }
  const token = generateToken(testPayload)
  assert(
    typeof token === "string" && token.length > 20,
    "Sinh JWT Token thành công",
  )

  const decoded = verifyToken(token)
  assert(
    decoded.userId === testPayload.userId &&
      decoded.role === "CUSTOMER" &&
      decoded.phone === testPayload.phone,
    "Giải mã JWT đúng thông tin userId, role, phone",
  )

  // TEST 4: Middleware Auth & Role Check
  console.log("\n4. Kiểm tra Middleware Xác thực & Phân quyền:")
  const authPayload = authenticate(`Bearer ${token}`)
  assert(
    authPayload.userId === testPayload.userId,
    "Authenticate header hợp lệ",
  )

  let roleCustomerPass = false
  try {
    authorizeRoles(authPayload, ["CUSTOMER"])
    roleCustomerPass = true
  } catch (e) {
    roleCustomerPass = false
  }
  assert(roleCustomerPass, "Cho phép Role CUSTOMER truy cập")

  let roleDriverBlocked = false
  try {
    authorizeRoles(authPayload, ["DRIVER"])
  } catch (e) {
    roleDriverBlocked = true
  }
  assert(roleDriverBlocked, "Chặn đúng khi truy cập API dành cho DRIVER")

  // TEST 5: Coordinate Validation (Phase 3)
  console.log("\n5. Kiểm tra Tọa độ Địa lý (WGS 84):")
  function isValidCoord(lat: number, lng: number) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  }
  assert(
    isValidCoord(10.8231, 106.6297),
    "Tọa độ TP.HCM hợp lệ (10.8231, 106.6297)",
  )
  assert(!isValidCoord(95.0, 106.0), "Từ chối vĩ độ ngoài phạm vi [-90, 90]")
  assert(
    !isValidCoord(10.0, 195.0),
    "Từ chối kinh độ ngoài phạm vi [-180, 180]",
  )

  console.log(`\n========================================`)
  console.log(`🏁 TỔNG KẾT: ${passed} Passed, ${failed} Failed`)
  console.log(`========================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error("Lỗi khi chạy test:", err)
  process.exit(1)
})
