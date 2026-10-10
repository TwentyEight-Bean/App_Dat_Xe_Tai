import { Router } from "express"
import {
  generateStringeeClientToken,
  authorizeTripCall,
  generateAnswerUrlScco,
  processStringeeEvent,
  getTripCallLogs,
  getUserCallHistory,
} from "../../lib/stringeeService"
import { requireAuth, type AuthRequest } from "../middleware"

const router = Router()

/**
 * 1. GET /calls/token
 * Lấy Client Access Token kết nối Stringee SDK cho người dùng đang đăng nhập
 */
router.get("/token", requireAuth, (req: AuthRequest, res, next) => {
  try {
    const token = generateStringeeClientToken(req.user!.userId)
    res.json({
      success: true,
      data: {
        userId: req.user!.userId,
        clientToken: token,
        expiresInSeconds: 3600 * 24,
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 2. POST /calls/authorize
 * Cấp phép & Khởi tạo cuộc gọi giấu số (Number Masking) giữa Khách hàng và Tài xế
 */
router.post("/authorize", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { bookingId } = req.body
    const result = await authorizeTripCall({
      bookingId,
      callerUserId: req.user!.userId,
    })

    res.json({
      success: true,
      message: result.message,
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 3. ALL /calls/answer-url (GET & POST)
 * Webhook Stringee gọi để lấy SCCO (Stringee Call Control Object) điều hướng cuộc gọi
 */
router.all("/answer-url", (req, res) => {
  try {
    const from = String(req.query.from || req.body?.from || "")
    const to = String(req.query.to || req.body?.to || "")
    const customData = req.query.customData || req.body?.customData

    const scco = generateAnswerUrlScco({
      from,
      to,
      customData: customData ? String(customData) : undefined,
    })

    res.json(scco)
  } catch (err: any) {
    console.error("[Stringee Answer URL Error]:", err.message)
    res.status(500).json([])
  }
})

/**
 * 4. POST /calls/events
 * Webhook Stringee gửi sự kiện cuộc gọi (Ringing, Answered, Ended, Recording URL)
 */
router.post("/events", async (req, res) => {
  try {
    const result = await processStringeeEvent(req.body)
    res.json(result)
  } catch (err: any) {
    console.error("[Stringee Event Error]:", err.message)
    res.status(500).json({ success: false })
  }
})

/**
 * 5. GET /calls/trip/:bookingId
 * Lấy lịch sử cuộc gọi trong một chuyến xe cụ thể
 */
router.get(
  "/trip/:bookingId",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const logs = await getTripCallLogs(
        req.params.bookingId as string,
        req.user!.userId,
      )
      res.json({
        success: true,
        count: logs.length,
        data: logs,
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * 6. GET /calls/history
 * Lấy lịch sử cuộc gọi tổng quan của người dùng
 */
router.get("/history", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const logs = await getUserCallHistory(req.user!.userId, limit)
    res.json({
      success: true,
      count: logs.length,
      data: logs,
    })
  } catch (err) {
    next(err)
  }
})

export default router
