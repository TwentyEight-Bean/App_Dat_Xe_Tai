import crypto from "node:crypto"
import { client } from "../db"
import { ApiError } from "./errors"
import { topUpWallet, getOrCreateWallet } from "./walletService"

/**
 * Cấu hình Cổng Thanh Toán VNPay
 */
export const VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE || "DATXETAI_SANDBOX",
  hashSecret:
    process.env.VNPAY_HASH_SECRET || "VNPAY_DATXETAI_HASH_SECRET_KEY_2026",
  url:
    process.env.VNPAY_URL ||
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  defaultReturnUrl:
    process.env.VNPAY_RETURN_URL ||
    "http://localhost:8443/payment/vnpay-callback",
}

/**
 * Cấu hình Cổng Thanh Toán MoMo
 */
export const MOMO_CONFIG = {
  partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO_DATXETAI",
  accessKey: process.env.MOMO_ACCESS_KEY || "MOMO_ACCESS_KEY_DEV",
  secretKey:
    process.env.MOMO_SECRET_KEY || "MOMO_SECRET_KEY_DEV_TRUCK_BOOKING_2026",
  endpoint:
    process.env.MOMO_ENDPOINT ||
    "https://test-payment.momo.vn/v2/gateway/api/create",
  defaultRedirectUrl:
    process.env.MOMO_REDIRECT_URL ||
    "http://localhost:8443/payment/momo-callback",
  defaultIpnUrl:
    process.env.MOMO_IPN_URL ||
    "http://localhost:3000/api/v1/payments/momo-ipn",
}

export type PaymentGateway = "VNPAY" | "MOMO"
export type PaymentPurpose = "TOPUP_WALLET" | "PAY_BOOKING"

export interface CreatePaymentDto {
  userId: string
  amount: number
  gateway: PaymentGateway
  purpose: PaymentPurpose
  bookingId?: string
  ipAddr?: string
  bankCode?: string // VNPAY QR, VNBANK, INTCARD,...
  redirectUrl?: string
  description?: string
}

/**
 * Định dạng ngày theo chuẩn VNPay: yyyyMMddHHmmss
 */
function formatVnpayDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(date.getHours()).padStart(2, "0")
  const mi = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return `${y}${m}${d}${h}${mi}${s}`
}

/**
 * Tạo mã giao dịch duy nhất cho cổng thanh toán
 */
