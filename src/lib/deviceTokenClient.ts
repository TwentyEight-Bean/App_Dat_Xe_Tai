/**
 * Client-side Device Token Manager
 * Quản lý quyền Web Notification và đăng ký / hủy Device Token với Backend
 * API: POST /api/v1/auth/device-token và DELETE /api/v1/auth/device-token (Sprint 1: Task 1.4)
 */

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported"

/**
 * Kiểm tra trạng thái cấp quyền thông báo của trình duyệt
 */
export function getNotificationPermissionStatus(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported"
  }
  return Notification.permission
}

/**
 * Lấy device token đã lưu trong localStorage (nếu có)
 */
export function getStoredDeviceToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("fcm_device_token")
}

/**
 * Nhận diện tên thiết bị / trình duyệt thân thiện
 */
export function detectDeviceName(): string {
  if (typeof window === "undefined") return "Web Client"
  const ua = navigator.userAgent
  let os = "Thiết bị Web"
  if (ua.includes("Windows")) os = "Windows PC"
  else if (ua.includes("Macintosh")) os = "macOS"
  else if (ua.includes("iPhone")) os = "iPhone"
  else if (ua.includes("iPad")) os = "iPad"
  else if (ua.includes("Android")) os = "Android"

  let browser = "Browser"
  if (ua.includes("Edg/")) browser = "Edge"
  else if (ua.includes("Chrome/")) browser = "Chrome"
  else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari"
  else if (ua.includes("Firefox/")) browser = "Firefox"

  return `${browser} trên ${os}`
}

/**
 * Tạo một chuỗi token định danh thiết bị Web duy nhất
 */
function generateWebDeviceToken(): string {
  const existing = getStoredDeviceToken()
  if (existing) return existing

  const randomPart = Math.random().toString(36).substring(2, 12)
  const timePart = Date.now().toString(36)
  const token = `fcm_web_${timePart}_${randomPart}`
  if (typeof window !== "undefined") {
    localStorage.setItem("fcm_device_token", token)
  }
  return token
}

/**
 * Yêu cầu quyền thông báo và đăng ký Device Token lên Backend
 */
export async function registerDeviceTokenToServer(): Promise<{
  success: boolean
  message: string
  token?: string
}> {
  if (typeof window === "undefined") {
    return { success: false, message: "Môi trường không hỗ trợ" }
  }

  const authToken = localStorage.getItem("auth_token")
  if (!authToken) {
    return {
      success: false,
      message: "Vui lòng đăng nhập trước khi bật thông báo thiết bị",
    }
  }

  // 1. Kiểm tra hỗ trợ Web Notification
  if (!("Notification" in window)) {
    // Nếu trình duyệt không hỗ trợ Web Notification API, vẫn đăng ký Web Token mô phỏng
    const fcmToken = generateWebDeviceToken()
    return await sendTokenToBackend(authToken, fcmToken)
  }

  // 2. Yêu cầu quyền thông báo nếu chưa được cấp
  let permission = Notification.permission
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission()
    } catch {
      permission = "denied"
    }
  }

  if (permission === "denied") {
    return {
      success: false,
      message: "Quyền thông báo đã bị từ chối trong cài đặt trình duyệt",
    }
  }

  // 3. Khởi tạo Token và gửi lên Server
  const fcmToken = generateWebDeviceToken()
  return await sendTokenToBackend(authToken, fcmToken)
}

/**
 * Gửi Token lên API POST /api/v1/auth/device-token
 */
async function sendTokenToBackend(
  authToken: string,
  fcmToken: string,
): Promise<{ success: boolean; message: string; token?: string }> {
  try {
    const res = await fetch("/api/v1/auth/device-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        fcmToken,
        deviceType: "WEB",
        deviceName: detectDeviceName(),
      }),
    })

    const data = await res.json()

    if (!data.success) {
      throw new Error(data.message || "Đăng ký thiết bị thất bại")
    }

    localStorage.setItem("fcm_device_token", fcmToken)
    localStorage.setItem("device_notif_enabled", "true")

    // Phát sự kiện để cập nhật UI
    window.dispatchEvent(new Event("device-token-updated"))

    return {
      success: true,
      message: "Đăng ký thiết bị nhận thông báo đẩy thành công",
      token: fcmToken,
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Không thể kết nối đến máy chủ đăng ký thiết bị",
    }
  }
}

/**
 * Hủy đăng ký Device Token (DELETE /api/v1/auth/device-token)
 */
export async function removeDeviceTokenFromServer(): Promise<{
  success: boolean
  message: string
}> {
  if (typeof window === "undefined") {
    return { success: false, message: "Môi trường không hỗ trợ" }
  }

  const authToken = localStorage.getItem("auth_token")
  const fcmToken = getStoredDeviceToken()

  if (!authToken || !fcmToken) {
    localStorage.removeItem("fcm_device_token")
    localStorage.removeItem("device_notif_enabled")
    window.dispatchEvent(new Event("device-token-updated"))
    return { success: true, message: "Đã hủy thông báo trên thiết bị này" }
  }

  try {
    const res = await fetch("/api/v1/auth/device-token", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ fcmToken }),
    })

    const data = await res.json()
    localStorage.removeItem("fcm_device_token")
    localStorage.removeItem("device_notif_enabled")

    window.dispatchEvent(new Event("device-token-updated"))

    return {
      success: data.success,
      message: data.message || "Đã hủy đăng ký thiết bị thành công",
    }
  } catch (err: any) {
    localStorage.removeItem("fcm_device_token")
    localStorage.removeItem("device_notif_enabled")
    window.dispatchEvent(new Event("device-token-updated"))
    return {
      success: false,
      message: err.message || "Lỗi kết nối khi hủy thông báo thiết bị",
    }
  }
}
