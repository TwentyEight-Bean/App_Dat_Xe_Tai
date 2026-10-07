import jwt from 'jsonwebtoken';

// Mật khẩu bí mật để ký JWT. Trong thực tế, chuỗi này phải được cấu hình trong file .env
// Ví dụ: process.env.JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-truck-booking-app';
const JWT_EXPIRES_IN = '7d'; // Token có hạn 7 ngày

export interface JwtPayload {
  userId: string;
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  phone: string;
}

/**
 * Tạo JWT Token khi user đăng nhập thành công
 */
export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Xác thực JWT Token, trả về payload nếu hợp lệ, quăng lỗi nếu token sai/hết hạn
 */
export const verifyToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error('Token không hợp lệ hoặc đã hết hạn');
  }
};
