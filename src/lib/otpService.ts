import { eq, and, desc, gt } from "drizzle-orm"
import { db } from "../db"
import { users, otpVerifications, driverProfiles } from "../db/schema"
import { validateAndNormalizePhone } from "./sms/types"
import { getSmsProvider } from "./sms"
import { generateToken } from "./auth"
import { checkVietnamIp } from "./geoIp"

export interface RequestOtpResponse {
  success: boolean
  message: string
  phone: string
  retryAfterSeconds?: number
  devOtp?: string
}

export interface VerifyOtpResponse {
  success: boolean
  message: string
  token: string
  isNewUser: boolean
  user: {
    id: string
    phone: string
    fullName: string | null
    role: "CUSTOMER" | "DRIVER" | "ADMIN"
    avatarUrl: string | null
  }
}

/**
 * Sinh mã OTP 6 chữ số ngẫu nhiên hoặc mã cố định trong môi trường Test/Dev
 */
export function generateOtpCode(): string {
  // Nếu bật chế độ Mock cố định (0đ khi test)
  if (
    process.env.ENABLE_OTP_MOCK === "true" ||
    (!process.env.SMS_PROVIDER && process.env.NODE_ENV !== "production")
  ) {
    return "123456"
  }

  // Tạo số ngẫu nhiên 6 chữ số từ 100000 đến 999999
  const randomNum = Math.floor(100000 + Math.random() * 900000)
  return randomNum.toString()
}

/**
 * 1. Yêu cầu gửi mã OTP tới số điện thoại (Hệ thống chống Spam 3 tầng: Geo-IP, IP, và SĐT)
 */
