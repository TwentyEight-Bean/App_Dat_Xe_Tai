import { Router } from "express"
import {
  sendChatMessage,
  getBookingChatMessages,
  markBookingChatRead,
  getUserChatConversations,
} from "../../lib/chatService"
import { requireAuth, type AuthRequest } from "../middleware"

const router = Router()

// Mọi thao tác Chat đều bắt buộc đăng nhập (Khách hàng hoặc Tài xế)
router.use(requireAuth)

/**
 * 1. POST /chat/send
 * Gửi tin nhắn chat mới trong chuyến xe (Lưu DB + Bắn Pusher + Bắn Push Notification)
 */
router.post("/send", async (req: AuthRequest, res, next) => {
  try {
    const { bookingId, content, messageType, mediaUrl } = req.body

    const result = await sendChatMessage({
      bookingId,
      senderUserId: req.user!.userId,
      content,
      messageType,
      mediaUrl,
    })

    res.json({
      success: true,
      message: "Gửi tin nhắn thành công",
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 2. GET /chat/conversations
 * Lấy danh sách các cuộc trò chuyện gần đây của người dùng
 */
router.get("/conversations", async (req: AuthRequest, res, next) => {
  try {
    const conversations = await getUserChatConversations(req.user!.userId)
    res.json({
      success: true,
      count: conversations.length,
      data: conversations,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 3. GET /chat/:bookingId/messages
 * Lấy toàn bộ lịch sử tin nhắn của một chuyến xe (Phân trang, tự động đánh dấu đã đọc)
 */
router.get("/:bookingId/messages", async (req: AuthRequest, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50

    const result = await getBookingChatMessages(
      req.params.bookingId as string,
      req.user!.userId,
      { page, limit },
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 4. PATCH /chat/:bookingId/read
 * Đánh dấu đã đọc tất cả tin nhắn trong chuyến xe
 */
router.patch("/:bookingId/read", async (req: AuthRequest, res, next) => {
  try {
    const result = await markBookingChatRead(
      req.params.bookingId as string,
      req.user!.userId,
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

export default router
