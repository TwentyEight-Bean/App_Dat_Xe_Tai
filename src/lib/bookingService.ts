import { client } from "../db"
import { ApiError } from "./errors"
import { findNearbyDrivers } from "./dispatchService"
import {
  triggerDriverNewOffer,
  triggerBookingAccepted,
  triggerOfferCancelled,
  triggerBookingStatusChange,
  triggerBookingCancelled,
} from "./pusher"
import { calculateRouteDistance } from "./distanceService"
import {
  notifyDriverNewBookingOffer,
  notifyCustomerBookingAccepted,
  notifyCustomerDriverArrived,
  notifyCustomerBookingInTransit,
  notifyCustomerBookingCompleted,
  notifyTripCancelled,
} from "./notificationService"

export interface CreateBookingDto {
  vehicleTypeId: string
  originAddress: string
  originLat: number
  originLng: number
  destinationAddress: string
  destLat: number
  destLng: number
  estimatedPrice?: number
  surchargePrice?: number
  paymentMethod?: "CASH" | "WALLET" | "VNPAY" | "MOMO"
}

/**
 * Tạo mã chuyến xe duy nhất (VD: BK260109-842)
 */
function generateBookingCode(): string {
  const d = new Date()
  const dateStr = `${d.getFullYear().toString().slice(-2)}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`
  const randomNum = Math.floor(1000 + Math.random() * 9000)
  return `BK${dateStr}-${randomNum}`
}

/**
 * 1. Khách hàng tạo chuyến xe mới (POST /bookings)
 * Tự động tìm tài xế PostGIS trong bán kính và bắn sự kiện nổ cuốc qua Pusher
 */
