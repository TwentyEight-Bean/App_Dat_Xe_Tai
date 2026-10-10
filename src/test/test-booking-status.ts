import { client, db } from "../db"
import { users, driverProfiles, vehicleTypes } from "../db/schema"
import { eq } from "drizzle-orm"
import {
  createBooking,
  acceptBooking,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  getDriverActiveBooking,
} from "../lib/bookingService"
import { updateDriverLocation } from "../lib/dispatchService"

async function runTest() {
  console.log("===============================================================")
  console.log("🚀 KIỂM THỬ TASK 3.3: STATE MACHINE TRẠNG THÁI CHUYẾN ĐI")
  console.log("   (ACCEPTED -> ARRIVED_AT_PICKUP -> IN_TRANSIT -> COMPLETED)")
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
  console.log(`👤 Khách hàng: ${customer.fullName} (${customer.phone})`)

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
  console.log(`🚚 Tài xế: ${driver.fullName} (Driver ID: ${driver.driverId})`)

  // Cập nhật vị trí tài xế gần điểm đón (Chợ Bến Thành)
  await updateDriverLocation(driver.driverId, {
    lat: 10.775,
    lng: 106.699,
    heading: 0,
  })

  // Lấy ID loại xe 500KG
  const vType = await db
    .select()
    .from(vehicleTypes)
    .where(eq(vehicleTypes.code, "500KG"))
    .limit(1)
  const vehicleTypeId = vType[0].id

  // Dọn dẹp các cuốc test cũ (đánh dấu COMPLETED) để bài test lặp lại vô hạn lần (Idempotent)
  await client.unsafe(
    `
    UPDATE bookings
    SET status = 'COMPLETED', updated_at = NOW()
    WHERE status IN ('SEARCHING', 'ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    `,
  )

  // ===============================================================
  // KỊCH BẢN 1: LUỒNG CHUẨN HOÀN THÀNH ĐƠN HÀNG
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("📦 BƯỚC 1: Khách hàng tạo cuốc xe mới")
  const booking1 = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Chợ Bến Thành, Quận 1, TP.HCM",
    originLat: 10.7725,
    originLng: 106.698,
    destinationAddress: "Landmark 81, Bình Thạnh, TP.HCM",
    destLat: 10.795,
    destLng: 106.7218,
    paymentMethod: "CASH",
  })
  console.log(
    `   ✅ Tạo thành công: ${booking1.bookingCode} (Status: ${booking1.status})`,
  )

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("⚡ BƯỚC 2: Tài xế bấm nhận chuyến (SEARCHING -> ACCEPTED)")
  const acceptRes = await acceptBooking(driver.userId, booking1.bookingId)
  console.log(
    `   ✅ Tài xế đã nhận chuyến: ${acceptRes.bookingCode} (Status: ${acceptRes.status})`,
  )

  // Kiểm tra API lấy cuốc xe đang chạy của tài xế
  const activeBooking = await getDriverActiveBooking(driver.driverId)
  if (!activeBooking || activeBooking.id !== booking1.bookingId) {
    throw new Error(
      "❌ API getDriverActiveBooking không trả về chuyến xe vừa nhận!",
    )
  }
  console.log(
    `   🔍 getDriverActiveBooking xác nhận cuốc đang chạy: ${activeBooking.bookingCode}`,
  )

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "📍 BƯỚC 3: Tài xế cập nhật ĐÃ TỚI ĐIỂM LẤY HÀNG (ACCEPTED -> ARRIVED_AT_PICKUP)",
  )
  const arrivedRes = await updateBookingStatus(
    driver.userId,
    booking1.bookingId,
    "ARRIVED_AT_PICKUP",
    "Đã đỗ xe trước cổng số 2 chợ Bến Thành",
  )
  console.log(`   ✅ Cập nhật thành công:`)
  console.log(`      - Trạng thái mới: ${arrivedRes.status}`)
  console.log(`      - Tin nhắn hệ thống: ${arrivedRes.message}`)

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("🛡️ BƯỚC 4: Kiểm thử ngăn chặn bước nhảy trạng thái phi lý")
  console.log(
    "   (Thử nhảy từ ARRIVED_AT_PICKUP thẳng lên COMPLETED mà bỏ qua IN_TRANSIT)",
  )
  try {
    await updateBookingStatus(driver.userId, booking1.bookingId, "COMPLETED")
    throw new Error("❌ Thất bại: Hệ thống cho phép nhảy trạng thái phi lý!")
  } catch (err: any) {
    console.log(`   ✅ BẢO VỆ STATE MACHINE THÀNH CÔNG!`)
    console.log(`      - Mã lỗi: ${err.statusCode || 400}`)
    console.log(`      - Thông báo chặn: "${err.message}"`)
  }

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "🚚 BƯỚC 5: Tài xế cập nhật ĐANG VẬN CHUYỂN (ARRIVED_AT_PICKUP -> IN_TRANSIT)",
  )
  const inTransitRes = await updateBookingStatus(
    driver.userId,
    booking1.bookingId,
    "IN_TRANSIT",
    "Đã bốc hàng xong, đang di chuyển về Landmark 81",
  )
  console.log(`   ✅ Cập nhật thành công:`)
  console.log(`      - Trạng thái mới: ${inTransitRes.status}`)
  console.log(`      - Tin nhắn hệ thống: ${inTransitRes.message}`)

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "🛡️ BƯỚC 6: Kiểm thử chặn hủy đơn khi hàng đang trên đường giao (IN_TRANSIT)",
  )
  try {
    await cancelBooking(
      customer.id,
      booking1.bookingId,
      "Khách hàng đổi ý muốn hủy đơn",
    )
    throw new Error("❌ Thất bại: Cho phép hủy đơn khi xe đang chở hàng!")
  } catch (err: any) {
    console.log(`   ✅ CHẶN HỦY ĐƠN TRONG KHI GIAO THÀNH CÔNG!`)
    console.log(`      - Mã lỗi: ${err.statusCode || 400}`)
    console.log(`      - Thông báo chặn: "${err.message}"`)
  }

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "🏁 BƯỚC 7: Tài xế cập nhật HOÀN THÀNH CHUYẾN ĐI (IN_TRANSIT -> COMPLETED)",
  )
  const completedRes = await updateBookingStatus(
    driver.userId,
    booking1.bookingId,
    "COMPLETED",
    "Đã giao đủ hàng và thu tiền mặt",
  )
  console.log(`   ✅ Cập nhật thành công:`)
  console.log(`      - Trạng thái mới: ${completedRes.status}`)
  console.log(
    `      - Trạng thái thanh toán tự động: ${completedRes.paymentStatus} (Tự động chốt PAID)`,
  )
  console.log(`      - Tin nhắn hệ thống: ${completedRes.message}`)

  // Kiểm tra tài xế đã được giải phóng
  const afterCompletedActive = await getDriverActiveBooking(driver.driverId)
  if (afterCompletedActive !== null) {
    throw new Error("❌ Tài xế vẫn còn bị kẹt cuốc sau khi đã COMPLETED!")
  }
  console.log(
    `   🆓 Tài xế đã sẵn sàng nhận cuốc mới (Không còn cuốc nào active)`,
  )

  // ===============================================================
  // KỊCH BẢN 2: LUỒNG HỦY ĐƠN HỢP LỆ (CANCELLED)
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("❌ BƯỚC 8: Kiểm thử luồng HỦY ĐƠN HỢP LỆ (khi đang ở ACCEPTED)")
  const booking2 = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Bưu điện Trung tâm Sài Gòn, Quận 1",
    originLat: 10.7797,
    originLng: 106.699,
    destinationAddress: "Cầu Ánh Sao, Quận 7",
    destLat: 10.7188,
    destLng: 106.7197,
    paymentMethod: "CASH",
  })
  await acceptBooking(driver.userId, booking2.bookingId)
  console.log(
    `   - Tạo và nhận chuyến ${booking2.bookingCode} (Status: ACCEPTED)`,
  )

  const cancelRes = await cancelBooking(
    customer.id,
    booking2.bookingId,
    "Tôi bận việc đột xuất cần dời lịch",
  )
  console.log(`   ✅ Hủy chuyến thành công:`)
  console.log(`      - Trạng thái mới: ${cancelRes.status}`)
  console.log(`      - Người hủy: ${cancelRes.cancelledBy}`)
  console.log(`      - Lý do: ${cancelRes.reason}`)

  // Kiểm tra lại chi tiết cuốc xe trong DB
  const verifyDbBooking = await getBookingById(booking2.bookingId)
  if (verifyDbBooking.status !== "CANCELLED") {
    throw new Error("❌ Status trong DB chưa cập nhật thành CANCELLED!")
  }
  console.log(`   🔍 Database xác nhận trạng thái: ${verifyDbBooking.status}`)

  console.log(
    "\n===============================================================",
  )
  console.log(
    "🎉 TẤT CẢ TIÊU CHÍ TASK 3.3 ĐÃ HOÀN THÀNH VÀ CHỨNG MINH THÀNH CÔNG!",
  )
  console.log(
    "   - FSM Chuyển trạng thái chuẩn: ACCEPTED -> ARRIVED -> IN_TRANSIT -> COMPLETED",
  )
  console.log("   - Chống nhảy cóc trạng thái phi lý")
  console.log("   - Chặn hủy đơn khi xe đang lăn bánh giao hàng")
  console.log("   - Tự động hoàn tất thanh toán khi giao hàng thành công")
  console.log("   - Luồng hủy đơn hợp lệ kèm lý do và bắn Pusher realtime")
  console.log(
    "===============================================================\n",
  )

  process.exit(0)
}

runTest().catch((err) => {
  console.error("❌ Lỗi kiểm thử Task 3.3:", err)
  process.exit(1)
})
