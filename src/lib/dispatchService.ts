import { client } from "../db"

import { ApiError } from "./errors"

import { triggerDriverLocationUpdate } from "./pusher"

export interface FindNearbyDriversOptions {
  /** Vĩ độ điểm lấy hàng (VD: 10.776889) */

  originLat: number

  /** Kinh độ điểm lấy hàng (VD: 106.700806) */

  originLng: number

  /** Bán kính tìm kiếm tính theo km (mặc định: 5km) */

  radiusKm?: number

  /** Bán kính tìm kiếm tính theo mét (nếu truyền thì ưu tiên hơn radiusKm) */

  radiusMeters?: number

  /** Lọc theo loại xe tải cụ thể (UUID của vehicle_types) */

  vehicleTypeId?: string

  /** Danh sách driverId bỏ qua (ví dụ: tài xế đã từ chối nhận cuốc này) */

  excludeDriverIds?: string[]

  /** Số lượng tài xế tối đa cần quét (mặc định: 10) */

  limit?: number

  /**
   * Giới hạn thời gian cập nhật GPS gần nhất tính bằng phút (mặc định: không giới hạn hoặc 60 phút)
   * Giúp loại bỏ các tài xế để máy offline hoặc tắt GPS nhiều giờ trước
   */
  maxAgeMinutes?: number

  /**
   * Yêu cầu tài xế có số dư ví đạt hạn mức ký quỹ tối thiểu (mặc định: true)
   */
  requireMinDeposit?: boolean
}

export interface NearbyDriverResult {
  driverId: string

  userId: string

  fullName: string

  phone: string

  avatarUrl: string | null

  licensePlate: string | null

  ratingAvg: number

  vehicleTypeId: string | null

  vehicleTypeCode: string | null

  vehicleTypeName: string | null

  currentLocation: {
    latitude: number

    longitude: number

    heading: number | null

    lastUpdatedAt: Date
  }

  distanceMeters: number

  distanceKm: number
}

export interface UpdateLocationDto {
  lat?: number

  lng?: number

  latitude?: number

  longitude?: number

  heading?: number | null

  speed?: number | null

  bypassRateLimit?: boolean
}

export interface ActiveBookingTrackingSummary {
  id: string

  bookingCode: string

  status: string
}

export interface UpdatedDriverLocationResult {
  driverId: string

  latitude: number

  longitude: number

  heading: number | null

  speed: number | null

  updatedAt: Date

  activeBooking: ActiveBookingTrackingSummary | null
}

// Bảng lưu thời điểm cập nhật vị trí gần nhất của từng tài xế (phục vụ Throttling / Rate-Limiting)

const driverLastUpdateMap = new Map<string, number>()

const MIN_UPDATE_INTERVAL_MS = 2000 // Tối đa 1 request / 2 giây

/**
 * Xóa cache giới hạn tần suất cập nhật GPS (dùng cho unit/integration testing)
 */

export function resetDriverLocationRateLimit(driverId?: string) {
  if (driverId) {
    driverLastUpdateMap.delete(driverId)
  } else {
    driverLastUpdateMap.clear()
  }
}

/**
 * 1. CORE TASK 3.4: Cập nhật vị trí GPS realtime của tài xế vào PostGIS và bắn sự kiện Live Tracking
 * - Throttling chống spam: Tối đa 1 request / 2 giây
 * - Upsert tọa độ vào driver_locations
 * - Nếu tài xế đang trong chuyến đi (ACCEPTED, ARRIVED_AT_PICKUP, IN_TRANSIT) -> Bắn Pusher `driver:location-update`
 */

