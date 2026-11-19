/**
 * Thư viện kiểm tra tính an toàn của Mã PIN và chống tấn công vét cạn (Brute-force)
 */

// Danh sách các mã PIN quá đơn giản thường bị hacker/kẻ xấu dò đầu tiên
const WEAK_PIN_PATTERNS = new Set([
  "000000",
  "111111",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "123456",
  "654321",
  "123123",
  "121212",
  "112233",
  "665544",
  "987654",
  "456789",
  "012345",
  "543210",
])

export interface PinValidationResult {
  valid: boolean
  error?: string
}

/**
 * LỚP CHỐT CHẶN 2: Kiểm tra độ mạnh của mã PIN khi đăng ký / cập nhật PIN
 * - Bắt buộc đúng 6 số
 * - Không chứa ký tự đặc biệt hay chữ cái
 * - Không nằm trong danh sách mã yếu/dễ đoán (123456, 000000, ...)
 * - Không trùng 6 số cuối của số điện thoại
 */
export function validatePinStrength(pin: string, phone?: string): PinValidationResult {
  const cleanPin = (pin || "").trim()

  if (!/^\d{6}$/.test(cleanPin)) {
    return {
      valid: false,
      error: "Mã PIN phải gồm đúng 6 chữ số (0-9).",
    }
  }

  // Chặn các mã phổ biến/dễ đoán
  if (WEAK_PIN_PATTERNS.has(cleanPin)) {
    return {
      valid: false,
      error: "Mã PIN quá đơn giản và dễ đoán (ví dụ: 123456, 000000). Vui lòng chọn dãy 6 số khác an toàn hơn.",
    }
  }

  // Chặn 6 số giống nhau dạng regex tổng quát (ví dụ: 000000, 111111)
  if (/^(\d)\1{5}$/.test(cleanPin)) {
    return {
      valid: false,
      error: "Mã PIN không được gồm 6 chữ số trùng nhau.",
    }
  }

  // Chặn dãy số tiến hoặc lùi liên tiếp (012345, 123456, 234567, 765432, ...)
  const isAscending = "0123456789".includes(cleanPin)
  const isDescending = "9876543210".includes(cleanPin)
  if (isAscending || isDescending) {
    return {
      valid: false,
      error: "Mã PIN không được là dãy số tăng dần hoặc giảm dần liên tiếp.",
    }
  }

  // Chặn trùng 6 số cuối của số điện thoại nếu có truyền phone
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, "")
    if (cleanPhone.length >= 6 && cleanPhone.endsWith(cleanPin)) {
      return {
        valid: false,
        error: "Mã PIN không được trùng với 6 chữ số cuối của số điện thoại.",
      }
    }
  }

  return { valid: true }
}

/**
 * LỚP CHỐT CHẶN 1: Quản lý số lần đăng nhập sai (Rate Limiting & Lockout)
 * Chống kẻ xấu dùng tool tự động dò vét cạn (brute-force) 1 triệu mã PIN.
 */
interface AttemptRecord {
  failedCount: number
  lockedUntil?: number
  lastAttemptAt: number
}

// Lưu trữ in-memory theo key (IP + SĐT hoặc Phone)
const loginAttemptsMap = new Map<string, AttemptRecord>()

const MAX_FAILED_ATTEMPTS = 5 // Tối đa 5 lần thử sai
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // Khóa 15 phút nếu sai quá 5 lần

export function recordFailedAttempt(key: string): {
  remainingAttempts: number
  isLocked: boolean
  lockRemainingMinutes?: number
} {
  const now = Date.now()
  let record = loginAttemptsMap.get(key)

  if (!record || (record.lockedUntil && now > record.lockedUntil)) {
    record = {
      failedCount: 1,
      lastAttemptAt: now,
    }
  } else {
    record.failedCount += 1
    record.lastAttemptAt = now
  }

  if (record.failedCount >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS
    loginAttemptsMap.set(key, record)
    return {
      remainingAttempts: 0,
      isLocked: true,
      lockRemainingMinutes: Math.ceil(LOCKOUT_DURATION_MS / 60000),
    }
  }

  loginAttemptsMap.set(key, record)
  return {
    remainingAttempts: MAX_FAILED_ATTEMPTS - record.failedCount,
    isLocked: false,
  }
}

export function checkLoginLockout(key: string): {
  isLocked: boolean
  lockRemainingMinutes?: number
} {
  const now = Date.now()
  const record = loginAttemptsMap.get(key)

  if (!record || !record.lockedUntil) {
    return { isLocked: false }
  }

  if (now > record.lockedUntil) {
    // Đã hết thời gian khóa
    loginAttemptsMap.delete(key)
    return { isLocked: false }
  }

  const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000)
  return {
    isLocked: true,
    lockRemainingMinutes: remainingMinutes > 0 ? remainingMinutes : 1,
  }
}

export function resetLoginAttempts(key: string) {
  loginAttemptsMap.delete(key)
}