export async function requestOtp(
  rawPhone: string,
  clientIp?: string,
  options?: {
    forceStrictGeoIp?: boolean
    purpose?: "register" | "login" | "reset"
  },
): Promise<RequestOtpResponse> {
  // Validate định dạng SĐT Việt Nam
  const phoneValidation = validateAndNormalizePhone(rawPhone)
  if (!phoneValidation.valid) {
    throw new Error(phoneValidation.error || "Số điện thoại không hợp lệ")
  }

  const phone = phoneValidation.standardPhone
  const now = new Date()

  // Chống đăng ký trùng SĐT: Nếu purpose === 'register', kiểm tra xem SĐT đã có tài khoản chưa
  if (options?.purpose === "register") {
    const [existing] = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1)

    if (existing && existing.passwordHash) {
      throw new Error(
        "Số điện thoại này đã được đăng ký tài khoản. Vui lòng chuyển sang tab Đăng nhập.",
      )
    }
  }

  // ------------------------------------------------------------------------
  // TẦNG 1: KIỂM TRA GEO-IP QUỐC TẾ (CHỈ PHỤC VỤ NỘI ĐỊA VIỆT NAM)
  // ------------------------------------------------------------------------
  if (clientIp) {
    const geoCheck = checkVietnamIp(clientIp, {
      forceStrictCheck: options?.forceStrictGeoIp,
    })
    if (!geoCheck.allowed) {
      throw new Error(
        "FORBIDDEN: Dịch vụ chỉ phục vụ tại Việt Nam. Không hỗ trợ gửi OTP từ địa chỉ IP quốc tế.",
      )
    }
  }

  // ------------------------------------------------------------------------
  // TẦNG 2: GIỚI HẠN IP MẠNG (TỐI ĐA 3 SĐT DUY NHẤT TRONG 15 PHÚT)
  // Ngăn chặn bot cắm tool spam hàng loạt số khác nhau từ 1 máy / IP
  // ------------------------------------------------------------------------
  if (clientIp) {
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
    const recentIpOtps = await db
      .select({ phone: otpVerifications.phone })
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.ipAddress, clientIp),
          gt(otpVerifications.createdAt, fifteenMinutesAgo),
        ),
      )

    const uniquePhonesForIp = new Set(recentIpOtps.map((r) => r.phone))
    // Nếu IP này đã gửi cho 3 số điện thoại khác nhau trong 15p, và số hiện tại là số thứ 4
    if (uniquePhonesForIp.size >= 3 && !uniquePhonesForIp.has(phone)) {
      throw new Error(
        "Địa chỉ mạng của bạn đang yêu cầu mã OTP cho quá nhiều số điện thoại. Vui lòng thử lại sau 15 phút.",
      )
    }
  }

  // ------------------------------------------------------------------------
  // TẦNG 3: GIỚI HẠN THEO SỐ ĐIỆN THOẠI (COOLDOWN + 10 PHÚT + CẦU DAO 24 GIỜ)
  // ------------------------------------------------------------------------
  // 3.1. Cầu dao 24 giờ: Tối đa 5 lần gửi / 24 giờ cho 1 số điện thoại (Bảo vệ ngân sách SMS)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const dailyOtps = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phone, phone),
        gt(otpVerifications.createdAt, twentyFourHoursAgo),
      ),
    )

  if (dailyOtps.length >= 5) {
    throw new Error(
      "Số điện thoại này đã đạt giới hạn 5 lần nhận mã OTP trong 24 giờ. Vui lòng thử lại vào ngày mai để đảm bảo an toàn.",
    )
  }

  // 3.2. Giới hạn ngắn hạn: Không gửi quá 3 lần trong 10 phút gần nhất
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)
  const recentOtps = dailyOtps.filter(
    (otp) => otp.createdAt && otp.createdAt > tenMinutesAgo,
  )

  if (recentOtps.length >= 3) {
    throw new Error(
      "Bạn đã yêu cầu gửi mã quá 3 lần trong 10 phút. Vui lòng đợi thêm trước khi thử lại.",
    )
  }

  // 3.3. Cooldown liên tiếp: Tối thiểu 60 giây giữa 2 lần gửi
  if (recentOtps.length > 0) {
    const sorted = [...recentOtps].sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
    )
    const lastOtp = sorted[0]
    if (lastOtp.createdAt) {
      const elapsedSeconds = Math.floor(
        (now.getTime() - lastOtp.createdAt.getTime()) / 1000,
      )
      if (elapsedSeconds < 60) {
        const waitSeconds = 60 - elapsedSeconds
        throw new Error(
          `Vui lòng đợi thêm ${waitSeconds} giây nữa để gửi lại mã OTP.`,
        )
      }
    }
  }

  // Sinh mã OTP và thời gian hết hạn (5 phút)
  const otpCode = generateOtpCode()
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000)

  // Task 1.3: Gửi mã OTP qua SMS Gateway TRƯỚC khi ghi nhận vào DB
  const smsProvider = getSmsProvider()
  const sendResult = await smsProvider.sendOtp(phone, otpCode)

  if (!sendResult.success) {
    console.error(
      `[OTP Error] Không thể gửi SMS tới ${phone}:`,
      sendResult.error,
    )
    throw new Error(
      sendResult.error || "Không thể gửi tin nhắn OTP. Vui lòng thử lại sau.",
    )
  }

  // Chỉ khi gửi SMS thành công mới lưu bản ghi OTP vào DB (bao gồm ipAddress)
  await db.insert(otpVerifications).values({
    phone,
    otpCode,
    attempts: 0,
    isUsed: false,
    expiresAt,
    ipAddress: clientIp || null,
  })

  const isDevOrMock =
    process.env.ENABLE_OTP_MOCK === "true" ||
    (process.env.SMS_PROVIDER || "mock").toLowerCase() === "mock" ||
    process.env.NODE_ENV !== "production"

  return {
    success: true,
    message: "Mã OTP xác thực đã được gửi thành công.",
    phone,
    retryAfterSeconds: 60,
    ...(isDevOrMock ? { devOtp: otpCode } : {}),
  }
}

/**
 * 2. Xác thực tính hợp lệ của mã OTP (kiểm tra hạn dùng, brute-force protection, đánh dấu đã dùng)
 */
