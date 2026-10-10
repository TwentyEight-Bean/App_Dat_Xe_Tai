import admin from "firebase-admin"
import { client } from "../db"
import { ApiError } from "./errors"

export interface RegisterDeviceTokenDto {
  fcmToken: string
  deviceType?: "WEB" | "ANDROID" | "IOS"
  deviceName?: string
}

export interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
  imageUrl?: string
}

export interface SendPushResult {
  success: boolean
  deliveredCount: number
  failureCount: number
  messageIds: string[]
}

// ============================================================================
// KHỞI TẠO FIREBASE ADMIN SDK VỚI CƠ CHẾ GRACEFUL DEV MOCK
// ============================================================================
let firebaseApp: any = null
let isFirebaseConfigured = false

function initFirebaseAdmin(): any {
  if (firebaseApp) return firebaseApp

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined

  if (projectId && clientEmail && privateKey) {
    try {
      firebaseApp = (admin as any).initializeApp({
        credential: (admin as any).credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
      isFirebaseConfigured = true
      console.log("🔥 [Firebase] Đã kết nối Firebase Admin SDK thành công.")
      return firebaseApp
    } catch (err: any) {
      console.warn(
        "⚠️ [Firebase] Khởi tạo Firebase Admin thất bại:",
        err.message,
      )
    }
  }

  // Graceful Fallback: Dev Mock Mode
  isFirebaseConfigured = false
  console.log(
    "📱 [Firebase FCM] Chế độ DEV MOCK: Chưa cấu hình Firebase Service Account Credentials. Thông báo đẩy sẽ được mô phỏng log console an toàn.",
  )
  return null
}

// Khởi chạy kiểm tra khi module được nạp
initFirebaseAdmin()

// ============================================================================
// 1. QUẢN LÝ THIẾT BỊ & DEVICE TOKENS (TABLE: user_devices)
// ============================================================================

/**
 * Đăng ký hoặc cập nhật FCM device token của người dùng sau khi đăng nhập
 */
export async function registerDeviceToken(
  userId: string,
  dto: RegisterDeviceTokenDto,
) {
  if (!userId) {
    throw new ApiError(401, "Yêu cầu đăng nhập để đăng ký thiết bị")
  }
  if (!dto.fcmToken || !dto.fcmToken.trim()) {
    throw new ApiError(400, "Thiếu thông tin fcmToken")
  }

  const cleanToken = dto.fcmToken.trim()
  const cleanType = (dto.deviceType || "WEB").toUpperCase()
  const cleanName = dto.deviceName ? dto.deviceName.trim() : null

  const rows = await client.unsafe(
    `
    INSERT INTO user_devices (user_id, fcm_token, device_type, device_name, updated_at)
    VALUES ($1::uuid, $2, $3, $4, NOW())
    ON CONFLICT (user_id, fcm_token) DO UPDATE
    SET 
      device_type = EXCLUDED.device_type,
      device_name = EXCLUDED.device_name,
      updated_at = NOW()
    RETURNING id, user_id, fcm_token, device_type, device_name, updated_at
    `,
    [userId, cleanToken, cleanType, cleanName],
  )

  return rows[0]
}

/**
 * Xóa FCM device token khi người dùng đăng xuất khỏi thiết bị
 */
export async function removeDeviceToken(userId: string, fcmToken: string) {
  if (!userId || !fcmToken) {
    return { success: false, removedCount: 0 }
  }

  const rows = await client.unsafe(
    `
    DELETE FROM user_devices
    WHERE user_id = $1::uuid AND fcm_token = $2
    RETURNING id
    `,
    [userId, fcmToken.trim()],
  )

  return { success: true, removedCount: rows.length }
}

/**
 * Lấy danh sách FCM tokens hợp lệ của một người dùng
 */
export async function getUserDeviceTokens(userId: string): Promise<string[]> {
  if (!userId) return []

  const rows = await client.unsafe(
    `
    SELECT fcm_token FROM user_devices
    WHERE user_id = $1::uuid
    ORDER BY updated_at DESC
    `,
    [userId],
  )

  return rows.map((r: any) => r.fcm_token)
}

/**
 * Lấy danh sách FCM tokens của nhiều người dùng
 */
export async function getUsersDeviceTokens(
  userIds: string[],
): Promise<string[]> {
  if (!userIds || userIds.length === 0) return []

  const rows = await client.unsafe(
    `
    SELECT fcm_token FROM user_devices
    WHERE user_id = ANY($1::uuid[])
    `,
    [userIds],
  )

  return rows.map((r: any) => r.fcm_token)
}

// ============================================================================
// 2. PHÁT THÔNG BÁO ĐẨY PUSH NOTIFICATION (FCM DISPATCHER)
// ============================================================================

/**
 * Gửi thông báo đẩy đến danh sách các FCM tokens
 */
export async function sendPushNotificationToTokens(
  tokens: string[],
  payload: PushNotificationPayload,
): Promise<SendPushResult> {
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)))

  if (uniqueTokens.length === 0) {
    return {
      success: true,
      deliveredCount: 0,
      failureCount: 0,
      messageIds: [],
    }
  }

  // 1. Chế độ DEV MOCK: Log ra console khi chưa gắn Firebase Credentials
  if (!isFirebaseConfigured || !firebaseApp) {
    console.log(
      `📱 [FCM Mock] Push Notification (${uniqueTokens.length} thiết bị):`,
    )
    console.log(`   🔔 Tiêu đề: "${payload.title}"`)
    console.log(`   📝 Nội dung: "${payload.body}"`)
    if (payload.data) {
      console.log(`   📦 Data payload:`, payload.data)
    }

    return {
      success: true,
      deliveredCount: uniqueTokens.length,
      failureCount: 0,
      messageIds: uniqueTokens.map((_, i) => `mock-msg-${Date.now()}-${i}`),
    }
  }

  // 2. Chế độ Production: Gửi thật qua Firebase Cloud Messaging (FCM Multicast)
  try {
    const messaging = firebaseApp.messaging()
    const message: any = {
      tokens: uniqueTokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data || {},
      webpush: {
        notification: {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
        },
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "booking_updates",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    }

    const response = await messaging.sendEachForMulticast(message)

    // Tự động thu dọn các token đã hết hạn hoặc không còn đăng ký trên thiết bị
    const staleTokens: string[] = []
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success && resp.error) {
        const errCode = resp.error.code
        if (
          errCode === "messaging/registration-token-not-registered" ||
          errCode === "messaging/invalid-registration-token"
        ) {
          staleTokens.push(uniqueTokens[idx])
        }
      }
    })

    if (staleTokens.length > 0) {
      await client.unsafe(
        `DELETE FROM user_devices WHERE fcm_token = ANY($1::text[])`,
        [staleTokens],
      )
      console.log(
        `🧹 [FCM] Đã tự động dọn dẹp ${staleTokens.length} token hết hạn.`,
      )
    }

    const messageIds = response.responses
      .filter((r: any) => r.success && r.messageId)
      .map((r: any) => r.messageId!)

    return {
      success: response.successCount > 0,
      deliveredCount: response.successCount,
      failureCount: response.failureCount,
      messageIds,
    }
  } catch (error: any) {
    console.error("❌ [FCM] Lỗi phát thông báo đẩy Firebase:", error.message)
    return {
      success: false,
      deliveredCount: 0,
      failureCount: uniqueTokens.length,
      messageIds: [],
    }
  }
}

