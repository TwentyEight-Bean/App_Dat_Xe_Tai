import { useEffect, useRef, useState } from "react"
import { syncUserProfileFromApi } from "./account"
import useCustomerDialog from "./customerDialog"

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
  const [mode, setMode] = useState<"login" | "register">("login")
  const [phone, setPhone] = useState("0988888888")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("123456")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [infoMsg, setInfoMsg] = useState("")

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const dialogRef = useCustomerDialog(isOpen, onClose)

  useEffect(() => {
    if (!isOpen) {
      requestRef.current?.abort()
      pending.current = false
      setLoading(false)
      setError("")
      setInfoMsg("")
    }
    return () => requestRef.current?.abort()
  }, [isOpen])

  // Focus input when modal opens or mode changes
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      if (mode === "register" && !fullName) {
        nameInputRef.current?.focus()
      } else {
        phoneInputRef.current?.focus()
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [isOpen, mode])

  if (!isOpen) return null

  const handleLogin = async () => {
    if (pending.current) return

    const cleanPhone = phone.trim().replace(/\s+/g, "")
    if (!cleanPhone || cleanPhone.length < 9) {
      setError("Vui lòng nhập số điện thoại hợp lệ (tối thiểu 9 số)")
      return
    }

    if (!password || password.trim().length < 6) {
      setError("Vui lòng nhập mật khẩu hoặc mã PIN (tối thiểu 6 ký tự)")
      return
    }

    setError("")
    setLoading(true)
    pending.current = true
    const request = new AbortController()
    requestRef.current = request

    try {
      const res = await fetch("/api/v1/auth/login", {
        signal: request.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          password: password.trim(),
          role: "CUSTOMER",
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success || !data.token || !data.user?.phone) {
        if (res.status === 404) {
          setError("Số điện thoại chưa đăng ký. Hãy bấm 'Đăng ký mới' bên dưới để tạo tài khoản.")
        } else {
          setError(data.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại mật khẩu.")
        }
        return
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token)
        localStorage.setItem("user_phone", data.user.phone)
        window.dispatchEvent(new Event("customer-auth-changed"))
      }

      await syncUserProfileFromApi()

      if (request.signal.aborted || localStorage.getItem("auth_token") !== data.token) {
        return
      }

      onSuccess(data.token, data.user.phone)
    } catch (err: any) {
      if (request.signal.aborted) return
      setError(err.message || "Không thể kết nối đến máy chủ đăng nhập")
    } finally {
      if (!request.signal.aborted) {
        setLoading(false)
        pending.current = false
      }
    }
  }

  const handleRegister = async () => {
    if (pending.current) return

    const cleanPhone = phone.trim().replace(/\s+/g, "")
    if (!cleanPhone || cleanPhone.length < 9) {
      setError("Vui lòng nhập số điện thoại hợp lệ (tối thiểu 9 số)")
      return
    }

    if (!password || password.trim().length < 6) {
      setError("Vui lòng tạo mật khẩu hoặc mã PIN tối thiểu 6 ký tự")
      return
    }

    setError("")
    setLoading(true)
    pending.current = true
    const request = new AbortController()
    requestRef.current = request

    try {
      const res = await fetch("/api/v1/auth/register", {
        signal: request.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          fullName: fullName.trim() || undefined,
          password: password.trim(),
          role: "CUSTOMER",
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success || !data.token || !data.user?.phone) {
        if (res.status === 409) {
          setError("Số điện thoại đã tồn tại. Vui lòng chuyển sang tab Đăng nhập.")
        } else {
          setError(data.message || "Đăng ký tài khoản không thành công")
        }
        return
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token)
        localStorage.setItem("user_phone", data.user.phone)
        window.dispatchEvent(new Event("customer-auth-changed"))
      }

      await syncUserProfileFromApi()

      if (request.signal.aborted || localStorage.getItem("auth_token") !== data.token) {
        return
      }

      onSuccess(data.token, data.user.phone)
    } catch (err: any) {
      if (request.signal.aborted) return
      setError(err.message || "Không thể kết nối đến máy chủ đăng ký")
    } finally {
      if (!request.signal.aborted) {
        setLoading(false)
        pending.current = false
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "login") {
      handleLogin()
    } else {
      handleRegister()
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="customer-modal fixed inset-0 flex flex-col justify-end"
      style={{
        background: "rgba(15, 23, 42, 0.48)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Xác thực tài khoản trước khi đặt xe"
    >
      <div
        className="w-full max-w-[420px] mx-auto overflow-hidden animate-slide-up"
        style={{
          borderRadius: "26px 26px 0 0",
          background:
            "radial-gradient(120% 60% at 15% -10%, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.92) 60%), linear-gradient(180deg, #fffdfa 0%, #f7f4ec 100%)",
          border: "1px solid rgba(255, 255, 255, 0.85)",
          boxShadow: "0 -16px 40px -10px rgba(15, 23, 42, 0.35)",
          padding: "16px 20px 28px",
          maxHeight: "calc(100dvh - 16px)",
          overflowY: "auto",
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

        {/* Header Modal */}
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
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                background: "var(--brand-50, #eaf5ff)",
                color: "var(--brand-600, #1478d4)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: "20px",
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
                {mode === "login" ? "Đăng nhập đặt xe" : "Đăng ký tài khoản"}
              </h2>
              <p
                style={{
                  fontSize: "11px",
                  color: "#697580",
                  margin: "2px 0 0",
                }}
              >
                {mode === "login"
                  ? "Nhập số điện thoại & mật khẩu để tiếp tục"
                  : "Tạo tài khoản nhanh miễn phí 0đ"}
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

        {/* Mode Selector Tabs (Đăng nhập / Đăng ký) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#ebe7dd",
            padding: "3px",
            borderRadius: "14px",
            marginBottom: "16px",
            gap: "4px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login")
              setError("")
              setInfoMsg("")
            }}
            style={{
              padding: "8px 12px",
              borderRadius: "11px",
              border: "none",
              background: mode === "login" ? "#ffffff" : "transparent",
              color: mode === "login" ? "#17212b" : "#697580",
              fontWeight: mode === "login" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: mode === "login" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register")
              setError("")
              setInfoMsg("")
            }}
            style={{
              padding: "8px 12px",
              borderRadius: "11px",
              border: "none",
              background: mode === "register" ? "#ffffff" : "transparent",
              color: mode === "register" ? "#17212b" : "#697580",
              fontWeight: mode === "register" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: mode === "register" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Đăng ký mới
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
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span style={{ flex: 1 }}>{error}</span>
            {error.includes("Đăng ký mới") && mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("register")
                  setError("")
                }}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Đăng ký
              </button>
            )}
            {error.includes("Đăng nhập") && mode === "register" && (
              <button
                type="button"
                onClick={() => {
                  setMode("login")
                  setError("")
                }}
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Đăng nhập
              </button>
            )}
          </div>
        )}

        {/* Thông báo hướng dẫn */}
        {infoMsg && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: "12px",
              background: "#dcfce7",
              color: "#15803d",
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>✅</span>
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Form Đăng nhập / Đăng ký */}
        <form onSubmit={handleSubmit}>
          {/* Tên người dùng (chỉ hiển thị khi Đăng ký) */}
          {mode === "register" && (
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#697580",
                  marginBottom: "5px",
                }}
              >
                Họ và tên của bạn
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#fff",
                  border: "1.5px solid #e2ddd3",
                  borderRadius: "14px",
                  padding: "2px 14px",
                  boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.05)",
                }}
              >
                <input
                  ref={nameInputRef}
                  type="text"
                  disabled={loading}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  style={{
                    width: "100%",
                    height: "44px",
                    border: "none",
                    outline: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#17212b",
                    background: "transparent",
                  }}
                />
              </div>
            </div>
          )}

          {/* Số điện thoại */}
          <div style={{ marginBottom: "12px" }}>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "#697580",
                marginBottom: "5px",
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
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
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
                aria-label="Số điện thoại người gửi"
                autoComplete="tel"
                inputMode="tel"
                disabled={loading}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
          </div>

          {/* Mật khẩu hoặc Mã PIN */}
          <div style={{ marginBottom: "16px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "5px",
              }}
            >
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#697580",
                }}
              >
                {mode === "login" ? "Mật khẩu / Mã PIN" : "Tạo mật khẩu / Mã PIN (tối thiểu 6 ký tự)"}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#fff",
                border: "1.5px solid #e2ddd3",
                borderRadius: "14px",
                padding: "2px 14px",
                boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
            >
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập tối thiểu 6 ký tự"
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
          </div>

          {mode === "login" && (
            <p
              style={{
                fontSize: "11px",
                color: "#94a0aa",
                marginBottom: "16px",
              }}
            >
              💡 Gợi ý thử nghiệm: Tài khoản test có mật khẩu mặc định là <strong>123456</strong>.
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
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
              <span>{mode === "login" ? "Đang đăng nhập..." : "Đang tạo tài khoản..."}</span>
            ) : mode === "login" ? (
              <>
                <span>Đăng nhập &amp; Đặt xe ngay</span>
                <span style={{ fontSize: "16px" }}>➔</span>
              </>
            ) : (
              <>
                <span>Tạo tài khoản &amp; Tiếp tục</span>
                <span style={{ fontSize: "16px" }}>✓</span>
              </>
            )}
          </button>
        </form>

        {/* Footer switch */}
        <div style={{ textAlign: "center", marginTop: "14px" }}>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login")
              setError("")
              setInfoMsg("")
            }}
            style={{
              background: "none",
              border: "none",
              fontSize: "12px",
              color: "var(--brand-600, #1478d4)",
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            {mode === "login"
              ? "Chưa có tài khoản? Đăng ký ngay"
              : "Đã có tài khoản? Quay lại Đăng nhập"}
          </button>
        </div>
      </div>
    </div>
  )
}