export async function verifyOtpCodeOnly(
  rawPhone: string,
  inputOtp: string,
): Promise<{ phone: string }> {
  const phoneValidation = validateAndNormalizePhone(rawPhone)
  if (!phoneValidation.valid) {
    throw new Error(phoneValidation.error || "Số điện thoại không hợp lệ")
  }

  const phone = phoneValidation.standardPhone
  const cleanOtp = (inputOtp || "").trim()

  if (!cleanOtp) {
    throw new Error("Vui lòng nhập mã OTP 6 chữ số")
  }

  const now = new Date()

  // Tìm mã OTP mới nhất chưa sử dụng của số điện thoại này
  const records = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phone, phone),
        eq(otpVerifications.isUsed, false),
      ),
    )
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1)

  if (records.length === 0) {
    throw new Error(
      "Không tìm thấy yêu cầu OTP hoặc mã đã được sử dụng. Vui lòng bấm gửi lại mã.",
    )
  }

  const otpRecord = records[0]

  // Kiểm tra hạn sử dụng (5 phút)
  if (otpRecord.expiresAt < now) {
    throw new Error(
      "Mã OTP đã hết hạn (chỉ có hiệu lực trong 5 phút). Vui lòng yêu cầu mã mới.",
    )
  }

  // Kiểm tra số lần nhập sai quá 5 lần (Brute-force protection)
  if (otpRecord.attempts >= 5) {
    throw new Error(
      "Bạn đã nhập sai mã quá 5 lần. Mã này đã bị khóa vì lý do an toàn, vui lòng yêu cầu mã mới.",
    )
  }

  // Kiểm tra tính chính xác của OTP
  if (cleanOtp !== otpRecord.otpCode) {
    const nextAttempts = otpRecord.attempts + 1
    await db
      .update(otpVerifications)
      .set({ attempts: nextAttempts })
      .where(eq(otpVerifications.id, otpRecord.id))

    const remaining = 5 - nextAttempts
    if (remaining > 0) {
      throw new Error(
        `Mã OTP không chính xác. Bạn còn ${remaining} lần thử lại.`,
      )
    } else {
      throw new Error(
        "Bạn đã nhập sai quá 5 lần. Mã OTP này đã bị vô hiệu hóa.",
      )
    }
  }

  // Đánh dấu mã OTP đã được sử dụng thành công
  await db
    .update(otpVerifications)
    .set({ isUsed: true })
    .where(eq(otpVerifications.id, otpRecord.id))

  return { phone }
}

/**
 * 3. Xác thực mã OTP và tự động Đăng ký / Đăng nhập
 */
export async function verifyOtp(
  rawPhone: string,
  inputOtp: string,
  desiredRole?: "CUSTOMER" | "DRIVER",
  fullName?: string,
): Promise<VerifyOtpResponse> {
  const { phone } = await verifyOtpCodeOnly(rawPhone, inputOtp)

  // Kiểm tra User đã có trong hệ thống chưa
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)

  let userRecord
  let isNewUser = false
  const targetRole = desiredRole === "DRIVER" ? "DRIVER" : "CUSTOMER"

  if (existingUsers.length === 0) {
    // Tự động tạo người dùng mới
    const insertedUsers = await db
      .insert(users)
      .values({
        phone,
        fullName: fullName?.trim() || null,
        role: targetRole,
        status: "ACTIVE",
      })
      .returning()

    userRecord = insertedUsers[0]
    isNewUser = true
  } else {
    userRecord = existingUsers[0]

    // Cập nhật fullName nếu tài khoản chưa có tên mà lần này người dùng nhập
    if (fullName?.trim() && !userRecord.fullName) {
      const [updated] = await db
        .update(users)
        .set({ fullName: fullName.trim(), updatedAt: new Date() })
        .where(eq(users.id, userRecord.id))
        .returning()
      if (updated) userRecord = updated
    }

    // Kiểm tra tài khoản có bị khóa không
    if (userRecord.status === "BLOCKED") {
      throw new Error(
        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ bộ phận hỗ trợ khách hàng.",
      )
    }

    // Nếu đăng nhập từ phía Tài xế và user hiện tại có role CUSTOMER, nâng cấp lên DRIVER
    if (desiredRole === "DRIVER" && userRecord.role === "CUSTOMER") {
      await db
        .update(users)
        .set({ role: "DRIVER", updatedAt: new Date() })
        .where(eq(users.id, userRecord.id))
      userRecord.role = "DRIVER"
    }
  }

  // Nếu người dùng có quyền DRIVER, đảm bảo có bản ghi hồ sơ driverProfiles
  if (userRecord.role === "DRIVER") {
    const existingProfiles = await db
      .select()
      .from(driverProfiles)
      .where(eq(driverProfiles.userId, userRecord.id))
      .limit(1)

    if (existingProfiles.length === 0) {
      await db.insert(driverProfiles).values({
        userId: userRecord.id,
        kycStatus: "PENDING",
        isOnline: false,
        isActive: true,
      })
    }
  }

  // Phát hành JWT Token
  const token = generateToken({
    userId: userRecord.id,
    role: userRecord.role,
    phone: userRecord.phone,
  })

  return {
    success: true,
    message: isNewUser
      ? "Đăng ký tài khoản thành công!"
      : "Đăng nhập thành công!",
    token,
    isNewUser,
    user: {
      id: userRecord.id,
      phone: userRecord.phone,
      fullName: userRecord.fullName,
      role: userRecord.role,
      avatarUrl: userRecord.avatarUrl,
    },
  }
}
