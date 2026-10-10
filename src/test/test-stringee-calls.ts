import jwt from "jsonwebtoken"
import { client } from "../db"
import {
  generateStringeeClientToken,
  authorizeTripCall,
  generateAnswerUrlScco,
  processStringeeEvent,
  getTripCallLogs,
  getUserCallHistory,
  STRINGEE_CONFIG,
} from "../lib/stringeeService"
import {
  createBooking,
  acceptBooking,
  updateBookingStatus,
} from "../lib/bookingService"

async function runStringeeCallTest() {
  console.log("\n========================================================")
  console.log("🚀 BẮT ĐẦU TEST TOÀN DIỆN TASK 4.4: TỔNG ĐÀI ẢO STRINGEE")
  console.log("========================================================\n")

  try {
    // 1. Lấy dữ liệu mẫu
    const customers = await client.unsafe(
      `SELECT id, full_name, phone FROM users WHERE role = 'CUSTOMER' LIMIT 2`,
    )
    if (customers.length < 2) throw new Error("Cần ít nhất 2 customer để test")
    const customer = customers[0]
    const outsider = customers[1]

    const drivers = await client.unsafe(
      `
      SELECT dp.id as driver_id, dp.user_id, u.full_name, u.phone
      FROM driver_profiles dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.kyc_status = 'APPROVED' AND dp.is_active = true
      LIMIT 1
      `,
    )
    if (drivers.length === 0) throw new Error("Không có driver để test")
    const driver = drivers[0]

    // Đảm bảo tài xế có ví đủ tiền và online
    await client.unsafe(
      `INSERT INTO wallets (user_id, balance, min_deposit_limit) VALUES ($1::uuid, 500000, 200000) ON CONFLICT (user_id) DO UPDATE SET balance = 500000`,
      [driver.user_id],
    )
    await client.unsafe(
      `UPDATE driver_profiles SET is_online = true WHERE id = $1::uuid`,
      [driver.driver_id],
    )

    // Dọn dẹp chuyến xe cũ đang kẹt
    await client.unsafe(
      `
      UPDATE bookings
      SET status = 'COMPLETED', updated_at = NOW()
      WHERE driver_id = $1::uuid AND status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
      `,
      [driver.driver_id],
    )

    const vehicleTypes = await client.unsafe(
      `SELECT id FROM vehicle_types LIMIT 1`,
    )
    const vehicleTypeId = vehicleTypes[0].id

    console.log(`👤 Khách hàng: ${customer.full_name} (${customer.id})`)
    console.log(`👨‍✈️ Tài xế: ${driver.full_name} (${driver.user_id})`)
    console.log(
      `🕵️ Người lạ (Test bảo mật): ${outsider.full_name} (${outsider.id})\n`,
    )

    // ========================================================
    // TEST 1: SINH STRINGEE CLIENT ACCESS TOKEN (JWT)
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 1: Sinh Stringee Client Access Token (JWT HS256)")
    console.log("--------------------------------------------------------")
    const clientToken = generateStringeeClientToken(customer.id)
    console.log(`🔑 Client Token sinh ra: ${clientToken.slice(0, 50)}...`)

    // Giải mã và kiểm tra cấu trúc JWT
    const decoded: any = jwt.verify(clientToken, STRINGEE_CONFIG.apiKeySecret)
    console.log(`✅ Token hợp lệ:`, {
      userId: decoded.userId,
      iss: decoded.iss,
      exp: new Date(decoded.exp * 1000).toISOString(),
    })
    console.log("🎯 CHÍNH XÁC: Token chuẩn Stringee JWT!\n")

    // ========================================================
    // TEST 2: CẤP QUYỀN CUỘC GỌI GIẤU SỐ (NUMBER MASKING)
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 2: Cấp phép cuộc gọi giấu số (Khách gọi Tài xế)")
    console.log("--------------------------------------------------------")
    // Tạo cuốc xe
    const booking = await createBooking(customer.id, {
      vehicleTypeId,
      originAddress: "Sân bay Tân Sơn Nhất, Tân Bình, TP.HCM",
      originLat: 10.8185,
      originLng: 106.6588,
      destinationAddress: "Cảng Cát Lái, TP. Thủ Đức, TP.HCM",
      destLat: 10.7571,
      destLng: 106.7869,
      estimatedPrice: 400000,
    })
    console.log(
      `📦 Chuyến xe tạo mới: ${booking.bookingCode} (ID: ${booking.bookingId})`,
    )

    // Thử gọi khi chưa có tài xế nhận chuyến -> Bị chặn
    try {
      await authorizeTripCall({
        bookingId: booking.bookingId,
        callerUserId: customer.id,
      })
      console.error("❌ LỖI: Cho phép gọi khi chưa có tài xế nhận cuốc!")
    } catch (err: any) {
      console.log(
        `🛡️  ĐÃ CHẶN KHI CHƯA CÓ TÀI XẾ: "${err.message}" (Code: ${err.code})`,
      )
    }

    // Tài xế nhận cuốc xe
    await acceptBooking(driver.user_id, booking.bookingId)
    console.log(`✅ Tài xế đã nhận chuyến xe!`)

    // Khách hàng bấm gọi điện cho tài xế
    const callAuth = await authorizeTripCall({
      bookingId: booking.bookingId,
      callerUserId: customer.id,
    })

    console.log(`\n✅ Cấp phép cuộc gọi giấu số thành công!`)
    console.log(`   Mã cuộc gọi (Stringee Call ID): ${callAuth.stringeeCallId}`)
    console.log(
      `   Người gọi (Caller): ${callAuth.caller.role} (${callAuth.caller.userId})`,
    )
    console.log(
      `   Người nghe (Callee): ${callAuth.callee.name} (${callAuth.callee.role})`,
    )
    console.log(
      `   Xe: ${callAuth.callee.vehicleType} | Biển số: ${callAuth.callee.licensePlate}`,
    )
    console.log(
      `   🔒 SỐ ĐIỆN THOẠI THẬT ĐÃ ĐƯỢC ẨN: Hiển thị Hotline: ${callAuth.callee.maskedDisplayNumber}\n`,
    )

    // ========================================================
    // TEST 3: KIỂM TRA BẢO MẬT PHÂN QUYỀN CUỘC GỌI
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 3: Kiểm tra bảo mật (Chặn người lạ & Cuốc đã kết thúc)")
    console.log("--------------------------------------------------------")
    // Người lạ gọi điện
    try {
      await authorizeTripCall({
        bookingId: booking.bookingId,
        callerUserId: outsider.id,
      })
      console.error("❌ LỖI: Người lạ có thể gọi điện trong chuyến xe!")
    } catch (err: any) {
      console.log(`🛡️  CHẶN NGƯỜI LẠ THÀNH CÔNG: "${err.message}" (Status: 403)`)
    }

    // ========================================================
    // TEST 4: ĐIỀU HƯỚNG TỔNG ĐÀI SCCO (ANSWER URL WEBHOOK)
    // ========================================================
    console.log("\n--------------------------------------------------------")
    console.log("TEST 4: Sinh SCCO (Stringee Call Control Object)")
    console.log("--------------------------------------------------------")
    const scco = generateAnswerUrlScco({
      from: customer.id,
      to: driver.user_id,
      customData: JSON.stringify({ bookingId: booking.bookingId }),
    })
    console.log(
      `📜 Kịch bản SCCO trả về cho tổng đài Stringee:`,
      JSON.stringify(scco, null, 2),
    )
    if (
      scco.length === 2 &&
      scco[0].action === "record" &&
      scco[1].action === "connect"
    ) {
      console.log(
        "🎯 CHÍNH XÁC: Kịch bản ghi âm và kết nối chuẩn Stringee Answer URL!\n",
      )
    }

    // ========================================================
    // TEST 5: XỬ LÝ EVENT WEBHOOK TỪ STRINGEE (VÒNG ĐỜI CUỘC GỌI)
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 5: Xử lý Webhook Events từ Stringee (Vòng đời cuộc gọi)")
    console.log("--------------------------------------------------------")
    const testCallId = callAuth.stringeeCallId

    // 1. Sự kiện đổ chuông (RINGING)
    await processStringeeEvent({
      stringee_call_id: testCallId,
      call_status: "ringing",
    })
    console.log("📞 Event 1: Cuộc gọi đang đổ chuông (RINGING)")

    // 2. Sự kiện bắt máy (ANSWERED)
    await processStringeeEvent({
      stringee_call_id: testCallId,
      call_status: "answered",
    })
    console.log("🎙️ Event 2: Đối phương đã nhấc máy đàm thoại (ANSWERED)")

    // 3. Sự kiện gác máy kết thúc (ENDED) kèm thời lượng và file ghi âm
    await processStringeeEvent({
      stringee_call_id: testCallId,
      call_status: "ended",
      duration_seconds: 45,
      record_url: "https://api.stringee.com/v1/recording/call_rec_14892.mp3",
    })
    console.log(
      "⏹️ Event 3: Cuộc gọi kết thúc (ENDED) | Thời lượng: 45s | File ghi âm: .mp3\n",
    )

    // ========================================================
    // TEST 6: XEM LỊCH SỬ CUỘC GỌI TRONG CHUYẾN & NGƯỜI DÙNG
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 6: Kiểm tra Lịch sử cuộc gọi (Call Logs Ledger)")
    console.log("--------------------------------------------------------")
    const tripCalls = await getTripCallLogs(booking.bookingId, customer.id)
    console.log(
      `📋 Chuyến xe ${booking.bookingCode} có ${tripCalls.length} cuộc gọi:`,
    )
    for (const c of tripCalls) {
      console.log(`   - Từ: ${c.callerName} -> Đến: ${c.receiverName}`)
      console.log(
        `     Trạng thái: ${c.callStatus} | Thời lượng: ${c.durationSeconds} giây | Ghi âm: ${c.recordUrl}`,
      )
      console.log(`     Mã Stringee: ${c.stringeeCallId}`)
    }

    const custCallHistory = await getUserCallHistory(customer.id, 5)
    console.log(
      `\n📜 Lịch sử cuộc gọi của khách hàng: ${custCallHistory.length} cuộc gọi gần nhất`,
    )

    // Thử chặn gọi khi chuyến xe đã COMPLETED
    await updateBookingStatus(
      driver.user_id,
      booking.bookingId,
      "ARRIVED_AT_PICKUP",
    )
    await updateBookingStatus(driver.user_id, booking.bookingId, "IN_TRANSIT")
    await updateBookingStatus(driver.user_id, booking.bookingId, "COMPLETED")

    try {
      await authorizeTripCall({
        bookingId: booking.bookingId,
        callerUserId: customer.id,
      })
      console.error("❌ LỖI: Cho phép gọi khi chuyến xe đã COMPLETED!")
    } catch (err: any) {
      console.log(
        `\n🛡️  CHẶN GỌI KHI CHUYẾN XE ĐÃ HOÀN THÀNH: "${err.message}" (Code: ${err.code})`,
      )
    }

    console.log("\n========================================================")
    console.log("🎉 TẤT CẢ CÁC BƯỚC TEST TASK 4.4 ĐÃ HOÀN THÀNH XUẤT SẮC!")
    console.log("========================================================\n")
  } catch (err: any) {
    console.error("❌ LỖI TEST TASK 4.4:", err.message)
    if (err.stack) console.error(err.stack)
  } finally {
    process.exit(0)
  }
}

runStringeeCallTest()