export function generateTransactionCode(gateway: PaymentGateway): string {
  const prefix = gateway.toUpperCase()
  const timestamp = Date.now()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}_${timestamp}_${random}`
}

/**
 * 1. CORE API: Tạo link thanh toán VNPay / MoMo
 */
export async function createPaymentOrder(dto: CreatePaymentDto) {
  const {
    userId,
    amount,
    gateway,
    purpose,
    bookingId,
    ipAddr = "127.0.0.1",
    bankCode,
    redirectUrl,
    description,
  } = dto

  if (!userId) {
    throw new ApiError(401, "Yêu cầu đăng nhập người dùng")
  }

  const numAmount = Number(amount)
  if (isNaN(numAmount) || numAmount < 10000) {
    throw new ApiError(400, "Số tiền thanh toán tối thiểu là 10.000 VNĐ")
  }

  let walletId: string | null = null
  let bookingCode: string | null = null

  // 1. Kiểm tra mục đích thanh toán
  if (purpose === "TOPUP_WALLET") {
    const wallet = await getOrCreateWallet(userId)
    walletId = wallet.id
  } else if (purpose === "PAY_BOOKING") {
    if (!bookingId) {
      throw new ApiError(
        400,
        "Thiếu thông tin bookingId để thanh toán chuyến xe",
      )
    }
    const bRows = await client.unsafe(
      `SELECT id, booking_code, status, total_price, payment_status FROM bookings WHERE id = $1::uuid LIMIT 1`,
      [bookingId],
    )
    if (bRows.length === 0) {
      throw new ApiError(404, "Không tìm thấy chuyến xe cần thanh toán")
    }
    if (bRows[0].payment_status === "PAID") {
      throw new ApiError(400, "Chuyến xe này đã được thanh toán trước đó")
    }
    bookingCode = bRows[0].booking_code
  }

  const transactionCode = generateTransactionCode(gateway)
  const orderDesc =
    description ||
    (purpose === "TOPUP_WALLET"
      ? `Nạp ${numAmount.toLocaleString("vi-VN")} đ vào ví`
      : `Thanh toán chuyến xe ${bookingCode || bookingId}`)

  let paymentUrl: string
  let qrCodeUrl: string | null = null

  // 2. Tạo URL thanh toán theo Gateway
  if (gateway === "VNPAY") {
    const returnUrl = redirectUrl || VNPAY_CONFIG.defaultReturnUrl
    const createDate = formatVnpayDate(new Date())

    const vnpParams: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: VNPAY_CONFIG.tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: transactionCode,
      vnp_OrderInfo: orderDesc,
      vnp_OrderType: purpose === "TOPUP_WALLET" ? "topup" : "billpayment",
      vnp_Amount: String(numAmount * 100), // VNPay quy ước nhân 100
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    }

    if (bankCode) {
      vnpParams.vnp_BankCode = bankCode
    }

    // Sắp xếp tham số theo alphabet
    const sortedKeys = Object.keys(vnpParams).sort()
    const signDataParts: string[] = []
    const queryParts: string[] = []

    for (const key of sortedKeys) {
      const val = vnpParams[key]
      if (val !== undefined && val !== null && val.length > 0) {
        signDataParts.push(
          `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`,
        )
        queryParts.push(
          `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`,
        )
      }
    }

    const signData = signDataParts.join("&")
    const hmac = crypto.createHmac("sha512", VNPAY_CONFIG.hashSecret)
    const secureHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex")

    paymentUrl = `${VNPAY_CONFIG.url}?${queryParts.join("&")}&vnp_SecureHash=${secureHash}`
  } else if (gateway === "MOMO") {
    const returnUrl = redirectUrl || MOMO_CONFIG.defaultRedirectUrl
    const ipnUrl = MOMO_CONFIG.defaultIpnUrl
    const requestId = `${transactionCode}_REQ`
    const extraData = Buffer.from(
      JSON.stringify({ userId, purpose, bookingId }),
    ).toString("base64")

    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${numAmount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${transactionCode}&orderInfo=${orderDesc}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=captureWallet`

    const signature = crypto
      .createHmac("sha256", MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest("hex")

    // MoMo Payment URL (Môi trường Dev Sandbox)
    paymentUrl = `https://test-payment.momo.vn/v2/gateway/pay?partnerCode=${MOMO_CONFIG.partnerCode}&orderId=${transactionCode}&requestId=${requestId}&amount=${numAmount}&orderInfo=${encodeURIComponent(orderDesc)}&signature=${signature}`
    qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymentUrl)}`
  } else {
    throw new ApiError(400, `Cổng thanh toán "${gateway}" không được hỗ trợ`)
  }

  // 3. Lưu giao dịch PENDING vào bảng payment_transactions
  const inserted = await client.unsafe(
    `
    INSERT INTO payment_transactions (
      user_id,
      booking_id,
      wallet_id,
      amount,
      gateway,
      transaction_code,
      status,
      payment_url,
      description,
      created_at,
      updated_at
    ) VALUES (
      $1::uuid,
      $2::uuid,
      $3::uuid,
      $4::numeric,
      $5,
      $6,
      'PENDING',
      $7,
      $8,
      NOW(),
      NOW()
    )
    RETURNING id, transaction_code, amount, gateway, status, payment_url, created_at
    `,
    [
      userId,
      bookingId || null,
      walletId || null,
      numAmount,
      gateway,
      transactionCode,
      paymentUrl,
      orderDesc,
    ],
  )

  return {
    paymentId: inserted[0].id,
    transactionCode,
    gateway,
    amount: numAmount,
    purpose,
    paymentUrl,
    qrCodeUrl,
    bookingCode,
    description: orderDesc,
    createdAt: inserted[0].created_at,
  }
}

/**
 * 2. Xác thực và Xử lý IPN từ VNPay (Webhook Server-to-Server)
 */
export async function processVnpayIpn(query: Record<string, any>) {
  const vnpParams: Record<string, string> = {}
  let secureHash = ""

  for (const [key, value] of Object.entries(query)) {
    if (key === "vnp_SecureHash" || key === "vnp_SecureHashType") {
      if (key === "vnp_SecureHash") secureHash = String(value)
      continue
    }
    if (key.startsWith("vnp_")) {
      vnpParams[key] = String(value)
    }
  }

  // Sắp xếp alphabet
  const sortedKeys = Object.keys(vnpParams).sort()
  const signDataParts: string[] = []

  for (const key of sortedKeys) {
    const val = vnpParams[key]
    if (val !== undefined && val !== null && val.length > 0) {
      signDataParts.push(
        `${key}=${encodeURIComponent(val).replace(/%20/g, "+")}`,
      )
    }
  }

  const signData = signDataParts.join("&")
  const hmac = crypto.createHmac("sha512", VNPAY_CONFIG.hashSecret)
  const calculatedHash = hmac
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex")

  // 1. Kiểm tra chữ ký an toàn (Checksum Check)
  if (calculatedHash.toLowerCase() !== secureHash.toLowerCase()) {
    return {
      isValidChecksum: false,
      response: { RspCode: "97", Message: "Invalid Checksum" },
    }
  }

  const transactionCode = vnpParams["vnp_TxnRef"]
  const vnpAmount = Number(vnpParams["vnp_Amount"] || 0) / 100
  const responseCode = vnpParams["vnp_ResponseCode"] // "00" là thành công
  const vnpTransactionNo = vnpParams["vnp_TransactionNo"]

  // 2. Tìm đơn thanh toán trong Database
  const txRows = await client.unsafe(
    `SELECT * FROM payment_transactions WHERE transaction_code = $1 LIMIT 1`,
    [transactionCode],
  )

  if (txRows.length === 0) {
    return {
      isValidChecksum: true,
      response: { RspCode: "01", Message: "Order Not Found" },
    }
  }

  const tx = txRows[0]

  // 3. Kiểm tra số tiền
  if (Number(tx.amount) !== vnpAmount) {
    return {
      isValidChecksum: true,
      response: { RspCode: "04", Message: "Invalid Amount" },
    }
  }

  // 4. Kiểm tra trạng thái Idempotency (Tránh xử lý 2 lần)
  if (tx.status === "SUCCESS") {
    return {
      isValidChecksum: true,
      response: { RspCode: "02", Message: "Order already confirmed" },
    }
  }

  // 5. Nếu VNPay trả mã 00 (Giao dịch thành công)
  if (responseCode === "00") {
    await fulfillSuccessfulPayment({
      paymentTxId: tx.id,
      userId: tx.user_id,
      bookingId: tx.booking_id,
      walletId: tx.wallet_id,
      amount: vnpAmount,
      gateway: "VNPAY",
      transactionCode,
      gatewayRefId: vnpTransactionNo,
      rawResponse: query,
    })

    return {
      isValidChecksum: true,
      success: true,
      response: { RspCode: "00", Message: "Confirm Success" },
    }
  } else {
    // Giao dịch thất bại / Khách hủy giao dịch
    await client.unsafe(
      `
      UPDATE payment_transactions
      SET status = 'FAILED', gateway_ref_id = $1, raw_response = $2::jsonb, updated_at = NOW()
      WHERE id = $3::uuid
      `,
      [vnpTransactionNo, JSON.stringify(query), tx.id],
    )

    return {
      isValidChecksum: true,
      success: false,
      response: {
        RspCode: "00",
        Message: "Confirm Success (Recorded Failure)",
      },
    }
  }
}

/**
 * 3. Xác thực và Xử lý IPN từ MoMo (Webhook Server-to-Server)
 */
export async function processMomoIpn(body: Record<string, any>) {
  const {
    partnerCode,
    orderId,
    requestId,
    amount,
    orderInfo,
    orderType,
    transId,
    resultCode,
    message,
    payType,
    responseTime,
    extraData,
    signature,
  } = body

  if (!orderId || !signature) {
    return {
      isValidChecksum: false,
      response: { message: "Invalid MoMo Request Payload", status: 400 },
    }
  }

  // Chuỗi chữ ký chuẩn MoMo v2
  const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amount}&extraData=${extraData || ""}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`

  const calculatedSignature = crypto
    .createHmac("sha256", MOMO_CONFIG.secretKey)
    .update(rawSignature)
    .digest("hex")

  // 1. Kiểm tra chữ ký (Checksum)
  if (calculatedSignature !== signature) {
    return {
      isValidChecksum: false,
      response: { message: "Bad Signature", status: 400 },
    }
  }

  // 2. Tìm đơn thanh toán
  const txRows = await client.unsafe(
    `SELECT * FROM payment_transactions WHERE transaction_code = $1 LIMIT 1`,
    [orderId],
  )

  if (txRows.length === 0) {
    return {
      isValidChecksum: true,
      response: { message: "Order Not Found", status: 404 },
    }
  }

  const tx = txRows[0]

  // 3. Kiểm tra Idempotency
  if (tx.status === "SUCCESS") {
    return {
      isValidChecksum: true,
      response: { message: "Order already confirmed", status: 200 },
    }
  }

  // 4. Nếu resultCode === 0 (Thành công)
  if (Number(resultCode) === 0) {
    await fulfillSuccessfulPayment({
      paymentTxId: tx.id,
      userId: tx.user_id,
      bookingId: tx.booking_id,
      walletId: tx.wallet_id,
      amount: Number(amount),
      gateway: "MOMO",
      transactionCode: orderId,
      gatewayRefId: String(transId),
      rawResponse: body,
    })

    return {
      isValidChecksum: true,
      success: true,
      response: { message: "Success", status: 200 },
    }
  } else {
    // Giao dịch MoMo thất bại
    await client.unsafe(
      `
      UPDATE payment_transactions
      SET status = 'FAILED', gateway_ref_id = $1, raw_response = $2::jsonb, updated_at = NOW()
      WHERE id = $3::uuid
      `,
      [String(transId), JSON.stringify(body), tx.id],
    )

    return {
      isValidChecksum: true,
      success: false,
      response: { message: "Payment Failed", status: 200 },
    }
  }
}

