import jwt from "jsonwebtoken"
import { client } from "../db"
import { ApiError } from "./errors"

/**
 * Cấu hình Tổng Đài Ảo Stringee
 */
export const STRINGEE_CONFIG = {
  apiKeySid: process.env.STRINGEE_API_KEY_SID || "SK_STRINGEE_DATXETAI_DEV_001",
  apiKeySecret:
    process.env.STRINGEE_API_KEY_SECRET ||
    "STRINGEE_SECRET_KEY_DEV_2026_TRUCK_BOOKING",
  hotlineNumber: process.env.STRINGEE_HOTLINE_NUMBER || "1900-8888", // Số hiển thị đại diện giấu số
}

export interface AuthorizeCallDto {
  bookingId: string
  callerUserId: string
}

export interface StringeeEventPayload {
  call_id?: string
  stringee_call_id?: string
  event?: string
  call_status?: string
  end_cause?: string
  duration?: number
  duration_seconds?: number
  record_url?: string
  from?: string
  to?: string
  customData?: string
}

/**
 * 1. CORE API: Sinh Client Access Token kết nối Stringee SDK (JWT HS256)
 * Theo chuẩn Stringee: cty = "stringee-api;v=1"
 */
export function generateStringeeClientToken(
  userId: string,
  expiresInSeconds = 3600 * 24,
): string {
  if (!userId) {
    throw new ApiError(400, "Thiếu thông tin userId để cấp Stringee Token")
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = now + expiresInSeconds

  const header: any = {
    alg: "HS256",
    typ: "JWT",
    cty: "stringee-api;v=1",
  }

  const payload = {
    jti: `${STRINGEE_CONFIG.apiKeySid}_${now}_${Math.floor(1000 + Math.random() * 9000)}`,
    iss: STRINGEE_CONFIG.apiKeySid,
    exp,
    userId,
  }

  return jwt.sign(payload, STRINGEE_CONFIG.apiKeySecret, {
    algorithm: "HS256",
    header,
  } as jwt.SignOptions)
}

/**
 * 2. CORE API: Cấp quyền & Khởi tạo cuộc gọi giấu số giữa Khách và Tài xế (Number Masking)
 */
export async function authorizeTripCall(dto: AuthorizeCallDto) {
  const { bookingId, callerUserId } = dto

  if (!callerUserId) {
    throw new ApiError(401, "Yêu cầu đăng nhập để thực hiện cuộc gọi")
  }
  if (!bookingId) {
    throw new ApiError(400, "Thiếu thông tin bookingId")
  }

  // 1. Kiểm tra thông tin chuyến xe
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
      du.full_name as driver_name,
      dp.license_plate,
      vt.name as vehicle_type_name
    FROM bookings b
    JOIN users cu ON cu.id = b.customer_id
    LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
    LEFT JOIN users du ON du.id = dp.user_id
    LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId],
  )

  if (bookingRows.length === 0) {
    throw new ApiError(404, "Không tìm thấy chuyến xe")
  }

  const booking = bookingRows[0]

  // 2. Kiểm tra trạng thái chuyến xe: Phải đang hoạt động
  const allowedStatuses = [
    "SEARCHING",
    "ACCEPTED",
    "ARRIVED_AT_PICKUP",
    "IN_TRANSIT",
  ]
  if (!allowedStatuses.includes(booking.status)) {
    throw new ApiError(
      400,
      `Không thể thực hiện cuộc gọi vì chuyến xe đã ${
        booking.status === "COMPLETED" ? "hoàn thành" : "bị hủy"
      }.`,
      "TRIP_NOT_CALLABLE",
    )
  }

  // 3. Xác minh phân quyền và thiết lập Người gọi (Caller) / Người nhận (Callee)
  let callerRole: "CUSTOMER" | "DRIVER"
  let calleeRole: "CUSTOMER" | "DRIVER"
  let calleeUserId: string
  let calleeName: string
  let calleeAvatar: string | null = null

  if (callerUserId === booking.customer_id) {
    callerRole = "CUSTOMER"
    calleeRole = "DRIVER"

    if (!booking.driver_user_id) {
      throw new ApiError(
        400,
        "Chuyến xe chưa có tài xế tiếp nhận. Vui lòng chờ tài xế nhận cuốc để liên lạc.",
        "DRIVER_NOT_ASSIGNED",
      )
    }

    calleeUserId = booking.driver_user_id
    calleeName = booking.driver_name || "Tài xế"
  } else if (callerUserId === booking.driver_user_id) {
    callerRole = "DRIVER"
    calleeRole = "CUSTOMER"
    calleeUserId = booking.customer_id
    calleeName = booking.customer_name || "Khách hàng"
  } else {
    throw new ApiError(
      403,
      "Bạn không có quyền gọi điện trong chuyến xe này (Chỉ Khách hàng và Tài xế trong chuyến mới được phép liên lạc)",
    )
  }

  // 4. Sinh mã định danh cuộc gọi Stringee
  const stringeeCallId = `CALL_${booking.booking_code}_${Date.now()}`

  // 5. Lưu bản ghi bắt đầu cuộc gọi vào database call_logs
  const insertedCall = await client.unsafe(
    `
    INSERT INTO call_logs (
      booking_id,
      caller_id,
      receiver_id,
      stringee_call_id,
      call_status,
      duration_seconds,
      created_at
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4,
      'STARTED',
      0,
      NOW()
    )
    RETURNING id, booking_id, caller_id, receiver_id, stringee_call_id, call_status, created_at
    `,
    [bookingId, callerUserId, calleeUserId, stringeeCallId],
  )

  // 6. Cấp Access Token cho người gọi
  const clientToken = generateStringeeClientToken(callerUserId)

  return {
    callLogId: insertedCall[0].id,
    stringeeCallId,
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    tripStatus: booking.status,
    clientToken,
    caller: {
      userId: callerUserId,
      role: callerRole,
    },
    callee: {
      userId: calleeUserId,
      role: calleeRole,
      name: calleeName,
      licensePlate: calleeRole === "DRIVER" ? booking.license_plate : null,
      vehicleType: calleeRole === "DRIVER" ? booking.vehicle_type_name : null,
      // SỐ ĐIỆN THOẠI THẬT ĐƯỢC GIẤU HOÀN TOÀN:
      maskedDisplayNumber: STRINGEE_CONFIG.hotlineNumber,
    },
    message: "Cấp phép cuộc gọi giấu số thành công",
  }
}

