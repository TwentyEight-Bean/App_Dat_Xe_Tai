import { client } from "../db"

import { ApiError } from "./errors"

import { findNearbyDrivers } from "./dispatchService"

import {
  triggerEvent,
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

import {
  checkDriverDepositEligibility,
  deductTripCommission,
  getOrCreateWallet,
} from "./walletService"

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

  // Phương án 1: Kiểm tra nợ xấu của khách hàng (phí phạt hủy chuyến chưa thanh toán)
  const customerWallet = await getOrCreateWallet(customerId)
  const custBalance = Number(customerWallet?.balance || 0)

  if (custBalance < 0) {
    const debtFormatted = Math.abs(custBalance).toLocaleString("vi-VN")
    throw new ApiError(
      400,
      `Tài khoản của bạn đang có khoản nợ phí hủy chuyến chưa thanh toán (${debtFormatted}đ). Vui lòng thanh toán khoản nợ vào ví trước khi tiếp tục đặt chuyến mới.`,
    )
  }

  const paymentMethod = data.paymentMethod || "CASH"

  // Nếu chọn thanh toán bằng ví (WALLET), bắt buộc số dư ví phải đủ trả cước chuyến
  if (paymentMethod === "WALLET" && custBalance < totalPrice) {
    const balanceFormatted = custBalance.toLocaleString("vi-VN")
    const priceFormatted = totalPrice.toLocaleString("vi-VN")
    throw new ApiError(
      400,
      `Số dư ví (${balanceFormatted}đ) không đủ để thanh toán cước chuyến (${priceFormatted}đ). Vui lòng nạp thêm tiền hoặc chọn phương thức Tiền mặt / Chuyển khoản.`,
    )
  }

  // Hoa hồng sàn (20%)

  const driverCommission = Math.round(totalPrice * 0.2)

  const bookingCode = generateBookingCode()
  const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString()

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
      delivery_otp,
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
      $16,
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
      delivery_otp,
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

      deliveryOtp,
    ],
  )

  const booking = inserted[0]

  // 4. Quét tìm tài xế gần nhất trong bán kính vòng 1 (3-5km) (Task 3.1 & Task 2.4)
  let nearbyDrivers = await findNearbyDrivers({
    originLat,
    originLng,
    radiusKm: 5, // Bán kính vòng 1: quét đến 5km
    vehicleTypeId: data.vehicleTypeId,
    limit: 10,
  })

  let dispatchRound = 1

  // Task 2.4: Nếu vòng 1 chưa quét thấy ai -> Tự động mở rộng Vòng 2 (8km)
  if (nearbyDrivers.length === 0) {
    nearbyDrivers = await findNearbyDrivers({
      originLat,
      originLng,
      radiusKm: 8, // Bán kính vòng 2 mở rộng
      vehicleTypeId: data.vehicleTypeId,
      limit: 15,
    })
    if (nearbyDrivers.length > 0) {
      dispatchRound = 2
    }
  }

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
    deliveryOtp: booking.delivery_otp,
    dispatchRound,
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

  // 1.1 Kiểm tra số dư ví ký quỹ của tài xế (Task 4.1)

  const depositEligibility = await checkDriverDepositEligibility(driverUserId)

  if (!depositEligibility.eligible) {
    throw new ApiError(
      403,

      `FORBIDDEN: ${depositEligibility.message}`,

      "INSUFFICIENT_WALLET_DEPOSIT",
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
    id: acceptedBooking.id,

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
      b.cancelled_by,
      b.cancellation_reason,
      b.cancellation_fee,
      b.cancelled_at,
      b.pickup_proof_image,
      b.delivery_proof_image,
      b.delivery_otp,
      b.completed_lat,
      b.completed_lng,
      b.in_transit_at,
      b.completed_at,
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

    cancellation: r.cancelled_by
      ? {
          cancelledBy: r.cancelled_by,
          reason: r.cancellation_reason,
          fee: Number(r.cancellation_fee || 0),
          cancelledAt: r.cancelled_at,
        }
      : null,

    proofImages: {
      pickup: r.pickup_proof_image || null,
      delivery: r.delivery_proof_image || null,
    },

    deliveryOtp: r.delivery_otp || null,
    completedLat: r.completed_lat !== null ? Number(r.completed_lat) : null,
    completedLng: r.completed_lng !== null ? Number(r.completed_lng) : null,
    inTransitAt: r.in_transit_at || null,
    completedAt: r.completed_at || null,

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
 * 4.2 Lấy danh sách các chuyến xe thực tế đang chờ tài xế (SEARCHING)
 */
export async function getAvailableBookings(driverUserId?: string) {
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
      u.full_name as customer_name,
      u.phone as customer_phone,
      u.avatar_url as customer_avatar,
      vt.name as vehicle_type_name
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    WHERE b.status = 'SEARCHING'
      AND b.driver_id IS NULL
    ORDER BY b.created_at DESC
    LIMIT 10
    `,
  )

  return rows.map((r: any) => ({
    bookingId: r.id,
    id: r.id,
    bookingCode: r.booking_code,
    status: r.status,
    originAddress: r.origin_address,
    originLat: Number(r.origin_lat),
    originLng: Number(r.origin_lng),
    destinationAddress: r.destination_address,
    destLat: Number(r.dest_lat),
    destLng: Number(r.dest_lng),
    distanceKm: Number(r.distance_km),
    totalPrice: Number(r.total_price),
    driverEarning: Math.round(Number(r.total_price) * 0.8),
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    vehicleTypeName: r.vehicle_type_name || "Xe tải",
    customerName: r.customer_name || "Khách hàng",
    customerPhone: r.customer_phone || "",
    customerAvatar: r.customer_avatar || null,
    receiverName: "Người nhận hàng",
    expiresInSeconds: 30,
    createdAt: r.created_at,
  }))
}

/**
 * Bảng ánh xạ các bước chuyển trạng thái hợp lệ của chuyến xe (Finite State Machine)
 * Đã nhận (ACCEPTED) -> Tới lấy (ARRIVED_AT_PICKUP) -> Đang giao (IN_TRANSIT) -> Hoàn thành (COMPLETED)
 */

const VALID_TRANSITIONS: Record<string, string[]> = {
  SEARCHING: ["ACCEPTED", "CANCELLED"],

  ACCEPTED: ["ARRIVED_AT_PICKUP", "CANCELLED"],

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

export interface UpdateBookingStatusOptions {
  requireProof?: boolean
  requireOtp?: boolean
  driverLat?: number
  driverLng?: number
  deliveryOtp?: string
  bypassGeofence?: boolean
  bypassReason?: string
}

export async function updateBookingStatus(
  driverUserId: string,
  bookingId: string,
  newStatus: string,
  note?: string,
  proofImageUrl?: string,
  options?: UpdateBookingStatusOptions | boolean,
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

  // 2. Lấy thông tin chuyến xe hiện tại và tọa độ điểm giao hàng để kiểm tra Geofence
  const bookingRows = await client.unsafe(
    `SELECT id, booking_code, status, driver_id, customer_id, total_price, payment_method, delivery_otp,
            ST_Y(destination_point) as dest_lat, ST_X(destination_point) as dest_lng
     FROM bookings WHERE id = $1::uuid LIMIT 1`,
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

  const cleanProof = proofImageUrl ? String(proofImageUrl).trim() : null
  const opts: UpdateBookingStatusOptions =
    typeof options === "boolean" ? { requireProof: options } : options || {}

  // 3.0 RÀNG BUỘC BẮT BUỘC ẢNH KIỆN HÀNG LÊN XE KHI BẮT ĐẦU VẬN CHUYỂN (IN_TRANSIT)
  if (cleanStatus === "IN_TRANSIT") {
    if (opts.requireProof && !cleanProof) {
      throw new ApiError(
        400,
        "Vui lòng chụp hoặc tải ảnh kiện hàng bốc lên xe trước khi bắt đầu vận chuyển.",
        "MISSING_PICKUP_PROOF",
      )
    }
  }

  // 3.1 & 3.2 & 3.3 HỆ THỐNG KIỂM TRA CHỐNG GIAN LẬN KHI HOÀN THÀNH CUỐC (COMPLETED)
  if (cleanStatus === "COMPLETED") {
    // [Lớp 1]: Ràng buộc bắt buộc ảnh bằng chứng giao hàng (POD)
    if (opts.requireProof && !cleanProof) {
      throw new ApiError(
        400,
        "Vui lòng chụp hoặc tải ảnh bằng chứng giao hàng (Proof of Delivery) trước khi hoàn tất cuốc xe.",
        "MISSING_DELIVERY_PROOF",
      )
    }

    // [Lớp 2]: Ràng buộc mã OTP xác nhận từ người nhận hàng
    if (opts.requireOtp && booking.delivery_otp) {
      const providedOtp = opts.deliveryOtp ? String(opts.deliveryOtp).trim() : ""
      const expectedOtp = String(booking.delivery_otp).trim()
      if (!providedOtp || providedOtp !== expectedOtp) {
        throw new ApiError(
          400,
          "Mã xác nhận giao hàng (OTP) không chính xác. Vui lòng hỏi người nhận hàng.",
          "INVALID_DELIVERY_OTP",
        )
      }
    }

    // [Lớp 3]: Ràng buộc định vị GPS Geofencing (Khoảng cách ≤ 500m quanh điểm giao)
    if (
      opts.driverLat !== undefined &&
      opts.driverLng !== undefined &&
      booking.dest_lat !== null &&
      booking.dest_lng !== null &&
      !opts.bypassGeofence
    ) {
      const destLat = Number(booking.dest_lat)
      const destLng = Number(booking.dest_lng)
      const dLat = Number(opts.driverLat)
      const dLng = Number(opts.driverLng)

      // Công thức Haversine tính khoảng cách đường chim bay (mét)
      const R = 6371000 // bán kính Trái Đất theo mét
      const radLat1 = (destLat * Math.PI) / 180
      const radLat2 = (dLat * Math.PI) / 180
      const deltaLat = ((dLat - destLat) * Math.PI) / 180
      const deltaLng = ((dLng - destLng) * Math.PI) / 180

      const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(radLat1) *
          Math.cos(radLat2) *
          Math.sin(deltaLng / 2) *
          Math.sin(deltaLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distanceMeters = Math.round(R * c)

      if (distanceMeters > 500) {
        const distText =
          distanceMeters >= 1000
            ? `${(distanceMeters / 1000).toFixed(1)} km`
            : `${distanceMeters} m`
        throw new ApiError(
          400,
          `Bạn đang cách điểm giao hàng ${distText}. Vui lòng di chuyển đến điểm giao (trong phạm vi 500m) để hoàn tất.`,
          "GEOFENCE_TOO_FAR",
        )
      }
    }
  }

  // 4. Cập nhật Database (hỗ trợ ảnh bằng chứng POD, mốc thời gian và tọa độ hoàn thành)
  const updatedRows = await client.unsafe(
    `
    UPDATE bookings
    SET 
      status = $1::booking_status,
      payment_status = CASE WHEN $1 = 'COMPLETED' THEN 'PAID'::payment_status ELSE payment_status END,
      pickup_proof_image = CASE WHEN $1 = 'IN_TRANSIT' AND $4::text IS NOT NULL THEN $4 ELSE pickup_proof_image END,
      delivery_proof_image = CASE WHEN $1 = 'COMPLETED' AND $4::text IS NOT NULL THEN $4 ELSE delivery_proof_image END,
      in_transit_at = CASE WHEN $1 = 'IN_TRANSIT' AND in_transit_at IS NULL THEN NOW() ELSE in_transit_at END,
      completed_at = CASE WHEN $1 = 'COMPLETED' THEN NOW() ELSE completed_at END,
      completed_lat = CASE WHEN $1 = 'COMPLETED' AND $5::numeric IS NOT NULL THEN $5::numeric ELSE completed_lat END,
      completed_lng = CASE WHEN $1 = 'COMPLETED' AND $6::numeric IS NOT NULL THEN $6::numeric ELSE completed_lng END,
      updated_at = NOW()
    WHERE id = $2::uuid AND driver_id = $3::uuid
    RETURNING id, booking_code, status, payment_status, pickup_proof_image, delivery_proof_image, delivery_otp, completed_lat, completed_lng, in_transit_at, completed_at, updated_at
    `,
    [
      cleanStatus,
      bookingId,
      driverId,
      cleanProof,
      opts.driverLat !== undefined ? opts.driverLat : null,
      opts.driverLng !== undefined ? opts.driverLng : null,
    ],
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

  // 7. TASK 4.1: Tự động khấu trừ % hoa hồng (cuốc tiền mặt) hoặc cộng doanh thu (cuốc ví/online)

  let commissionInfo = null

  if (cleanStatus === "COMPLETED") {
    try {
      commissionInfo = await deductTripCommission(bookingId)
    } catch (commErr: any) {
      console.error(
        `[Wallet Commission Error] Lỗi khấu trừ hoa hồng cuốc ${booking.booking_code}:`,

        commErr.message,
      )
    }
  }

  return {
    bookingId: updatedBooking.id,

    bookingCode: updatedBooking.booking_code,

    status: updatedBooking.status,

    paymentStatus: updatedBooking.payment_status,

    commission: commissionInfo,

    proofImages: {
      pickup: updatedBooking.pickup_proof_image || null,
      delivery: updatedBooking.delivery_proof_image || null,
    },

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

  const cancelledBy = isCustomer ? "CUSTOMER" : "DRIVER"

  const cancelReason =
    reason || (isCustomer ? "Khách hàng yêu cầu hủy cuốc" : "Tài xế hủy cuốc")

  // Task 2.1: Phí bồi thường nếu khách hủy khi tài xế đã đến điểm lấy hàng (ARRIVED_AT_PICKUP)
  let cancellationFee = 0
  if (isCustomer && b.status === "ARRIVED_AT_PICKUP") {
    // Miễn trừ phí phạt nếu lý do hủy xuất phát từ lỗi tài xế (trễ hẹn, không đến, không di chuyển, không liên lạc được)
    const reasonLower = (cancelReason || "").toLowerCase()
    const isDriverFault =
      reasonLower.includes("trễ") ||
      reasonLower.includes("quá lâu") ||
      reasonLower.includes("không di chuyển") ||
      reasonLower.includes("không liên lạc") ||
      reasonLower.includes("không tới") ||
      reasonLower.includes("đổi tài xế")

    if (!isDriverFault) {
      cancellationFee = 30000 // 30.000đ bồi thường xăng xe tài xế khi lỗi do khách
    }
  }

  // Cập nhật sang CANCELLED và lưu vết đầy đủ vào Database
  const updatedRows = await client.unsafe(
    `
    UPDATE bookings
    SET 
      status = 'CANCELLED'::booking_status,
      cancelled_by = $1,
      cancellation_reason = $2,
      cancellation_fee = $3::numeric,
      cancelled_at = NOW(),
      updated_at = NOW()
    WHERE id = $4::uuid
    RETURNING id, booking_code, status, cancelled_by, cancellation_reason, cancellation_fee, cancelled_at, updated_at
    `,
    [cancelledBy, cancelReason, cancellationFee, bookingId],
  )

  const cancelled = updatedRows[0]

  // Task 2.1: Tự động trừ tiền ví khách hàng (hoặc ghi nợ) và cộng bồi thường vào ví tài xế
  if (cancellationFee > 0) {
    // 1. Trừ tiền ví khách hàng
    if (isCustomer && b.customer_id) {
      try {
        const customerWallet = await getOrCreateWallet(b.customer_id)
        const oldCustBalance = Number(customerWallet.balance || 0)
        const newCustBalance = oldCustBalance - cancellationFee
        await client.unsafe(
          `UPDATE wallets SET balance = $1::numeric, updated_at = NOW() WHERE id = $2::uuid`,
          [newCustBalance, customerWallet.id],
        )
        await client.unsafe(
          `INSERT INTO wallet_transactions (wallet_id, booking_id, amount, balance_before, balance_after, type, description, created_at)
           VALUES ($1::uuid, $2::uuid, $3::numeric, $4::numeric, $5::numeric, 'CANCELLATION_FEE', $6, NOW())`,
          [
            customerWallet.id,
            bookingId,
            -cancellationFee,
            oldCustBalance,
            newCustBalance,
            `Phí phạt hủy chuyến ${b.booking_code} khi tài xế đã tới điểm lấy hàng`,
          ],
        )
      } catch (cErr: any) {
        console.warn("Lỗi trừ phí phạt vào ví khách hàng:", cErr.message)
      }
    }

    // 2. Cộng tiền bồi thường vào ví tài xế
    if (b.driver_user_id) {
      try {
        const driverWallet = await getOrCreateWallet(b.driver_user_id)
        const oldDriverBalance = Number(driverWallet.balance || 0)
        const newDriverBalance = oldDriverBalance + cancellationFee
        await client.unsafe(
          `UPDATE wallets SET balance = $1::numeric, updated_at = NOW() WHERE id = $2::uuid`,
          [newDriverBalance, driverWallet.id],
        )
        await client.unsafe(
          `INSERT INTO wallet_transactions (wallet_id, booking_id, amount, balance_before, balance_after, type, description, created_at)
           VALUES ($1::uuid, $2::uuid, $3::numeric, $4::numeric, $5::numeric, 'BONUS', $6, NOW())`,
          [
            driverWallet.id,
            bookingId,
            cancellationFee,
            oldDriverBalance,
            newDriverBalance,
            `Bồi thường hủy chuyến ${b.booking_code} khi tài xế đã tới điểm lấy hàng`,
          ],
        )
      } catch (wErr: any) {
        console.warn("Lỗi cộng bồi thường vào ví tài xế:", wErr.message)
      }
    }
  }

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
    cancellationFee,
    cancelledAt: cancelled.cancelled_at,
    message: cancellationFee > 0
      ? `Hủy chuyến xe thành công. Phí bồi thường tài xế đã đến đón: ${cancellationFee.toLocaleString("vi-VN")}đ`
      : "Hủy chuyến xe thành công",
  }
}

/**
 * 7. CORE TASK 2.4: Mở rộng bán kính tìm tài xế (Dispatch Escalation Vòng 2 lên 8km)
 */
export async function escalateBookingDispatch(bookingId: string) {
  if (!bookingId) {
    throw new ApiError(400, "Thiếu thông tin bookingId")
  }

  const rows = await client.unsafe(
    `
    SELECT id, booking_code, status, vehicle_type_id,
           ST_Y(origin_point) as origin_lat, ST_X(origin_point) as origin_lng,
           origin_address, destination_address, distance_km, total_price
    FROM bookings
    WHERE id = $1::uuid
    LIMIT 1
    `,
    [bookingId],
  )

  if (rows.length === 0) {
    throw new ApiError(404, "Chuyến xe không tồn tại")
  }

  const b = rows[0]

  if (b.status !== "SEARCHING") {
    return {
      escalated: false,
      bookingId: b.id,
      status: b.status,
      message: `Chuyến xe không còn ở trạng thái tìm kiếm (Trạng thái hiện tại: ${b.status})`,
    }
  }

  // Quét vòng 1 để lấy danh sách tài xế đã nhận lời mời trước đó (để loại trừ không nổ chuông lặp)
  const round1Drivers = await findNearbyDrivers({
    originLat: Number(b.origin_lat),
    originLng: Number(b.origin_lng),
    radiusKm: 5,
    vehicleTypeId: b.vehicle_type_id,
    limit: 20,
  })
  const round1DriverIds = round1Drivers.map((d) => d.driverId)

  // Quét vòng 2 bán kính mở rộng 8km, loại trừ các tài xế vòng 1
  const round2Drivers = await findNearbyDrivers({
    originLat: Number(b.origin_lat),
    originLng: Number(b.origin_lng),
    radiusKm: 8,
    vehicleTypeId: b.vehicle_type_id,
    excludeDriverIds: round1DriverIds,
    limit: 15,
  })

  for (const driver of round2Drivers) {
    await triggerDriverNewOffer(driver.driverId, {
      bookingId: b.id,
      bookingCode: b.booking_code,
      originAddress: b.origin_address,
      destinationAddress: b.destination_address,
      distanceKm: Number(b.distance_km),
      totalPrice: Number(b.total_price),
      vehicleTypeName: driver.vehicleTypeName,
      expiresInSeconds: 20,
    })
  }

  const driverUserIds = round2Drivers.map((d) => d.userId).filter(Boolean)
  if (driverUserIds.length > 0) {
    notifyDriverNewBookingOffer(driverUserIds, {
      bookingId: b.id,
      bookingCode: b.booking_code,
      originAddress: b.origin_address,
      destinationAddress: b.destination_address,
      distanceKm: Number(b.distance_km),
      totalPrice: Number(b.total_price),
      vehicleTypeName: round2Drivers[0]?.vehicleTypeName || undefined,
    }).catch((err) => console.warn("FCM escalation offer error:", err.message))
  }

  return {
    escalated: true,
    bookingId: b.id,
    bookingCode: b.booking_code,
    dispatchRound: 2,
    radiusKm: 8,
    matchedDriversCount: round2Drivers.length,
    drivers: round2Drivers.map((d) => ({
      driverId: d.driverId,
      name: d.fullName,
      distanceKm: d.distanceKm,
    })),
    message: `Đã mở rộng bán kính tìm xe lên 8km. Quét thấy ${round2Drivers.length} tài xế trong Vòng 2.`,
  }
}

/**
 * 7.1 Khách hàng đổi sang tài xế khác do tài xế hiện tại đến trễ hoặc không di chuyển
 */
export async function reassignBookingDriver(
  customerId: string,
  bookingId: string,
  reason?: string,
) {
  if (!customerId || !bookingId) {
    throw new ApiError(400, "Thiếu thông tin người dùng hoặc chuyến xe")
  }

  const rows = await client.unsafe(
    `
    SELECT b.id, b.booking_code, b.status, b.customer_id, b.driver_id, b.vehicle_type_id,
           ST_Y(b.origin_point) as origin_lat, ST_X(b.origin_point) as origin_lng,
           b.origin_address, b.destination_address, b.distance_km, b.total_price,
           dp.user_id as driver_user_id
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

  if (b.customer_id !== customerId) {
    throw new ApiError(403, "Bạn không có quyền đổi tài xế cho chuyến xe này")
  }

  if (b.status !== "ACCEPTED" && b.status !== "ARRIVED_AT_PICKUP") {
    throw new ApiError(
      400,
      `Không thể đổi tài xế khi đơn đang ở trạng thái ${b.status}`,
    )
  }

  const oldDriverId = b.driver_id

  // 1. Giải phóng tài xế cũ và chuyển đơn về SEARCHING
  await client.unsafe(
    `
    UPDATE bookings
    SET 
      status = 'SEARCHING'::booking_status,
      driver_id = NULL,
      updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [bookingId],
  )

  // 2. Bắn sự kiện Pusher thông báo cho tài xế cũ
  if (oldDriverId) {
    await triggerEvent(`driver-${oldDriverId}`, "booking:cancelled", {
      bookingId,
      cancelledBy: "SYSTEM",
      reason: reason || "Khách hàng đổi tài xế do thời gian chờ quá lâu",
    }).catch(() => {})
  }

  // 3. Bắn sự kiện Pusher cập nhật kênh chuyến đi
  await triggerEvent(`trip-${bookingId}`, "booking:reassigned", {
    bookingId,
    status: "SEARCHING",
    message: "Đang tìm kiếm tài xế xe tải khác gần bạn...",
  }).catch(() => {})

  // 4. Quét tìm tài xế mới quanh điểm đón (loại trừ tài xế cũ)
  const nearby = await findNearbyDrivers({
    originLat: Number(b.origin_lat),
    originLng: Number(b.origin_lng),
    radiusKm: 6,
    vehicleTypeId: b.vehicle_type_id,
    excludeDriverIds: oldDriverId ? [oldDriverId] : [],
    limit: 15,
  })

  for (const driver of nearby) {
    await triggerDriverNewOffer(driver.driverId, {
      bookingId,
      bookingCode: b.booking_code,
      originAddress: b.origin_address,
      destinationAddress: b.destination_address,
      distanceKm: Number(b.distance_km),
      totalPrice: Number(b.total_price),
      vehicleTypeName: driver.vehicleTypeName || undefined,
    }).catch(() => {})
  }

  return {
    bookingId,
    status: "SEARCHING",
    message: "Đã hủy tài xế trễ và đang tự động tìm tài xế xe tải mới quanh bạn",
  }
}

/**
 * 7. Khách hàng đánh giá cuốc xe (Rating & Feedback)
 */
export async function rateBooking(
  bookingId: string,
  customerId: string,
  data: {
    rating: number
    comment?: string
    tags?: string[]
  },
) {
  const { rating, comment, tags } = data
  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "Điểm đánh giá phải từ 1 đến 5 sao")
  }

  // 1. Kiểm tra chuyến xe
  const bookingRows = await client.unsafe(
    `SELECT id, driver_id, customer_id, status FROM bookings WHERE id = $1::uuid LIMIT 1`,
    [bookingId],
  )
  if (bookingRows.length === 0) {
    throw new ApiError(404, "Không tìm thấy chuyến xe để đánh giá")
  }

  const b = bookingRows[0]
  if (b.customer_id !== customerId) {
    throw new ApiError(403, "Bạn không phải là khách hàng của chuyến xe này")
  }

  if (b.status !== "COMPLETED") {
    throw new ApiError(400, "Chỉ có thể đánh giá chuyến xe khi đã hoàn thành")
  }

  // 2. Lưu chi tiết đánh giá vào bảng driver_ratings
  if (b.driver_id) {
    await client.unsafe(
      `
      INSERT INTO driver_ratings (booking_id, driver_id, customer_id, rating, tags, comment, updated_at)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::text[], $6, NOW())
      ON CONFLICT (booking_id, customer_id)
      DO UPDATE SET rating = EXCLUDED.rating, tags = EXCLUDED.tags, comment = EXCLUDED.comment, updated_at = NOW()
      `,
      [b.id, b.driver_id, customerId, rating, tags || [], comment || null],
    )

    // 3. Tính toán lại rating_avg chính xác dựa trên toàn bộ đánh giá thực tế
    const avgRes = await client.unsafe(
      `SELECT ROUND(AVG(rating)::numeric, 2) as avg_rating FROM driver_ratings WHERE driver_id = $1::uuid`,
      [b.driver_id],
    )
    const newAvg = avgRes[0]?.avg_rating ? Number(avgRes[0].avg_rating) : rating
    await client.unsafe(
      `UPDATE driver_profiles SET rating_avg = $1 WHERE id = $2::uuid`,
      [newAvg, b.driver_id],
    )
  }

  return {
    bookingId: b.id,
    rating,
    comment: comment || null,
    tags: tags || [],
    message: "Đánh giá chuyến đi thành công. Cảm ơn phản hồi của bạn!",
  }
}

/**
 * 10. Lấy danh sách lịch sử cuốc xe và thống kê thu nhập thực tế của tài xế
 */
export async function getDriverBookings(driverUserId: string, limit = 50) {
  if (!driverUserId) {
    throw new ApiError(400, "Thiếu thông tin tài xế")
  }

  // 1. Tìm driver profile theo user_id
  const dpRows = await client.unsafe(
    `SELECT id FROM driver_profiles WHERE user_id = $1::uuid LIMIT 1`,
    [driverUserId],
  )
  if (dpRows.length === 0) {
    return {
      bookings: [],
      summary: { todayEarnings: 0, todayTrips: 0, weekEarnings: 0 },
    }
  }
  const driverId = dpRows[0].id

  // 2. Lấy danh sách cuốc xe
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
      b.driver_commission,
      b.payment_method,
      b.payment_status,
      b.created_at,
      b.updated_at,
      u.full_name as customer_name,
      u.phone as customer_phone,
      vt.name as vehicle_type_name
    FROM bookings b
    LEFT JOIN users u ON u.id = b.customer_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    WHERE b.driver_id = $1::uuid
    ORDER BY b.created_at DESC
    LIMIT $2
    `,
    [driverId, limit],
  )

  // 3. Tính toán thống kê doanh thu thực tế từ DB
  const todayStats = await client.unsafe(
    `
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(total_price * 0.8), 0) as total_earnings
    FROM bookings
    WHERE driver_id = $1::uuid 
      AND status = 'COMPLETED'
      AND created_at >= CURRENT_DATE
    `,
    [driverId],
  )

  const weekStats = await client.unsafe(
    `
    SELECT 
      COALESCE(SUM(total_price * 0.8), 0) as total_earnings
    FROM bookings
    WHERE driver_id = $1::uuid 
      AND status = 'COMPLETED'
      AND created_at >= NOW() - INTERVAL '7 days'
    `,
    [driverId],
  )

  const todayEarnings = Math.round(Number(todayStats[0]?.total_earnings || 0))
  const todayTrips = Number(todayStats[0]?.count || 0)
  const weekEarnings = Math.round(Number(weekStats[0]?.total_earnings || 0))

  const bookings = rows.map((r: any) => ({
    id: r.id,
    bookingCode: r.booking_code,
    status: r.status,
    originAddress: r.origin_address,
    destinationAddress: r.destination_address,
    distanceKm: Number(r.distance_km || 0),
    totalPrice: Number(r.total_price || 0),
    driverEarning: Math.round(Number(r.total_price || 0) * 0.8),
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    customerName: r.customer_name || "Khách hàng",
    customerPhone: r.customer_phone || "",
    vehicleTypeName: r.vehicle_type_name || "Xe tải",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return {
    bookings,
    summary: {
      todayEarnings,
      todayTrips,
      weekEarnings,
    },
  }
}


