import jwt from "jsonwebtoken"

// Mật khẩu bí mật để ký JWT. Bắt buộc cấu hình trong .env ở môi trường production.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim()
  if (secret) return secret
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: JWT_SECRET chưa được cấu hình trong biến môi trường (.env) cho production",
    )
  }
  return "super-secret-key-for-truck-booking-app"
}

const JWT_EXPIRES_IN = "7d" // Token có hạn 7 ngày

export interface JwtPayload {
  userId: string

  role: "CUSTOMER" | "DRIVER" | "ADMIN"

  phone: string
}

/**
 * Tạo JWT Token khi user đăng nhập thành công
 */

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN })
}

/**
 * Xác thực JWT Token, trả về payload nếu hợp lệ, quăng lỗi nếu token sai/hết hạn
 */

export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload

    return decoded
  } catch (error) {
    throw new Error("Token không hợp lệ hoặc đã hết hạn")
  }
}
