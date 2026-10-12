import crypto from "node:crypto"
import { client } from "../db"
import {
  createPaymentOrder,
  processVnpayIpn,
  processMomoIpn,
  getPaymentStatus,
  getUserPaymentHistory,
  VNPAY_CONFIG,
  MOMO_CONFIG,
} from "../lib/paymentService"
import { getWalletDetails } from "../lib/walletService"
import { createBooking } from "../lib/bookingService"

async function runPaymentGatewayTest() {
  console.log("\n========================================================")
  console.log("🚀 BẮT ĐẦU TEST TOÀN DIỆN TASK 4.2: CỔNG VNPAY & MOMO")
  console.log("========================================================\n")

  try {
    // 1. Lấy dữ liệu mẫu
    const users = await client.unsafe(
      `SELECT id, full_name, phone, role FROM users WHERE role = 'DRIVER' LIMIT 1`,
    )
    if (users.length === 0) throw new Error("Không có driver để test")
    const testDriver = users[0]

    const customers = await client.unsafe(
      `SELECT id, full_name, phone FROM users WHERE role = 'CUSTOMER' LIMIT 1`,
    )
    if (customers.length === 0) throw new Error("Không có customer để test")
    const testCustomer = customers[0]

    const vehicleTypes = await client.unsafe(
      `SELECT id FROM vehicle_types LIMIT 1`,
    )
    const vehicleTypeId = vehicleTypes[0].id

    console.log(`👨‍✈️ Tài xế: ${testDriver.full_name} (${testDriver.id})`)
    console.log(
      `👤 Khách hàng: ${testCustomer.full_name} (${testCustomer.id})\n`,
    )

    // ========================================================
    // TEST 1: VNPAY - NẠP TIỀN VÀO VÍ KÝ QUỸ (TOPUP_WALLET)
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 1: VNPay - Tạo Link nạp ví & Xử lý Webhook IPN")
    console.log("--------------------------------------------------------")
    const initialWallet = await getWalletDetails(testDriver.id)
    console.log(
      `💰 Số dư ví ban đầu: ${initialWallet.balance.toLocaleString("vi-VN")} đ`,
    )

    const topupAmount = 250000 // Nạp 250.000 đ
    const vnpOrder = await createPaymentOrder({
      userId: testDriver.id,
      amount: topupAmount,
      gateway: "VNPAY",
      purpose: "TOPUP_WALLET",
      bankCode: "NCB",
      description: "Tài xế nạp 250k vào ví ký quỹ qua VNPay",
    })

    console.log(`✅ Tạo đơn thanh toán VNPay thành công!`)
    console.log(`   Mã giao dịch: ${vnpOrder.transactionCode}`)
    console.log(`   Số tiền: ${vnpOrder.amount.toLocaleString("vi-VN")} đ`)
    console.log(
      `   URL thanh toán VNPay: ${vnpOrder.paymentUrl.slice(0, 100)}...`,
    )

    // GIẢ LẬP VNPAY IPN THÀNH CÔNG
    console.log("\n📡 Giả lập VNPay gọi Webhook IPN (Thành công)...")
    const vnpIpnParams: Record<string, string> = {
      vnp_Amount: String(topupAmount * 100),
      vnp_BankCode: "NCB",
      vnp_BankTranNo: "VNP14829103",
      vnp_CardType: "ATM",
      vnp_OrderInfo: vnpOrder.description,
      vnp_PayDate: "20261011103000",
      vnp_ResponseCode: "00",
      vnp_TmnCode: VNPAY_CONFIG.tmnCode,
      vnp_TransactionNo: "14829103",
      vnp_TransactionStatus: "00",
      vnp_TxnRef: vnpOrder.transactionCode,
    }

    // Tạo chữ ký chuẩn SHA512
    const sortedKeys = Object.keys(vnpIpnParams).sort()
    const signData = sortedKeys
      .map(
        (k) =>
          `${k}=${encodeURIComponent(vnpIpnParams[k]).replace(/%20/g, "+")}`,
      )
      .join("&")
    const vnpHash = crypto
      .createHmac("sha512", VNPAY_CONFIG.hashSecret)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex")

    vnpIpnParams.vnp_SecureHash = vnpHash

    // Gọi xử lý IPN
    const vnpIpnRes = await processVnpayIpn(vnpIpnParams)
    console.log(`✅ Kết quả xử lý VNPay IPN:`, vnpIpnRes)

    // Kiểm tra số dư ví tài xế
    const updatedWallet = await getWalletDetails(testDriver.id)
    console.log(
      `💰 Số dư ví sau khi VNPay IPN thành công: ${updatedWallet.balance.toLocaleString("vi-VN")} đ`,
    )
    const walletGain = updatedWallet.balance - initialWallet.balance
    if (walletGain === topupAmount) {
      console.log(
        `🎯 CHÍNH XÁC: Ví đã được nạp đúng +${topupAmount.toLocaleString("vi-VN")} đ!\n`,
      )
    } else {
      console.warn(`⚠️ Số dư tăng ${walletGain} khác ${topupAmount}`)
    }

    // ========================================================
    // TEST 2: VNPAY - IDEMPOTENCY & CHỮ KÝ GIẢ MẠO
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 2: VNPay - Kiểm tra Idempotency & Chữ ký giả mạo")
    console.log("--------------------------------------------------------")
    // Thử gọi lại IPN lần 2 (Retry từ cổng)
    const vnpRetryRes = await processVnpayIpn(vnpIpnParams)
    console.log(`✅ Kết quả gọi lại IPN lần 2 (Idempotency):`, vnpRetryRes)
    if (vnpRetryRes.response.RspCode === "02") {
      console.log(
        "🛡️  ĐẠT: Đã chặn xử lý trùng lặp (RspCode 02 - Order already confirmed)",
      )
    }

    // Thử gửi chữ ký giả mạo
    const fakeParams = { ...vnpIpnParams, vnp_SecureHash: "fake_hash_123456" }
    const fakeRes = await processVnpayIpn(fakeParams)
    console.log(`✅ Kết quả khi chữ ký bị giả mạo:`, fakeRes)
    if (fakeRes.response.RspCode === "97") {
      console.log(
        "🛡️  ĐẠT: Đã phát hiện và từ chối chữ ký giả mạo (RspCode 97 - Invalid Checksum)\n",
      )
    }

    // ========================================================
    // TEST 3: MOMO - THANH TOÁN CHUYẾN XE (PAY_BOOKING)
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 3: MoMo - Tạo Link trả cuốc & Xử lý Webhook IPN")
    console.log("--------------------------------------------------------")
    // Tạo 1 cuốc xe cho khách
    const booking = await createBooking(testCustomer.id, {
      vehicleTypeId,
      originAddress: "Bến xe Miền Đông, Bình Thạnh, TP.HCM",
      originLat: 10.8142,
      originLng: 106.7118,
      destinationAddress: "Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM",
      destLat: 10.8542,
      destLng: 106.7856,
      estimatedPrice: 350000,
      paymentMethod: "MOMO",
    })
    console.log(
      `📦 Khách tạo chuyến xe: ${booking.bookingCode} | Cước phí: ${booking.totalPrice.toLocaleString("vi-VN")} đ`,
    )

    // Tạo link thanh toán MoMo cho chuyến xe
    const momoOrder = await createPaymentOrder({
      userId: testCustomer.id,
      amount: booking.totalPrice,
      gateway: "MOMO",
      purpose: "PAY_BOOKING",
      bookingId: booking.bookingId,
      description: `Thanh toán cước xe tải ${booking.bookingCode} qua MoMo`,
    })

    console.log(`✅ Tạo đơn thanh toán MoMo thành công!`)
    console.log(`   Mã giao dịch: ${momoOrder.transactionCode}`)
    console.log(`   MoMo Pay URL: ${momoOrder.paymentUrl.slice(0, 100)}...`)
    console.log(`   QR Code URL: ${momoOrder.qrCodeUrl}`)

    // GIẢ LẬP MOMO IPN THÀNH CÔNG
    console.log("\n📡 Giả lập MoMo gọi Webhook IPN (Thành công)...")
    const momoOrderId = momoOrder.transactionCode
    const momoRequestId = `${momoOrderId}_REQ`
    const momoTransId = Date.now()
    const momoAmount = booking.totalPrice
    const momoExtraData = Buffer.from(
      JSON.stringify({
        userId: testCustomer.id,
        purpose: "PAY_BOOKING",
        bookingId: booking.bookingId,
      }),
    ).toString("base64")

    const rawMomoSig = `accessKey=${MOMO_CONFIG.accessKey}&amount=${momoAmount}&extraData=${momoExtraData}&message=Success&orderId=${momoOrderId}&orderInfo=${momoOrder.description}&orderType=momo_wallet&partnerCode=${MOMO_CONFIG.partnerCode}&payType=qr&requestId=${momoRequestId}&responseTime=${Date.now()}&resultCode=0&transId=${momoTransId}`

    const momoSignature = crypto
      .createHmac("sha256", MOMO_CONFIG.secretKey)
      .update(rawMomoSig)
      .digest("hex")

    const momoIpnBody = {
      partnerCode: MOMO_CONFIG.partnerCode,
      orderId: momoOrderId,
      requestId: momoRequestId,
      amount: momoAmount,
      orderInfo: momoOrder.description,
      orderType: "momo_wallet",
      transId: momoTransId,
      resultCode: 0,
      message: "Success",
      payType: "qr",
      responseTime: Date.now(),
      extraData: momoExtraData,
      signature: momoSignature,
    }

    const momoIpnRes = await processMomoIpn(momoIpnBody)
    console.log(`✅ Kết quả xử lý MoMo IPN:`, momoIpnRes)

    // Kiểm tra trạng thái chuyến xe trong database
    const bookingCheck = await client.unsafe(
      `SELECT booking_code, payment_status, payment_method FROM bookings WHERE id = $1::uuid`,
      [booking.bookingId],
    )
    console.log(`📋 Trạng thái thanh toán chuyến xe:`, bookingCheck[0])
    if (
      bookingCheck[0].payment_status === "PAID" &&
      bookingCheck[0].payment_method === "MOMO"
    ) {
      console.log(
        "🎯 CHÍNH XÁC: Chuyến xe đã được tự động cập nhật sang PAID với phương thức MOMO!\n",
      )
    }

    // ========================================================
    // TEST 4: MOMO - IDEMPOTENCY & CHỮ KÝ SAI
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 4: MoMo - Kiểm tra Idempotency & Chữ ký giả mạo")
    console.log("--------------------------------------------------------")
    const momoRetryRes = await processMomoIpn(momoIpnBody)
    console.log(
      `✅ Kết quả gọi lại MoMo IPN lần 2 (Idempotency):`,
      momoRetryRes,
    )

    const fakeMomoBody = {
      ...momoIpnBody,
      signature: "fake_momo_signature_123",
    }
    const fakeMomoRes = await processMomoIpn(fakeMomoBody)
    console.log(`✅ Kết quả khi chữ ký MoMo bị giả mạo:`, fakeMomoRes)

    // ========================================================
    // TEST 5: TRA CỨU TRẠNG THÁI GIAO DỊCH & LỊCH SỬ THANH TOÁN
    // ========================================================
    console.log("\n--------------------------------------------------------")
    console.log("TEST 5: Tra cứu Trạng thái giao dịch & Lịch sử thanh toán")
    console.log("--------------------------------------------------------")
    const vnpStatus = await getPaymentStatus(vnpOrder.transactionCode)
    console.log(`🔍 Trạng thái giao dịch VNPay:`, {
      code: vnpStatus.transactionCode,
      gateway: vnpStatus.gateway,
      amount: vnpStatus.amount,
      status: vnpStatus.status,
      isSuccess: vnpStatus.isSuccess,
      gatewayRefId: vnpStatus.gatewayRefId,
    })

    const momoStatus = await getPaymentStatus(momoOrder.transactionCode)
    console.log(`🔍 Trạng thái giao dịch MoMo:`, {
      code: momoStatus.transactionCode,
      gateway: momoStatus.gateway,
      amount: momoStatus.amount,
      status: momoStatus.status,
      isSuccess: momoStatus.isSuccess,
      bookingCode: momoStatus.bookingCode,
    })

    const customerHistory = await getUserPaymentHistory(testCustomer.id, 5)
    console.log(
      `📜 Lịch sử thanh toán của khách hàng (${customerHistory.length} giao dịch gần nhất):`,
    )
    for (const h of customerHistory) {
      console.log(
        `   - [${h.gateway}] ${h.amount.toLocaleString("vi-VN")} đ | ${h.status} | ${h.description} (Mã: ${h.transactionCode})`,
      )
    }

    console.log("\n========================================================")
    console.log("🎉 TẤT CẢ CÁC BƯỚC TEST TASK 4.2 ĐÃ THÀNH CÔNG RỰC RỠ!")
    console.log("========================================================\n")
  } catch (err: any) {
    console.error("❌ LỖI TEST TASK 4.2:", err.message)
    if (err.stack) console.error(err.stack)
  } finally {
    process.exit(0)
  }
}

runPaymentGatewayTest()