export async function createBooking(
  customerId: string,
  data: CreateBookingDto,
) {
  if (!customerId) {
    throw new ApiError(401, "Yêu cầu đăng nhập tài khoản khách hàng")
  }

  if (!data.vehicleTypeId) {
    throw new ApiError(400, "Thiếu thông tin loại xe (vehicleTypeId)")
  }
  if (
    !data.originAddress ||
    data.originLat === undefined ||
    data.originLng === undefined
  ) {
    throw new ApiError(
      400,
      "Thiếu thông tin hoặc tọa độ điểm lấy hàng (originAddress, originLat, originLng)",
    )
  }
  if (
    !data.destinationAddress ||
    data.destLat === undefined ||
    data.destLng === undefined
  ) {
    throw new ApiError(
      400,
      "Thiếu thông tin hoặc tọa độ điểm giao hàng (destinationAddress, destLat, destLng)",
    )
  }

  const originLat = Number(data.originLat)
  const originLng = Number(data.originLng)
  const destLat = Number(data.destLat)
  const destLng = Number(data.destLng)

  // 1. Tính toán khoảng cách lộ trình thực tế
  const route = await calculateRouteDistance(
    originLat,
    originLng,
    destLat,
    destLng,
  )
  const distanceKm = route.distanceKm

  // 2. Tính cước phí dựa theo pricing_rules nếu chưa có estimatedPrice
  let totalPrice = Number(data.estimatedPrice || 0)
  let basePrice = totalPrice
  const surchargePrice = Number(data.surchargePrice || 0)

  if (totalPrice <= 0) {
    const rules = await client.unsafe(
      `SELECT base_price, base_distance_km, price_per_km FROM pricing_rules WHERE vehicle_type_id = $1::uuid LIMIT 1`,
      [data.vehicleTypeId],
    )

    if (rules.length > 0) {
      const rule = rules[0]
      const bPrice = Number(rule.base_price)
      const bDist = Number(rule.base_distance_km)
      const pPerKm = Number(rule.price_per_km)

      if (distanceKm <= bDist) {
        basePrice = bPrice
      } else {
        basePrice = bPrice + (distanceKm - bDist) * pPerKm
      }
      totalPrice = Math.round(basePrice + surchargePrice)
    } else {
      // Mặc định fallback nếu loại xe chưa cài bảng giá
      basePrice = Math.round(150000 + distanceKm * 15000)
      totalPrice = basePrice + surchargePrice
    }
  }

  // Hoa hồng sàn (20%)
  const driverCommission = Math.round(totalPrice * 0.2)
  const bookingCode = generateBookingCode()
  const paymentMethod = data.paymentMethod || "CASH"

  // 3. Tạo đơn hàng vào Database với tọa độ PostGIS GEOMETRY(Point, 4326)
  const inserted = await client.unsafe(
    `
    INSERT INTO bookings (
      booking_code,
      customer_id,
      vehicle_type_id,
      status,
      origin_address,
      origin_point,
      destination_address,
      destination_point,
      distance_km,
      base_price,
      surcharge_price,
      total_price,
      driver_commission,
      payment_method,
      payment_status,
      created_at,
      updated_at
    ) VALUES (
      $1,
      $2::uuid,
      $3::uuid,
      'SEARCHING',
      $4,
      ST_SetSRID(ST_MakePoint($5::double precision, $6::double precision), 4326),
      $7,
      ST_SetSRID(ST_MakePoint($8::double precision, $9::double precision), 4326),
      $10::numeric,
      $11::numeric,
      $12::numeric,
      $13::numeric,
      $14::numeric,
      $15,
      'UNPAID',
      NOW(),
      NOW()
    )
    RETURNING 
      id,
      booking_code,
      customer_id,
      vehicle_type_id,
      status,
      origin_address,
      destination_address,
      distance_km,
      total_price,
      created_at
    `,
    [
      bookingCode,
      customerId,
      data.vehicleTypeId,
      data.originAddress,
      originLng,
      originLat,
      data.destinationAddress,
      destLng,
      destLat,
      distanceKm,
      basePrice,
      surchargePrice,
      totalPrice,
      driverCommission,
      paymentMethod,
    ],
  )

  const booking = inserted[0]

  // 4. Quét tìm tài xế gần nhất trong bán kính 3-5km (Task 3.1)
  const nearbyDrivers = await findNearbyDrivers({
    originLat,
    originLng,
    radiusKm: 5, // Bán kính vòng 1: quét đến 5km
    vehicleTypeId: data.vehicleTypeId,
    limit: 10,
  })

  // 5. Bắn sự kiện Pusher "Có cuốc mới" (Task 3.2) đến từng tài xế tìm được
  for (const driver of nearbyDrivers) {
    await triggerDriverNewOffer(driver.driverId, {
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      originAddress: booking.origin_address,
      destinationAddress: booking.destination_address,
      distanceKm: Number(booking.distance_km),
      totalPrice: Number(booking.total_price),
      vehicleTypeName: driver.vehicleTypeName,
      expiresInSeconds: 20, // Đếm ngược 20 giây để tài xế nhận cuốc
    })
  }

  // 6. Bắn thông báo đẩy Push Notification FCM (Task 3.5) đến các tài xế trong bán kính
  const driverUserIds = nearbyDrivers.map((d) => d.userId).filter(Boolean)
  if (driverUserIds.length > 0) {
    notifyDriverNewBookingOffer(driverUserIds, {
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      originAddress: booking.origin_address,
      destinationAddress: booking.destination_address,
      distanceKm: Number(booking.distance_km),
      totalPrice: Number(booking.total_price),
      vehicleTypeName: nearbyDrivers[0]?.vehicleTypeName || undefined,
    }).catch((err) => console.warn("FCM new offer error:", err.message))
  }

  return {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    status: booking.status,
    distanceKm: Number(booking.distance_km),
    totalPrice: Number(booking.total_price),
    matchedDriversCount: nearbyDrivers.length,
    matchedDrivers: nearbyDrivers.map((d) => ({
      driverId: d.driverId,
      name: d.fullName,
      distanceKm: d.distanceKm,
    })),
  }
}

/**
 * 2. Tài xế bấm nhận cuốc xe (POST /driver/bookings/:id/accept)
 * CHỐNG TRANH CHẤP CUỐC XE (Race Condition) bằng Atomic SQL Update
 */
