import { client } from "../db"
import { ApiError } from "./errors"
import { triggerNewChatMessage, triggerMessagesRead } from "./pusher"
import { sendPushNotificationToUser } from "./notificationService"

export type ChatMessageType = "TEXT" | "IMAGE" | "LOCATION"

export interface SendMessageDto {
  bookingId: string
  senderUserId: string
  content?: string
  messageType?: ChatMessageType
  mediaUrl?: string
}

export interface GetMessagesOptions {
  page?: number
  limit?: number
}

/**
 * 1. CORE API: Gửi tin nhắn chat trong chuyến xe (Lưu vào DB + Bắn Pusher)
 */
export async function sendChatMessage(dto: SendMessageDto) {
  const {
    bookingId,
    senderUserId,
    content,
    messageType = "TEXT",
    mediaUrl,
  } = dto

  if (!senderUserId) {
    throw new ApiError(401, "Yêu cầu đăng nhập để gửi tin nhắn")
  }
  if (!bookingId) {
    throw new ApiError(400, "Thiếu thông tin bookingId")
  }

  const cleanContent = content ? String(content).trim() : ""
  if (!cleanContent && !mediaUrl) {
    throw new ApiError(
      400,
      "Nội dung tin nhắn hoặc tệp đính kèm không được để trống",
    )
  }

  // 1. Kiểm tra chuyến xe và xác minh phân quyền người gửi
  const bookingRows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.customer_id,
      b.driver_id,
      dp.user_id as driver_user_id,
      cu.full_name as customer_name,
      du.full_name as driver_name
    FROM bookings b
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId],
  )

  if (bookingRows.length === 0) {
    throw new ApiError(404, "Không tìm thấy chuyến xe")
  }

  const booking = bookingRows[0]

  // Xác định vai trò của người gửi
  let senderRole: "CUSTOMER" | "DRIVER" | "ADMIN"
  let receiverUserId: string | null = null

  if (senderUserId === booking.customer_id) {
    senderRole = "CUSTOMER"
    receiverUserId = booking.driver_user_id || null
  } else if (senderUserId === booking.driver_user_id) {
    senderRole = "DRIVER"
    receiverUserId = booking.customer_id
  } else {
    // Kiểm tra xem có phải ADMIN không
    const adminCheck = await client.unsafe(
      `SELECT role FROM users WHERE id = $1::uuid LIMIT 1`,
      [senderUserId],
    )
    if (adminCheck[0]?.role === "ADMIN") {
      senderRole = "ADMIN"
      receiverUserId = booking.customer_id
    } else {
      throw new ApiError(
        403,
        "Bạn không có quyền tham gia cuộc trò chuyện trong chuyến xe này",
      )
    }
  }

  // 2. Lấy thông tin chi tiết người gửi (Tên, Avatar)
  const senderUser = await client.unsafe(
    `SELECT id, full_name, avatar_url FROM users WHERE id = $1::uuid LIMIT 1`,
    [senderUserId],
  )
  const senderName = senderUser[0]?.full_name || "Người dùng"
  const senderAvatar = senderUser[0]?.avatar_url || null

  // 3. Lưu tin nhắn vào PostgreSQL booking_messages
  const inserted = await client.unsafe(
    `
    INSERT INTO booking_messages (
      booking_id,
      sender_id,
      message_type,
      content,
      media_url,
      is_read,
      created_at
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3,
      $4,
      $5,
      false,
      NOW()
    )
    RETURNING id, booking_id, sender_id, message_type, content, media_url, is_read, created_at
    `,
    [
      bookingId,
      senderUserId,
      messageType,
      cleanContent || null,
      mediaUrl || null,
    ],
  )

  const msg = inserted[0]

  // 4. Bắn sự kiện thời gian thực qua Pusher (Tuân thủ payload tối giản theo docs/note.txt)
  await triggerNewChatMessage(bookingId, {
    messageId: msg.id,
    bookingId: msg.booking_id,
    senderId: msg.sender_id,
    senderRole,
    senderName,
    senderAvatar,
    messageType: msg.message_type,
    content: msg.content || "",
    mediaUrl: msg.media_url,
    createdAt: msg.created_at,
  })

  // 5. Gửi Push Notification (FCM) ngầm đến người nhận
  if (receiverUserId) {
    const notifyBody =
      messageType === "IMAGE"
        ? "[Hình ảnh]"
        : messageType === "LOCATION"
          ? "[Vị trí hiện tại]"
          : cleanContent.length > 80
            ? `${cleanContent.slice(0, 80)}...`
            : cleanContent

    sendPushNotificationToUser(receiverUserId, {
      title: `💬 ${senderName} đã nhắn cho bạn`,
      body: notifyBody,
      data: {
        type: "NEW_CHAT_MESSAGE",
        bookingId,
        bookingCode: booking.booking_code,
        messageId: msg.id,
      },
    }).catch((err) => console.warn("FCM chat message error:", err.message))
  }

  return {
    id: msg.id,
    bookingId: msg.booking_id,
    bookingCode: booking.booking_code,
    senderId: msg.sender_id,
    senderRole,
    senderName,
    senderAvatar,
    messageType: msg.message_type,
    content: msg.content,
    mediaUrl: msg.media_url,
    isRead: msg.is_read,
    createdAt: msg.created_at,
  }
}

