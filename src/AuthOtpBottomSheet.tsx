import { useEffect, useRef, useState } from "react"
import { syncUserProfileFromApi } from "./account"
import useCustomerDialog from "./customerDialog"
import { validateVietnamesePhone } from "./lib/phoneValidation"

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
  // Mode: "login" (Đăng nhập) hoặc "register" (Đăng ký mới)
  const [mode, setMode] = useState<"login" | "register">("login")

  // Thông tin đăng nhập / đăng ký
  const [identifier, setIdentifier] = useState("")
  const [phone, setPhone] = useState("")
  const [fullName, setFullName] = useState("")
  const [authType, setAuthType] = useState<"pin" | "password">("pin")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [infoMsg, setInfoMsg] = useState("")

  const loginInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)

  const pending = useRef(false)
  const requestRef = useRef<AbortController | null>(null)

  // Đăng ký dialog với customerDialog để không bị đè lên các sheet khác
  useCustomerDialog(isOpen, onClose)

  useEffect(() => {
    if (!isOpen) {
      if (requestRef.current) {
        requestRef.current.abort()
        requestRef.current = null
      }
      setLoading(false)
      setError("")
      setInfoMsg("")
      pending.current = false
      return
    }

    const timer = setTimeout(() => {
      if (mode === "login") {
        loginInputRef.current?.focus()
      } else {
        nameInputRef.current?.focus()
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [isOpen, mode])

  // ==========================================================================
  // 1. ĐĂNG KÝ TÀI KHOẢN MỚI TRỰC TIẾP (BẰNG TÊN + SĐT + MẬT KHẨU)
  // ==========================================================================
  const handleRegister = async () => {
    if (pending.current) return

    if (!fullName.trim()) {
      setError("Vui lòng nhập Họ và tên của bạn để tạo tài khoản")
      nameInputRef.current?.focus()
      return
    }

    const phoneCheck = validateVietnamesePhone(phone)
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || "Số điện thoại không hợp lệ")
      phoneInputRef.current?.focus()
      return
    }
    const cleanPhone = phoneCheck.phone

    if (authType === "pin") {
      if (!/^\d{6}$/.test(password.trim())) {
        setError("Vui lòng tạo mã PIN gồm đúng 6 chữ số (Ví dụ: 123456)")
        passwordInputRef.current?.focus()
        return
      }
    } else {
      if (!password || password.trim().length < 6) {
        setError("Vui lòng tạo mật khẩu tối thiểu 6 ký tự")
        passwordInputRef.current?.focus()
        return
      }
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
          fullName: fullName.trim(),
          password: password.trim(),
          role: "CUSTOMER",
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success || !data.token || !data.user?.phone) {
        setError(
          data.message ||
            "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.",
        )
        return
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token)
        localStorage.setItem("user_phone", data.user.phone)
        window.dispatchEvent(new Event("customer-auth-changed"))
      }

      await syncUserProfileFromApi()

      onSuccess(data.token, data.user.phone)
      onClose()
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

  // ==========================================================================
  // 2. ĐĂNG NHẬP BẰNG TÊN / SĐT + MẬT KHẨU HOẶC MÃ PIN
  // ==========================================================================
  const handleLogin = async () => {
    if (pending.current) return

    const rawId = identifier.trim()
    if (!rawId) {
      setError("Vui lòng nhập Tên đăng nhập hoặc Số điện thoại")
      loginInputRef.current?.focus()
      return
    }

    let cleanPhone = rawId
    const phoneCheck = validateVietnamesePhone(rawId)
    if (phoneCheck.valid) {
      cleanPhone = phoneCheck.phone
    }

    if (authType === "pin") {
      if (!/^\d{6}$/.test(password.trim())) {
        setError("Vui lòng nhập đúng 6 chữ số mã PIN (Ví dụ: 123456)")
        passwordInputRef.current?.focus()
        return
      }
    } else {
      if (!password || password.trim().length < 6) {
        setError("Vui lòng nhập mật khẩu (tối thiểu 6 ký tự)")
        passwordInputRef.current?.focus()
        return
      }
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
          username: rawId,
          password: password.trim(),
          role: "CUSTOMER",
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success || !data.token || !data.user?.phone) {
        if (res.status === 404) {
          setError(
            "Tài khoản chưa được đăng ký. Hãy bấm 'Đăng ký mới' bên dưới để tạo tài khoản.",
          )
        } else {
          setError(
            data.message ||
              "Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng thử lại.",
          )
        }
        return
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token)
        localStorage.setItem("user_phone", data.user.phone)
        window.dispatchEvent(new Event("customer-auth-changed"))
      }

      await syncUserProfileFromApi()

      if (
        request.signal.aborted ||
        localStorage.getItem("auth_token") !== data.token
      ) {
        return
      }

      onSuccess(data.token, data.user.phone)
      onClose()
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

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose()
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          borderTopLeftRadius: "28px",
          borderTopRightRadius: "28px",
          padding: "24px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.25)",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh kéo trang trí */}
        <div
          style={{
            width: "44px",
            height: "5px",
            background: "#cbd5e1",
            borderRadius: "99px",
            margin: "0 auto 16px",
          }}
        />

        {/* Tiêu đề & Nút đóng */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.35)",
              }}
            >
              🚛
            </div>
            <div>
              <h2
                style={{
                  fontSize: "17px",
                  fontWeight: 800,
                  color: "#0f172a",
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                {mode === "login" ? "Đăng nhập tài khoản" : "Đăng ký tài khoản mới"}
              </h2>
              <p
                style={{
                  fontSize: "12px",
                  color: "#64748b",
                  margin: "2px 0 0",
                  fontWeight: 500,
                }}
              >
                {mode === "login"
                  ? "Nhập tên hoặc số điện thoại & mật khẩu / mã PIN"
                  : "Điền thông tin và tạo mật khẩu để bắt đầu"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#64748b",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs chuyển đổi Đăng nhập / Đăng ký */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#f1f5f9",
            borderRadius: "14px",
            padding: "4px",
            marginBottom: "16px",
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
              color: mode === "login" ? "#0f172a" : "#64748b",
              fontWeight: mode === "login" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow:
                mode === "login" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
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
              color: mode === "register" ? "#0f172a" : "#64748b",
              fontWeight: mode === "register" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow:
                mode === "register" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
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
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "10px 14px",
              borderRadius: "14px",
              fontSize: "12.5px",
              fontWeight: 600,
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Thông báo thông tin */}
        {infoMsg && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#15803d",
              padding: "10px 14px",
              borderRadius: "14px",
              fontSize: "12.5px",
              fontWeight: 600,
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>💡</span>
            <span>{infoMsg}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* 1. FORM ĐĂNG NHẬP                                                 */}
        {/* ================================================================= */}
        {mode === "login" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleLogin()
            }}
          >
            {/* Tên đăng nhập hoặc Số điện thoại */}
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "5px",
                }}
              >
                Tên đăng nhập hoặc Số điện thoại
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#fff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "14px",
                  padding: "2px 14px",
                }}
              >
                <input
                  ref={loginInputRef}
                  aria-label="Tên đăng nhập hoặc Số điện thoại"
                  type="text"
                  disabled={loading}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Nhập tên tài khoản hoặc SĐT..."
                  style={{
                    width: "100%",
                    height: "44px",
                    border: "none",
                    outline: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            {/* Chọn hình thức: Mã PIN hoặc Mật khẩu */}
            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  Hình thức xác thực
                </span>
                <div
                  style={{
                    display: "flex",
                    background: "#f1f5f9",
                    padding: "2px",
                    borderRadius: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAuthType("pin")
                      setPassword("")
                      setError("")
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: authType === "pin" ? "#ffffff" : "transparent",
                      color: authType === "pin" ? "#0f172a" : "#64748b",
                      fontWeight: authType === "pin" ? 700 : 500,
                      fontSize: "11px",
                      cursor: "pointer",
                      boxShadow:
                        authType === "pin"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    🔢 Mã PIN 6 số
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthType("password")
                      setPassword("")
                      setError("")
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background:
                        authType === "password" ? "#ffffff" : "transparent",
                      color: authType === "password" ? "#0f172a" : "#64748b",
                      fontWeight: authType === "password" ? 700 : 500,
                      fontSize: "11px",
                      cursor: "pointer",
                      boxShadow:
                        authType === "password"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    🔑 Mật khẩu chữ
                  </button>
                </div>
              </div>
            </div>

            {/* Ô nhập PIN hoặc Mật khẩu */}
            <div style={{ marginBottom: "18px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#fff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "14px",
                  padding: "2px 14px",
                }}
              >
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  inputMode={authType === "pin" ? "numeric" : "text"}
                  pattern={authType === "pin" ? "[0-9]*" : undefined}
                  maxLength={authType === "pin" ? 6 : 40}
                  disabled={loading}
                  value={password}
                  onChange={(e) => {
                    if (authType === "pin") {
                      setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))
                    } else {
                      setPassword(e.target.value)
                    }
                  }}
                  placeholder={
                    authType === "pin" ? "123456" : "Nhập mật khẩu của bạn"
                  }
                  style={{
                    width: "100%",
                    height: "44px",
                    border: "none",
                    outline: "none",
                    fontSize: authType === "pin" ? "18px" : "15px",
                    fontWeight: authType === "pin" ? 700 : 600,
                    letterSpacing: authType === "pin" ? "4px" : "normal",
                    textAlign: authType === "pin" ? "center" : "left",
                    color: "#0f172a",
                    background: "transparent",
                  }}
                />
                {authType === "password" && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      fontSize: "16px",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                )}
              </div>
            </div>

            {/* Nút Submit Đăng nhập */}
            <button
              type="submit"
              disabled={loading}
              className="primary-button"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "14px",
                fontSize: "14.5px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
              }}
            >
              {loading ? (
                <span>Đang đăng nhập...</span>
              ) : (
                <>
                  <span>Đăng nhập ngay</span>
                  <span style={{ fontSize: "16px" }}>➔</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* 2. FORM ĐĂNG KÝ TÀI KHOẢN MỚI                                      */}
        {/* ================================================================= */}
        {mode === "register" && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleRegister()
            }}
          >
            {/* Họ và tên */}
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "5px",
                }}
              >
                Họ và tên của bạn <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#fff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "14px",
                  padding: "2px 14px",
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
                    color: "#0f172a",
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            {/* Số điện thoại */}
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "5px",
                }}
              >
                Số điện thoại liên hệ <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#fff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "14px",
                  padding: "2px 12px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#0f172a",
                    paddingRight: "10px",
                    borderRight: "1px solid #e2e8f0",
                    marginRight: "10px",
                  }}
                >
                  🇻🇳 +84
                </span>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  maxLength={12}
                  disabled={loading}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0988 888 888"
                  style={{
                    width: "100%",
                    height: "44px",
                    border: "none",
                    outline: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            {/* Chọn hình thức: Mã PIN hoặc Mật khẩu */}
            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  Tạo Mật khẩu bảo vệ
                </span>
                <div
                  style={{
                    display: "flex",
                    background: "#f1f5f9",
                    padding: "2px",
                    borderRadius: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAuthType("pin")
                      setPassword("")
                      setError("")
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: authType === "pin" ? "#ffffff" : "transparent",
                      color: authType === "pin" ? "#0f172a" : "#64748b",
                      fontWeight: authType === "pin" ? 700 : 500,
                      fontSize: "11px",
                      cursor: "pointer",
                      boxShadow:
                        authType === "pin"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    🔢 Mã PIN 6 số
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthType("password")
                      setPassword("")
                      setError("")
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background:
                        authType === "password" ? "#ffffff" : "transparent",
                      color: authType === "password" ? "#0f172a" : "#64748b",
                      fontWeight: authType === "password" ? 700 : 500,
                      fontSize: "11px",
                      cursor: "pointer",
                      boxShadow:
                        authType === "password"
                          ? "0 1px 3px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    🔑 Mật khẩu chữ
                  </button>
                </div>
              </div>
            </div>

            {/* Ô nhập PIN hoặc Mật khẩu khi đăng ký */}
            <div style={{ marginBottom: "18px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#fff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: "14px",
                  padding: "2px 14px",
                }}
              >
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  inputMode={authType === "pin" ? "numeric" : "text"}
                  pattern={authType === "pin" ? "[0-9]*" : undefined}
                  maxLength={authType === "pin" ? 6 : 40}
                  disabled={loading}
                  value={password}
                  onChange={(e) => {
                    if (authType === "pin") {
                      setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))
                    } else {
                      setPassword(e.target.value)
                    }
                  }}
                  placeholder={
                    authType === "pin" ? "123456" : "Tạo mật khẩu đăng nhập"
                  }
                  style={{
                    width: "100%",
                    height: "44px",
                    border: "none",
                    outline: "none",
                    fontSize: authType === "pin" ? "18px" : "15px",
                    fontWeight: authType === "pin" ? 700 : 600,
                    letterSpacing: authType === "pin" ? "4px" : "normal",
                    textAlign: authType === "pin" ? "center" : "left",
                    color: "#0f172a",
                    background: "transparent",
                  }}
                />
                {authType === "password" && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      fontSize: "16px",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                )}
              </div>
            </div>

            {/* Nút Tạo tài khoản */}
            <button
              type="submit"
              disabled={loading}
              className="primary-button"
              style={{
                width: "100%",
                height: "48px",
                borderRadius: "14px",
                fontSize: "14.5px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
              }}
            >
              {loading ? (
                <span>Đang tạo tài khoản...</span>
              ) : (
                <>
                  <span>Đăng ký tài khoản ngay</span>
                  <span style={{ fontSize: "16px" }}>➔</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
