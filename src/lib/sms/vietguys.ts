import { ISmsProvider, SmsSendResult } from "./types"

/**
 * VietGuys Provider - Tích hợp cổng SMS Brandname của VietGuys
 */
export class VietGuysProvider implements ISmsProvider {
  name = "VietGuysProvider"

  private username: string
  private password: string
  private brandname: string

  constructor() {
    this.username = process.env.VIETGUYS_USERNAME || ""
    this.password = process.env.VIETGUYS_PASSWORD || ""
    this.brandname = process.env.VIETGUYS_BRANDNAME || "DATXETAI"
  }

  async sendOtp(phone: string, otp: string): Promise<SmsSendResult> {
    if (!this.username || !this.password) {
      console.warn(
        "[VietGuys] Thiếu VIETGUYS_USERNAME hoặc VIETGUYS_PASSWORD trong .env",
      )
      return {
        success: false,
        error: "Chưa cấu hình tài khoản VietGuys trên hệ thống",
      }
    }

    try {
      const content = `Ma xac thuc OTP cua ban la ${otp}. Hieu luc trong 5 phut. Khong chia se ma nay.`
      const url = "https://cloudsms.vietguys.biz:4438/api/index.php"

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          u: this.username,
          pwd: this.password,
          from: this.brandname,
          phone: phone,
          sms: content,
          json: "1",
        }).toString(),
      })

      const data = (await response.json()) as {
        error?: number
        message?: string
        log_id?: string
      }

      // VietGuys error = 0 là thành công
      if (data.error === 0) {
        return {
          success: true,
          messageId: data.log_id,
        }
      } else {
        console.error("[VietGuys Error]", data)
        return {
          success: false,
          error: data.message || `VietGuys trả về mã lỗi: ${data.error}`,
        }
      }
    } catch (error: any) {
      console.error("[VietGuys Network Error]", error)
      return {
        success: false,
        error: error.message || "Lỗi kết nối tới cổng VietGuys",
      }
    }
  }
}