export async function acceptBooking(driverUserId: string, bookingId: string) {
  if (!driverUserId) {
    throw new ApiError(401, "Yêu cầu đăng nhập tài khoản tài xế")
  }
  if (!bookingId) {
    throw new ApiError(400, "Thiếu thông tin bookingId")
  }

  // 1. Kiểm tra tài xế có đủ điều kiện nhận cuốc
  const driverRows = await client.unsafe(
    `
    SELECT dp.id, dp.user_id, dp.kyc_status, dp.is_online, dp.is_active, dp.license_plate,
           u.full_name, u.phone, u.avatar_url,
           vt.name as vehicle_type_name
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    LEFT JOIN vehicle_types vt ON vt.id = dp.vehicle_type_id
    WHERE dp.user_id = $1::uuid
    LIMIT 1
    `,
    [driverUserId],
  )

  if (driverRows.length === 0) {
    throw new ApiError(404, "Không tìm thấy hồ sơ tài xế")
  }

  const driver = driverRows[0]

  if (driver.kyc_status !== "APPROVED") {
    throw new ApiError(403, "Tài xế chưa được duyệt KYC, không thể nhận cuốc")
  }
  if (!driver.is_active) {
    throw new ApiError(403, "Tài khoản tài xế đang bị tạm ngưng")
  }
  if (!driver.is_online) {
    throw new ApiError(
      400,
      "Vui lòng bật trạng thái Trực tuyến (Online) trước khi nhận cuốc",
    )
  }

  // 2. Kiểm tra tài xế có đang kẹt chuyến xe khác không
  const busyRows = await client.unsafe(
    `
    SELECT id, booking_code FROM bookings
    WHERE driver_id = $1::uuid AND status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    LIMIT 1
    `,
    [driver.id],
  )

  if (busyRows.length > 0) {
    throw new ApiError(
      400,
      `Bạn đang có chuyến xe "${busyRows[0].booking_code}" chưa hoàn thành. Không thể nhận thêm cuốc mới.`,
    )
  }

  // 3. ATOMIC UPDATE: Chỉ cập nhật nếu status hiện tại là 'SEARCHING'
  // Đảm bảo dù 2 hay nhiều tài xế cùng bấm trong 1 mili-giây, chỉ ĐÚNG 1 người nhận được
  const updated = await client.unsafe(
    `
    UPDATE bookings
    SET 
      driver_id = $1::uuid,
      status = 'ACCEPTED',
      updated_at = NOW()
    WHERE id = $2::uuid
      AND status = 'SEARCHING'
    RETURNING *
    `,
    [driver.id, bookingId],
  )

  if (updated.length === 0) {
    // Kiểm tra nguyên nhân thất bại
    const currentBooking = await client.unsafe(
      `SELECT status, driver_id FROM bookings WHERE id = $1::uuid LIMIT 1`,
      [bookingId],
    )

    if (currentBooking.length === 0) {
      throw new ApiError(404, "Chuyến xe không tồn tại")
    }

    if (
      currentBooking[0].driver_id &&
      currentBooking[0].driver_id !== driver.id
    ) {
      throw new ApiError(
        409,
        "Rất tiếc! Chuyến xe này đã được một tài xế khác nhanh tay tiếp nhận.",
        "BOOKING_ALREADY_TAKEN",
      )
    }

    if (currentBooking[0].status === "CANCELLED") {
      throw new ApiError(
        400,
        "Chuyến xe đã bị hủy bởi khách hàng.",
        "BOOKING_CANCELLED",
      )
    }

    throw new ApiError(
      400,
      `Chuyến xe không ở trạng thái sẵn sàng để nhận (Trạng thái hiện tại: ${currentBooking[0].status})`,
    )
  }

  const acceptedBooking = updated[0]

  // 4. Bắn sự kiện Pusher đến Khách hàng: "Tài xế đã nhận cuốc" (kênh trip-{bookingId})
  await triggerBookingAccepted(bookingId, {
    driverId: driver.id,
    driverName: driver.full_name,
    driverPhone: driver.phone,
    avatarUrl: driver.avatar_url,
    licensePlate: driver.license_plate,
    vehicleTypeName: driver.vehicle_type_name,
    ratingAvg: 5.0,
  })

  // 4.1 Bắn Push Notification FCM đến Khách hàng (Task 3.5)
  notifyCustomerBookingAccepted(acceptedBooking.customer_id, {
    bookingId,
    bookingCode: acceptedBooking.booking_code,
    driverName: driver.full_name,
    driverPhone: driver.phone,
    licensePlate: driver.license_plate,
    vehicleTypeName: driver.vehicle_type_name,
  }).catch((err) => console.warn("FCM accept booking error:", err.message))

  // 5. Bắn sự kiện hủy lời mời đến các tài xế lân cận khác (để tắt popup đếm ngược)
  // Quét các tài xế khác đang online cùng loại xe
  const otherDrivers = await client.unsafe(
    `
    SELECT id FROM driver_profiles
    WHERE is_online = true AND kyc_status = 'APPROVED' AND id != $1::uuid
    `,
    [driver.id],
  )

  for (const d of otherDrivers) {
    await triggerOfferCancelled(d.id, bookingId, "TAKEN")
  }

  return {
    bookingId: acceptedBooking.id,
    bookingCode: acceptedBooking.booking_code,
    status: "ACCEPTED",
    originAddress: acceptedBooking.origin_address,
    destinationAddress: acceptedBooking.destination_address,
    distanceKm: Number(acceptedBooking.distance_km),
    totalPrice: Number(acceptedBooking.total_price),
    driverCommission: Number(acceptedBooking.driver_commission),
    message: "Nhận chuyến thành công! Vui lòng di chuyển đến điểm lấy hàng.",
  }
}

