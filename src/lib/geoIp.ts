import geoip from "geoip-lite"
import { isPrivateOrLocalIp, normalizeIp } from "./ipUtils"

export interface GeoIpCheckResult {
  allowed: boolean
  country: string | null
  ip: string
  reason?: string
}

/**
 * Kiểm tra xem địa chỉ IP có thuộc lãnh thổ Việt Nam hay không
 * @param ip Địa chỉ IP cần kiểm tra
 * @param options Tùy chọn cấu hình
 */
export function checkVietnamIp(
  ip: string,
  options: {
    bypassPrivateIps?: boolean
    forceStrictCheck?: boolean
  } = {},
): GeoIpCheckResult {
  const cleanIp = normalizeIp(ip)
  const { bypassPrivateIps = true, forceStrictCheck = false } = options

  // 1. Nếu là IP nội bộ / Localhost
  if (isPrivateOrLocalIp(cleanIp)) {
    if (forceStrictCheck) {
      return {
        allowed: false,
        country: "PRIVATE",
        ip: cleanIp,
        reason:
          "IP nội bộ không được chấp nhận trong chế độ kiểm tra nghiêm ngặt",
      }
    }
    if (bypassPrivateIps) {
      return {
        allowed: true,
        country: "VN",
        ip: cleanIp,
      }
    }
  }

  // 2. Tra cứu cơ sở dữ liệu GeoIP
  const geo = geoip.lookup(cleanIp)
  const country = geo?.country || null

  // 3. Nếu tìm thấy mã quốc gia và là Việt Nam (VN)
  if (country === "VN") {
    return {
      allowed: true,
      country: "VN",
      ip: cleanIp,
    }
  }

  // 4. Nếu không phải IP Việt Nam (IP quốc tế)
  return {
    allowed: false,
    country,
    ip: cleanIp,
    reason: `Dịch vụ chỉ phục vụ tại Việt Nam. Địa chỉ IP của bạn thuộc quốc gia: ${country || "Không xác định"}`,
  }
}