/**
 * 2. Lấy toàn bộ lịch sử tin nhắn của chuyến xe (Phân trang & Tự động đánh dấu đã đọc)
 */
export async function getBookingChatMessages(
  bookingId: string,
  currentUserId: string,
  options?: GetMessagesOptions,
) {
  if (!currentUserId) {
    throw new ApiError(401, "Yêu cầu đăng nhập")
  }
  if (!bookingId) {
    throw new ApiError(400, "Thiếu thông tin bookingId")
  }

  // 1. Kiểm tra quyền truy cập chuyến xe
  const bookingRows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.customer_id,
      b.driver_id,
      dp.user_id as driver_user_id,
      cu.full_name as customer_name,
      cu.avatar_url as customer_avatar,
      du.full_name as driver_name,
      du.avatar_url as driver_avatar
    FROM bookings b
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId],
  )

  if (bookingRows.length === 0) {
    throw new ApiError(404, "Không tìm thấy chuyến xe")
  }

  const booking = bookingRows[0]

  // Xác minh quyền truy cập
  const isParticipant =
    currentUserId === booking.customer_id ||
    currentUserId === booking.driver_user_id

  if (!isParticipant) {
    const adminCheck = await client.unsafe(
      `SELECT role FROM users WHERE id = $1::uuid LIMIT 1`,
      [currentUserId],
    )
    if (adminCheck[0]?.role !== "ADMIN") {
      throw new ApiError(
        403,
        "Bạn không có quyền xem cuộc trò chuyện của chuyến xe này",
      )
    }
  }

  const page = Math.max(1, Number(options?.page || 1))
  const limit = Math.min(100, Math.max(1, Number(options?.limit || 50)))
  const offset = (page - 1) * limit

  // 2. Tự động đánh dấu đã đọc các tin nhắn gửi đến currentUserId
  const updatedRead = await client.unsafe(
    `
    UPDATE booking_messages
    SET is_read = true
    WHERE booking_id = $1::uuid 
      AND sender_id != $2::uuid 
      AND is_read = false
    RETURNING id
    `,
    [bookingId, currentUserId],
  )

  if (updatedRead.length > 0) {
    triggerMessagesRead(bookingId, currentUserId).catch((err) =>
      console.warn("Pusher mark read error:", err.message),
    )
  }

  // 3. Đếm tổng số tin nhắn
  const countRes = await client.unsafe(
    `SELECT count(*) as total FROM booking_messages WHERE booking_id = $1::uuid`,
    [bookingId],
  )
  const total = parseInt(countRes[0]?.total || "0", 10)

  // 4. Lấy danh sách tin nhắn (Đã được cập nhật is_read)
  const rows = await client.unsafe(
    `
    SELECT 
      bm.id,
      bm.booking_id,
      bm.sender_id,
      bm.message_type,
      bm.content,
      bm.media_url,
      bm.is_read,
      bm.created_at,
      u.full_name as sender_name,
      u.avatar_url as sender_avatar,
      CASE 
        WHEN bm.sender_id = $2::uuid THEN 'CUSTOMER'
        WHEN bm.sender_id = $3::uuid THEN 'DRIVER'
        ELSE 'ADMIN'
      END as sender_role
    FROM booking_messages bm
    JOIN users u ON u.id = bm.sender_id
    WHERE bm.booking_id = $1::uuid
    ORDER BY bm.created_at ASC
    LIMIT $4 OFFSET $5
    `,
    [
      bookingId,
      booking.customer_id,
      booking.driver_user_id || "00000000-0000-0000-0000-000000000000",
      limit,
      offset,
    ],
  )

  return {
    booking: {
      id: booking.id,
      bookingCode: booking.booking_code,
      status: booking.status,
      customer: {
        id: booking.customer_id,
        name: booking.customer_name,
        avatarUrl: booking.customer_avatar,
      },
      driver: booking.driver_user_id
        ? {
            id: booking.driver_user_id,
            name: booking.driver_name,
            avatarUrl: booking.driver_avatar,
          }
        : null,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    messages: rows.map((r: any) => ({
      id: r.id,
      bookingId: r.booking_id,
      senderId: r.sender_id,
      senderRole: r.sender_role,
      senderName: r.sender_name,
      senderAvatar: r.sender_avatar,
      messageType: r.message_type,
      content: r.content,
      mediaUrl: r.media_url,
      isRead: r.is_read,
      isMe: r.sender_id === currentUserId,
      createdAt: r.created_at,
    })),
  }
}