/**
 * 4. Hàm thực thi nghiệp vụ khi thanh toán Cổng thành công (Cộng tiền ví HOẶC trả tiền cuốc)
 * ĐẢM BẢO CHỐNG TRÙNG VÀ TRANSACTION AN TOÀN
 */
async function fulfillSuccessfulPayment(params: {
  paymentTxId: string
  userId: string
  bookingId: string | null
  walletId: string | null
  amount: number
  gateway: PaymentGateway
  transactionCode: string
  gatewayRefId: string
  rawResponse: any
}) {
  const {
    paymentTxId,
    userId,
    bookingId,
    amount,
    gateway,
    transactionCode,
    gatewayRefId,
    rawResponse,
  } = params

  return await client.begin(async (sql) => {
    // 1. Cập nhật payment_transactions sang SUCCESS
    await sql`
      UPDATE payment_transactions
      SET 
        status = 'SUCCESS',
        gateway_ref_id = ${gatewayRefId},
        raw_response = ${JSON.stringify(rawResponse)}::jsonb,
        updated_at = NOW()
      WHERE id = ${paymentTxId}::uuid
    `

    // 2. Phân loại nghiệp vụ:
    if (bookingId) {
      // 2.1 TRƯỜNG HỢP: Khách hàng thanh toán tiền cuốc xe qua cổng VNPay/MoMo
      await sql`
        UPDATE bookings
        SET 
          payment_method = ${gateway}::payment_method,
          payment_status = 'PAID'::payment_status,
          updated_at = NOW()
        WHERE id = ${bookingId}::uuid
      `
    } else {
      // 2.2 TRƯỜNG HỢP: Nạp tiền vào Ví Ký Quỹ (Tài xế / Khách hàng nạp ví)
      // Gọi trực tiếp nạp ví
      await topUpWallet({
        userId,
        amount,
        description: `Nạp ${amount.toLocaleString("vi-VN")} đ qua cổng ${gateway} (${transactionCode})`,
        referenceCode: gatewayRefId || transactionCode,
      })
    }
  })
}

