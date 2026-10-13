import { useState, useRef, useEffect } from "react"

type DriverAuthGateProps = {
  onSuccess: (token: string, user: any) => void
  onBackToCustomer?: () => void
}

export default function DriverAuthGate({
  onSuccess,
  onBackToCustomer,
}: DriverAuthGateProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [phone, setPhone] = useState("0908815624")
  const [otp, setOtp] = useState("123456")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(60)
  const [infoMsg, setInfoMsg] = useState("")

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const otpInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === "phone") {
        phoneInputRef.current?.focus()
      } else {
        otpInputRef.current?.focus()
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [step])

  useEffect(() => {
    let timer: any
    if (step === "otp" && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [step, countdown])

  const handleRequestOtp = async () => {
    const cleanPhone = phone.trim().replace(/\s+/g, "")
    if (!cleanPhone || cleanPhone.length < 9) {
      setError("Vui lòng nhập số điện thoại đối tác hợp lệ (tối thiểu 9 số)")
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
      setInfoMsg("Mã OTP đã gửi! Mã thử nghiệm: 123456")
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
          role: "DRIVER",
        }),
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message || "Xác thực mã OTP thất bại")
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("driver_auth_token", data.token)
        localStorage.setItem("driver_phone", data.user.phone)
      }

      onSuccess(data.token, data.user)
    } catch (err: any) {
      setError(err.message || "Xác thực OTP không thành công")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #0e1726 0%, #172338 100%)",
        color: "#fff",
        padding: "24px 20px",
        justifyContent: "space-between",
      }}
    >
      {/* Top Header */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                display: "grid",
                placeItems: "center",
                fontSize: "20px",
                boxShadow: "0 4px 14px rgba(245, 158, 11, 0.4)",
              }}
            >
              🚚
            </span>
            <div>
              <strong style={{ fontSize: "16px", letterSpacing: "-0.01em" }}>
                FastDrop Driver
              </strong>
              <small style={{ display: "block", color: "#94a3b8", fontSize: "11px" }}>
                Cổng Đối Tác Tài Xế Xe Tải
              </small>
            </div>
          </div>

          {onBackToCustomer && (
            <button
              type="button"
              onClick={onBackToCustomer}
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#cbd5e1",
                padding: "6px 12px",
                borderRadius: "10px",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              ← Về Khách hàng
            </button>
          )}
        </div>

        {/* Hero Title */}
        <div style={{ marginBottom: "28px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "12px",
              background: "rgba(245, 158, 11, 0.18)",
              color: "#fbbf24",
              fontSize: "11px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#f59e0b",
              }}
            />
            Đăng nhập phân quyền Role: DRIVER
          </span>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              lineHeight: 1.25,
              margin: 0,
              color: "#f8fafc",
            }}
          >
            {step === "phone"
              ? "Bắt đầu nhận cuốc xe ngay hôm nay"
              : "Xác thực mã OTP Đối tác"}
          </h1>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "13px",
              margin: "8px 0 0",
              lineHeight: 1.4,
            }}
          >
            {step === "phone"
              ? "Nhập số điện thoại đối tác đã đăng ký hoặc số mới để tự động liên kết hồ sơ xe."
              : `Mã xác nhận 6 số đã được gửi tới số điện thoại ${phone}.`}
          </p>
        </div>

        {/* Thông báo lỗi */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.18)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#fca5a5",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Thông báo mã test */}
        {infoMsg && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              background: "rgba(34, 197, 94, 0.16)",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              color: "#86efac",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>✅</span>
            <span>{infoMsg}</span>
          </div>
        )}

        {/* STEP 1: NHẬP SĐT */}
        {step === "phone" && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "20px",
              padding: "20px 16px",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Số điện thoại Tài xế
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.7)",
                border: "1.5px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "14px",
                padding: "2px 14px",
                marginBottom: "12px",
              }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#cbd5e1",
                  paddingRight: "10px",
                  borderRight: "1px solid rgba(255, 255, 255, 0.15)",
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
                placeholder="09xx xxx xxx"
                style={{
                  width: "100%",
                  height: "46px",
                  border: "none",
                  outline: "none",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#fff",
                  background: "transparent",
                }}
              />
            </div>

            <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 18px" }}>
              💡 Gợi ý thử nghiệm: Bấm &quot;Tiếp tục&quot; với số <strong>{phone}</strong> để nhận mã OTP test <strong>123456</strong>.
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={handleRequestOtp}
              style={{
                width: "100%",
                height: "50px",
                borderRadius: "14px",
                border: "none",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                color: "#111827",
                fontSize: "15px",
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 4px 18px rgba(245, 158, 11, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? (
                <span>Đang gửi mã...</span>
              ) : (
                <>
                  <span>TIẾP TỤC</span>
                  <span style={{ fontSize: "18px" }}>➔</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 2: NHẬP OTP */}
        {step === "otp" && (
          <div
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "20px",
              padding: "20px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
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
                  color: "#fbbf24",
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
                background: "rgba(15, 23, 42, 0.7)",
                border: "1.5px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "14px",
                padding: "2px 14px",
                marginBottom: "10px",
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
                  height: "48px",
                  border: "none",
                  outline: "none",
                  fontSize: "22px",
                  fontWeight: 700,
                  letterSpacing: "8px",
                  textAlign: "center",
                  color: "#f8fafc",
                  background: "transparent",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
                fontSize: "11px",
                color: "#94a3b8",
              }}
            >
              <span>Mã dùng thử: <strong style={{ color: "#fbbf24" }}>123456</strong></span>
              {countdown > 0 ? (
                <span>Gửi lại sau {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#fbbf24",
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
              style={{
                width: "100%",
                height: "50px",
                borderRadius: "14px",
                border: "none",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                color: "#111827",
                fontSize: "15px",
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 4px 18px rgba(245, 158, 11, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {loading ? (
                <span>Đang xác thực...</span>
              ) : (
                <>
                  <span>ĐĂNG NHẬP NHẬN CUỐC</span>
                  <span style={{ fontSize: "18px" }}>✓</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div style={{ textAlign: "center", paddingTop: "24px" }}>
        <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>
          Hỗ trợ đối tác 24/7: <strong>1900 1234</strong> · FastDrop Logistics Vietnam
        </p>
      </div>
    </div>
  )
}
