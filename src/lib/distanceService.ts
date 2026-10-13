/**
 * DISTANCE & ROUTING SERVICE (Open Source / 0 VNĐ Mode)
 * SPRINT: 2 (Task 2.3)
 *
 * Tính toán khoảng cách (km) và thời gian di chuyển (phút) giữa 2 điểm tọa độ GPS
 * sử dụng công nghệ Open-Source: OSRM (OpenStreetMap Routing Machine) kết hợp
 * thuật toán dự phòng Haversine Urban Formula. Hoàn toàn MIỄN PHÍ (0 VNĐ).
 */

export interface DistanceResult {
  distanceKm: number

  durationMinutes: number

  routingSource: "GOONG_API" | "HAVERSINE_LOCAL"
}

export interface SimpleDistanceResult {
  distanceKm: number

  durationMinutes: number
}

export interface CoordinatePoint {
  lat: number

  lng: number
}

/**
 * Thuật toán Haversine tính khoảng cách đường chim bay giữa 2 tọa độ WGS 84
 * Kết hợp hệ số uốn lượn đô thị Việt Nam (Detour Factor: 1.28x)
 */

export function calculateHaversineDistance(
  lat1: number,

  lng1: number,

  lat2: number,

  lng2: number,
): SimpleDistanceResult {
  const R = 6371 // Bán kính Trái Đất (km)

  const dLat = ((lat2 - lat1) * Math.PI) / 180

  const dLng = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const straightDistanceKm = R * c

  // Hệ số khúc khuỷu / rẽ cua mạng lưới đường bộ đô thị (Detour Factor ~ 1.28x)

  const detourFactor = 1.28

  const actualRoadDistanceKm = Math.max(
    0.5,

    Number((straightDistanceKm * detourFactor).toFixed(1)),
  )

  // Vận tốc trung bình xe tải trong đô thị Việt Nam (~ 24 km/h) + 5 phút dừng đèn đỏ/bốc dỡ sơ bộ

  const avgTruckSpeedKmh = 24

  const durationMinutes = Math.max(
    5,

    Math.round((actualRoadDistanceKm / avgTruckSpeedKmh) * 60) + 5,
  )

  return {
    distanceKm: actualRoadDistanceKm,

    durationMinutes,
  }
}

/**
 * Tính khoảng cách thực tế giữa điểm đi (Origin) và điểm đến (Destination)
 * Ưu tiên gọi Goong.io -> Nếu quá 1.5s hoặc lỗi mạng thì tự động chuyển Haversine
 */

async function calculateSingleLeg(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<DistanceResult> {
  // Nếu điểm đi trùng điểm đến
  if (
    Math.abs(originLat - destLat) < 0.0001 &&
    Math.abs(originLng - destLng) < 0.0001
  ) {
    return {
      distanceKm: 0.1,
      durationMinutes: 3,
      routingSource: "HAVERSINE_LOCAL",
    }
  }

  // 1. Thử gọi Goong.io API cho chặng này
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1800) // 1.8s timeout

    const goongUrl = `https://rsapi.goong.io/Direction?origin=${originLat},${originLng}&destination=${destLat},${destLng}&vehicle=truck&api_key=${process.env.GOONG_API_KEY || ""}`

    const res = await fetch(goongUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TruckBookingApp/1.0",
      },
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (data.routes && data.routes.length > 0) {
        const leg = data.routes[0].legs[0]
        const distanceMeters = leg?.distance?.value || 0
        const durationSeconds = leg?.duration?.value || 0
        const distanceKm = Math.max(
          0.5,
          Number((distanceMeters / 1000).toFixed(1)),
        )
        const durationMinutes = Math.max(5, Math.round(durationSeconds / 60))

        return {
          distanceKm,
          durationMinutes,
          routingSource: "GOONG_API",
        }
      }
    }
  } catch (error) {
    // Chuyển sang fallback Haversine
  }

  // 2. Fallback: Haversine
  const fallback = calculateHaversineDistance(
    originLat,
    originLng,
    destLat,
    destLng,
  )

  return {
    distanceKm: fallback.distanceKm,
    durationMinutes: fallback.durationMinutes,
    routingSource: "HAVERSINE_LOCAL",
  }
}

/**
 * Tính khoảng cách thực tế giữa điểm đi (Origin) và điểm đến (Destination)
 * Hỗ trợ đa điểm dừng (Waypoints): Tự động tính tổng cộng các chặng đường
 */
export async function calculateRouteDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  waypoints?: CoordinatePoint[],
): Promise<DistanceResult> {
  // Validate tọa độ hợp lệ
  if (
    typeof originLat !== "number" ||
    typeof originLng !== "number" ||
    typeof destLat !== "number" ||
    typeof destLng !== "number" ||
    isNaN(originLat) ||
    isNaN(originLng) ||
    isNaN(destLat) ||
    isNaN(destLng)
  ) {
    throw new Error("Tọa độ GPS điểm đi hoặc điểm đến không hợp lệ")
  }

  if (originLat < -90 || originLat > 90 || destLat < -90 || destLat > 90) {
    throw new Error("Vĩ độ (Latitude) phải nằm trong phạm vi [-90, 90]")
  }

  if (originLng < -180 || originLng > 180 || destLng < -180 || destLng > 180) {
    throw new Error("Kinh độ (Longitude) phải nằm trong phạm vi [-180, 180]")
  }

  // Nếu không có điểm dừng trung gian (chuyến đi thẳng thông thường)
  if (!waypoints || waypoints.length === 0) {
    return await calculateSingleLeg(originLat, originLng, destLat, destLng)
  }

  // Trường hợp có điểm dừng trung gian (Task 2.3: Multi-drop route)
  const allStops = [
    { lat: originLat, lng: originLng },
    ...waypoints,
    { lat: destLat, lng: destLng },
  ]

  let totalDistanceKm = 0
  let totalDurationMinutes = 0
  let usedGoong = false

  for (let i = 0; i < allStops.length - 1; i++) {
    const legRes = await calculateSingleLeg(
      allStops[i].lat,
      allStops[i].lng,
      allStops[i + 1].lat,
      allStops[i + 1].lng,
    )
    totalDistanceKm += legRes.distanceKm
    totalDurationMinutes += legRes.durationMinutes
    if (legRes.routingSource === "GOONG_API") usedGoong = true
  }

  return {
    distanceKm: Number(totalDistanceKm.toFixed(1)),
    durationMinutes: totalDurationMinutes,
    routingSource: usedGoong ? "GOONG_API" : "HAVERSINE_LOCAL",
  }
}
