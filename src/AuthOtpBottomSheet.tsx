import { useEffect, useRef, useState } from "react"
import { syncUserProfileFromApi } from "./account"

type AuthOtpBottomSheetProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (token: string, phone: string) => void
}

export default function AuthOtpBottomSheet({
  isOpen,
  onClose,
  onSuccess,
}: AuthOtpBottomSheetProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [phone, setPhone] = useState("0988888888")
  const [otp, setOtp] = useState("123456")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(60)
  const [infoMsg, setInfoMsg] = useState("")

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const otpInputRef = useRef<HTMLInputElement>(null)

  // Auto focus input when opened or step changed
  useEffect(() => {
    if (!isOpen) {
      setStep("phone")
      setError("")
      setInfoMsg("")
      return
    }

    const timer = setTimeout(() => {
      if (step === "phone") {
        phoneInputRef.current?.focus()
      } else {
        otpInputRef.current?.focus()
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [isOpen, step])

  // Countdown timer for OTP
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    if (step === "otp" && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [step, countdown])

  if (!isOpen) return null

  const handleRequestOtp = async () => {
    const cleanPhone = phone.trim().replace(/\s+/g, "")
    if (!cleanPhone || cleanPhone.length < 9) {
      setError("Vui lòng nhập số điện thoại hợp lệ (tối thiểu 9 số)")
      return
    }

    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/v1/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.message || "Gửi mã OTP thất bại")
      }

      setStep("otp")
      setCountdown(60)
      setInfoMsg("Mã OTP đã gửi! Mã thử nghiệm miễn phí: 123456")
    } catch (err: any) {
      setError(err.message || "Không thể kết nối đến máy chủ gửi OTP")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim()
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError("Vui lòng nhập đủ 6 chữ số OTP")
      return
    }

    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim().replace(/\s+/g, ""),
          otp: cleanOtp,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.message || "Mã OTP không đúng hoặc đã hết hạn")
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token)
        localStorage.setItem("user_phone", data.user.phone)
      }

      // Tự động đồng bộ profile người dùng
      await syncUserProfileFromApi()

      onSuccess(data.token, data.user.phone)
    } catch (err: any) {
      setError(err.message || "Xác thực OTP thất bại")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{
        background: "rgba(15, 23, 42, 0.48)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Xác thực đăng nhập trước khi đặt xe"
    >
      <div
        className="w-full max-w-[420px] mx-auto overflow-hidden animate-slide-up"
        style={{
          borderRadius: "26px 26px 0 0",
          background:
            "radial-gradient(120% 60% at 15% -10%, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85) 60%), linear-gradient(180deg, #fffdfa 0%, #f7f4ec 100%)",
          border: "1px solid rgba(255, 255, 255, 0.85)",
          boxShadow: "0 -16px 40px -10px rgba(15, 23, 42, 0.35)",
          padding: "16px 20px 28px",
        }}
      >
        {/* Thanh kéo nhỏ phía trên */}
        <div
          style={{
            width: "40px",
            height: "4px",
            borderRadius: "2px",
            background: "#d5cfc2",
            margin: "0 auto 14px",
          }}
        />

        {/* Header của Modal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "12px",
                background: "var(--brand-50, #eaf5ff)",
                color: "var(--brand-600, #1478d4)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: "18px",
              }}
            >
              🚚
            </span>
            <div>
              <h2
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#17212b",
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                {step === "phone" ? "Xác thực số điện thoại" : "Nhập mã OTP"}
              </h2>
              <p
                style={{
                  fontSize: "11px",
                  color: "#697580",
                  margin: "2px 0 0",
                }}
              >
                {step === "phone"
                  ? "Tài xế sẽ liên hệ số này để nhận hàng"
                  : `Mã xác nhận 6 số đã gửi tới ${phone}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "none",
              background: "rgba(0, 0, 0, 0.06)",
              color: "#3e4a56",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: "15px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Thông báo lỗi */}
        {error && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: "12px",
              background: "#fee2e2",
              color: "#dc2626",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Thông báo hướng dẫn / Demo OTP */}
        {infoMsg && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: "12px",
              background: "#dcfce7",
              color: "#15803d",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>✅</span>
            <span>{infoMsg}</span>
          </div>
        )}

        {/* BƯỚC 1: NHẬP SỐ ĐIỆN THOẠI */}
        {step === "phone" && (
          <div>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "#697580",
                marginBottom: "6px",
              }}
            >
              Số điện thoại người gửi
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#fff",
                border: "1.5px solid #e2ddd3",
                borderRadius: "14px",
                padding: "2px 12px",
                boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.05)",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#17212b",
                  paddingRight: "10px",
                  borderRight: "1px solid #e9e4d9",
                  marginRight: "10px",
                }}
              >
                🇻🇳 +84
              </span>
              <input
                ref={phoneInputRef}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRequestOtp()
                }}
                placeholder="0988 888 888"
                style={{
                  width: "100%",
                  height: "44px",
                  border: "none",
                  outline: "none",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#17212b",
                  background: "transparent",
                }}
              />
            </div>

            <p
              style={{
                fontSize: "11px",
                color: "#94a0aa",
                marginBottom: "16px",
              }}
            >
              💡 Gợi ý thử nghiệm: Bấm &quot;Gửi mã OTP&quot; với số mặc định để nhận mã test <strong>123456</strong>.
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={handleRequestOtp}
              className="primary-button"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "14px",
                fontSize: "14px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span>Đang gửi mã...</span>
              ) : (
                <>
                  <span>Gửi mã OTP</span>
                  <span style={{ fontSize: "16px" }}>➔</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* BƯỚC 2: NHẬP MÃ OTP */}
        {step === "otp" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#697580",
                }}
              >
                Mã xác nhận 6 số
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep("phone")
                  setError("")
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--brand-600, #1478d4)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Đổi số điện thoại
              </button>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1.5px solid #e2ddd3",
                borderRadius: "14px",
                padding: "2px 14px",
                boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.05)",
                marginBottom: "8px",
              }}
            >
              <input
                ref={otpInputRef}
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerifyOtp()
                }}
                placeholder="123456"
                style={{
                  width: "100%",
                  height: "44px",
                  border: "none",
                  outline: "none",
                  fontSize: "20px",
                  fontWeight: 700,
                  letterSpacing: "6px",
                  textAlign: "center",
                  color: "#17212b",
                  background: "transparent",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                fontSize: "11px",
                color: "#697580",
              }}
            >
              <span>Mã dùng thử: <strong>123456</strong></span>
              {countdown > 0 ? (
                <span>Gửi lại sau {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--brand-600, #1478d4)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Gửi lại mã
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleVerifyOtp}
              className="primary-button"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "14px",
                fontSize: "14px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span>Đang xác thực...</span>
              ) : (
                <>
                  <span>Xác nhận &amp; Tiếp tục tìm xe</span>
                  <span style={{ fontSize: "16px" }}>✓</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