/**
 * Gửi thông báo đẩy đến một người dùng cụ thể (tự động gom tất cả thiết bị của người đó)
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: PushNotificationPayload,
): Promise<SendPushResult> {
  const tokens = await getUserDeviceTokens(userId)
  return await sendPushNotificationToTokens(tokens, payload)
}

/**
 * Gửi thông báo đẩy đến nhiều người dùng
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload,
): Promise<SendPushResult> {
  const tokens = await getUsersDeviceTokens(userIds)
  return await sendPushNotificationToTokens(tokens, payload)
}

// ============================================================================
// 3. CÁC KỊCH BẢN THÔNG BÁO ĐẨY ĐẶC THÙ NGHIỆP VỤ (TASK 3.5 BUSINESS SCENARIOS)
// ============================================================================

export interface NewBookingOfferNotificationData {
  bookingId: string
  bookingCode: string
  distanceKm: number
  totalPrice: number
  originAddress: string
  destinationAddress?: string
  vehicleTypeName?: string
}

/**
 * Kịch bản 1: Thông báo cho tài xế có cuốc xe mới gần điểm đỗ
 */
export async function notifyDriverNewBookingOffer(
  driverUserIds: string[],
  offer: NewBookingOfferNotificationData,
) {
  return await sendPushNotificationToUsers(driverUserIds, {
    title: "🚚 Có chuyến hàng mới gần bạn!",
    body: `Đơn hàng cách bạn ${offer.distanceKm}km (${offer.bookingCode}) - Cước phí: ${offer.totalPrice.toLocaleString("vi-VN")}đ. Nhận ngay trong 20s!`,
    data: {
      type: "NEW_OFFER",
      bookingId: offer.bookingId,
      bookingCode: offer.bookingCode,
      distanceKm: String(offer.distanceKm),
      totalPrice: String(offer.totalPrice),
    },
  })
}

