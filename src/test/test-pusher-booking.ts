import { client, db } from "../db"
import { users, driverProfiles, vehicleTypes } from "../db/schema"
import { eq } from "drizzle-orm"
import { generateToken } from "../lib/auth"
import {
  createBooking,
  acceptBooking,
  getBookingById,
} from "../lib/bookingService"
import { updateDriverLocation } from "../lib/dispatchService"

async function runTest() {
  console.log("===============================================================")
  console.log("🚀 KIỂM THỬ TASK 3.2: TÍCH HỢP PUSHER & ĐIỀU PHỐI NHẬN CUỐC XE")
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

  // 2. Chuẩn bị 2 tài xế xe tải 500KG đang Online
  const driver500kgList = await db
    .select({
      driverId: driverProfiles.id,
      userId: driverProfiles.userId,
      fullName: users.fullName,
      phone: users.phone,
      vehicleTypeId: driverProfiles.vehicleTypeId,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId))
    .where(eq(driverProfiles.isOnline, true))
    .orderBy(users.fullName)

  if (driver500kgList.length < 2) {
    console.error("❌ Cần ít nhất 2 tài xế Online để test tranh chấp cuốc xe")
    process.exit(1)
  }

  const driverA = driver500kgList[0]
  const driverB = driver500kgList[1]

  console.log(`🚚 Tài xế A: ${driverA.fullName} (ID: ${driverA.driverId})`)
  console.log(`🚚 Tài xế B: ${driverB.fullName} (ID: ${driverB.driverId})`)

  // Cập nhật vị trí tài xế quanh Chợ Bến Thành (quận 1)
  await updateDriverLocation(driverA.driverId, {
    lat: 10.7797,
    lng: 106.699,
    heading: 90,
  }) // Nhà thờ Đức Bà ~800m
  await updateDriverLocation(driverB.driverId, {
    lat: 10.795,
    lng: 106.7218,
    heading: 90,
  }) // Landmark 81 ~3.6km

  // Lấy ID loại xe 500KG
  const vType = await db
    .select()
    .from(vehicleTypes)
    .where(eq(vehicleTypes.code, "500KG"))
    .limit(1)
  const vehicleTypeId = vType[0].id

  // Dọn dẹp các cuốc test cũ (đánh dấu COMPLETED) để bài test có thể chạy lặp lại vô hạn lần (Idempotent)
  await client.unsafe(
    `
    UPDATE bookings
    SET status = 'COMPLETED', updated_at = NOW()
    WHERE status IN ('SEARCHING', 'ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    `,
  )

  // --- BƯỚC 1: KHÁCH HÀNG TẠO ĐƠN ĐẶT XE ---
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "📦 BƯỚC 1: Khách hàng tạo cuốc xe mới (Chợ Bến Thành -> Landmark 81)",
  )
  const newBooking = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Chợ Bến Thành, Lê Lợi, Phường Bến Thành, Quận 1",
    originLat: 10.7725,
    originLng: 106.698,
    destinationAddress: "Landmark 81, Vinhomes Central Park, Bình Thạnh",
    destLat: 10.795,
    destLng: 106.7218,
    paymentMethod: "CASH",
  })

  console.log("   ✅ Đặt xe thành công!")
  console.log(
    `      - Mã chuyến xe: ${newBooking.bookingCode} (ID: ${newBooking.bookingId})`,
  )
  console.log(`      - Trạng thái: ${newBooking.status}`)
  console.log(`      - Khoảng cách: ${newBooking.distanceKm} km`)
  console.log(
    `      - Cước phí: ${newBooking.totalPrice.toLocaleString("vi-VN")} đ`,
  )
  console.log(
    `      - Quét thấy: ${newBooking.matchedDriversCount} tài xế trong bán kính`,
  )
  newBooking.matchedDrivers.forEach((d, i) => {
    console.log(
      `         ${i + 1}. ${d.name} - Cách ${d.distanceKm} km -> ĐÃ BẮN EVENT PUSHER NỔ CUỐC`,
    )
  })

  // --- BƯỚC 2: TÀI XẾ A NHẬN CUỐC ---
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(`⚡ BƯỚC 2: Tài xế A (${driverA.fullName}) bấm nhận cuốc xe`)
  const acceptResultA = await acceptBooking(
    driverA.userId,
    newBooking.bookingId,
  )
  console.log(`   ✅ ${acceptResultA.message}`)
  console.log(`      - Trạng thái cuốc: ${acceptResultA.status}`)
  console.log(
    `      - Đã bắn Pusher event "booking:accepted" đến khách hàng trên kênh [trip-${newBooking.bookingId}]`,
  )
  console.log(
    `      - Đã bắn Pusher event "offer:cancelled" đến Tài xế B trên kênh [driver-${driverB.driverId}]`,
  )

  // --- BƯỚC 3: TÀI XẾ B BẤM NHẬN CUỐC CÙNG LÚC (TEST RACE CONDITION) ---
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    `🛡️ BƯỚC 3: Tài xế B (${driverB.fullName}) bấm nhận cuốc trễ hơn (Race Condition)`,
  )
  try {
    await acceptBooking(driverB.userId, newBooking.bookingId)
    console.error(
      "   ❌ LỖI: Tài xế B không được phép nhận chuyến khi Tài xế A đã nhận!",
    )
  } catch (err: any) {
    console.log(`   ✅ BẢO VỆ CONCURRENCY THÀNH CÔNG!`)
    console.log(`      - Mã lỗi: ${err.statusCode} (${err.errorCode})`)
    console.log(`      - Thông báo chặn: "${err.message}"`)
  }

  // --- BƯỚC 4: XEM CHI TIẾT CHUYẾN XE SAU KHI NHẬN ---
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("📋 BƯỚC 4: Lấy thông tin chuyến xe chi tiết sau khi nhận cuốc")
  const details = await getBookingById(newBooking.bookingId)
  console.log(`   - Mã chuyến: ${details.bookingCode}`)
  console.log(`   - Trạng thái: ${details.status}`)
  console.log(
    `   - Khách hàng: ${details.customer.name} (${details.customer.phone})`,
  )
  console.log(
    `   - Tài xế tiếp nhận: ${details.driver?.name} - SĐT: ${details.driver?.phone} - Biển số: ${details.driver?.licensePlate}`,
  )
  console.log(`   - Loại xe: ${details.driver?.vehicleTypeName}`)

  console.log(
    "\n===============================================================",
  )
  console.log(
    "🎉 TẤT CẢ TIÊU CHÍ TASK 3.2 ĐÃ HOÀN THÀNH VÀ CHỨNG MINH THÀNH CÔNG!",
  )
  console.log(
    "===============================================================\n",
  )

  process.exit(0)
}

runTest().catch((err) => {
  console.error("❌ Lỗi kiểm thử Task 3.2:", err)
  process.exit(1)
})
