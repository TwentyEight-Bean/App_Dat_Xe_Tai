/**
 * DISTANCE & ROUTING SERVICE (Open Source / 0 VNĐ Mode)
 * SPRINT: 2 (Task 2.3)
 * 
 * Tính toán khoảng cách (km) và thời gian di chuyển (phút) giữa 2 điểm tọa độ GPS
 * sử dụng công nghệ Open-Source: OSRM (OpenStreetMap Routing Machine) kết hợp
 * thuật toán dự phòng Haversine Urban Formula. Hoàn toàn MIỄN PHÍ (0 VNĐ).
 */

export interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  routingSource: 'OSRM_OPENSOURCE' | 'HAVERSINE_LOCAL';
}

/**
 * Thuật toán Haversine tính khoảng cách đường chim bay giữa 2 tọa độ WGS 84
 * Kết hợp hệ số uốn lượn đô thị Việt Nam (Detour Factor: 1.28x)
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { distanceKm: number; durationMinutes: number } {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistanceKm = R * c;

  // Hệ số khúc khuỷu / rẽ cua mạng lưới đường bộ đô thị (Detour Factor ~ 1.28x)
  const detourFactor = 1.28;
  const actualRoadDistanceKm = Math.max(0.5, Number((straightDistanceKm * detourFactor).toFixed(1)));

  // Vận tốc trung bình xe tải trong đô thị Việt Nam (~ 24 km/h) + 5 phút dừng đèn đỏ/bốc dỡ sơ bộ
  const avgTruckSpeedKmh = 24;
  const durationMinutes = Math.max(
    5,
    Math.round((actualRoadDistanceKm / avgTruckSpeedKmh) * 60) + 5
  );

  return {
    distanceKm: actualRoadDistanceKm,
    durationMinutes,
  };
}

/**
 * Tính khoảng cách thực tế giữa điểm đi (Origin) và điểm đến (Destination)
 * Ưu tiên gọi OSRM OpenStreetMap -> Nếu quá 1.5s hoặc lỗi mạng thì tự động chuyển Haversine
 */
export async function calculateRouteDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DistanceResult> {
  // Validate tọa độ hợp lệ
  if (
    typeof originLat !== 'number' ||
    typeof originLng !== 'number' ||
    typeof destLat !== 'number' ||
    typeof destLng !== 'number' ||
    isNaN(originLat) ||
    isNaN(originLng) ||
    isNaN(destLat) ||
    isNaN(destLng)
  ) {
    throw new Error('Tọa độ GPS điểm đi hoặc điểm đến không hợp lệ');
  }

  if (originLat < -90 || originLat > 90 || destLat < -90 || destLat > 90) {
    throw new Error('Vĩ độ (Latitude) phải nằm trong phạm vi [-90, 90]');
  }

  if (originLng < -180 || originLng > 180 || destLng < -180 || destLng > 180) {
    throw new Error('Kinh độ (Longitude) phải nằm trong phạm vi [-180, 180]');
  }

  // Nếu điểm đi trùng điểm đến
  if (Math.abs(originLat - destLat) < 0.0001 && Math.abs(originLng - destLng) < 0.0001) {
    return {
      distanceKm: 0.1,
      durationMinutes: 3,
      routingSource: 'HAVERSINE_LOCAL',
    };
  }

  // 1. Thử gọi Open-Source OSRM Routing Engine (OpenStreetMap)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800); // 1.8s timeout

    // Chú ý: OSRM nhận định dạng {lng},{lat};{lng},{lat} (Kinh độ trước, Vĩ độ sau)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;

    const res = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TruckBookingApp/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceMeters = route.distance || 0;
        const durationSeconds = route.duration || 0;

        const distanceKm = Math.max(0.5, Number((distanceMeters / 1000).toFixed(1)));
        const durationMinutes = Math.max(5, Math.round(durationSeconds / 60));

        return {
          distanceKm,
          durationMinutes,
          routingSource: 'OSRM_OPENSOURCE',
        };
      }
    }
  } catch (error) {
    // Không ném lỗi ra ngoài khi OSRM timeout hoặc mạng chậm, chuyển ngay sang Fallback Haversine
  }

  // 2. Dự phòng (Fallback): Tính bằng Haversine Urban Formula siêu tốc (< 1ms, 0 VNĐ)
  const fallback = calculateHaversineDistance(originLat, originLng, destLat, destLng);
  return {
    distanceKm: fallback.distanceKm,
    durationMinutes: fallback.durationMinutes,
    routingSource: 'HAVERSINE_LOCAL',
  };
}
