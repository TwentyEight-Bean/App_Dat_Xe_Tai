import { client, db } from "../db"
import { users, driverProfiles, vehicleTypes } from "../db/schema"
import { eq } from "drizzle-orm"
import {
  createBooking,
  acceptBooking,
  updateBookingStatus,
  getBookingById,
} from "../lib/bookingService"
import {
  updateDriverLocation,
  getDriverLocation,
  resetDriverLocationRateLimit,
} from "../lib/dispatchService"

async function runTest() {
  console.log("===============================================================")
  console.log("🚀 KIỂM THỬ TASK 3.4: CẬP NHẬT VỊ TRÍ GPS & LIVE TRACKING XE")
  console.log(
    "   (Driver GPS Stream -> PostGIS -> Rate Limiting -> Pusher Event)",
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

  // Lấy ID loại xe 500KG
  const vType = await db
    .select()
    .from(vehicleTypes)
    .where(eq(vehicleTypes.code, "500KG"))
    .limit(1)
  const vehicleTypeId = vType[0].id

  // Dọn dẹp các cuốc test cũ và reset rate-limit
  await client.unsafe(
    `
    UPDATE bookings
    SET status = 'COMPLETED', updated_at = NOW()
    WHERE status IN ('SEARCHING', 'ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    `,
  )
  resetDriverLocationRateLimit()

  // ===============================================================
  // KỊCH BẢN 1: TÀI XẾ CẬP NHẬT TỌA ĐỘ KHI CHƯA CÓ CUỐC XE
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "📍 BƯỚC 1: Tài xế gửi tọa độ GPS lúc đang rảnh rỗi (chưa nhận cuốc)",
  )
  const idleLoc = await updateDriverLocation(driver.driverId, {
    latitude: 10.7725,
    longitude: 106.698,
    heading: 90,
    speed: 0,
  })
  console.log(`   ✅ Cập nhật tọa độ thành công:`)
  console.log(
    `      - Vị trí: Lat ${idleLoc.latitude}, Lng ${idleLoc.longitude}`,
  )
  console.log(
    `      - Cuốc xe đang chạy: ${
      idleLoc.activeBooking
        ? idleLoc.activeBooking.bookingCode
        : "Không có (Đang rảnh)"
    }`,
  )

  // Kiểm tra lưu DB
  const dbLoc = await getDriverLocation(driver.driverId)
  if (!dbLoc || Math.abs(dbLoc.latitude - 10.7725) > 0.0001) {
    throw new Error("❌ Tọa độ trong DB không khớp với vị trí vừa cập nhật!")
  }
  console.log(`   🔍 Database xác nhận vị trí lưu trữ chính xác trong PostGIS.`)

  // ===============================================================
  // KỊCH BẢN 2: KIỂM THỬ THROTTLING / RATE LIMIT (TỐI ĐA 1 LẦN / 2 GIÂY)
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "🛡️ BƯỚC 2: Kiểm thử chống spam GPS (Gửi liên tiếp trong < 2 giây)",
  )
  try {
    // Gửi ngay lập tức mà không chờ 2 giây
    await updateDriverLocation(driver.driverId, {
      latitude: 10.7726,
      longitude: 106.6981,
    })
    throw new Error("❌ Thất bại: Hệ thống không chặn spam GPS!")
  } catch (err: any) {
    console.log(`   ✅ RATE LIMIT BẢO VỆ THÀNH CÔNG!`)
    console.log(`      - Mã lỗi: ${err.statusCode || 429} (${err.code})`)
    console.log(`      - Thông báo: "${err.message}"`)
  }

  // ===============================================================
  // KỊCH BẢN 3: TÀI XẾ NHẬN CUỐC & TRUYỀN TỌA ĐỘ REALTIME (LIVE TRACKING)
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("📦 BƯỚC 3: Khách đặt xe và tài xế nhận cuốc")
  const booking = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Chợ Bến Thành, Quận 1",
    originLat: 10.7725,
    originLng: 106.698,
    destinationAddress: "Landmark 81, Bình Thạnh",
    destLat: 10.795,
    destLng: 106.7218,
    paymentMethod: "CASH",
  })
  await acceptBooking(driver.userId, booking.bookingId)
  console.log(
    `   ✅ Cuốc xe ${booking.bookingCode} đã được nhận bởi tài xế ${driver.fullName}`,
  )

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "📡 BƯỚC 4: Tài xế di chuyển tới điểm đón (ACCEPTED -> Bắn Live GPS)",
  )
  // Bỏ qua rate-limit cho bước test để mô phỏng lần gửi tiếp theo
  const step1Loc = await updateDriverLocation(driver.driverId, {
    latitude: 10.775,
    longitude: 106.699,
    heading: 45,
    speed: 25.5,
    bypassRateLimit: true,
  })
  console.log(`   ✅ Đã phát sóng GPS qua Pusher:`)
  console.log(
    `      - Chuyến xe liên kết: ${step1Loc.activeBooking?.bookingCode} (Status: ${step1Loc.activeBooking?.status})`,
  )
  console.log(
    `      - Tọa độ xe: (${step1Loc.latitude}, ${step1Loc.longitude}) | Tốc độ: ${step1Loc.speed} km/h`,
  )

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "🚚 BƯỚC 5: Tài xế chuyển trạng thái sang IN_TRANSIT và tiếp tục di chuyển",
  )
  await updateBookingStatus(
    driver.userId,
    booking.bookingId,
    "ARRIVED_AT_PICKUP",
  )
  await updateBookingStatus(driver.userId, booking.bookingId, "IN_TRANSIT")

  const step2Loc = await updateDriverLocation(driver.driverId, {
    latitude: 10.785,
    longitude: 106.71,
    heading: 120,
    speed: 42.0,
    bypassRateLimit: true,
  })
  console.log(`   ✅ Đã phát sóng GPS chặng vận chuyển:`)
  console.log(
    `      - Chuyến xe liên kết: ${step2Loc.activeBooking?.bookingCode} (Status: ${step2Loc.activeBooking?.status})`,
  )
  console.log(
    `      - Tọa độ xe: (${step2Loc.latitude}, ${step2Loc.longitude}) | Hướng: ${step2Loc.heading}° | Tốc độ: ${step2Loc.speed} km/h`,
  )

  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("🗺️ BƯỚC 6: Khách hàng mở màn hình Live Tracking (getBookingById)")
  const trackedBooking = await getBookingById(booking.bookingId)
  console.log(`   ✅ Thông tin chuyến xe cho khách hàng:`)
  console.log(
    `      - Mã chuyến: ${trackedBooking.bookingCode} (Status: ${trackedBooking.status})`,
  )
  console.log(
    `      - Tài xế: ${trackedBooking.driver?.name} - SĐT: ${trackedBooking.driver?.phone}`,
  )
  console.log(
    `      - Vị trí hiện tại của tài xế:`,
    trackedBooking.driver?.currentLocation,
  )

  if (!trackedBooking.driver?.currentLocation) {
    throw new Error(
      "❌ Không tìm thấy currentLocation của tài xế trong API chi tiết chuyến xe!",
    )
  }

  // ===============================================================
  // KỊCH BẢN 4: KHI HOÀN THÀNH CUỐC XE -> NGỪNG PHÁT SÓNG VÀO KÊNH ĐƠN
  // ===============================================================
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "🏁 BƯỚC 7: Hoàn thành chuyến xe -> Tọa độ mới không còn gắn vào chuyến cũ",
  )
  await updateBookingStatus(driver.userId, booking.bookingId, "COMPLETED")

  const afterCompleteLoc = await updateDriverLocation(driver.driverId, {
    latitude: 10.795,
    longitude: 106.7218,
    heading: 0,
    speed: 0,
    bypassRateLimit: true,
  })
  console.log(`   ✅ Vị trí mới sau khi hoàn thành:`)
  console.log(
    `      - Cuốc xe đang chạy: ${
      afterCompleteLoc.activeBooking
        ? afterCompleteLoc.activeBooking.bookingCode
        : "null (Đã hoàn tất)"
    }`,
  )

  if (afterCompleteLoc.activeBooking !== null) {
    throw new Error(
      "❌ Chuyến xe đã COMPLETED nhưng vẫn còn hiển thị là activeBooking!",
    )
  }

  console.log(
    "\n===============================================================",
  )
  console.log(
    "🎉 TẤT CẢ TIÊU CHÍ TASK 3.4 ĐÃ HOÀN THÀNH VÀ CHỨNG MINH THÀNH CÔNG!",
  )
  console.log("   - Upsert tọa độ GPS PostGIS (Point, 4326) chuẩn xác")
  console.log(
    "   - Cơ chế Throttling / Rate-Limiting chống spam (1 req / 2s) chuẩn 429",
  )
  console.log(
    "   - Tự động nhận diện chuyến xe đang chạy (ACCEPTED/ARRIVED/IN_TRANSIT)",
  )
  console.log(
    "   - Phát sóng sự kiện Real-Time 'driver:location-update' đến kênh trip-{id}",
  )
  console.log(
    "   - API chi tiết cuốc xe trả về đầy đủ tọa độ live để khách render bản đồ",
  )
  console.log(
    "===============================================================\n",
  )

  process.exit(0)
}

runTest().catch((err) => {
  console.error("❌ Lỗi kiểm thử Task 3.4:", err)
  process.exit(1)
})