/**
 * 3. Sinh SCCO (Stringee Call Control Object) cho Answer URL Webhook
 * Khi tổng đài Stringee kết nối cuộc gọi, hàm này trả về kịch bản điều hướng
 */
export function generateAnswerUrlScco(params: {
  from: string
  to: string
  customData?: string
}) {
  const { from, to, customData } = params

  return [
    {
      action: "record",
      eventUrl: `${process.env.API_BASE_URL || "http://localhost:3000"}/api/v1/calls/events`,
      format: "mp3",
    },
    {
      action: "connect",
      from: {
        type: "internal",
        number: from,
        alias: `Hotline ${STRINGEE_CONFIG.hotlineNumber}`,
      },
      to: {
        type: "internal",
        number: to,
        alias: `Người dùng ${to.slice(0, 8)}`,
      },
      customData: customData || "{}",
    },
  ]
}

/**
 * 4. Xử lý Event Webhook từ Stringee (ringing, answered, ended, recording,...)
 */
export async function processStringeeEvent(payload: StringeeEventPayload) {
  const callId = payload.call_id || payload.stringee_call_id
  const event = String(payload.event || payload.call_status || "").toLowerCase()
  const duration = payload.duration || payload.duration_seconds || 0
  const recordUrl = payload.record_url || null

  let normalizedStatus = "STARTED"
  if (event.includes("ringing")) normalizedStatus = "RINGING"
  else if (event.includes("answered") || event === "in_call")
    normalizedStatus = "ANSWERED"
  else if (event.includes("ended") || event.includes("completed"))
    normalizedStatus = "ENDED"
  else if (event.includes("busy")) normalizedStatus = "BUSY"
  else if (event.includes("no_answer") || event.includes("timeout"))
    normalizedStatus = "MISSED"
  else if (event.includes("failed") || event.includes("rejected"))
    normalizedStatus = "FAILED"

  if (callId) {
    await client.unsafe(
      `
      UPDATE call_logs
      SET 
        call_status = $1,
        duration_seconds = CASE WHEN $2 > 0 THEN $2 ELSE duration_seconds END,
        record_url = COALESCE($3, record_url)
      WHERE stringee_call_id = $4
      `,
      [normalizedStatus, Number(duration), recordUrl, callId],
    )
  }

  return {
    success: true,
    callId,
    status: normalizedStatus,
    duration,
  }
}

