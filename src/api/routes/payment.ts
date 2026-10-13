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
    const transactionCode = req.query.vnp_TxnRef as string
    const responseCode = req.query.vnp_ResponseCode as string
    const isSuccess = result.isValidChecksum && responseCode === "00"
    const rawAmount = Number(req.query.vnp_Amount || 0)
    const amount = rawAmount > 0 ? rawAmount / 100 : 0
    const bankCode = (req.query.vnp_BankCode as string) || "VNPay"
    const message = isSuccess
      ? "Giao dịch VNPay thành công!"
      : "Giao dịch VNPay không thành công hoặc đã bị hủy."

    // Nếu gọi dạng API / AJAX / kiểm thử máy chủ
    if (
      req.query.format === "json" ||
      (req.headers.accept?.includes("application/json") &&
        !req.headers.accept?.includes("text/html"))
    ) {
      return res.json({
        success: isSuccess,
        transactionCode,
        responseCode,
        message,
        data: req.query,
      })
    }

    // Trả về trang HTML đồ họa cao cấp cho người dùng
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kết quả thanh toán VNPay - FastDrop</title>
  <style>
    :root {
      --primary: #2563eb;
      --success: #16a34a;
      --danger: #dc2626;
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --subtext: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    .card {
      background: var(--card);
      border-radius: 20px;
      padding: 32px 24px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .icon {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      background: ${isSuccess ? "rgba(22, 163, 74, 0.15)" : "rgba(220, 38, 38, 0.15)"};
      color: ${isSuccess ? "var(--success)" : "var(--danger)"};
      border: 2px solid ${isSuccess ? "var(--success)" : "var(--danger)"};
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 8px;
      color: ${isSuccess ? "#4ade80" : "#f87171"};
    }
    .amount {
      font-size: 28px;
      font-weight: 800;
      margin: 12px 0 20px;
      color: #fff;
    }
    .details {
      background: rgba(0,0,0,0.25);
      border-radius: 12px;
      padding: 14px 16px;
      text-align: left;
      font-size: 13px;
      margin-bottom: 24px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .row:last-child { border-bottom: none; }
    .label { color: var(--subtext); }
    .val { font-weight: 600; color: #fff; }
    .btn {
      display: block;
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37,99,235,0.4);
    }
    .countdown {
      font-size: 12px;
      color: var(--subtext);
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? "✓" : "✕"}</div>
    <h1>${isSuccess ? "Thanh Toán Thành Công!" : "Thanh Toán Thất Bại"}</h1>
    <p style="font-size: 13px; color: var(--subtext);">${message}</p>
    ${amount > 0 ? `<div class="amount">${amount.toLocaleString("vi-VN")} đ</div>` : ""}
    <div class="details">
      <div class="row">
        <span class="label">Mã giao dịch</span>
        <span class="val">${transactionCode || "—"}</span>
      </div>
      <div class="row">
        <span class="label">Cổng thanh toán</span>
        <span class="val">VNPay (${bankCode})</span>
      </div>
      <div class="row">
        <span class="label">Mã phản hồi</span>
        <span class="val">${responseCode || "—"}</span>
      </div>
    </div>
    <a href="/" class="btn" id="returnBtn">Quay lại FastDrop</a>
    <div class="countdown">Tự động chuyển hướng sau <span id="timer">5</span> giây...</div>
  </div>
  <script>
    var sec = 5;
    var timerEl = document.getElementById("timer");
    var interval = setInterval(function() {
      sec--;
      if (timerEl) timerEl.innerText = sec;
      if (sec <= 0) {
        clearInterval(interval);
        window.location.href = "/";
      }
    }, 1000);
  </script>
</body>
</html>`

    res.setHeader("Content-Type", "text/html; charset=utf-8")
    return res.send(html)
  } catch (err: any) {
    if (
      req.query.format === "json" ||
      (req.headers.accept?.includes("application/json") &&
        !req.headers.accept?.includes("text/html"))
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
    res.status(400).send(`<h3>Lỗi xử lý phản hồi VNPay: ${err.message}</h3><p><a href="/">Quay lại ứng dụng</a></p>`)
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