export async function updateDriverLocation(
  driverId: string,

  coords: UpdateLocationDto,
): Promise<UpdatedDriverLocationResult> {
  if (!driverId) {
    throw new ApiError(400, "Thiếu thông tin driverId")
  }

  // 1. Giới hạn tần suất cập nhật (Rate limit / Throttling: tối đa 1 lần / 2 giây)

  const now = Date.now()

  const lastTime = driverLastUpdateMap.get(driverId) || 0

  if (!coords.bypassRateLimit && now - lastTime < MIN_UPDATE_INTERVAL_MS) {
    const remainingSeconds = (
      (MIN_UPDATE_INTERVAL_MS - (now - lastTime)) /
      1000
    )

      .toFixed(1)

    throw new ApiError(
      429,

      `Tần suất cập nhật vị trí quá nhanh. Tối đa 1 lần mỗi 2 giây (Vui lòng chờ ${remainingSeconds}s).`,

      "RATE_LIMIT_EXCEEDED",
    )
  }

  // 2. Chuẩn hóa và kiểm tra tọa độ GPS

  const rawLat = coords.lat !== undefined ? coords.lat : coords.latitude

  const rawLng = coords.lng !== undefined ? coords.lng : coords.longitude

  if (rawLat === undefined || rawLat === null) {
    throw new ApiError(400, "Thiếu thông tin vĩ độ (lat hoặc latitude)")
  }

  if (rawLng === undefined || rawLng === null) {
    throw new ApiError(400, "Thiếu thông tin kinh độ (lng hoặc longitude)")
  }

  const lat = Number(rawLat)

  const lng = Number(rawLng)

  const heading =
    coords.heading !== undefined && coords.heading !== null
      ? Number(coords.heading)
      : null

  const speed =
    coords.speed !== undefined && coords.speed !== null
      ? Number(coords.speed)
      : null

  if (isNaN(lat) || lat < -90 || lat > 90) {
    throw new ApiError(400, "Vĩ độ (lat) không hợp lệ (-90 đến 90)")
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    throw new ApiError(400, "Kinh độ (lng) không hợp lệ (-180 đến 180)")
  }

  // 3. Upsert vào bảng driver_locations với kiểu dữ liệu PostGIS GEOMETRY(Point, 4326)

  const rows = await client.unsafe(
    `
    INSERT INTO driver_locations (driver_id, location_point, heading, updated_at)
    VALUES (
      $1::uuid,
      ST_SetSRID(ST_MakePoint($2::double precision, $3::double precision), 4326),
      $4::numeric,
      NOW()
    )
    ON CONFLICT (driver_id) DO UPDATE
    SET 
      location_point = EXCLUDED.location_point,
      heading = EXCLUDED.heading,
      updated_at = NOW()
    RETURNING 
      driver_id,
      ST_Y(location_point) as latitude,
      ST_X(location_point) as longitude,
      heading,
      updated_at
    `,

    [driverId, lng, lat, heading],
  )

  // Cập nhật mốc thời gian rate-limit

  driverLastUpdateMap.set(driverId, now)

  const updated = rows[0]

  // 4. Kiểm tra tài xế có đang trong chuyến đi nào không

  const activeBookings = await client.unsafe(
    `
    SELECT id, booking_code, status
    FROM bookings
    WHERE driver_id = $1::uuid
      AND status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    ORDER BY created_at DESC
    LIMIT 1
    `,

    [driverId],
  )

  let activeBooking: ActiveBookingTrackingSummary | null = null

  // 5. Nếu có chuyến đi đang chạy -> Bắn ngay sự kiện Pusher realtime đến kênh chuyến đi của khách

  if (activeBookings.length > 0) {
    const ab = activeBookings[0]

    activeBooking = {
      id: ab.id,

      bookingCode: ab.booking_code,

      status: ab.status,
    }

    await triggerDriverLocationUpdate(ab.id, {
      driverId,

      latitude: Number(updated.latitude),

      longitude: Number(updated.longitude),

      heading,

      speed,
    })
  }

  return {
    driverId: updated.driver_id,

    latitude: Number(updated.latitude),

    longitude: Number(updated.longitude),

    heading: updated.heading !== null ? Number(updated.heading) : null,

    speed: speed !== null ? Number(speed) : null,

    updatedAt: updated.updated_at,

    activeBooking,
  }
}

/**
 * 2. Lấy vị trí GPS hiện tại của một tài xế
 */