/**
 * 5. Lấy lịch sử cuộc gọi của một chuyến xe
 */
export async function getTripCallLogs(
  bookingId: string,
  currentUserId: string,
) {
  if (!currentUserId || !bookingId) {
    throw new ApiError(400, "Thiếu tham số bookingId hoặc currentUserId")
  }

  const rows = await client.unsafe(
    `
    SELECT 
      cl.id,
      cl.booking_id,
      cl.caller_id,
      cl.receiver_id,
      cl.stringee_call_id,
      cl.call_status,
      cl.duration_seconds,
      cl.record_url,
      cl.created_at,
      u_caller.full_name as caller_name,
      u_receiver.full_name as receiver_name
    FROM call_logs cl
    JOIN users u_caller ON u_caller.id = cl.caller_id
    JOIN users u_receiver ON u_receiver.id = cl.receiver_id
    WHERE cl.booking_id = $1::uuid
    ORDER BY cl.created_at DESC
    `,
    [bookingId],
  )

  return rows.map((r: any) => ({
    id: r.id,
    bookingId: r.booking_id,
    callerId: r.caller_id,
    callerName: r.caller_name,
    receiverId: r.receiver_id,
    receiverName: r.receiver_name,
    stringeeCallId: r.stringee_call_id,
    callStatus: r.call_status,
    durationSeconds: r.duration_seconds,
    recordUrl: r.record_url,
    createdAt: r.created_at,
    isCaller: r.caller_id === currentUserId,
  }))
}

/**
 * 6. Lấy lịch sử cuộc gọi tổng quan của người dùng
 */
export async function getUserCallHistory(userId: string, limit = 20) {
  if (!userId) {
    throw new ApiError(401, "Yêu cầu đăng nhập")
  }

  const rows = await client.unsafe(
    `
    SELECT 
      cl.id,
      cl.booking_id,
      b.booking_code,
      cl.caller_id,
      cl.receiver_id,
      cl.call_status,
      cl.duration_seconds,
      cl.created_at,
      u_caller.full_name as caller_name,
      u_receiver.full_name as receiver_name
    FROM call_logs cl
    JOIN bookings b ON b.id = cl.booking_id
    JOIN users u_caller ON u_caller.id = cl.caller_id
    JOIN users u_receiver ON u_receiver.id = cl.receiver_id
    WHERE cl.caller_id = $1::uuid OR cl.receiver_id = $1::uuid
    ORDER BY cl.created_at DESC
    LIMIT $2
    `,
    [userId, limit],
  )

  return rows.map((r: any) => ({
    id: r.id,
    bookingId: r.booking_id,
    bookingCode: r.booking_code,
    isIncoming: r.receiver_id === userId,
    partnerName: r.caller_id === userId ? r.receiver_name : r.caller_name,
    callStatus: r.call_status,
    durationSeconds: r.duration_seconds,
    createdAt: r.created_at,
  }))
}
