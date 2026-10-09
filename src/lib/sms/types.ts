export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ISmsProvider {
  name: string;
  sendOtp(phone: string, otp: string): Promise<SmsSendResult>;
}

/**
 * Chuẩn hóa và kiểm tra số điện thoại di động Việt Nam.
 * Hỗ trợ các định dạng: "0901234567", "+84901234567", "84901234567", "090 123 4567"
 * Trả về định dạng chuẩn 10 số dạng "0901234567" và E.164 "+84901234567".
 */
export function validateAndNormalizePhone(rawPhone: string): {
  valid: boolean;
  standardPhone: string; // VD: 0901234567
  e164Phone: string;     // VD: +84901234567
  error?: string;
} {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, standardPhone: '', e164Phone: '', error: 'Số điện thoại không được để trống' };
  }

  // Loại bỏ khoảng trắng, dấu gạch nối, dấu chấm, ngoặc đơn
  let clean = rawPhone.replace(/[\s\-\.\(\)]/g, '');

  // Chuẩn hóa tiền tố quốc tế
  if (clean.startsWith('+84')) {
    clean = '0' + clean.slice(3);
  } else if (clean.startsWith('84') && clean.length === 11) {
    clean = '0' + clean.slice(2);
  }

  // Kiểm tra đầu số di động VN (10 số, bắt đầu bằng 03, 05, 07, 08, 09)
  const vnPhoneRegex = /^(0)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  if (!vnPhoneRegex.test(clean)) {
    return {
      valid: false,
      standardPhone: '',
      e164Phone: '',
      error: 'Số điện thoại không đúng định dạng di động Việt Nam (gồm 10 chữ số, đầu 03, 05, 07, 08, 09)',
    };
  }

  const e164 = '+84' + clean.slice(1);
  return {
    valid: true,
    standardPhone: clean,
    e164Phone: e164,
  };
}
