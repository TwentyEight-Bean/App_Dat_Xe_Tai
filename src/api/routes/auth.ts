import { Router } from "express"
import { requestOtp, verifyOtp } from "../../lib/otpService"
import {
  registerDeviceToken,
  removeDeviceToken,
} from "../../lib/notificationService"
import { requireAuth, type AuthRequest } from "../middleware"

const router = Router()

router.post("/request-otp", async (req, res, next) => {
  try {
    const result = await requestOtp(req.body.phone)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.post("/verify-otp", async (req, res, next) => {
  try {
    const result = await verifyOtp(req.body.phone, req.body.otp)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.get("/me", requireAuth, (req: AuthRequest, res) => {
  res.json({
    success: true,
    user: req.user,
  })
})

/**
 * POST /api/v1/auth/device-token
 * Đăng ký / cập nhật FCM Device Token sau khi đăng nhập
 */
router.post(
  "/device-token",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const device = await registerDeviceToken(req.user!.userId, req.body)
      res.json({
        success: true,
        message: "Đăng ký thiết bị nhận thông báo đẩy thành công",
        data: device,
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * DELETE /api/v1/auth/device-token
 * Hủy đăng ký FCM Device Token khi đăng xuất
 */
router.delete(
  "/device-token",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const { fcmToken } = req.body
      const result = await removeDeviceToken(req.user!.userId, fcmToken)
      res.json({
        success: true,
        message: "Hủy đăng ký thiết bị thành công",
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },
)

export default router
