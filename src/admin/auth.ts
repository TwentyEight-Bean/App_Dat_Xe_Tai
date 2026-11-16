/**
 * Helpers xác thực phiên đăng nhập Admin ở frontend.
 * Không sử dụng DEV_ADMIN_TOKEN fallback trên UI vận hành.
 */

export function clearAdminSession(): void {
  localStorage.removeItem("admin_auth_token")
  localStorage.removeItem("admin_user_info")
  window.dispatchEvent(new Event("admin_session_expired"))
}

export function getAdminToken(): string | null {
  const token = localStorage.getItem("admin_auth_token")
  if (!token || token === "DEV_ADMIN_TOKEN") {
    clearAdminSession()
    return null
  }
  return token
}

export function requireAdminToken(): string {
  const token = getAdminToken()
  if (!token) {
    throw new Error("Phiên đăng nhập Quản trị viên đã hết hạn. Vui lòng đăng nhập lại.")
  }
  return token
}

export function isUnauthorizedResponse(status: number, message?: string): boolean {
  return (
    status === 401 ||
    Boolean(message?.includes("Token không hợp lệ")) ||
    Boolean(message?.includes("UNAUTHORIZED"))
  )
}
