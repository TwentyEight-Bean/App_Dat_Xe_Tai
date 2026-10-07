import { verifyToken, JwtPayload } from '../lib/auth';

/**
 * Hàm hỗ trợ lấy Token từ Header của Request
 * Dành cho các framework HTTP (Express, Hono, Next.js, v.v.)
 */
export const extractTokenFromHeader = (authHeader?: string | null): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
};

/**
 * Hàm kiểm tra xác thực (Authentication)
 * @param authHeader Chuỗi header Authorization (VD: "Bearer eyJhbGci...")
 * @returns JwtPayload chứa thông tin user nếu hợp lệ, quăng lỗi nếu thất bại
 */
export const authenticate = (authHeader?: string | null): JwtPayload => {
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    throw new Error('UNAUTHORIZED: Không tìm thấy Token xác thực (Missing Bearer Token)');
  }
  return verifyToken(token);
};

/**
 * Hàm phân quyền (Authorization / Role-based Access Control)
 * @param payload Dữ liệu payload lấy được sau khi authenticate()
 * @param allowedRoles Mảng các Role được phép truy cập API này
 */
export const authorizeRoles = (payload: JwtPayload, allowedRoles: Array<'CUSTOMER' | 'DRIVER' | 'ADMIN'>) => {
  if (!allowedRoles.includes(payload.role)) {
    throw new Error(`FORBIDDEN: Quyền truy cập bị từ chối. API này chỉ dành cho: ${allowedRoles.join(', ')}`);
  }
};
