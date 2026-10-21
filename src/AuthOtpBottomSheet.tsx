import { useEffect, useRef, useState } from "react"
import { syncUserProfileFromApi } from "./account"
import useCustomerDialog from "./customerDialog"
import { sanitizePhoneInput, validateVietnamesePhone } from "./lib/phoneValidation"

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
  // Mode: "login" (Đăng nhập bằng Mật khẩu / PIN) hoặc "register" (Đăng ký mới với OTP xác minh chính chủ)
  const [mode, setMode] = useState<"login" | "register">("login")

  // Tùy chọn đăng nhập nhanh bằng OTP dành cho ai quên mật khẩu / thích dùng OTP
  const [useOtpForLogin, setUseOtpForLogin] = useState(false)
  const [loginOtpStep, setLoginOtpStep] = useState<"phone" | "otp">("phone")

  // Thông tin đăng ký / đăng nhập
  const [phone, setPhone] = useState("0988888888")
  const [fullName, setFullName] = useState("")
  const [authType, setAuthType] = useState<"pin" | "password">("pin")
  const [password, setPassword] = useState("123456")
  const [showPassword, setShowPassword] = useState(false)

  // Trạng thái OTP khi đăng ký
  const [registerOtpSent, setRegisterOtpSent] = useState(false)
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""])
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [infoMsg, setInfoMsg] = useState("")

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const pending = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  const timerRef = useRef<number | null>(null)
  const dialogRef = useCustomerDialog(isOpen, onClose)

  // Dọn dẹp timer và abort request khi đóng modal
  useEffect(() => {
    if (!isOpen) {
      requestRef.current?.abort()
      if (timerRef.current) window.clearInterval(timerRef.current)
      pending.current = false
      setLoading(false)
      setError("")
      setInfoMsg("")
      setRegisterOtpSent(false)
      setUseOtpForLogin(false)
      setLoginOtpStep("phone")
      setOtpDigits(["", "", "", "", "", ""])
      setDevOtpCode(null)
      setCountdown(0)
    }
    return () => {
      requestRef.current?.abort()
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [isOpen])

  // Bộ đếm ngược 60 giây gửi lại mã OTP
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) window.clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [countdown])

  // Focus ô nhập phù hợp khi mở modal hoặc đổi tab
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      if (mode === "register") {
        if (!registerOtpSent) {
          nameInputRef.current?.focus()
        } else {
          otpInputRefs.current[0]?.focus()
        }
      } else {
        if (useOtpForLogin && loginOtpStep === "otp") {
          otpInputRefs.current[0]?.focus()
        } else {
          phoneInputRef.current?.focus()
        }
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [isOpen, mode, registerOtpSent, useOtpForLogin, loginOtpStep])

  if (!isOpen) return null

  // --------------------------------------------------------------------------
  // 1. GỬI MÃ OTP XÁC MINH SĐT KHI ĐĂNG KÝ (CHỐNG SỐ ẢO)
  // --------------------------------------------------------------------------
  const handleSendRegisterOtp = async () => {
    if (pending.current) return

    const phoneCheck = validateVietnamesePhone(phone)
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || "Số điện thoại không hợp lệ")
      return
    }
    const cleanPhone = phoneCheck.phone

    if (!fullName.trim()) {
      setError("Vui lòng nhập Họ và tên của bạn để tạo tài khoản")
      nameInputRef.current?.focus()
      return
    }

    if (authType === "pin") {
      if (!/^\d{6}$/.test(password.trim())) {
        setError("Vui lòng tạo mã PIN gồm đúng 6 chữ số")
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
      // Gọi request-otp với purpose: "register" (backend sẽ chặn nếu số đã tồn tại)
      const res = await fetch("/api/v1/auth/request-otp", {
        signal: request.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          purpose: "register",
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success) {
        if (data.message?.includes("đã được đăng ký")) {
          setError("Số điện thoại này đã có tài khoản. Vui lòng bấm 'Đăng nhập' bên dưới.")
        } else {
          setError(data.message || "Không thể gửi mã OTP. Vui lòng thử lại sau.")
        }
        return
      }

      if (data.devOtp) {
        setDevOtpCode(data.devOtp)
      }

      setInfoMsg("Mã OTP đã được gửi đến số điện thoại của bạn. Vui lòng nhập mã để hoàn tất đăng ký.")
      setCountdown(data.retryAfterSeconds || 60)
      setRegisterOtpSent(true)
      setOtpDigits(["", "", "", "", "", ""])

      setTimeout(() => {
        otpInputRefs.current[0]?.focus()
      }, 100)
    } catch (err: any) {
      if (request.signal.aborted) return
      setError(err.message || "Không thể kết nối đến máy chủ gửi OTP")
    } finally {
      if (!request.signal.aborted) {
        setLoading(false)
        pending.current = false
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. HOÀN TẤT ĐĂNG KÝ VỚI MÃ OTP + THIẾT LẬP MẬT KHẨU / PIN
  // --------------------------------------------------------------------------
  const handleCompleteRegister = async (otpOverride?: string) => {
    if (pending.current) return

    const fullOtp = otpOverride || otpDigits.join("").trim()
    if (fullOtp.length !== 6 || !/^\d{6}$/.test(fullOtp)) {
      setError("Vui lòng nhập đúng 6 chữ số mã OTP đã gửi đến điện thoại")
      return
    }

    const cleanPhone = validateVietnamesePhone(phone).phone
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
          otp: fullOtp,
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success || !data.token || !data.user?.phone) {
        setError(data.message || "Đăng ký không thành công. Vui lòng kiểm tra lại mã OTP.")
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

  // --------------------------------------------------------------------------
  // 3. ĐĂNG NHẬP BẰNG SỐ ĐIỆN THOẠI + MẬT KHẨU / MÃ PIN (NHANH CHÓNG)
  // --------------------------------------------------------------------------
  const handlePasswordLogin = async () => {
    if (pending.current) return

    const phoneCheck = validateVietnamesePhone(phone)
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || "Số điện thoại không hợp lệ")
      return
    }
    const cleanPhone = phoneCheck.phone

    if (authType === "pin") {
      if (!/^\d{6}$/.test(password.trim())) {
        setError("Vui lòng nhập đúng 6 chữ số mã PIN (Ví dụ: 123456)")
        return
      }
    } else {
      if (!password || password.trim().length < 6) {
        setError("Vui lòng nhập mật khẩu (tối thiểu 6 ký tự)")
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
          password: password.trim(),
          role: "CUSTOMER",
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success || !data.token || !data.user?.phone) {
        if (res.status === 404) {
          setError("Số điện thoại này chưa đăng ký. Hãy bấm 'Đăng ký mới' bên dưới để tạo tài khoản.")
        } else {
          setError(
            data.message ||
              (authType === "pin"
                ? "Mã PIN không chính xác. Vui lòng thử lại hoặc đăng nhập bằng OTP."
                : "Mật khẩu không chính xác. Vui lòng thử lại hoặc đăng nhập bằng OTP.")
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

  // --------------------------------------------------------------------------
  // 4. ĐĂNG NHẬP NHANH BẰNG OTP (KHI QUÊN MẬT KHẨU / PIN)
  // --------------------------------------------------------------------------
  const handleQuickLoginRequestOtp = async () => {
    if (pending.current) return

    const phoneCheck = validateVietnamesePhone(phone)
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || "Số điện thoại không hợp lệ")
      return
    }
    const cleanPhone = phoneCheck.phone

    setError("")
    setLoading(true)
    pending.current = true
    const request = new AbortController()
    requestRef.current = request

    try {
      const res = await fetch("/api/v1/auth/request-otp", {
        signal: request.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success) {
        setError(data.message || "Không thể gửi mã OTP")
        return
      }

      if (data.devOtp) setDevOtpCode(data.devOtp)
      setInfoMsg("Mã OTP đã được gửi đến số điện thoại của bạn.")
      setCountdown(data.retryAfterSeconds || 60)
      setLoginOtpStep("otp")
      setOtpDigits(["", "", "", "", "", ""])

      setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      if (request.signal.aborted) return
      setError(err.message || "Lỗi kết nối")
    } finally {
      if (!request.signal.aborted) {
        setLoading(false)
        pending.current = false
      }
    }
  }

  const handleQuickLoginVerifyOtp = async (codeOverride?: string) => {
    if (pending.current) return

    const fullCode = codeOverride || otpDigits.join("").trim()
    if (fullCode.length !== 6) {
      setError("Vui lòng nhập đủ 6 chữ số OTP")
      return
    }

    const cleanPhone = validateVietnamesePhone(phone).phone
    setError("")
    setLoading(true)
    pending.current = true
    const request = new AbortController()
    requestRef.current = request

    try {
      const res = await fetch("/api/v1/auth/verify-otp", {
        signal: request.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          otp: fullCode,
          role: "CUSTOMER",
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success || !data.token || !data.user?.phone) {
        setError(data.message || "Mã OTP không chính xác hoặc đã hết hạn")
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
      setError(err.message || "Lỗi xác thực mã OTP")
    } finally {
      if (!request.signal.aborted) {
        setLoading(false)
        pending.current = false
      }
    }
  }

  // --------------------------------------------------------------------------
  // XỬ LÝ 6 Ô DIGIT BOXES & PASTE CLIPBOARD
  // --------------------------------------------------------------------------
  const handleDigitChange = (index: number, val: string) => {
    const cleanChar = val.replace(/\D/g, "").slice(-1)
    const newDigits = [...otpDigits]
    newDigits[index] = cleanChar
    setOtpDigits(newDigits)
    setError("")

    if (cleanChar && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }

    const completeCode = newDigits.join("")
    if (completeCode.length === 6 && /^\d{6}$/.test(completeCode)) {
      if (mode === "register") {
        handleCompleteRegister(completeCode)
      } else {
        handleQuickLoginVerifyOtp(completeCode)
      }
    }
  }

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits]
        newDigits[index - 1] = ""
        setOtpDigits(newDigits)
        otpInputRefs.current[index - 1]?.focus()
      } else {
        const newDigits = [...otpDigits]
        newDigits[index] = ""
        setOtpDigits(newDigits)
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (!pasted) return

    const newDigits = [...otpDigits]
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || ""
    }
    setOtpDigits(newDigits)

    const nextIdx = Math.min(pasted.length, 5)
    otpInputRefs.current[nextIdx]?.focus()

    if (pasted.length === 6) {
      if (mode === "register") {
        handleCompleteRegister(pasted)
      } else {
        handleQuickLoginVerifyOtp(pasted)
      }
    }
  }

  const handleQuickFillDevOtp = (code: string) => {
    const chars = code.split("").slice(0, 6)
    const newDigits = ["", "", "", "", "", ""]
    chars.forEach((c, i) => (newDigits[i] = c))
    setOtpDigits(newDigits)
    if (mode === "register") {
      handleCompleteRegister(code)
    } else {
      handleQuickLoginVerifyOtp(code)
    }
  }

  const maskedPhone =
    phone.length >= 7 ? `${phone.slice(0, 4)} ••• ${phone.slice(-3)}` : phone

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="customer-modal fixed inset-0 flex flex-col justify-end"
      style={{
        background: "rgba(15, 23, 42, 0.52)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Xác thực tài khoản đặt xe"
    >
      <div
        className="w-full max-w-[430px] mx-auto overflow-hidden animate-slide-up"
        style={{
          borderRadius: "28px 28px 0 0",
          background:
            "radial-gradient(120% 70% at 15% -10%, rgba(255, 255, 255, 0.99), rgba(255, 255, 255, 0.94) 60%), linear-gradient(180deg, #fffdf9 0%, #f7f3ea 100%)",
          border: "1px solid rgba(255, 255, 255, 0.9)",
          boxShadow: "0 -20px 48px -10px rgba(15, 23, 42, 0.38)",
          padding: "16px 20px 28px",
          maxHeight: "calc(100dvh - 16px)",
          overflowY: "auto",
        }}
      >
        {/* Thanh kéo nhỏ phía trên */}
        <div
          style={{
            width: "42px",
            height: "4px",
            borderRadius: "2px",
            background: "#d6cfc0",
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
                width: "40px",
                height: "40px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                color: "#0284c7",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: "20px",
                boxShadow: "0 2px 8px rgba(14, 165, 233, 0.2)",
              }}
            >
              🚚
            </span>
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
                {mode === "login"
                  ? (useOtpForLogin ? "Đăng nhập nhanh bằng OTP" : "Đăng nhập tài khoản")
                  : (registerOtpSent ? "Xác minh số điện thoại chính chủ" : "Đăng ký tài khoản mới")}
              </h2>
              <p
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  margin: "2px 0 0",
                  fontWeight: 500,
                }}
              >
                {mode === "login"
                  ? (useOtpForLogin
                      ? "Mã OTP SMS gửi về điện thoại, không cần mật khẩu"
                      : "Nhập số điện thoại & mật khẩu / mã PIN đã đăng ký")
                  : (registerOtpSent
                      ? `Nhập mã 6 số gửi đến SĐT: ${maskedPhone}`
                      : "Bắt buộc xác thực OTP để chống đăng ký số điện thoại ảo")}
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
              background: "rgba(0, 0, 0, 0.05)",
              color: "#475569",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: "15px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab chuyển đổi: ĐĂNG NHẬP vs ĐĂNG KÝ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#ebe6db",
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
              setUseOtpForLogin(false)
              setRegisterOtpSent(false)
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
              setRegisterOtpSent(false)
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
              boxShadow: mode === "register" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <span>Đăng ký mới</span>
            <span
              style={{
                fontSize: "9px",
                background: "#0284c7",
                color: "#fff",
                padding: "1px 5px",
                borderRadius: "6px",
                fontWeight: 700,
              }}
            >
              Kèm OTP
            </span>
          </button>
        </div>

        {/* Thông báo lỗi */}
        {error && (
          <div
            style={{
              padding: "10px 13px",
              borderRadius: "12px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
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
          </div>
        )}

        {/* Thông báo hướng dẫn / thành công */}
        {infoMsg && (
          <div
            style={{
              padding: "10px 13px",
              borderRadius: "12px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
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
            <span style={{ flex: 1 }}>{infoMsg}</span>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: ĐĂNG NHẬP (BẰNG MẬT KHẨU / MÃ PIN HOẶC OTP NHANH)          */}
        {/* ================================================================= */}
        {mode === "login" && !useOtpForLogin && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handlePasswordLogin()
            }}
          >
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
                Số điện thoại của bạn
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#fff",
                  border: "1.5px solid #e2ddd3",
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
                    borderRight: "1px solid #e9e4d9",
                    marginRight: "10px",
                  }}
                >
                  🇻🇳 +84
                </span>
                <input
                  ref={phoneInputRef}
                  aria-label="Số điện thoại"
                  type="tel"
                  maxLength={12}
                  disabled={loading}
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                  placeholder="0988 888 888"
                  style={{
                    width: "100%",
                    height: "44px",
                    border: "none",
                    outline: "none",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "transparent",
                  }}
                />
              </div>
            </div>

            {/* Loại xác thực: PIN hoặc Mật khẩu */}
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#475569" }}>
                  Hình thức đăng nhập
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0284c7",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? "Ẩn" : "Hiện"}
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px",
                  background: "#ebe7dd",
                  padding: "3px",
                  borderRadius: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setAuthType("pin")
                    setPassword("123456")
                    setError("")
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "9px",
                    border: "none",
                    background: authType === "pin" ? "#ffffff" : "transparent",
                    color: authType === "pin" ? "#0284c7" : "#64748b",
                    fontWeight: authType === "pin" ? 700 : 500,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: authType === "pin" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  🔢 Mã PIN (6 số)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthType("password")
                    setError("")
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "9px",
                    border: "none",
                    background: authType === "password" ? "#ffffff" : "transparent",
                    color: authType === "password" ? "#0284c7" : "#64748b",
                    fontWeight: authType === "password" ? 700 : 500,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: authType === "password" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}
                >
                  🔑 Mật khẩu chữ
                </button>
              </div>
            </div>

            {/* Ô nhập PIN hoặc Mật khẩu */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "5px",
                }}
              >
                {authType === "pin" ? "Nhập mã PIN (6 số)" : "Nhập mật khẩu"}
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#fff",
                  border: "1.5px solid #e2ddd3",
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
                  placeholder={authType === "pin" ? "123456" : "Nhập mật khẩu của bạn"}
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
              </div>
            </div>

            {/* Nút Đăng nhập */}
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
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
              }}
            >
              {loading ? (
                <span>Đang đăng nhập...</span>
              ) : (
                <>
                  <span>Đăng nhập &amp; Đặt xe</span>
                  <span style={{ fontSize: "16px" }}>➔</span>
                </>
              )}
            </button>

            {/* Nút đăng nhập nhanh bằng OTP */}
            <div style={{ textAlign: "center", marginTop: "14px" }}>
              <button
                type="button"
                onClick={() => {
                  setUseOtpForLogin(true)
                  setLoginOtpStep("phone")
                  setError("")
                  setInfoMsg("")
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12px",
                  color: "#0284c7",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>⚡ Quên mật khẩu? Đăng nhập nhanh bằng OTP</span>
              </button>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* TAB 1 (PHỤ): ĐĂNG NHẬP NHANH BẰNG OTP CHO NGƯỜI QUÊN MẬT KHẨU    */}
        {/* ================================================================= */}
        {mode === "login" && useOtpForLogin && (
          <div>
            {loginOtpStep === "phone" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleQuickLoginRequestOtp()
                }}
              >
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "5px",
                    }}
                  >
                    Số điện thoại nhận mã OTP
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "#fff",
                      border: "1.5px solid #e2ddd3",
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
                        borderRight: "1px solid #e9e4d9",
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
                      onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                      placeholder="0988 888 888"
                      style={{
                        width: "100%",
                        height: "44px",
                        border: "none",
                        outline: "none",
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#0f172a",
                        background: "transparent",
                      }}
                    />
                  </div>
                </div>

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
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? <span>Đang gửi mã...</span> : <span>Gửi mã OTP qua SMS</span>}
                </button>
              </form>
            ) : (
              <div>
                {/* 6 ô OTP đăng nhập nhanh */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#f1f5f9",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#1e293b" }}>
                    📱 {phone}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLoginOtpStep("phone")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#0284c7",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Đổi số
                  </button>
                </div>

                {devOtpCode && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                      border: "1px dashed #d97706",
                      borderRadius: "12px",
                      padding: "8px 12px",
                      marginBottom: "14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#92400e" }}>
                      Mã thử nghiệm: <strong>{devOtpCode}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuickFillDevOtp(devOtpCode)}
                      style={{
                        background: "#b45309",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ⚡ Điền nhanh
                    </button>
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, 1fr)",
                    gap: "8px",
                    maxWidth: "340px",
                    margin: "0 auto 16px",
                  }}
                >
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      disabled={loading}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      onPaste={handleDigitPaste}
                      style={{
                        width: "100%",
                        height: "50px",
                        textAlign: "center",
                        fontSize: "20px",
                        fontWeight: 800,
                        borderRadius: "12px",
                        border: digit ? "2px solid #0284c7" : "1.5px solid #cbd5e1",
                        background: digit ? "#f0f9ff" : "#fff",
                      }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  disabled={loading || otpDigits.join("").length < 6}
                  onClick={() => handleQuickLoginVerifyOtp()}
                  className="primary-button"
                  style={{
                    width: "100%",
                    height: "48px",
                    borderRadius: "14px",
                    fontSize: "14px",
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                  }}
                >
                  {loading ? "Đang xác thực..." : "Xác nhận & Đăng nhập"}
                </button>
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: "14px" }}>
              <button
                type="button"
                onClick={() => setUseOtpForLogin(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "12px",
                  color: "#64748b",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ← Quay lại đăng nhập bằng Mật khẩu / Mã PIN
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ĐĂNG KÝ TÀI KHOẢN MỚI (BẮT BUỘC OTP + TẠO MẬT KHẨU/PIN)    */}
        {/* ================================================================= */}
        {mode === "register" && (
          <div>
            {!registerOtpSent ? (
              // BƯỚC 1: ĐIỀN THÔNG TIN + TẠO MẬT KHẨU/PIN
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendRegisterOtp()
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
                    Họ và tên <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "#fff",
                      border: "1.5px solid #e2ddd3",
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

                {/* Số điện thoại chính chủ */}
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
                    Số điện thoại chính chủ <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "#fff",
                      border: "1.5px solid #e2ddd3",
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
                        borderRight: "1px solid #e9e4d9",
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
                      onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                      placeholder="0988 888 888"
                      style={{
                        width: "100%",
                        height: "44px",
                        border: "none",
                        outline: "none",
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#0f172a",
                        background: "transparent",
                      }}
                    />
                  </div>
                </div>

                {/* Chọn loại bảo mật: PIN 6 số hoặc Mật khẩu */}
                <div style={{ marginBottom: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "6px",
                    }}
                  >
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#475569" }}>
                      Tạo khóa bảo mật <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0284c7",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {showPassword ? "Ẩn" : "Hiện"}
                    </button>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px",
                      background: "#ebe7dd",
                      padding: "3px",
                      borderRadius: "12px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAuthType("pin")
                        setPassword("123456")
                        setError("")
                      }}
                      style={{
                        padding: "6px 8px",
                        borderRadius: "9px",
                        border: "none",
                        background: authType === "pin" ? "#ffffff" : "transparent",
                        color: authType === "pin" ? "#0284c7" : "#64748b",
                        fontWeight: authType === "pin" ? 700 : 500,
                        fontSize: "12px",
                        cursor: "pointer",
                        boxShadow: authType === "pin" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      🔢 Mã PIN (6 số)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthType("password")
                        setError("")
                      }}
                      style={{
                        padding: "6px 8px",
                        borderRadius: "9px",
                        border: "none",
                        background: authType === "password" ? "#ffffff" : "transparent",
                        color: authType === "password" ? "#0284c7" : "#64748b",
                        fontWeight: authType === "password" ? 700 : 500,
                        fontSize: "12px",
                        cursor: "pointer",
                        boxShadow: authType === "password" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      🔑 Mật khẩu chữ
                    </button>
                  </div>
                </div>

                {/* Ô nhập PIN hoặc Mật khẩu */}
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "5px",
                    }}
                  >
                    {authType === "pin" ? "Tạo mã PIN (6 số)" : "Tạo mật khẩu (tối thiểu 6 ký tự)"}
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "#fff",
                      border: "1.5px solid #e2ddd3",
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
                      placeholder={authType === "pin" ? "123456" : "Tạo mật khẩu đăng nhập"}
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
                  </div>
                </div>

                {/* Nút gửi OTP xác minh */}
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
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                  }}
                >
                  {loading ? (
                    <span>Đang gửi mã xác thực...</span>
                  ) : (
                    <>
                      <span>Xác minh SĐT qua OTP &amp; Tiếp tục</span>
                      <span style={{ fontSize: "16px" }}>➔</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              // BƯỚC 2: NHẬP MÃ OTP ĐỂ HOÀN TẤT ĐĂNG KÝ (CHỐNG SỐ ẢO)
              <div>
                <div
                  style={{
                    background: "#f1f5f9",
                    padding: "10px 14px",
                    borderRadius: "14px",
                    marginBottom: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                      Xác minh chủ sở hữu:
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#0f172a" }}>
                      📱 {phone} ({fullName})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterOtpSent(false)
                      setError("")
                      setInfoMsg("")
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#0284c7",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Sửa thông tin
                  </button>
                </div>

                {/* Banner test mock OTP */}
                {devOtpCode && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                      border: "1px dashed #d97706",
                      borderRadius: "12px",
                      padding: "10px 12px",
                      marginBottom: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "10px", color: "#92400e", fontWeight: 700, textTransform: "uppercase" }}>
                        ⚡ Chế độ thử nghiệm (0 VNĐ)
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: "#78350f" }}>
                        Mã OTP: <span style={{ letterSpacing: "2px", background: "#fff", padding: "1px 6px", borderRadius: "6px" }}>{devOtpCode}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickFillDevOtp(devOtpCode)}
                      style={{
                        background: "#b45309",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ⚡ Điền nhanh
                    </button>
                  </div>
                )}

                {/* 6 Ô NHẬP OTP */}
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: "8px",
                      textAlign: "center",
                    }}
                  >
                    Nhập mã 6 chữ số vừa gửi tới SMS để hoàn tất
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: "8px",
                      maxWidth: "340px",
                      margin: "0 auto",
                    }}
                  >
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputRefs.current[idx] = el
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        autoComplete="one-time-code"
                        disabled={loading}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        onPaste={handleDigitPaste}
                        style={{
                          width: "100%",
                          height: "52px",
                          textAlign: "center",
                          fontSize: "22px",
                          fontWeight: 800,
                          borderRadius: "14px",
                          border: digit ? "2px solid #0284c7" : "1.5px solid #cbd5e1",
                          background: digit ? "#f0f9ff" : "#ffffff",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Timer gửi lại */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: "18px",
                  }}
                >
                  {countdown > 0 ? (
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                      ⏱️ Gửi lại mã sau: <strong style={{ color: "#0284c7" }}>{countdown}s</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleSendRegisterOtp}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0284c7",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      🔄 Gửi lại mã OTP
                    </button>
                  )}
                </div>

                {/* Submit Hoàn tất đăng ký */}
                <button
                  type="button"
                  disabled={loading || otpDigits.join("").length < 6}
                  onClick={() => handleCompleteRegister()}
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
                    cursor:
                      loading || otpDigits.join("").length < 6
                        ? "not-allowed"
                        : "pointer",
                    opacity: loading || otpDigits.join("").length < 6 ? 0.6 : 1,
                    background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                    boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
                  }}
                >
                  {loading ? (
                    <span>Đang tạo tài khoản...</span>
                  ) : (
                    <>
                      <span>Hoàn tất Đăng ký &amp; Tiếp tục</span>
                      <span style={{ fontSize: "16px" }}>✓</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
