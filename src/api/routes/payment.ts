import { Router } from "express"
import {
  createPaymentOrder,
  processVnpayIpn,
  processMomoIpn,
  getPaymentStatus,
  getUserPaymentHistory,
} from "../../lib/paymentService"
import { requireAuth, type AuthRequest } from "../middleware"

const router = Router()

/**
 * 1. POST /payments/create-url
 * Tạo đường dẫn thanh toán qua cổng VNPay hoặc MoMo
 * (Dùng để Nạp ví Ký quỹ HOẶC Thanh toán chuyến xe)
 */
router.post("/create-url", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const {
      amount,
      gateway,
      purpose,
      bookingId,
      bankCode,
      redirectUrl,
      description,
    } = req.body

    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      req.socket.remoteAddress ||
      "127.0.0.1"

    const result = await createPaymentOrder({
      userId: req.user!.userId,
      amount: Number(amount),
      gateway: gateway ? String(gateway).toUpperCase() as any : "VNPAY",
      purpose: purpose ? String(purpose).toUpperCase() as any : "TOPUP_WALLET",
      bookingId,
      bankCode,
      redirectUrl,
      description,
      ipAddr: clientIp,
    })

    res.json({
      success: true,
      message: `Tạo link thanh toán qua ${result.gateway} thành công`,
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 2. GET /payments/vnpay-ipn
 * Webhook Server-to-Server nhận kết quả giao dịch tự động từ VNPay
 */
router.get("/vnpay-ipn", async (req, res) => {
  try {
    const result = await processVnpayIpn(req.query)
    // Phản hồi định dạng JSON đúng chuẩn quy định của VNPay
    res.json(result.response)
  } catch (err: any) {
    console.error("[VNPay IPN Error]:", err.message)
    res.json({ RspCode: "99", Message: "Unknown Error" })
  }
})

/**
 * 3. GET /payments/vnpay-return
 * URL xử lý khi người dùng hoàn tất thanh toán trên VNPay và được điều hướng về
 */
router.get("/vnpay-return", async (req, res) => {
  try {
    const result = await processVnpayIpn(req.query)
    const transactionCode = req.query.vnp_TxnRef
    const responseCode = req.query.vnp_ResponseCode

    res.json({
      success: result.isValidChecksum && responseCode === "00",
      transactionCode,
      responseCode,
      message:
        responseCode === "00"
          ? "Giao dịch VNPay thành công!"
          : "Giao dịch VNPay không thành công hoặc đã bị hủy.",
      data: req.query,
    })
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err.message,
    })
  }
})

/**
 * 4. POST /payments/momo-ipn
 * Webhook Server-to-Server nhận kết quả giao dịch tự động từ MoMo
 */
router.post("/momo-ipn", async (req, res) => {
  try {
    const result = await processMomoIpn(req.body)
    res.status(result.response.status || 200).json(result.response)
  } catch (err: any) {
    console.error("[MoMo IPN Error]:", err.message)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

/**
 * 5. GET /payments/status/:transactionCode
 * Kiểm tra trạng thái giao dịch thanh toán
 */
router.get("/status/:transactionCode", async (req, res, next) => {
  try {
    const status = await getPaymentStatus(req.params.transactionCode)
    res.json({
      success: true,
      data: status,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 6. GET /payments/history
 * Lấy lịch sử giao dịch thanh toán của người dùng hiện tại
 */
router.get("/history", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20
    const history = await getUserPaymentHistory(req.user!.userId, limit)
    res.json({
      success: true,
      count: history.length,
      data: history,
    })
  } catch (err) {
    next(err)
  }
})

export default router
