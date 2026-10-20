import { useState, useRef, useEffect } from "react"

type DriverAuthGateProps = {
  onSuccess: (token: string, user: any) => void
  onBackToCustomer?: () => void
}

const SEED_DRIVERS = [
  {
    name: "Lê Thành Đạt",
    phone: "0908815624",
    vehicle: "Xe van",
    plate: "51D-482.15",
    badge: "Đã duyệt KYC",
    badgeColor: "#4ade80",
  },
  {
    name: "Trần Minh Quân",
    phone: "0903124486",
    vehicle: "Xe 1 tấn",
    plate: "51D-923.41",
    badge: "Đã duyệt KYC",
    badgeColor: "#4ade80",
  },
  {
    name: "Võ Tuấn Kiệt",
    phone: "0987452201",
    vehicle: "Xe 2 tấn",
    plate: "51D-638.19",
    badge: "Đã duyệt KYC",
    badgeColor: "#4ade80",
  },
  {
    name: "Ngô Hoàng Nam",
    phone: "0916348832",
    vehicle: "Xe 500kg",
    plate: "Chưa nộp xe",
    badge: "Chờ duyệt KYC",
    badgeColor: "#fbbf24",
  },
]

export default function DriverAuthGate({
  onSuccess,
  onBackToCustomer,
}: DriverAuthGateProps) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [phone, setPhone] = useState("0908815624")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("123456")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [infoMsg, setInfoMsg] = useState("")

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === "register" && !fullName) {
        nameInputRef.current?.focus()
      } else {
        phoneInputRef.current?.focus()
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [mode])

  const handleQuickLogin = async (driver: typeof SEED_DRIVERS[0]) => {
    setPhone(driver.phone)
    setError("")
    setLoading(true)
    setInfoMsg(`Đang đăng nhập nhanh tài khoản tài xế ${driver.name}...`)

    try {
      // Thử đăng nhập trước
      let res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: driver.phone,
          password: "123456",
          role: "DRIVER",
        }),
      })

      let data = await res.json()

      // Nếu tài xế chưa có trong database, tự động đăng ký mới
      if (!res.ok && res.status === 404) {
        res = await fetch("/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: driver.phone,
            password: "123456",
            fullName: driver.name,
            role: "DRIVER",
          }),
        })
        data = await res.json()
      }

      if (!res.ok || !data.success || !data.token || !data.user) {
        throw new Error(data.message || "Đăng nhập nhanh không thành công")
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("driver_auth_token", data.token)
        localStorage.setItem("driver_phone", data.user.phone)
      }

      onSuccess(data.token, data.user)
    } catch (err: any) {
      setError(err.message || "Đăng nhập nhanh không thành công")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    const cleanPhone = phone.trim().replace(/\s+/g, "")
    if (!cleanPhone || cleanPhone.length < 9) {
      setError("Vui lòng nhập số điện thoại đối tác hợp lệ (tối thiểu 9 số)")
      return
    }

    if (!password || password.trim().length < 6) {
      setError("Vui lòng nhập mật khẩu hoặc mã PIN (tối thiểu 6 ký tự)")
      return
    }

    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          password: password.trim(),
          role: "DRIVER",
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success || !data.token || !data.user) {
        if (res.status === 404) {
          setError("Số điện thoại chưa đăng ký đối tác. Vui lòng chuyển sang 'Đăng ký đối tác mới'.")
        } else {
          setError(data.message || "Đăng nhập không thành công. Kiểm tra lại mật khẩu.")
        }
        return
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("driver_auth_token", data.token)
        localStorage.setItem("driver_phone", data.user.phone)
      }

      onSuccess(data.token, data.user)
    } catch (err: any) {
      setError(err.message || "Không thể kết nối đến máy chủ đăng nhập đối tác")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    const cleanPhone = phone.trim().replace(/\s+/g, "")
    if (!cleanPhone || cleanPhone.length < 9) {
      setError("Vui lòng nhập số điện thoại đối tác hợp lệ (tối thiểu 9 số)")
      return
    }

    if (!password || password.trim().length < 6) {
      setError("Vui lòng tạo mật khẩu hoặc mã PIN tối thiểu 6 ký tự")
      return
    }

    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          fullName: fullName.trim() || undefined,
          password: password.trim(),
          role: "DRIVER",
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success || !data.token || !data.user) {
        if (res.status === 409) {
          setError("Số điện thoại đối tác đã tồn tại. Vui lòng chuyển sang Đăng nhập.")
        } else {
          setError(data.message || "Đăng ký đối tác không thành công")
        }
        return
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("driver_auth_token", data.token)
        localStorage.setItem("driver_phone", data.user.phone)
      }

      onSuccess(data.token, data.user)
    } catch (err: any) {
      setError(err.message || "Không thể kết nối đến máy chủ đăng ký đối tác")
    } finally {
      setLoading(false)
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
            marginBottom: "28px",
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
        <div style={{ marginBottom: "22px" }}>
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
              marginBottom: "10px",
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
            Phân quyền đối tác: DRIVER
          </span>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 800,
              lineHeight: 1.25,
              margin: 0,
              color: "#f8fafc",
            }}
          >
            {mode === "login"
              ? "Bắt đầu nhận cuốc xe ngay hôm nay"
              : "Đăng ký trở thành tài xế đối tác"}
          </h1>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "13px",
              margin: "6px 0 0",
              lineHeight: 1.4,
            }}
          >
            {mode === "login"
              ? "Đăng nhập bằng số điện thoại và mật khẩu/mã PIN của bạn."
              : "Tạo tài khoản đối tác để bắt đầu nhận đơn vận chuyển hàng hóa."}
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "rgba(255, 255, 255, 0.06)",
            padding: "3px",
            borderRadius: "14px",
            marginBottom: "18px",
            gap: "4px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
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
              padding: "9px 12px",
              borderRadius: "11px",
              border: "none",
              background: mode === "login" ? "rgba(245, 158, 11, 0.25)" : "transparent",
              color: mode === "login" ? "#fbbf24" : "#94a3b8",
              fontWeight: mode === "login" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
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
              padding: "9px 12px",
              borderRadius: "11px",
              border: "none",
              background: mode === "register" ? "rgba(245, 158, 11, 0.25)" : "transparent",
              color: mode === "register" ? "#fbbf24" : "#94a3b8",
              fontWeight: mode === "register" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Đăng ký đối tác
          </button>
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
            <span style={{ flex: 1 }}>{error}</span>
            {error.includes("Đăng ký") && mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("register")
                  setError("")
                }}
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Đăng ký
              </button>
            )}
          </div>
        )}

        {/* Thông báo thông tin */}
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

        {/* Form Đăng nhập / Đăng ký đối tác */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "20px",
            padding: "20px 16px",
          }}
        >
          {/* Tên tài xế (khi Đăng ký) */}
          {mode === "register" && (
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Họ và tên Tài xế
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(15, 23, 42, 0.7)",
                  border: "1.5px solid rgba(255, 255, 255, 0.15)",
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
                  placeholder="Ví dụ: Lê Thành Đạt"
                  style={{
                    width: "100%",
                    height: "44px",
                    border: "none",
                    outline: "none",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#fff",
                    background: "transparent",
                  }}
                />
              </div>
            </div>
          )}

          {/* SĐT */}
          <div style={{ marginBottom: "14px" }}>
            <label
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: "6px",
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
                disabled={loading}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xx xxx xxx"
                style={{
                  width: "100%",
                  height: "44px",
                  border: "none",
                  outline: "none",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#fff",
                  background: "transparent",
                }}
              />
            </div>
          </div>

          {/* Mật khẩu hoặc Mã PIN */}
          <div style={{ marginBottom: "18px" }}>
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
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {mode === "login" ? "Mật khẩu / Mã PIN" : "Tạo Mật khẩu / Mã PIN"}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.7)",
                border: "1.5px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "14px",
                padding: "2px 14px",
              }}
            >
              <input
                type={showPassword ? "text" : "password"}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                style={{
                  width: "100%",
                  height: "44px",
                  border: "none",
                  outline: "none",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#fff",
                  background: "transparent",
                }}
              />
            </div>
          </div>

          {mode === "login" && (
            <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 18px" }}>
              💡 Mật khẩu tài xế mẫu: <strong>123456</strong>
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
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
              <span>Đang xử lý...</span>
            ) : mode === "login" ? (
              <>
                <span>ĐĂNG NHẬP NHẬN CUỐC</span>
                <span style={{ fontSize: "18px" }}>➔</span>
              </>
            ) : (
              <>
                <span>ĐĂNG KÝ HỒ SƠ TÀI XẾ</span>
                <span style={{ fontSize: "18px" }}>✓</span>
              </>
            )}
          </button>

          {/* Quick Test Driver Accounts */}
          <div
            style={{
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px dashed rgba(255, 255, 255, 0.12)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#cbd5e1",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                ⚡ Chọn nhanh tài xế thật (Database)
              </span>
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                1-chạm đăng nhập
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {SEED_DRIVERS.map((d) => (
                <button
                  key={d.phone}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin(d)}
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.04)")
                  }
                >
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#f8fafc",
                      }}
                    >
                      🚚 {d.name}{" "}
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          fontWeight: 400,
                        }}
                      >
                        ({d.phone})
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#94a3b8",
                        marginTop: "2px",
                      }}
                    >
                      {d.vehicle} · {d.plate}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "8px",
                      background: "rgba(255, 255, 255, 0.06)",
                      color: d.badgeColor,
                      border: `1px solid ${d.badgeColor}40`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.badge} ➔
                  </span>
                </button>
              ))}
            </div>
          </div>
        </form>
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