export interface BookingAcceptedNotificationData {
  bookingId: string
  bookingCode: string
  driverName: string
  driverPhone: string
  licensePlate?: string | null
  vehicleTypeName?: string | null
}

/**
 * Kịch bản 2: Thông báo cho khách hàng khi tài xế bấm nhận cuốc xe
 */
export async function notifyCustomerBookingAccepted(
  customerUserId: string,
  info: BookingAcceptedNotificationData,
) {
  const plateText = info.licensePlate ? ` (Biển số: ${info.licensePlate})` : ""
  return await sendPushNotificationToUser(customerUserId, {
    title: "✅ Tài xế đã nhận chuyến xe của bạn!",
    body: `Tài xế ${info.driverName}${plateText} đã nhận đơn ${info.bookingCode} và đang di chuyển đến điểm lấy hàng.`,
    data: {
      type: "BOOKING_ACCEPTED",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode,
      driverName: info.driverName,
      driverPhone: info.driverPhone,
    },
  })
}

export interface DriverArrivedInfo {
  bookingId: string
  bookingCode: string
  driverName: string
}

export interface BookingInTransitInfo {
  bookingId: string
  bookingCode: string
}

export interface BookingCompletedInfo {
  bookingId: string
  bookingCode: string
  totalPrice?: number
}

/**
 * Kịch bản 3: Thông báo cho khách hàng khi tài xế đã đến điểm lấy hàng
 */
export async function notifyCustomerDriverArrived(
  customerUserId: string,
  info: DriverArrivedInfo,
) {
  return await sendPushNotificationToUser(customerUserId, {
    title: "📍 Xe đã tới điểm lấy hàng!",
    body: `Tài xế ${info.driverName} đã đến điểm hẹn lấy hàng (${info.bookingCode}). Vui lòng chuẩn bị hàng hóa!`,
    data: {
      type: "DRIVER_ARRIVED",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode,
    },
  })
}

/**
 * Kịch bản 4: Thông báo cho khách hàng khi hàng hóa bắt đầu được vận chuyển
 */
export async function notifyCustomerBookingInTransit(
  customerUserId: string,
  info: BookingInTransitInfo,
) {
  return await sendPushNotificationToUser(customerUserId, {
    title: "🚚 Hàng hóa đang trên đường vận chuyển!",
    body: `Đơn hàng ${info.bookingCode} đã được bốc lên xe và đang trên đường giao đến người nhận.`,
    data: {
      type: "IN_TRANSIT",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode,
    },
  })
}

/**
 * Kịch bản 5: Thông báo cho khách hàng khi cuốc xe hoàn thành thành công
 */
export async function notifyCustomerBookingCompleted(
  customerUserId: string,
  info: BookingCompletedInfo,
) {
  return await sendPushNotificationToUser(customerUserId, {
    title: "🎉 Giao hàng hoàn tất!",
    body: `Chuyến hàng ${info.bookingCode} đã được giao thành công. Cảm ơn bạn đã tin tưởng dịch vụ!`,
    data: {
      type: "BOOKING_COMPLETED",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode,
    },
  })
}

/**
 * Kịch bản 6: Thông báo cho khách hàng hoặc tài xế khi chuyến đi bị hủy
 */
export async function notifyTripCancelled(
  targetUserId: string,
  info: {
    bookingId: string
    bookingCode: string
    cancelledBy: "CUSTOMER" | "DRIVER" | "SYSTEM"
    reason?: string
  },
) {
  const who =
    info.cancelledBy === "CUSTOMER"
      ? "Khách hàng"
      : info.cancelledBy === "DRIVER"
        ? "Tài xế"
        : "Hệ thống"
  const reasonText = info.reason ? ` Lý do: ${info.reason}` : ""

  return await sendPushNotificationToUser(targetUserId, {
    title: "❌ Chuyến xe đã bị hủy",
    body: `Chuyến xe ${info.bookingCode} đã bị hủy bởi ${who}.${reasonText}`,
    data: {
      type: "BOOKING_CANCELLED",
      bookingId: info.bookingId,
      bookingCode: info.bookingCode,
      cancelledBy: info.cancelledBy,
    },
  })
}