/**
 * 5. Lấy chi tiết trạng thái giao dịch thanh toán
 */
export async function getPaymentStatus(transactionCode: string) {
  if (!transactionCode) {
    throw new ApiError(400, "Thiếu mã giao dịch transactionCode")
  }

  const rows = await client.unsafe(
    `
    SELECT 
      pt.id,
      pt.user_id,
      pt.booking_id,
      pt.wallet_id,
      pt.amount,
      pt.gateway,
      pt.transaction_code,
      pt.gateway_ref_id,
      pt.status,
      pt.payment_url,
      pt.description,
      pt.created_at,
      pt.updated_at,
      b.booking_code
    FROM payment_transactions pt
    LEFT JOIN bookings b ON b.id = pt.booking_id
    WHERE pt.transaction_code = $1
    LIMIT 1
    `,
    [transactionCode],
  )

  if (rows.length === 0) {
    throw new ApiError(404, "Không tìm thấy thông tin giao dịch thanh toán")
  }

  const r = rows[0]
  return {
    id: r.id,
    transactionCode: r.transaction_code,
    gateway: r.gateway,
    amount: Number(r.amount),
    status: r.status,
    isSuccess: r.status === "SUCCESS",
    gatewayRefId: r.gateway_ref_id,
    bookingCode: r.booking_code || null,
    bookingId: r.booking_id || null,
    description: r.description,
    paymentUrl: r.payment_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/**
 * 6. Lấy lịch sử giao dịch thanh toán của người dùng
 */
export async function getUserPaymentHistory(userId: string, limit = 20) {
  const rows = await client.unsafe(
    `
    SELECT 
      pt.id,
      pt.amount,
      pt.gateway,
      pt.transaction_code,
      pt.gateway_ref_id,
      pt.status,
      pt.description,
      pt.created_at,
      b.booking_code
    FROM payment_transactions pt
    LEFT JOIN bookings b ON b.id = pt.booking_id
    WHERE pt.user_id = $1::uuid
    ORDER BY pt.created_at DESC
    LIMIT $2
    `,
    [userId, limit],
  )

  return rows.map((r: any) => ({
    id: r.id,
    transactionCode: r.transaction_code,
    gateway: r.gateway,
    amount: Number(r.amount),
    status: r.status,
    gatewayRefId: r.gateway_ref_id,
    bookingCode: r.booking_code || null,
    description: r.description,
    createdAt: r.created_at,
  }))
}