export async function getDriverLocation(driverId: string) {
  if (!driverId) return null

  const rows = await client.unsafe(
    `
    SELECT 
      driver_id,
      ST_Y(location_point) as latitude,
      ST_X(location_point) as longitude,
      heading,
      updated_at
    FROM driver_locations
    WHERE driver_id = $1::uuid
    LIMIT 1
    `,

    [driverId],
  )

  if (rows.length === 0) return null

  const row = rows[0]

  return {
    driverId: row.driver_id,

    latitude: Number(row.latitude),

    longitude: Number(row.longitude),

    heading: row.heading !== null ? Number(row.heading) : null,

    updatedAt: row.updated_at,
  }
}

/**
 * 3. CORE TASK 3.1: Viết query PostGIS tìm danh sách tài xế đang online trong bán kính (3-5km)
 *
 * TIÊU CHÍ LỌC NGHIÊM NGẶT:
 * 1. dp.is_online = true (Tài xế đang sẵn sàng nhận cuốc)
 * 2. dp.kyc_status = 'APPROVED' (Hồ sơ đã được Quản trị viên duyệt)
 * 3. dp.is_active = true (Tài khoản tài xế không bị tạm ngưng/khóa)
 * 4. u.status = 'ACTIVE' (Tài khoản người dùng đang hoạt động)
 * 5. dp.vehicle_type_id = :vehicleTypeId (Khớp loại xe khách yêu cầu, nếu có truyền)
 * 6. Vị trí hiện tại nằm trong bán kính tìm kiếm (sử dụng ST_DWithin trên geography để tính chuẩn mét)
 * 7. Tài xế không đang bận một chuyến xe khác (NOT IN 'ACCEPTED', 'IN_TRANSIT')
 * 8. Sắp xếp tài xế từ gần nhất đến xa nhất theo khoảng cách thực tế (ST_Distance)
 */

