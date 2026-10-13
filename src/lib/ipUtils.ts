import type { Request } from "express"

/**
 * Trích xuất địa chỉ IP thực của client từ Express Request
 * Ưu tiên: Cloudflare Header -> X-Forwarded-For -> Socket Remote Address
 */
export function getClientIp(req: Request): string {
  // 1. Cloudflare header
  const cfIp = req.headers["cf-connecting-ip"]
  if (typeof cfIp === "string" && cfIp.trim()) {
    return normalizeIp(cfIp.trim())
  }

  // 2. X-Forwarded-For header (có thể gồm chuỗi: "client, proxy1, proxy2")
  const xForwardedFor = req.headers["x-forwarded-for"]
  if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
    const firstIp = xForwardedFor.split(",")[0].trim()
    if (firstIp) {
      return normalizeIp(firstIp)
    }
  }

  // 3. X-Real-IP (Nginx/Traefik)
  const xRealIp = req.headers["x-real-ip"]
  if (typeof xRealIp === "string" && xRealIp.trim()) {
    return normalizeIp(xRealIp.trim())
  }

  // 4. Express req.ip hoặc Socket Remote Address
  const socketIp = req.ip || req.socket?.remoteAddress || "127.0.0.1"
  return normalizeIp(socketIp)
}

/**
 * Chuẩn hóa địa chỉ IP: loại bỏ prefix IPv6 mapping (::ffff:)
 */
export function normalizeIp(ip: string): string {
  let clean = ip.trim()
  if (clean.startsWith("::ffff:")) {
    clean = clean.replace("::ffff:", "")
  }
  return clean
}

/**
 * Kiểm tra xem địa chỉ IP có phải là IP nội bộ (Localhost, Private Network) hay không
 */
export function isPrivateOrLocalIp(ip: string): boolean {
  const normalized = normalizeIp(ip)

  // Localhost
  if (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost"
  ) {
    return true
  }

  // Dải 10.0.0.0 - 10.255.255.255
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true
  }

  // Dải 192.168.0.0 - 192.168.255.255
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true
  }

  // Dải 172.16.0.0 - 172.31.255.255
  const match172 = normalized.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
  if (match172) {
    const secondOctet = parseInt(match172[1], 10)
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true
    }
  }

  return false
}
