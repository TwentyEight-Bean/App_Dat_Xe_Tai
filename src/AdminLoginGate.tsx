import { useState, useRef, useEffect } from "react"

interface AdminLoginGateProps {
  onSuccess: (token: string, user: any) => void
  onBackToCustomer?: () => void
}

export default function AdminLoginGate({
  onSuccess,
  onBackToCustomer,
}: AdminLoginGateProps) {
  const [email, setEmail] = useState("admin@fastdrop.vn")
  const [password, setPassword] = useState("admin123")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!email.trim()) {
      setError("Vui lòng nhập Email hoặc Tên tài khoản")
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setError("Vui lòng nhập Mật khẩu bảo mật")
      passwordRef.current?.focus()
      return
    }

    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/v1/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message || "Đăng nhập không thành công")
      }

      // Lưu token vào localStorage
      localStorage.setItem("admin_auth_token", data.token)
      if (data.user) {
        localStorage.setItem("admin_user_info", JSON.stringify(data.user))
      }

      onSuccess(data.token, data.user)
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối máy chủ quản trị. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }

  const handleFillDemo = () => {
    setEmail("admin@fastdrop.vn")
    setPassword("admin123")
    setError("")
  }

  return (
    <div
      className="no-scrollbar h-full w-full flex flex-col justify-between p-5 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 relative font-sans"
      style={{
        overflowX: "hidden",
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Background ambient lighting strictly contained */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-60 h-60 rounded-full bg-blue-600/15 blur-[70px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-60 h-60 rounded-full bg-indigo-600/15 blur-[70px]" />
      </div>

      {/* Top Header */}
      <header className="w-full flex items-center justify-between z-10 pt-1 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-white">
                FastDrop
              </span>
              <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                ADMIN
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-tight">
              Cổng Điều hành & Quản trị
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={
            onBackToCustomer ||
            (() => {
              window.location.hash = ""
            })
          }
          className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700 transition"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>Khách hàng</span>
        </button>
      </header>

      {/* Main Login Body */}
      <main className="flex-1 flex flex-col justify-center my-auto py-2 z-10">
        {/* Lock Icon & Title */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-400 flex items-center justify-center mx-auto mb-2.5 shadow-inner">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Đăng nhập Quản trị viên
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Xác thực tài khoản để truy cập hệ thống điều phối
          </p>
        </div>

        {/* Quick Demo Info Pill */}
        <div className="mb-4 p-2.5 rounded-xl bg-blue-950/50 border border-blue-800/40 flex items-center justify-between text-xs text-blue-300">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔑</span>
            <div>
              <p className="font-semibold text-blue-200 text-[11.5px]">
                Tài khoản mẫu:
              </p>
              <p className="text-[10.5px] text-blue-400/90 font-mono">
                admin@fastdrop.vn / admin123
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-[10.5px] font-medium text-blue-300 hover:text-white bg-blue-900/70 hover:bg-blue-800 px-2 py-1 rounded-md transition"
          >
            Điền nhanh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-red-950/70 border border-red-800/70 text-red-300 text-xs flex items-start gap-2">
            <svg
              className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Email / Tên đăng nhập
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206"
                  />
                </svg>
              </div>
              <input
                id="admin-email"
                ref={emailRef}
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fastdrop.vn"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Mật khẩu bảo mật
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <input
                id="admin-password"
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
              >
                {showPassword ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 active:scale-[0.98] transition duration-150 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Đang xác thực...</span>
              </>
            ) : (
              <>
                <span>Xác thực & Truy cập Quản trị</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </>
            )}
          </button>
        </form>
      </main>

      {/* Security details footnote */}
      <footer className="w-full pt-3 border-t border-slate-800/80 text-center z-10 text-[10.5px] text-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-slate-400">
          <svg
            className="w-3.5 h-3.5 text-emerald-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>Phân quyền RBAC · Mã hóa bcrypt</span>
        </div>
        <p className="text-[10px] text-slate-600">
          FastDrop Enterprise Security · v1.0.0
        </p>
      </footer>
    </div>
  )
}
