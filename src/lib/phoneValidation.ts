/**
 * Tiện ích kiểm tra và chuẩn hóa số điện thoại di động Việt Nam
 * Áp dụng thống nhất cho cả Frontend (UI) và Backend (API)
 */

/**
 * Chỉ cho phép người dùng nhập chữ số (và dấu + nếu là mã vùng)
 */
export function sanitizePhoneInput(val: string): string {
  if (!val) return ""
  // Nếu có dấu + ở đầu thì giữ lại, còn lại chỉ lấy số
  const startsWithPlus = val.startsWith("+")
  const digitsOnly = val.replace(/\D/g, "")
  const cleaned = startsWithPlus ? "+" + digitsOnly : digitsOnly
  return cleaned.slice(0, 12)
}

/**
 * Kiểm tra tính hợp lệ của số điện thoại di động Việt Nam:
 * - Độ dài: đúng 10 chữ số (dạng 0xxxxxxxxx) hoặc dạng quốc tế +84xxxxxxxxx
 * - Các đầu số hợp lệ của các nhà mạng viễn thông Việt Nam:
 *   + Viettel: 086, 096, 097, 098, 032, 033, 034, 035, 036, 037, 038, 039
 *   + MobiFone: 089, 090, 093, 070, 076, 077, 078, 079
 *   + VinaPhone: 088, 091, 094, 081, 082, 083, 084, 085
 *   + Vietnamobile: 092, 052, 056, 058
 *   + Wintel / Itelecom: 055, 087
 *   + Gmobile: 099, 059
 */
export function validateVietnamesePhone(rawPhone: string): {
  valid: boolean
  phone: string // Số chuẩn hóa dạng 10 số (VD: 0988888888)
  e164: string // Số chuẩn hóa dạng E.164 (VD: +84988888888)
  error?: string
} {
  if (!rawPhone || typeof rawPhone !== "string" || !rawPhone.trim()) {
    return {
      valid: false,
      phone: "",
      e164: "",
      error: "Vui lòng nhập số điện thoại",
    }
  }

  // Loại bỏ khoảng trắng, dấu gạch nối, dấu chấm, ngoặc
  let clean = rawPhone.trim().replace(/[\s\-\.\(\)]/g, "")

  // Chuẩn hóa tiền tố quốc tế về dạng 0xxxxxxxxx
  if (clean.startsWith("+84")) {
    clean = "0" + clean.slice(3)
  } else if (clean.startsWith("84") && clean.length === 11) {
    clean = "0" + clean.slice(2)
  }

  // Kiểm tra chỉ chứa chữ số
  if (!/^\d+$/.test(clean)) {
    return {
      valid: false,
      phone: clean,
      e164: "",
      error: "Số điện thoại chỉ được chứa các chữ số (0-9)",
    }
  }

  // Kiểm tra độ dài 10 chữ số
  if (clean.length < 10) {
    return {
      valid: false,
      phone: clean,
      e164: "",
      error: `Số điện thoại còn thiếu (${clean.length}/10 số). Vui lòng nhập đủ 10 số.`,
    }
  }

  if (clean.length > 10) {
    return {
      valid: false,
      phone: clean,
      e164: "",
      error: `Số điện thoại quá dài (${clean.length} số). Số di động Việt Nam chuẩn gồm 10 chữ số.`,
    }
  }

  // Regex kiểm tra đầu số nhà mạng di động Việt Nam hiện hành
  const vnMobileRegex = /^0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])\d{7}$/

  if (!vnMobileRegex.test(clean)) {
    return {
      valid: false,
      phone: clean,
      e164: "",
      error:
        "Đầu số không đúng mạng di động Việt Nam (hợp lệ gồm đầu 03, 05, 07, 08, 09)",
    }
  }

  return {
    valid: true,
    phone: clean,
    e164: "+84" + clean.slice(1),
  }
}