export async function findNearbyDrivers(
  options: FindNearbyDriversOptions,
): Promise<NearbyDriverResult[]> {
  const originLat = Number(options.originLat)

  const originLng = Number(options.originLng)

  if (isNaN(originLat) || originLat < -90 || originLat > 90) {
    throw new ApiError(
      400,

      "Tọa độ điểm đón (originLat) không hợp lệ (-90 đến 90)",
    )
  }

  if (isNaN(originLng) || originLng < -180 || originLng > 180) {
    throw new ApiError(
      400,

      "Tọa độ điểm đón (originLng) không hợp lệ (-180 đến 180)",
    )
  }

  // Xác định bán kính tìm kiếm tính bằng mét (mặc định 5000m = 5km)

  let radiusMeters = 5000

  if (options.radiusMeters && options.radiusMeters > 0) {
    radiusMeters = Number(options.radiusMeters)
  } else if (options.radiusKm && options.radiusKm > 0) {
    radiusMeters = Number(options.radiusKm) * 1000
  }

  const limit =
    options.limit && options.limit > 0
      ? Math.min(Number(options.limit), 50)
      : 10

  const vehicleTypeId = options.vehicleTypeId
    ? String(options.vehicleTypeId).trim()
    : null

  const excludeDriverIds = Array.isArray(options.excludeDriverIds)
    ? options.excludeDriverIds.filter(Boolean)
    : []

  const maxAgeMinutes =
    options.maxAgeMinutes !== undefined ? Number(options.maxAgeMinutes) : null

  // Xây dựng điều kiện truy vấn SQL PostGIS an toàn

  const conditions: string[] = [
    `dp.is_online = true`,

    `dp.kyc_status = 'APPROVED'`,

    `dp.is_active = true`,

    `u.status = 'ACTIVE'`,

    // PostGIS ST_DWithin trên geography (chuẩn bán cầu WGS84, khoảng cách tính bằng mét)

    `ST_DWithin(
      dl.location_point::geography,
      ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography,
      $3::double precision
    )`,
  ]

  const params: any[] = [originLng, originLat, radiusMeters]

  let paramIndex = 4

  if (vehicleTypeId) {
    conditions.push(`dp.vehicle_type_id = $${paramIndex}::uuid`)

    params.push(vehicleTypeId)

    paramIndex++
  }

  if (excludeDriverIds.length > 0) {
    conditions.push(`dp.id NOT IN (SELECT unnest($${paramIndex}::uuid[]))`)

    params.push(excludeDriverIds)

    paramIndex++
  }

  // Loại trừ tài xế đang trong chuyến đi chưa hoàn thành
  conditions.push(`
    NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.driver_id = dp.id
        AND b.status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    )
  `)

  // Nếu có giới hạn thời gian cập nhật GPS gần nhất
  if (maxAgeMinutes && maxAgeMinutes > 0) {
    conditions.push(
      `dl.updated_at >= NOW() - ($${paramIndex}::integer * INTERVAL '1 minute')`,
    )
    params.push(maxAgeMinutes)
    paramIndex++
  }

  // Task 2.3: Lọc tài xế đủ điều kiện ký quỹ ví (mặc định: balance >= minDepositLimit)
  const requireMinDeposit = options.requireMinDeposit !== false
  if (requireMinDeposit) {
    conditions.push(
      `(w.id IS NOT NULL AND w.balance >= COALESCE(w.min_deposit_limit, 200000))`,
    )
  }

  params.push(limit)

  const limitParam = `$${paramIndex}`

  const query = `
    SELECT 
      dp.id AS driver_id,
      dp.user_id,
      u.full_name,
      u.phone,
      u.avatar_url,
      dp.license_plate,
      dp.rating_avg,
      dp.vehicle_type_id,
      vt.code AS vehicle_type_code,
      vt.name AS vehicle_type_name,
      ST_Y(dl.location_point) AS latitude,
      ST_X(dl.location_point) AS longitude,
      dl.heading,
      dl.updated_at AS last_updated_at,
      ROUND(
        ST_Distance(
          dl.location_point::geography,
          ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography
        )::numeric, 1
      ) AS distance_meters
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    JOIN driver_locations dl ON dl.driver_id = dp.id
    LEFT JOIN vehicle_types vt ON vt.id = dp.vehicle_type_id
    LEFT JOIN wallets w ON w.user_id = dp.user_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY distance_meters ASC
    LIMIT ${limitParam}
  `

  const rows = await client.unsafe(query, params)

  return rows.map((r: any) => {
    const distMeters = Number(r.distance_meters)

    return {
      driverId: r.driver_id,

      userId: r.user_id,

      fullName: r.full_name || "Tài xế",

      phone: r.phone,

      avatarUrl: r.avatar_url || null,

      licensePlate: r.license_plate || null,

      ratingAvg: Number(r.rating_avg || 5.0),

      vehicleTypeId: r.vehicle_type_id || null,

      vehicleTypeCode: r.vehicle_type_code || null,

      vehicleTypeName: r.vehicle_type_name || null,

      currentLocation: {
        latitude: Number(r.latitude),

        longitude: Number(r.longitude),

        heading: r.heading !== null ? Number(r.heading) : null,

        lastUpdatedAt: r.last_updated_at,
      },

      distanceMeters: distMeters,

      distanceKm: Math.round((distMeters / 1000) * 100) / 100,
    }
  })
}

export interface DemandHotspotsOptions {
  lat?: number
  lng?: number
  radiusKm?: number
}

export interface DemandHotspotItem {
  district: string
  count: number
  lat: number
  lng: number
  radiusMeters: number
}

export interface DemandHotspotsResult {
  isHighDemand: boolean
  badge: string
  text: string
  surgeBonusPercent: number
  hotspots: DemandHotspotItem[]
}

/**
 * Phân tích các khu vực có nhu cầu đặt xe cao thời gian thực dựa trên cơ sở dữ liệu bookings
 */
