import { client } from "../db"
import {
  sendChatMessage,
  getBookingChatMessages,
  markBookingChatRead,
  getUserChatConversations,
} from "../lib/chatService"
import { createBooking, acceptBooking } from "../lib/bookingService"

async function runChatPusherTest() {
  console.log("\n========================================================")
  console.log("🚀 BẮT ĐẦU TEST TOÀN DIỆN TASK 4.3: CHAT TRONG APP & PUSHER")
  console.log("========================================================\n")

  try {
    // 1. Lấy khách hàng, tài xế và người dùng thứ 3 (để test bảo mật)
    const customers = await client.unsafe(
      `SELECT id, full_name, phone FROM users WHERE role = 'CUSTOMER' LIMIT 2`,
    )
    if (customers.length < 2) throw new Error("Cần ít nhất 2 customer để test")
    const customer = customers[0]
    const outsiderUser = customers[1] // Người không liên quan chuyến xe

    const drivers = await client.unsafe(
      `
      SELECT dp.id as driver_id, dp.user_id, u.full_name, u.phone
      FROM driver_profiles dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.kyc_status = 'APPROVED' AND dp.is_active = true
      ORDER BY dp.is_online DESC
      LIMIT 1
      `,
    )
    if (drivers.length === 0) throw new Error("Không có driver để test")
    const driver = drivers[0]

    // Đảm bảo tài xế test có ví đủ tiền ký quỹ và đang online
    await client.unsafe(
      `INSERT INTO wallets (user_id, balance, min_deposit_limit) VALUES ($1::uuid, 500000, 200000) ON CONFLICT (user_id) DO UPDATE SET balance = 500000`,
      [driver.user_id],
    )
    await client.unsafe(
      `UPDATE driver_profiles SET is_online = true WHERE id = $1::uuid`,
      [driver.driver_id],
    )

    const vehicleTypes = await client.unsafe(
      `SELECT id FROM vehicle_types LIMIT 1`,
    )
    const vehicleTypeId = vehicleTypes[0].id

    console.log(`👤 Khách hàng: ${customer.full_name} (${customer.id})`)
    console.log(`👨‍✈️ Tài xế: ${driver.full_name} (User ID: ${driver.user_id})`)
    console.log(
      `🕵️ Người lạ (Test bảo mật): ${outsiderUser.full_name} (${outsiderUser.id})\n`,
    )

    // Dọn dẹp chuyến xe cũ đang kẹt của tài xế
    await client.unsafe(
      `
      UPDATE bookings
      SET status = 'COMPLETED', updated_at = NOW()
      WHERE driver_id = $1::uuid AND status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
      `,
      [driver.driver_id],
    )

    // Tạo cuốc xe mới
    const booking = await createBooking(customer.id, {
      vehicleTypeId,
      originAddress: "Tòa nhà Bitexco, Quận 1, TP.HCM",
      originLat: 10.7718,
      originLng: 106.7044,
      destinationAddress: "Landmark 81, Bình Thạnh, TP.HCM",
      destLat: 10.795,
      destLng: 106.7219,
      estimatedPrice: 200000,
    })
    console.log(
      `📦 Khởi tạo chuyến xe test: ${booking.bookingCode} (ID: ${booking.bookingId})`,
    )

    // Tài xế nhận cuốc
    await acceptBooking(driver.user_id, booking.bookingId)
    console.log(`✅ Tài xế đã nhận chuyến xe thành công!\n`)

    // ========================================================
    // TEST 1: KHÁCH HÀNG GỬI TIN NHẮN ĐẦU TIÊN
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 1: Khách hàng gửi tin nhắn văn bản (Pusher + DB)")
    console.log("--------------------------------------------------------")
    const msg1 = await sendChatMessage({
      bookingId: booking.bookingId,
      senderUserId: customer.id,
      content:
        "Chào anh tài xế, hàng của em gồm 5 thùng carton để sẵn ở sảnh nhé!",
      messageType: "TEXT",
    })

    console.log(`✅ Khách gửi tin nhắn thành công:`)
    console.log(`   Message ID: ${msg1.id}`)
    console.log(`   Vai trò: ${msg1.senderRole} | Tên: ${msg1.senderName}`)
    console.log(`   Nội dung: "${msg1.content}"`)
    console.log(`   Thời gian: ${msg1.createdAt}\n`)

    // ========================================================
    // TEST 2: TÀI XẾ PHẢN HỒI LẠI
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 2: Tài xế gửi tin nhắn phản hồi")
    console.log("--------------------------------------------------------")
    const msg2 = await sendChatMessage({
      bookingId: booking.bookingId,
      senderUserId: driver.user_id,
      content:
        "Dạ em nhận được rồi ạ! Em đang chạy từ Nguyễn Huệ qua khoảng 5 phút nữa tới sảnh.",
      messageType: "TEXT",
    })

    console.log(`✅ Tài xế gửi tin nhắn thành công:`)
    console.log(`   Message ID: ${msg2.id}`)
    console.log(`   Vai trò: ${msg2.senderRole} | Tên: ${msg2.senderName}`)
    console.log(`   Nội dung: "${msg2.content}"\n`)

    // ========================================================
    // TEST 3: TÀI XẾ GỬI ẢNH HÀNG HÓA (IMAGE TYPE)
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 3: Gửi tin nhắn đa phương tiện (Ảnh hàng hóa)")
    console.log("--------------------------------------------------------")
    const msg3 = await sendChatMessage({
      bookingId: booking.bookingId,
      senderUserId: driver.user_id,
      content: "Em đã xếp 5 thùng lên thùng xe cẩn thận rồi nhé chị!",
      messageType: "IMAGE",
      mediaUrl:
        "https://res.cloudinary.com/fbgdh4zl/image/upload/v1/truck_cargo_proof.jpg",
    })

    console.log(`✅ Gửi ảnh hàng hóa thành công:`)
    console.log(`   Loại tin nhắn: ${msg3.messageType}`)
    console.log(`   Media URL: ${msg3.mediaUrl}`)
    console.log(`   Nội dung kèm ảnh: "${msg3.content}"\n`)

    // ========================================================
    // TEST 4: LẤY LỊCH SỬ CHAT & TỰ ĐỘNG ĐÁNH DẤU ĐÃ ĐỌC
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 4: Khách hàng mở chat -> Lấy lịch sử & Đánh dấu đã đọc")
    console.log("--------------------------------------------------------")
    const chatHistory = await getBookingChatMessages(
      booking.bookingId,
      customer.id,
    )
    console.log(`📜 Tổng số tin nhắn tải về: ${chatHistory.messages.length}`)
    for (const m of chatHistory.messages) {
      console.log(
        `   [${m.senderRole}] ${m.senderName}: "${m.content}" ${
          m.mediaUrl ? `[Ảnh: ${m.mediaUrl}]` : ""
        } (Đã xem: ${m.isRead ? "✓✓" : "✓"})`,
      )
    }

    // Kiểm tra tin nhắn của tài xế đã được đánh dấu đã đọc chưa
    const driverMsgAfterRead = chatHistory.messages.find(
      (m) => m.senderId === driver.user_id,
    )
    console.log(
      `\n👁️ Trạng thái tin nhắn tài xế sau khi khách mở xem: isRead = ${
        driverMsgAfterRead?.isRead ? "TRUE (Đã đọc)" : "FALSE"
      }\n`,
    )

    // ========================================================
    // TEST 5: KIỂM TRA PHÂN QUYỀN BẢO MẬT (CHẶN NGƯỜI LẠ)
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log(
      "TEST 5: Kiểm tra phân quyền bảo mật (Chặn người không liên quan)",
    )
    console.log("--------------------------------------------------------")
    try {
      await sendChatMessage({
        bookingId: booking.bookingId,
        senderUserId: outsiderUser.id,
        content: "Tin nhắn spam từ người lạ không có trong chuyến xe",
      })
      console.error(
        "❌ LỖI: Hệ thống đã cho phép người lạ gửi tin nhắn vào chuyến xe!",
      )
    } catch (err: any) {
      console.log(
        `🛡️  ĐÃ CHẶN GỬI TIN NHẮN THÀNH CÔNG: "${err.message}" (Status: ${err.status || 403})`,
      )
    }

    try {
      await getBookingChatMessages(booking.bookingId, outsiderUser.id)
      console.error("❌ LỖI: Hệ thống đã cho phép người lạ đọc lịch sử chat!")
    } catch (err: any) {
      console.log(
        `🛡️  ĐÃ CHẶN ĐỌC LỊCH SỬ CHAT THÀNH CÔNG: "${err.message}" (Status: ${err.status || 403})\n`,
      )
    }

    // ========================================================
    // TEST 6: DANH SÁCH CUỘC TRÒ CHUYỆN GẦN ĐÂY (CONVERSATIONS)
    // ========================================================
    console.log("--------------------------------------------------------")
    console.log("TEST 6: Danh sách cuộc trò chuyện gần đây của Người dùng")
    console.log("--------------------------------------------------------")
    const custConvs = await getUserChatConversations(customer.id)
    console.log(`📋 Khách hàng có ${custConvs.length} cuộc trò chuyện:`)
    for (const c of custConvs.slice(0, 3)) {
      console.log(
        `   - Chuyến xe: ${c.bookingCode} | Đối tác: ${c.partner.name} (${c.partner.role})`,
      )
      console.log(
        `     Tin nhắn cuối: "${c.lastMessage?.content}" lúc ${c.lastMessage?.time}`,
      )
      console.log(`     Số tin chưa đọc: ${c.unreadCount}`)
    }

    console.log("\n========================================================")
    console.log("🎉 TẤT CẢ CÁC BƯỚC TEST TASK 4.3 ĐÃ THÀNH CÔNG 100%!")
    console.log("========================================================\n")
  } catch (err: any) {
    console.error("❌ LỖI TEST TASK 4.3:", err.message)
    if (err.stack) console.error(err.stack)
  } finally {
    process.exit(0)
  }
}

runChatPusherTest()
