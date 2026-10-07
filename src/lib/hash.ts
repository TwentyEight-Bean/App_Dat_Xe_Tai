import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Mã hóa mật khẩu (Hash password)
 * @param password Mật khẩu gốc dạng text
 * @returns Mật khẩu đã được mã hóa
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Kiểm tra mật khẩu (Verify password)
 * @param password Mật khẩu gốc do user nhập vào lúc đăng nhập
 * @param hashedPassword Mật khẩu đã mã hóa lưu trong Database
 * @returns true nếu trùng khớp, false nếu sai
 */
export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};
