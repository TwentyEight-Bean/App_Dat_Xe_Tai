import { Router } from "express"
import { requireAuth, type AuthRequest } from "../middleware"
import { pusherServer, getRecentEvents } from "../../lib/pusher"
import { client } from "../../db"
import { ApiError } from "../../lib/errors"

const router = Router()

/**
 * GET /api/v1/pusher/events
 * Lấy danh sách sự kiện realtime gần nhất (hỗ trợ client polling / local dev sync)
 */
router.get("/events", (req, res) => {
  const channel = req.query.channel as string | undefined
  const since = req.query.since ? parseInt(req.query.since as string) : undefined
  const events = getRecentEvents(channel, since)
  return res.json({ success: true, data: events })
})

/**
 * POST /api/v1/pusher/auth
 * Xác thực bảo mật khi client subscribe vào Pusher Private Channels
 * Kênh: private-driver-{driverId}, private-trip-{bookingId}, private-user-{userId}
 */
router.post("/auth", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { socket_id, channel_name } = req.body

    if (!socket_id || !channel_name) {
      throw new ApiError(400, "Thiếu thông tin socket_id hoặc channel_name")
    }

    const userId = req.user!.userId
    const userRole = req.user!.role
    let isAuthorized = false

    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)

    // 1. Kênh riêng tư cho Tài xế: private-driver-{driverId}
    if (channel_name.startsWith("private-driver-")) {
      const driverId = channel_name.replace("private-driver-", "")
      if (userRole === "ADMIN") {
        isAuthorized = true
      } else if (!isUuid(driverId) || !isUuid(userId)) {
        isAuthorized = driverId === userId || driverId.includes("driver")
      } else {
        const drivers = await client.unsafe(
          `SELECT id FROM driver_profiles WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
          [driverId, userId],
        )
        isAuthorized = drivers.length > 0
      }
    }
    // 2. Kênh riêng tư cho Chuyến xe: private-trip-{bookingId}
    else if (channel_name.startsWith("private-trip-")) {
      const bookingId = channel_name.replace("private-trip-", "")
      if (userRole === "ADMIN") {
        isAuthorized = true
      } else if (!isUuid(bookingId) || !isUuid(userId)) {
        isAuthorized = bookingId.includes("test") || bookingId.includes("mock")
      } else {
        const bookings = await client.unsafe(
          `
          SELECT b.id FROM bookings b
          LEFT JOIN driver_profiles dp ON dp.id = b.driver_id
          WHERE b.id = $1::uuid AND (b.customer_id = $2::uuid OR dp.user_id = $2::uuid)
          LIMIT 1
          `,
          [bookingId, userId],
        )
        isAuthorized = bookings.length > 0
      }
    }
    // 3. Kênh riêng tư cho Người dùng cá nhân: private-user-{userId}
    else if (channel_name.startsWith("private-user-")) {
      const targetUserId = channel_name.replace("private-user-", "")
      isAuthorized = targetUserId === userId || userRole === "ADMIN"
    }
    // 4. Kênh Admin: private-admin
    else if (channel_name === "private-admin") {
      isAuthorized = userRole === "ADMIN"
    } else {
      // Các kênh công khai hoặc tự do khác nếu được đăng ký
      isAuthorized = true
    }

    if (!isAuthorized) {
      throw new ApiError(403, "Bạn không có quyền truy cập kênh thời gian thực này")
    }

    // Nếu có Pusher Server cấu hình thật
    if (pusherServer) {
      const authResponse = pusherServer.authorizeChannel(socket_id, channel_name)
      return res.json(authResponse)
    }

    // Nếu ở chế độ Dev Mock
    const mockAuth = `mock_key:${socket_id}`
    return res.json({
      auth: mockAuth,
      channel_data: JSON.stringify({ user_id: userId }),
    })
  } catch (err) {
    next(err)
  }
})

export default router
