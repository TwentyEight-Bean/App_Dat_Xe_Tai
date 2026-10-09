import { ISmsProvider, SmsSendResult } from './types';

/**
 * Mock SMS Provider dành cho môi trường Development và Test (0 VNĐ).
 * In trực tiếp mã OTP ra console server để lập trình viên và QA kiểm thử ngay lập tức.
 */
export class MockSmsProvider implements ISmsProvider {
  name = 'MockSmsProvider';

  async sendOtp(phone: string, otp: string): Promise<SmsSendResult> {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    console.log('\n================== [MOCK SMS OTP GATEWAY] ==================');
    console.log(`⏰ Thời gian: ${timestamp}`);
    console.log(`📱 Người nhận (SĐT): ${phone}`);
    console.log(`🔑 Mã OTP xác thực: [ ${otp} ]`);
    console.log(`💬 Nội dung: [DATXETAI] Ma xac thuc OTP cua ban la ${otp}. Hieu luc trong 5 phut.`);
    console.log('============================================================\n');

    return {
      success: true,
      messageId: `mock-msg-${Date.now()}`,
    };
  }
}
