import { eq, and, desc, gt } from 'drizzle-orm';
import { db } from '../db';
import { users, wallets, otpVerifications } from '../db/schema';
import { validateAndNormalizePhone } from './sms/types';
import { getSmsProvider } from './sms';
import { generateToken } from './auth';

export interface RequestOtpResponse {
  success: boolean;
  message: string;
  phone: string;
  retryAfterSeconds?: number;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  token: string;
  isNewUser: boolean;
  user: {
    id: string;
    phone: string;
    fullName: string | null;
    role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
    avatarUrl: string | null;
  };
}

/**
 * Sinh mã OTP 6 chữ số ngẫu nhiên hoặc mã cố định trong môi trường Test/Dev
 */
export function generateOtpCode(): string {
  // Nếu bật chế độ Mock cố định (0đ khi test)
  if (process.env.ENABLE_OTP_MOCK === 'true' || (!process.env.SMS_PROVIDER && process.env.NODE_ENV !== 'production')) {
    return '123456';
  }

  // Tạo số ngẫu nhiên 6 chữ số từ 100000 đến 999999
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return randomNum.toString();
}

/**
 * 1. Yêu cầu gửi mã OTP tới số điện thoại (Có cơ chế Rate-limit & Mock)
 */
export async function requestOtp(rawPhone: string): Promise<RequestOtpResponse> {
  // Validate định dạng SĐT Việt Nam
  const phoneValidation = validateAndNormalizePhone(rawPhone);
  if (!phoneValidation.valid) {
    throw new Error(phoneValidation.error || 'Số điện thoại không hợp lệ');
  }

  const phone = phoneValidation.standardPhone;
  const now = new Date();

  // Kiểm tra Rate Limit 1: Không gửi quá 3 lần trong 10 phút gần nhất
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const recentOtps = await db
    .select()
    .from(otpVerifications)
    .where(and(eq(otpVerifications.phone, phone), gt(otpVerifications.createdAt, tenMinutesAgo)));

  if (recentOtps.length >= 3) {
    throw new Error('Bạn đã yêu cầu gửi mã quá 3 lần trong 10 phút. Vui lòng đợi thêm trước khi thử lại.');
  }

  // Kiểm tra Rate Limit 2: Khoảng cách giữa 2 lần gửi liên tiếp tối thiểu 60 giây (chống spam liên tục)
  if (recentOtps.length > 0) {
    // Sắp xếp lấy cái mới nhất
    const sorted = [...recentOtps].sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
    );
    const lastOtp = sorted[0];
    if (lastOtp.createdAt) {
      const elapsedSeconds = Math.floor((now.getTime() - lastOtp.createdAt.getTime()) / 1000);
      if (elapsedSeconds < 60) {
        const waitSeconds = 60 - elapsedSeconds;
        throw new Error(`Vui lòng đợi thêm ${waitSeconds} giây nữa để gửi lại mã OTP.`);
      }
    }
  }

  // Sinh mã OTP và thời gian hết hạn (5 phút)
  const otpCode = generateOtpCode();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  // Lưu bản ghi OTP vào DB
  await db.insert(otpVerifications).values({
    phone,
    otpCode,
    attempts: 0,
    isUsed: false,
    expiresAt,
  });

  // Gửi mã OTP qua SMS Gateway
  const smsProvider = getSmsProvider();
  const sendResult = await smsProvider.sendOtp(phone, otpCode);

  if (!sendResult.success) {
    console.error(`[OTP Error] Không thể gửi SMS tới ${phone}:`, sendResult.error);
    throw new Error(sendResult.error || 'Không thể gửi tin nhắn OTP. Vui lòng thử lại sau.');
  }

  return {
    success: true,
    message: 'Mã OTP xác thực đã được gửi thành công.',
    phone,
    retryAfterSeconds: 60,
  };
}

/**
 * 2. Xác thực mã OTP và tự động Đăng ký / Đăng nhập
 */
