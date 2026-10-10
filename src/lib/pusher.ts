import Pusher from "pusher"
import * as dotenv from "dotenv"

dotenv.config()

// Khởi tạo Pusher Server nếu có cấu hình trong biến môi trường
const isPusherConfigured = Boolean(
  process.env.PUSHER_APP_ID &&
    process.env.PUSHER_KEY &&
    process.env.PUSHER_SECRET,
)

export const pusherServer: Pusher | null = isPusherConfigured
  ? new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER || "ap1",
      useTLS: process.env.PUSHER_USE_TLS !== "false",
    })
  : null

if (isPusherConfigured) {
  console.log(
    "📡 [Pusher] Kết nối dịch vụ Pusher thành công (Cluster:",
    process.env.PUSHER_CLUSTER || "ap1",
    ")",
  )
} else {
  console.log(
    "📡 [Pusher] Chế độ DEV MOCK: Chưa cấu hình Pusher Key. Sự kiện Realtime sẽ được mô phỏng log console.",
  )
}

/**
 * Hàm chung bắn sự kiện Realtime qua Pusher
 * Tuân thủ quy định: Payload tối giản để tiết kiệm chi phí băng thông (docs/note.txt)
 */
export async function triggerEvent(
  channel: string,
  event: string,
  data: any,
): Promise<boolean> {
  try {
    if (pusherServer) {
      await pusherServer.trigger(channel, event, data)
      console.log(
        `📡 [Pusher Event] [${channel}] -> "${event}":`,
        JSON.stringify(data),
      )
      return true
    } else {
      // Mock log trong môi trường development
      console.log(
        `📡 [Pusher Mock] [${channel}] -> "${event}":`,
        JSON.stringify(data),
      )
      return true
    }
  } catch (err: any) {
    console.error(
      `❌ [Pusher Error] Không thể gửi sự kiện [${channel}] -> "${event}":`,
      err.message,
    )
    return false
  }
}

/**
 * 1. Bắn sự kiện "Nổ cuốc mới" đến riêng điện thoại của một tài xế
 * Kênh: driver-{driverId}
 * Sự kiện: booking:new-offer
 */
export async function triggerDriverNewOffer(
  driverId: string,
  offerData: {
    bookingId: string
    bookingCode: string
    originAddress: string
    destinationAddress: string
    distanceKm: number
    totalPrice: number
    vehicleTypeName?: string | null
    expiresInSeconds?: number
  },
) {
  const channel = `driver-${driverId}`
  const event = "booking:new-offer"

  // Payload siêu nhẹ (Signaling) theo chuẩn thiết kế
  const payload = {
    bookingId: offerData.bookingId,
    bookingCode: offerData.bookingCode,
    originAddress: offerData.originAddress,
    destinationAddress: offerData.destinationAddress,
    distanceKm: offerData.distanceKm,
    totalPrice: offerData.totalPrice,
    vehicleTypeName: offerData.vehicleTypeName || null,
    expiresInSeconds: offerData.expiresInSeconds || 20,
    timestamp: Date.now(),
  }

  return await triggerEvent(channel, event, payload)
}

/**
 * 2. Bắn sự kiện "Đã có tài xế nhận cuốc" đến khách hàng đang chờ
 * Kênh: trip-{bookingId}
 * Sự kiện: booking:accepted
 */
export async function triggerBookingAccepted(
  bookingId: string,
  driverInfo: {
    driverId: string
    driverName: string
    driverPhone: string
    avatarUrl?: string | null
    licensePlate?: string | null
    vehicleTypeName?: string | null
    ratingAvg?: number
  },
) {
  const channel = `trip-${bookingId}`
  const event = "booking:accepted"

  const payload = {
    bookingId,
    status: "ACCEPTED",
    driver: {
      id: driverInfo.driverId,
      name: driverInfo.driverName,
      phone: driverInfo.driverPhone,
      avatarUrl: driverInfo.avatarUrl || null,
      licensePlate: driverInfo.licensePlate || null,
      vehicleTypeName: driverInfo.vehicleTypeName || null,
      ratingAvg: driverInfo.ratingAvg || 5.0,
    },
    timestamp: Date.now(),
  }

  return await triggerEvent(channel, event, payload)
}

/**
 * 3. Bắn sự kiện "Hủy lời mời" đến các tài xế bấm chậm hơn khi cuốc đã có người nhận
 * Kênh: driver-{driverId}
 * Sự kiện: offer:cancelled
 */
export async function triggerOfferCancelled(
  driverId: string,
  bookingId: string,
  reason = "TAKEN",
) {
  const channel = `driver-${driverId}`
  const event = "offer:cancelled"

  const payload = {
    bookingId,
    reason, // 'TAKEN' (Đã có người nhận) hoặc 'EXPIRED' (Hết thời gian chờ)
    timestamp: Date.now(),
  }

  return await triggerEvent(channel, event, payload)
}

/**
 * 4. Bắn sự kiện "Cập nhật trạng thái chuyến xe" (Đã nhận -> Tới lấy -> Đang giao -> Hoàn thành)
 * Kênh: trip-{bookingId}
 * Sự kiện: booking:status-change
 */
export async function triggerBookingStatusChange(
  bookingId: string,
  newStatus: string,
  extra: {
    message?: string
    driverId?: string
    note?: string | null
  } = {},
) {
  const channel = `trip-${bookingId}`
  const event = "booking:status-change"

  const payload = {
    bookingId,
    status: newStatus,
    message: extra.message || `Chuyến xe đã cập nhật trạng thái: ${newStatus}`,
    driverId: extra.driverId || null,
    note: extra.note || null,
    timestamp: Date.now(),
  }

  return await triggerEvent(channel, event, payload)
}

/**
 * 5. Bắn sự kiện "Hủy chuyến xe" đến cả Khách hàng và Tài xế
 * Kênh: trip-{bookingId} và driver-{driverId}
 * Sự kiện: booking:cancelled
 */
export async function triggerBookingCancelled(
  bookingId: string,
  cancelledBy: "CUSTOMER" | "DRIVER" | "SYSTEM",
  reason?: string,
  driverId?: string | null,
) {
  const payload = {
    bookingId,
    status: "CANCELLED",
    cancelledBy,
    reason: reason || "Chuyến xe đã bị hủy",
    timestamp: Date.now(),
  }

  // Báo trên kênh chuyến đi cho khách
  await triggerEvent(`trip-${bookingId}`, "booking:cancelled", payload)

  // Báo trên kênh riêng của tài xế nếu chuyến đã có tài xế nhận
  if (driverId) {
    await triggerEvent(`driver-${driverId}`, "booking:cancelled", payload)
  }

  return true
}

/**
 * 6. Bắn sự kiện "Cập nhật tọa độ GPS tài xế" (Live Tracking) cho khách hàng
 * Kênh: trip-{bookingId}
 * Sự kiện: driver:location-update
 */
export async function triggerDriverLocationUpdate(
  bookingId: string,
  location: {
    driverId: string
    latitude: number
    longitude: number
    heading?: number | null
    speed?: number | null
  },
) {
  const channel = `trip-${bookingId}`
  const event = "driver:location-update"

  const payload = {
    bookingId,
    driverId: location.driverId,
    latitude: location.latitude,
    longitude: location.longitude,
    heading: location.heading !== undefined ? location.heading : null,
    speed: location.speed !== undefined ? location.speed : null,
    timestamp: Date.now(),
  }

  return await triggerEvent(channel, event, payload)
}