export async function getDemandHotspots(
  options?: DemandHotspotsOptions,
): Promise<DemandHotspotsResult> {
  const currentLat = options?.lat || 10.7769
  const currentLng = options?.lng || 106.7009
  const radiusKm = options?.radiusKm || 25

  try {
    // 1. Quét các đơn hàng đang PENDING / SEARCHING hoặc vừa tạo gần đây
    const query = `
      SELECT 
        b.id,
        b.origin_address,
        ST_X(b.origin_point::geometry) AS lng,
        ST_Y(b.origin_point::geometry) AS lat,
        b.status,
        b.created_at,
        ROUND(
          ST_Distance(
            b.origin_point::geography,
            ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography
          )::numeric, 1
        ) AS distance_meters
      FROM bookings b
      WHERE (
        b.status IN ('PENDING', 'SEARCHING')
        OR (b.created_at >= NOW() - INTERVAL '4 hours' AND b.status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT'))
      )
      AND ST_DWithin(
        b.origin_point::geography,
        ST_SetSRID(ST_MakePoint($1::double precision, $2::double precision), 4326)::geography,
        $3
      )
      ORDER BY b.created_at DESC
      LIMIT 50
    `

    const rows = await client.unsafe(query, [currentLng, currentLat, radiusKm * 1000])

    const extractDistrict = (addr: string): string => {
      if (!addr) return "Khu vực lân cận"
      const match = addr.match(
        /(Quận\s+\w+|Q\.\s*\w+|Huyện\s+\w+|TP\.\s*\w+|Thị xã\s+\w+|Bình Thạnh|Gò Vấp|Tân Bình|Tân Phú|Phú Nhuận|Bình Tân|Củ Chi|Hóc Môn|Nhà Bè|Cần Giờ|Thủ Đức|Sóng Thần|Tân Tạo|Cát Lái|Hoàn Kiếm|Ba Đình|Đống Đa|Hai Bà Trưng|Cầu Giấy|Thanh Xuân|Hải Châu|Sơn Trà|Ngũ Hành Sơn|Ninh Kiều)/i,
      )
      if (match) {
        let name = match[0].trim()
        if (/^Q\.\s*(\d+)$/i.test(name)) name = `Quận ${name.replace(/^Q\.\s*/i, "")}`
        return name
      }
      const parts = addr.split(",")
      if (parts.length >= 2) return parts[parts.length - 2].trim()
      return "Khu vực trung tâm"
    }

    const districtMap: Record<string, { count: number; lats: number[]; lngs: number[] }> = {}

    rows.forEach((r: any) => {
      const distName = extractDistrict(r.origin_address)
      if (!districtMap[distName]) {
        districtMap[distName] = { count: 0, lats: [], lngs: [] }
      }
      districtMap[distName].count += 1
      districtMap[distName].lats.push(Number(r.lat))
      districtMap[distName].lngs.push(Number(r.lng))
    })

    const sortedDistricts = Object.entries(districtMap)
      .map(([name, val]) => ({
        district: name,
        count: val.count,
        lat: val.lats.reduce((a, b) => a + b, 0) / val.lats.length,
        lng: val.lngs.reduce((a, b) => a + b, 0) / val.lngs.length,
        radiusMeters: Math.min(2500, Math.max(1000, val.count * 600)),
      }))
      .sort((a, b) => b.count - a.count)

    const totalOrders = rows.length

    if (sortedDistricts.length > 0 && totalOrders >= 2) {
      const topNames = sortedDistricts.slice(0, 2).map((d) => d.district).join(" & ")
      return {
        isHighDemand: true,
        badge: "🔥 Nhu cầu cao:",
        text: `${topNames} đang có ${totalOrders} đơn đặt xe (+15% cước)`,
        surgeBonusPercent: 15,
        hotspots: sortedDistricts.slice(0, 3),
      }
    }

    if (sortedDistricts.length === 1) {
      const d = sortedDistricts[0]
      return {
        isHighDemand: false,
        badge: "⚡ Đang có đơn:",
        text: `${d.district} đang có đơn đặt xe chờ tài xế tiếp nhận`,
        surgeBonusPercent: 0,
        hotspots: [d],
      }
    }

    return {
      isHighDemand: false,
      badge: "🟢 Nhu cầu ổn định:",
      text: "Hệ thống đang quét đơn hàng phù hợp gần vị trí bạn",
      surgeBonusPercent: 0,
      hotspots: [
        {
          district: "Khu vực của bạn",
          count: 1,
          lat: currentLat,
          lng: currentLng,
          radiusMeters: 1200,
        },
      ],
    }
  } catch (err) {
    console.warn("Lỗi phân tích điểm nóng nhu cầu:", err)
    return {
      isHighDemand: false,
      badge: "🟢 Nhu cầu ổn định:",
      text: "Đang sẵn sàng kết nối các cuốc xe quanh bạn",
      surgeBonusPercent: 0,
      hotspots: [],
    }
  }
}