export async function verifyOtp(rawPhone: string, inputOtp: string): Promise<VerifyOtpResponse> {
  const phoneValidation = validateAndNormalizePhone(rawPhone);
  if (!phoneValidation.valid) {
    throw new Error(phoneValidation.error || 'Số điện thoại không hợp lệ');
  }

  const phone = phoneValidation.standardPhone;
  const cleanOtp = (inputOtp || '').trim();

  if (!cleanOtp) {
    throw new Error('Vui lòng nhập mã OTP');
  }

  const now = new Date();

  // Tìm mã OTP mới nhất chưa sử dụng của số điện thoại này
  const records = await db
    .select()
    .from(otpVerifications)
    .where(and(eq(otpVerifications.phone, phone), eq(otpVerifications.isUsed, false)))
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  if (records.length === 0) {
    throw new Error('Không tìm thấy yêu cầu OTP hoặc mã đã được sử dụng. Vui lòng bấm gửi lại mã.');
  }

  const otpRecord = records[0];

  // Kiểm tra hạn sử dụng
  if (otpRecord.expiresAt < now) {
    throw new Error('Mã OTP đã hết hạn (chỉ có hiệu lực trong 5 phút). Vui lòng yêu cầu mã mới.');
  }

  // Kiểm tra số lần nhập sai quá 5 lần (Brute-force protection)
  if (otpRecord.attempts >= 5) {
    throw new Error('Bạn đã nhập sai mã quá 5 lần. Mã này đã bị khóa vì lý do an toàn, vui lòng yêu cầu mã mới.');
  }

  // Kiểm tra tính chính xác của OTP
  if (cleanOtp !== otpRecord.otpCode) {
    const nextAttempts = otpRecord.attempts + 1;
    await db
      .update(otpVerifications)
      .set({ attempts: nextAttempts })
      .where(eq(otpVerifications.id, otpRecord.id));

    const remaining = 5 - nextAttempts;
    if (remaining > 0) {
      throw new Error(`Mã OTP không chính xác. Bạn còn ${remaining} lần thử lại.`);
    } else {
      throw new Error('Bạn đã nhập sai quá 5 lần. Mã OTP này đã bị vô hiệu hóa.');
    }
  }

  // Đánh dấu mã OTP đã được sử dụng thành công
  await db
    .update(otpVerifications)
    .set({ isUsed: true })
    .where(eq(otpVerifications.id, otpRecord.id));

  // Kiểm tra User đã có trong hệ thống chưa
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  let userRecord;
  let isNewUser = false;

  if (existingUsers.length === 0) {
    // Tự động tạo người dùng mới (Role: CUSTOMER, Status: ACTIVE)
    const insertedUsers = await db
      .insert(users)
      .values({
        phone,
        role: 'CUSTOMER',
        status: 'ACTIVE',
      })
      .returning();

    userRecord = insertedUsers[0];
    isNewUser = true;

    // Khởi tạo ví tiền rỗng cho khách hàng mới
    try {
      await db.insert(wallets).values({
        userId: userRecord.id,
        balance: '0',
        lockedBalance: '0',
        currency: 'VND',
      });
    } catch (walletErr) {
      console.warn('[Wallet Init Warning] Không thể tạo ví tự động:', walletErr);
    }
  } else {
    userRecord = existingUsers[0];

    // Kiểm tra tài khoản có bị khóa không
    if (userRecord.status === 'BLOCKED') {
      throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ bộ phận hỗ trợ khách hàng.');
    }
  }

  // Phát hành JWT Token
  const token = generateToken({
    userId: userRecord.id,
    role: userRecord.role,
    phone: userRecord.phone,
  });

  return {
    success: true,
    message: isNewUser ? 'Đăng ký tài khoản thành công!' : 'Đăng nhập thành công!',
    token,
    isNewUser,
    user: {
      id: userRecord.id,
      phone: userRecord.phone,
      fullName: userRecord.fullName,
      role: userRecord.role,
      avatarUrl: userRecord.avatarUrl,
    },
  };
}
