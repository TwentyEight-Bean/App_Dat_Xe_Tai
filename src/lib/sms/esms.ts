import { ISmsProvider, SmsSendResult } from "./types"

/**
 * eSMS Provider - Tích hợp dịch vụ SMS Brandname / OTP của eSMS.vn
 */
export class EsmsProvider implements ISmsProvider {
  name = "EsmsProvider"

  private apiKey: string
  private secretKey: string
  private brandname: string

  constructor() {
    this.apiKey = process.env.ESMS_API_KEY || ""
    this.secretKey = process.env.ESMS_SECRET_KEY || ""
    this.brandname = process.env.ESMS_BRANDNAME || "Baotam"
  }

  async sendOtp(phone: string, otp: string): Promise<SmsSendResult> {
    if (!this.apiKey || !this.secretKey) {
      console.warn("[eSMS] Thiếu ESMS_API_KEY hoặc ESMS_SECRET_KEY trong .env")
      return {
        success: false,
        error: "Chưa cấu hình tài khoản eSMS trên hệ thống",
      }
    }

    try {
      const content = `Ma xac thuc OTP cua ban la ${otp}. Ma co hieu luc trong 5 phut. Khong chia se ma nay cho bat ky ai.`
      const url =
        "http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json"

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ApiKey: this.apiKey,
          SecretKey: this.secretKey,
          Phone: phone,
          Content: content,
          SmsType: "2", // 2: Tin nhắn Brandname CSKH / OTP
          Brandname: this.brandname,
          IsUnicode: "0",
          Sandbox: process.env.NODE_ENV === "production" ? "0" : "1",
        }),
      })

      const data = (await response.json()) as {
        CodeResult?: string
        CountRegenerate?: number
        SMSID?: string
        ErrorMessage?: string
      }

      // Mã 100 nghĩa là eSMS gửi tin thành công
      if (data.CodeResult === "100") {
        return {
          success: true,
          messageId: data.SMSID,
        }
      } else {
        console.error("[eSMS Error]", data)
        return {
          success: false,
          error: data.ErrorMessage || `eSMS trả về mã lỗi: ${data.CodeResult}`,
        }
      }
    } catch (error: any) {
      console.error("[eSMS Network Error]", error)
      return {
        success: false,
        error: error.message || "Lỗi kết nối tới cổng eSMS",
      }
    }
  }
}