/**
 * 3. Đánh dấu tất cả tin nhắn trong chuyến xe là đã đọc
 */
export async function markBookingChatRead(
  bookingId: string,
  currentUserId: string,
) {
  if (!currentUserId || !bookingId) {
    throw new ApiError(400, "Thiếu tham số bookingId hoặc currentUserId")
  }

  const updated = await client.unsafe(
    `
    UPDATE booking_messages
    SET is_read = true
    WHERE booking_id = $1::uuid AND sender_id != $2::uuid AND is_read = false
    RETURNING id
    `,
    [bookingId, currentUserId],
  )

  if (updated.length > 0) {
    await triggerMessagesRead(bookingId, currentUserId)
  }

  return {
    success: true,
    updatedCount: updated.length,
    message: "Đã đánh dấu đọc tin nhắn thành công",
  }
}

/**
 * 4. Lấy danh sách các cuộc trò chuyện gần đây của người dùng
 */
export async function getUserChatConversations(userId: string) {
  if (!userId) {
    throw new ApiError(401, "Yêu cầu đăng nhập")
  }

  // Tìm các chuyến xe mà user là khách hoặc tài xế
  const rows = await client.unsafe(
    `
    SELECT 
      b.id as booking_id,
      b.booking_code,
      b.status as booking_status,
      b.created_at as booking_created_at,
      cu.id as customer_id,
      cu.full_name as customer_name,
      cu.avatar_url as customer_avatar,
      du.id as driver_user_id,
      du.full_name as driver_name,
      du.avatar_url as driver_avatar,
      dp.license_plate,
      vt.name as vehicle_type_name,
      last_msg.content as last_message_content,
      last_msg.message_type as last_message_type,
      last_msg.created_at as last_message_time,
      COALESCE(unread.unread_count, 0) as unread_count
    FROM bookings b
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    LEFT JOIN LATERAL (
      SELECT content, message_type, created_at
      FROM booking_messages
      WHERE booking_id = b.id
      ORDER BY created_at DESC
      LIMIT 1
    ) last_msg ON true
    LEFT JOIN LATERAL (
      SELECT count(*) as unread_count
      FROM booking_messages
      WHERE booking_id = b.id AND sender_id != $1::uuid AND is_read = false
    ) unread ON true
    WHERE (b.customer_id = $1::uuid OR dp.user_id = $1::uuid)
    ORDER BY COALESCE(last_msg.created_at, b.created_at) DESC
    LIMIT 30
    `,
    [userId],
  )

  return rows.map((r: any) => {
    const isCustomer = r.customer_id === userId
    const partner = isCustomer
      ? {
          name: r.driver_name || "Tài xế đang nhận chuyến",
          avatarUrl: r.driver_avatar,
          role: "DRIVER",
          licensePlate: r.license_plate,
        }
      : {
          name: r.customer_name,
          avatarUrl: r.customer_avatar,
          role: "CUSTOMER",
          licensePlate: null,
        }

    return {
      bookingId: r.booking_id,
      bookingCode: r.booking_code,
      bookingStatus: r.booking_status,
      partner,
      vehicleTypeName: r.vehicle_type_name,
      lastMessage: r.last_message_content
        ? {
            content: r.last_message_content,
            type: r.last_message_type,
            time: r.last_message_time,
          }
        : null,
      unreadCount: Number(r.unread_count || 0),
    }
  })
}