/**
 * 3. Lấy thông tin chi tiết một chuyến xe (GET /bookings/:id)
 */
export async function getBookingById(bookingId: string) {
  if (!bookingId) {
    throw new ApiError(400, "Thiếu thông tin bookingId")
  }

  const rows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.origin_address,
      ST_Y(b.origin_point) as origin_lat,
      ST_X(b.origin_point) as origin_lng,
      b.destination_address,
      ST_Y(b.destination_point) as dest_lat,
      ST_X(b.destination_point) as dest_lng,
      b.distance_km,
      b.base_price,
      b.surcharge_price,
      b.total_price,
      b.driver_commission,
      b.payment_method,
      b.payment_status,
      b.created_at,
      b.updated_at,
      u.full_name as customer_name,
      u.phone as customer_phone,
      u.avatar_url as customer_avatar,
      b.driver_id,
      du.full_name as driver_name,
      du.phone as driver_phone,
      du.avatar_url as driver_avatar,
      dp.license_plate,
      vt.name as vehicle_type_name,
      ST_Y(dl.location_point) as driver_lat,
      ST_X(dl.location_point) as driver_lng,
      dl.heading as driver_heading,
      dl.updated_at as driver_loc_updated_at
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    LEFT JOIN driver_locations dl ON dl.driver_id = dp.id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId],
  )

  if (rows.length === 0) {
    throw new ApiError(404, "Không tìm thấy chuyến xe")
  }

  const r = rows[0]
  return {
    id: r.id,
    bookingCode: r.booking_code,
    status: r.status,
    origin: {
      address: r.origin_address,
      latitude: Number(r.origin_lat),
      longitude: Number(r.origin_lng),
    },
    destination: {
      address: r.destination_address,
      latitude: Number(r.dest_lat),
      longitude: Number(r.dest_lng),
    },
    distanceKm: Number(r.distance_km),
    pricing: {
      basePrice: Number(r.base_price),
      surchargePrice: Number(r.surcharge_price),
      totalPrice: Number(r.total_price),
      driverCommission: Number(r.driver_commission),
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
    },
    customer: {
      name: r.customer_name,
      phone: r.customer_phone,
      avatarUrl: r.customer_avatar,
    },
    driver: r.driver_name
      ? {
          id: r.driver_id,
          name: r.driver_name,
          phone: r.driver_phone,
          avatarUrl: r.driver_avatar,
          licensePlate: r.license_plate,
          vehicleTypeName: r.vehicle_type_name,
          currentLocation:
            r.driver_lat !== null
              ? {
                  latitude: Number(r.driver_lat),
                  longitude: Number(r.driver_lng),
                  heading:
                    r.driver_heading !== null ? Number(r.driver_heading) : null,
                  updatedAt: r.driver_loc_updated_at,
                }
              : null,
        }
      : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/**
 * 4. Lấy lịch sử chuyến xe của khách hàng (GET /bookings)
 */
export async function getCustomerBookings(customerId: string, limit = 20) {
  const rows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.origin_address,
      b.destination_address,
      b.distance_km,
      b.total_price,
      b.payment_method,
      b.created_at
    FROM bookings b
    WHERE b.customer_id = $1::uuid
    ORDER BY b.created_at DESC
    LIMIT $2
    `,
    [customerId, limit],
  )

  return rows.map((r: any) => ({
    id: r.id,
    bookingCode: r.booking_code,
    status: r.status,
    originAddress: r.origin_address,
    destinationAddress: r.destination_address,
    distanceKm: Number(r.distance_km),
    totalPrice: Number(r.total_price),
    paymentMethod: r.payment_method,
    createdAt: r.created_at,
  }))
}

/**
 * 4.1 Lấy chuyến xe đang chạy của tài xế (GET /driver/bookings/active)
 */
export async function getDriverActiveBooking(driverId: string) {
  const rows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.origin_address,
      ST_Y(b.origin_point) as origin_lat,
      ST_X(b.origin_point) as origin_lng,
      b.destination_address,
      ST_Y(b.destination_point) as dest_lat,
      ST_X(b.destination_point) as dest_lng,
      b.distance_km,
      b.total_price,
      b.driver_commission,
      b.payment_method,
      b.payment_status,
      b.created_at,
      b.updated_at,
      u.full_name as customer_name,
      u.phone as customer_phone,
      u.avatar_url as customer_avatar
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    WHERE b.driver_id = $1::uuid 
      AND b.status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    ORDER BY b.created_at DESC
    LIMIT 1
    `,
    [driverId],
  )

  if (rows.length === 0) {
    return null
  }

  const r = rows[0]
  return {
    id: r.id,
    bookingCode: r.booking_code,
    status: r.status,
    origin: {
      address: r.origin_address,
      latitude: Number(r.origin_lat),
      longitude: Number(r.origin_lng),
    },
    destination: {
      address: r.destination_address,
      latitude: Number(r.dest_lat),
      longitude: Number(r.dest_lng),
    },
    distanceKm: Number(r.distance_km),
    totalPrice: Number(r.total_price),
    driverCommission: Number(r.driver_commission),
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    customer: {
      name: r.customer_name,
      phone: r.customer_phone,
      avatarUrl: r.customer_avatar,
    },
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/**
 * Bảng ánh xạ các bước chuyển trạng thái hợp lệ của chuyến xe (Finite State Machine)
 * Đã nhận (ACCEPTED) -> Tới lấy (ARRIVED_AT_PICKUP) -> Đang giao (IN_TRANSIT) -> Hoàn thành (COMPLETED)
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  SEARCHING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["ARRIVED_AT_PICKUP", "IN_TRANSIT", "CANCELLED"],
  ARRIVED_AT_PICKUP: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
}

const STATUS_MESSAGES: Record<string, string> = {
  ARRIVED_AT_PICKUP: "Tài xế đã đến điểm lấy hàng. Vui lòng chuẩn bị hàng hóa!",
  IN_TRANSIT: "Hàng hóa đã được bốc lên xe và đang trên đường vận chuyển.",
  COMPLETED:
    "Chuyến hàng đã được giao thành công! Cảm ơn bạn đã sử dụng dịch vụ.",
}

/**
 * 5. CORE TASK 3.3: Tài xế cập nhật trạng thái chuyến đi (PATCH /driver/bookings/:id/status)
 * Luồng: Đã nhận -> Tới lấy -> Đang giao -> Hoàn thành
 */
export async function updateBookingStatus(
  driverUserId: string,
  bookingId: string,
  newStatus: string,
  note?: string,
) {
  if (!driverUserId) {
    throw new ApiError(401, "Yêu cầu đăng nhập tài khoản tài xế")
  }
  if (!bookingId) {
    throw new ApiError(400, "Thiếu thông tin bookingId")
  }
  if (!newStatus) {
    throw new ApiError(400, "Thiếu thông tin trạng thái mới (status)")
  }

  const cleanStatus = String(newStatus).trim().toUpperCase()
  const allowedStatuses = ["ARRIVED_AT_PICKUP", "IN_TRANSIT", "COMPLETED"]

  if (!allowedStatuses.includes(cleanStatus)) {
    throw new ApiError(
      400,
      `Trạng thái "${newStatus}" không hợp lệ. Các trạng thái cho phép: ${allowedStatuses.join(", ")}`,
    )
  }

  // 1. Kiểm tra tài xế có tồn tại không
  const driverProfile = await client.unsafe(
    `SELECT dp.id, u.full_name FROM driver_profiles dp JOIN users u ON u.id = dp.user_id WHERE dp.user_id = $1::uuid LIMIT 1`,
    [driverUserId],
  )

  if (driverProfile.length === 0) {
    throw new ApiError(404, "Không tìm thấy hồ sơ tài xế")
  }
  const driverId = driverProfile[0].id

  // 2. Lấy thông tin chuyến xe hiện tại
  const bookingRows = await client.unsafe(
    `SELECT id, booking_code, status, driver_id, customer_id, total_price, payment_method FROM bookings WHERE id = $1::uuid LIMIT 1`,
    [bookingId],
  )

  if (bookingRows.length === 0) {
    throw new ApiError(404, "Chuyến xe không tồn tại")
  }

  const booking = bookingRows[0]

  // Kiểm tra tài xế có quyền cập nhật cuốc xe này không
  if (booking.driver_id !== driverId) {
    throw new ApiError(403, "Bạn không phải là tài xế phụ trách chuyến xe này")
  }

  const currentStatus = String(booking.status)

  if (currentStatus === cleanStatus) {
    return {
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      status: currentStatus,
      message: `Chuyến xe đã ở trạng thái ${cleanStatus}`,
    }
  }

  // 3. Kiểm tra tính hợp lệ của luồng trạng thái (State Machine Validation)
  const allowedNext = VALID_TRANSITIONS[currentStatus] || []
  if (!allowedNext.includes(cleanStatus)) {
    throw new ApiError(
      400,
      `Không thể chuyển trạng thái từ "${currentStatus}" sang "${cleanStatus}". Luồng hợp lệ: ${allowedNext.join(" hoặc ")}`,
    )
  }

  // 4. Cập nhật Database
  // Nếu hoàn thành chuyến đi -> tự động chuyển payment_status sang PAID (nếu tiền mặt/ví)
  const updatedRows = await client.unsafe(
    `
    UPDATE bookings
    SET 
      status = $1::booking_status,
      payment_status = CASE WHEN $1 = 'COMPLETED' THEN 'PAID'::payment_status ELSE payment_status END,
      updated_at = NOW()
    WHERE id = $2::uuid AND driver_id = $3::uuid
    RETURNING id, booking_code, status, payment_status, updated_at
    `,
    [cleanStatus, bookingId, driverId],
  )

  const updatedBooking = updatedRows[0]
  const statusMsg =
    STATUS_MESSAGES[cleanStatus] ||
    `Cập nhật trạng thái thành công: ${cleanStatus}`

  // 5. Bắn sự kiện Pusher thời gian thực đến kênh trip-{bookingId} cho khách hàng
  await triggerBookingStatusChange(bookingId, cleanStatus, {
    message: statusMsg,
    driverId,
    note: note || null,
  })

  // 6. Bắn thông báo đẩy Push Notification FCM đến Khách hàng (Task 3.5)
  if (cleanStatus === "ARRIVED_AT_PICKUP") {
    notifyCustomerDriverArrived(booking.customer_id, {
      bookingId,
      bookingCode: booking.booking_code,
      driverName: driverProfile[0]?.full_name || "Tài xế",
    }).catch((err) => console.warn("FCM driver arrived error:", err.message))
  } else if (cleanStatus === "IN_TRANSIT") {
    notifyCustomerBookingInTransit(booking.customer_id, {
      bookingId,
      bookingCode: booking.booking_code,
    }).catch((err) => console.warn("FCM in transit error:", err.message))
  } else if (cleanStatus === "COMPLETED") {
    notifyCustomerBookingCompleted(booking.customer_id, {
      bookingId,
      bookingCode: booking.booking_code,
      totalPrice: Number(booking.total_price),
    }).catch((err) => console.warn("FCM completed error:", err.message))
  }

  return {
    bookingId: updatedBooking.id,
    bookingCode: updatedBooking.booking_code,
    status: updatedBooking.status,
    paymentStatus: updatedBooking.payment_status,
    message: statusMsg,
    updatedAt: updatedBooking.updated_at,
  }
}

/**
 * 6. Khách hàng hoặc tài xế hủy chuyến xe (POST /bookings/:id/cancel)
 */
export async function cancelBooking(
  userId: string,
  bookingId: string,
  reason?: string,
) {
  if (!userId) {
    throw new ApiError(401, "Yêu cầu đăng nhập")
  }
  if (!bookingId) {
    throw new ApiError(400, "Thiếu thông tin bookingId")
  }

  const rows = await client.unsafe(
    `
    SELECT b.id, b.booking_code, b.status, b.customer_id, b.driver_id, dp.user_id as driver_user_id
    FROM bookings b
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId],
  )

  if (rows.length === 0) {
    throw new ApiError(404, "Chuyến xe không tồn tại")
  }

  const b = rows[0]

  // Kiểm tra quyền hủy
  const isCustomer = b.customer_id === userId
  const isDriver = b.driver_user_id === userId

  if (!isCustomer && !isDriver) {
    throw new ApiError(403, "Bạn không có quyền hủy chuyến xe này")
  }

  if (b.status === "CANCELLED") {
    return {
      bookingId: b.id,
      bookingCode: b.booking_code,
      status: "CANCELLED",
      message: "Chuyến xe đã bị hủy trước đó",
    }
  }

  if (b.status === "COMPLETED") {
    throw new ApiError(400, "Chuyến xe đã hoàn thành, không thể hủy")
  }

  if (b.status === "IN_TRANSIT") {
    throw new ApiError(
      400,
      "Hàng hóa đang được vận chuyển trên đường, không thể hủy chuyến xe. Vui lòng liên hệ tổng đài để được hỗ trợ.",
    )
  }

  // Cập nhật sang CANCELLED
  const updatedRows = await client.unsafe(
    `
    UPDATE bookings
    SET status = 'CANCELLED'::booking_status, updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id, booking_code, status, updated_at
    `,
    [bookingId],
  )

  const cancelled = updatedRows[0]
  const cancelledBy = isCustomer ? "CUSTOMER" : "DRIVER"
  const cancelReason =
    reason || (isCustomer ? "Khách hàng yêu cầu hủy cuốc" : "Tài xế hủy cuốc")

  // Bắn sự kiện Pusher thông báo hủy
  await triggerBookingCancelled(
    bookingId,
    cancelledBy,
    cancelReason,
    b.driver_id,
  )

  // Bắn thông báo đẩy Push Notification FCM đến đối phương (Task 3.5)
  const targetUserId = isCustomer ? b.driver_user_id : b.customer_id
  if (targetUserId) {
    notifyTripCancelled(targetUserId, {
      bookingId,
      bookingCode: b.booking_code,
      cancelledBy,
      reason: cancelReason,
    }).catch((err) => console.warn("FCM cancel error:", err.message))
  }

  return {
    bookingId: cancelled.id,
    bookingCode: cancelled.booking_code,
    status: "CANCELLED",
    cancelledBy,
    reason: cancelReason,
    message: "Hủy chuyến xe thành công",
  }
}
