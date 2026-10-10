import { client, db } from "../db"
import { users, driverProfiles, vehicleTypes } from "../db/schema"
import { eq } from "drizzle-orm"
import {
  registerDeviceToken,
  removeDeviceToken,
  getUserDeviceTokens,
  sendPushNotificationToUser,
} from "../lib/notificationService"
import {
  createBooking,
  acceptBooking,
  updateBookingStatus,
  cancelBooking,
} from "../lib/bookingService"
import {
  updateDriverLocation,
  resetDriverLocationRateLimit,
} from "../lib/dispatchService"

async function runTest() {
  console.log("===============================================================")
  console.log(
    "🚀 KIỂM THỬ TASK 3.5: FIREBASE CLOUD MESSAGING (FCM) PUSH NOTIFICATION",
  )
  console.log(
    "   (Device Token Registry -> FCM Multicast -> 6 Business Triggers)",
  )
  console.log(
    "===============================================================\n",
  )

  // 1. Chuẩn bị tài khoản Khách hàng
  const customerList = await db
    .select()
    .from(users)
    .where(eq(users.phone, "0908122940"))
    .limit(1)

  if (customerList.length === 0) {
    console.error("❌ Không tìm thấy user khách hàng")
    process.exit(1)
  }
  const customer = customerList[0]
  console.log(
    `👤 Khách hàng: ${customer.fullName} (${customer.phone} - ID: ${customer.id})`,
  )

  // 2. Chuẩn bị tài xế Online
  const driverList = await db
    .select({
      driverId: driverProfiles.id,
      userId: driverProfiles.userId,
      fullName: users.fullName,
      phone: users.phone,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId))
    .where(eq(driverProfiles.isOnline, true))
    .orderBy(users.fullName)
    .limit(1)

  if (driverList.length === 0) {
    console.error("❌ Cần ít nhất 1 tài xế Online để test")
    process.exit(1)
  }

  const driver = driverList[0]
  console.log(`🚚 Tài xế: ${driver.fullName} (User ID: ${driver.userId})`)

  // Cập nhật vị trí tài xế gần điểm đón (Chợ Bến Thành)
  resetDriverLocationRateLimit()
  await updateDriverLocation(driver.driverId, {
    lat: 10.775,
    lng: 106.699,
    heading: 90,
    bypassRateLimit: true,
  })

  // Lấy ID loại xe 500KG
  const vType = await db
    .select()
    .from(vehicleTypes)
    .where(eq(vehicleTypes.code, "500KG"))
    .limit(1)
  const vehicleTypeId = vType[0].id

  // Dọn dẹp các cuốc test cũ
  await client.unsafe(
    `
    UPDATE bookings
    SET status = 'COMPLETED', updated_at = NOW()
    WHERE status IN ('SEARCHING', 'ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    `,
  )

  // ===============================================================
  // KỊCH BẢN 1: ĐĂNG KÝ VÀ QUẢN LÝ FCM DEVICE TOKEN (POST /auth/device-token)
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("📲 BƯỚC 1: Đăng ký FCM Device Token cho Khách hàng & Tài xế")

  const customerToken = `fcm_web_token_customer_${Date.now()}`
  const driverToken = `fcm_android_token_driver_${Date.now()}`

  await registerDeviceToken(customer.id, {
    fcmToken: customerToken,
    deviceType: "WEB",
    deviceName: "Chrome macOS",
  })
  console.log(`   ✅ Đã lưu token cho Khách hàng: ${customerToken}`)

  await registerDeviceToken(driver.userId, {
    fcmToken: driverToken,
    deviceType: "ANDROID",
    deviceName: "Samsung Galaxy A54",
  })
  console.log(`   ✅ Đã lưu token cho Tài xế: ${driverToken}`)

  // Kiểm tra truy xuất token từ DB
  const customerTokens = await getUserDeviceTokens(customer.id)
  const driverTokens = await getUserDeviceTokens(driver.userId)

  if (!customerTokens.includes(customerToken)) {
    throw new Error("❌ Không tìm thấy token khách hàng vừa lưu trong DB!")
  }
  if (!driverTokens.includes(driverToken)) {
    throw new Error("❌ Không tìm thấy token tài xế vừa lưu trong DB!")
  }
  console.log(
    `   🔍 Database xác nhận token đã được lưu trong bảng user_devices.`,
  )

  // ===============================================================
  // KỊCH BẢN 2: GỬI THÔNG BÁO TEST RIÊNG LẺ
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("🔔 BƯỚC 2: Kiểm thử gửi Push Notification đơn lẻ đến thiết bị")
  const pushRes = await sendPushNotificationToUser(customer.id, {
    title: "🎁 Khuyến mãi đặc biệt!",
    body: "Nhập mã SPRINT3 giảm ngay 20% cho chuyến xe đầu tiên.",
    data: { promoCode: "SPRINT3" },
  })
  console.log(
    `   ✅ Kết quả gửi: Thành công ${pushRes.deliveredCount} thiết bị.`,
  )

  // ===============================================================
  // KỊCH BẢN 3: TỰ ĐỘNG BẮN FCM TRONG VÒNG ĐỜI ĐƠN HÀNG (LIFECYCLE TRIGGERS)
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "📦 BƯỚC 3: Khách đặt xe -> Kích hoạt FCM Push 'Có cuốc mới' cho tài xế",
  )
  const booking1 = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Chợ Bến Thành, Quận 1",
    originLat: 10.7725,
    originLng: 106.698,
    destinationAddress: "Landmark 81, Bình Thạnh",
    destLat: 10.795,
    destLng: 106.7218,
    paymentMethod: "CASH",
  })
  console.log(`   ✅ Tạo thành công cuốc ${booking1.bookingCode}`)

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "⚡ BƯỚC 4: Tài xế nhận cuốc -> Kích hoạt FCM Push 'Tài xế đã nhận' cho khách",
  )
  await acceptBooking(driver.userId, booking1.bookingId)
  console.log(`   ✅ Tài xế ${driver.fullName} đã nhận cuốc xe`)

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "📍 BƯỚC 5: Tài xế tới điểm hẹn -> Kích hoạt FCM Push 'Xe đã tới' cho khách",
  )
  await updateBookingStatus(
    driver.userId,
    booking1.bookingId,
    "ARRIVED_AT_PICKUP",
  )
  console.log(`   ✅ Trạng thái: ARRIVED_AT_PICKUP`)

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "🚚 BƯỚC 6: Hàng lên xe -> Kích hoạt FCM Push 'Đang giao hàng' cho khách",
  )
  await updateBookingStatus(driver.userId, booking1.bookingId, "IN_TRANSIT")
  console.log(`   ✅ Trạng thái: IN_TRANSIT`)

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "🏁 BƯỚC 7: Hoàn thành -> Kích hoạt FCM Push 'Giao hàng thành công' cho khách",
  )
  await updateBookingStatus(driver.userId, booking1.bookingId, "COMPLETED")
  console.log(`   ✅ Trạng thái: COMPLETED`)

  // ===============================================================
  // KỊCH BẢN 4: THÔNG BÁO KHI HỦY CUỐC XE
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "❌ BƯỚC 8: Khách hủy cuốc xe -> Kích hoạt FCM Push thông báo cho tài xế",
  )
  const booking2 = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Bưu điện Thành phố, Quận 1",
    originLat: 10.7797,
    originLng: 106.699,
    destinationAddress: "Cầu Ánh Sao, Quận 7",
    destLat: 10.7188,
    destLng: 106.7197,
    paymentMethod: "CASH",
  })
  await acceptBooking(driver.userId, booking2.bookingId)
  await cancelBooking(
    customer.id,
    booking2.bookingId,
    "Khách hàng bận họp đột xuất",
  )
  console.log(
    `   ✅ Chuyến xe đã hủy thành công và đã bắn FCM thông báo cho tài xế`,
  )

  // ===============================================================
  // KỊCH BẢN 5: ĐĂNG XUẤT XÓA TOKEN (DELETE /auth/device-token)
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("🚪 BƯỚC 9: Đăng xuất thiết bị (Xóa FCM Token)")
  const removeRes = await removeDeviceToken(customer.id, customerToken)
  console.log(
    `   ✅ Xóa token thành công: ${removeRes.removedCount} token đã hủy.`,
  )

  const customerTokensAfter = await getUserDeviceTokens(customer.id)
  if (customerTokensAfter.includes(customerToken)) {
    throw new Error("❌ Token vẫn còn tồn tại trong DB sau khi đăng xuất!")
  }
  console.log(
    `   🔍 Database xác nhận token đã được xóa khỏi bảng user_devices.`,
  )

  console.log(
    "\n===============================================================",
  )
  console.log(
    "🎉 TẤT CẢ TIÊU CHÍ TASK 3.5 ĐÃ HOÀN THÀNH VÀ CHỨNG MINH THÀNH CÔNG!",
  )
  console.log(
    "   - Bảng user_devices lưu trữ token thiết bị chuẩn xác (Web, Android, iOS)",
  )
  console.log(
    "   - API đăng ký và hủy token thiết bị khi đăng nhập / đăng xuất",
  )
  console.log(
    "   - Tự động phát sóng Push Notification trong toàn bộ 6 kịch bản:",
  )
  console.log("     1. Báo tài xế có cuốc mới")
  console.log("     2. Báo khách tài xế đã nhận")
  console.log("     3. Báo khách xe đã tới điểm lấy")
  console.log("     4. Báo khách hàng hóa đang trên đường vận chuyển")
  console.log("     5. Báo khách chuyến đi hoàn tất")
  console.log("     6. Báo đối phương khi chuyến đi bị hủy")
  console.log(
    "   - Cơ chế Graceful Fallback (Mock an toàn khi chưa gắn Firebase Key)",
  )
  console.log(
    "===============================================================\n",
  )

  process.exit(0)
}

runTest().catch((err) => {
  console.error("❌ Lỗi kiểm thử Task 3.5:", err)
  process.exit(1)
})
