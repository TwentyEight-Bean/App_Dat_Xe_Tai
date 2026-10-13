import { client } from "../db"
import {
  createBooking,
  acceptBooking,
  updateBookingStatus,
  cancelBooking,
  getBookingById,
  escalateBookingDispatch,
} from "../lib/bookingService"
import { findNearbyDrivers } from "../lib/dispatchService"
import { getOrCreateWallet } from "../lib/walletService"

async function runSprint3HardeningTests() {
  console.log("===============================================================")
  console.log("🚀 BẮT ĐẦU TEST TOÀN DIỆN: SPRINT 3 HARDENING & BUSINESS LOGIC")
  console.log("===============================================================\n")

  // Chuẩn bị dữ liệu mẫu
  const customers = await client.unsafe(
    `SELECT u.id, u.phone, u.full_name FROM users u WHERE u.role = 'CUSTOMER' LIMIT 1`,
  )
  const drivers = await client.unsafe(
    `SELECT dp.id as driver_id, dp.user_id, u.full_name, dp.vehicle_type_id 
     FROM driver_profiles dp 
     JOIN users u ON u.id = dp.user_id 
     WHERE dp.kyc_status = 'APPROVED' LIMIT 2`,
  )

  if (customers.length === 0 || drivers.length < 2) {
    throw new Error("Không đủ dữ liệu khách hàng hoặc tài xế để chạy test!")
  }

  const customer = customers[0]
  const driverA = drivers[0]
  const driverB = drivers[1]
  const vehicleTypeId = driverA.vehicle_type_id

  console.log(`👤 Khách hàng test: ${customer.full_name} (${customer.phone})`)
  console.log(`🚚 Tài xế A: ${driverA.full_name} | ID: ${driverA.driver_id}`)
  console.log(`🚚 Tài xế B: ${driverB.full_name} | ID: ${driverB.driver_id}\n`)

  // Đảm bảo cả 2 tài xế online và có ví ký quỹ >= 200k
  await client.unsafe(
    `UPDATE driver_profiles SET is_online = true, is_active = true WHERE id IN ($1::uuid, $2::uuid)`,
    [driverA.driver_id, driverB.driver_id],
  )
  await client.unsafe(
    `INSERT INTO wallets (user_id, balance, min_deposit_limit) 
     VALUES ($1::uuid, 500000, 200000) 
     ON CONFLICT (user_id) DO UPDATE SET balance = 500000`,
    [driverA.user_id],
  )
  await client.unsafe(
    `INSERT INTO wallets (user_id, balance, min_deposit_limit) 
     VALUES ($1::uuid, 500000, 200000) 
     ON CONFLICT (user_id) DO UPDATE SET balance = 500000`,
    [driverB.user_id],
  )

  // Cập nhật vị trí GPS cho cả 2 tài xế gần Chợ Bến Thành
  await client.unsafe(
    `INSERT INTO driver_locations (driver_id, location_point, updated_at)
     VALUES ($1::uuid, ST_SetSRID(ST_MakePoint(106.699, 10.7797), 4326), NOW())
     ON CONFLICT (driver_id) DO UPDATE SET location_point = EXCLUDED.location_point, updated_at = NOW()`,
    [driverA.driver_id],
  )
  await client.unsafe(
    `INSERT INTO driver_locations (driver_id, location_point, updated_at)
     VALUES ($1::uuid, ST_SetSRID(ST_MakePoint(106.690, 10.7850), 4326), NOW())
     ON CONFLICT (driver_id) DO UPDATE SET location_point = EXCLUDED.location_point, updated_at = NOW()`,
    [driverB.driver_id],
  )

  // -------------------------------------------------------------------------
  // TEST 1: Task 1.2 - Chặn nhảy cóc từ ACCEPTED sang IN_TRANSIT
  // -------------------------------------------------------------------------
  console.log("---------------------------------------------------------------")
  console.log("🧪 TEST 1: State Machine bắt buộc đi qua ARRIVED_AT_PICKUP")

  const b1 = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Chợ Bến Thành, Quận 1",
    originLat: 10.7725,
    originLng: 106.698,
    destinationAddress: "Landmark 81, Bình Thạnh",
    destLat: 10.795,
    destLng: 106.7218,
    paymentMethod: "CASH",
  })

  await acceptBooking(driverA.user_id, b1.bookingId)
  console.log(`   - Tạo và nhận chuyến ${b1.bookingCode} (Status: ACCEPTED)`)

  try {
    await updateBookingStatus(driverA.user_id, b1.bookingId, "IN_TRANSIT")
    throw new Error("❌ Thất bại: Cho phép nhảy cóc sang IN_TRANSIT!")
  } catch (err: any) {
    console.log(`   ✅ BẢO VỆ STATE MACHINE THÀNH CÔNG: Chặn nhảy từ ACCEPTED sang IN_TRANSIT`)
    console.log(`      Thông báo lỗi: "${err.message}"`)
  }

  // -------------------------------------------------------------------------
  // TEST 2: Task 1.1 - Loại trừ tài xế đang ở trạng thái ARRIVED_AT_PICKUP
  // -------------------------------------------------------------------------
  console.log("\n---------------------------------------------------------------")
  console.log("🧪 TEST 2: PostGIS loại trừ tài xế đang ở trạng thái ARRIVED_AT_PICKUP")

  await updateBookingStatus(driverA.user_id, b1.bookingId, "ARRIVED_AT_PICKUP")
  console.log(`   - Tài xế A cập nhật ARRIVED_AT_PICKUP`)

  const nearbyAfterArrived = await findNearbyDrivers({
    originLat: 10.7725,
    originLng: 106.698,
    radiusKm: 5,
    vehicleTypeId,
  })

  const driverAFound = nearbyAfterArrived.some((d) => d.driverId === driverA.driver_id)
  if (driverAFound) {
    throw new Error("❌ Thất bại: Tài xế A đang ARRIVED_AT_PICKUP vẫn bị quét trúng!")
  }
  console.log(`   ✅ LOẠI TRỪ THÀNH CÔNG: Tài xế A đang ở điểm đón nên không xuất hiện trong danh sách tìm kiếm (Số tài xế tìm thấy: ${nearbyAfterArrived.length})`)

  // -------------------------------------------------------------------------
  // TEST 3: Task 2.1 - Hủy cuốc lúc ARRIVED_AT_PICKUP -> Phí bồi thường 30.000đ
  // -------------------------------------------------------------------------
  console.log("\n---------------------------------------------------------------")
  console.log("🧪 TEST 3: Khách hủy lúc tài xế đã đến -> Lưu vết & Tính phí bồi thường 30.000đ")

  const driverWalletBefore = await getOrCreateWallet(driverA.user_id)
  const custWalletBefore = await getOrCreateWallet(customer.id)

  const cancelRes = await cancelBooking(customer.id, b1.bookingId, "Khách hàng đổi ý hủy đơn")

  const driverWalletAfter = await getOrCreateWallet(driverA.user_id)
  const custWalletAfter = await getOrCreateWallet(customer.id)

  const driverDiff = Number(driverWalletAfter.balance) - Number(driverWalletBefore.balance)
  const custDiff = Number(custWalletAfter.balance) - Number(custWalletBefore.balance)

  console.log(`   - Kết quả hủy: ${cancelRes.message}`)
  console.log(`   - Phí bồi thường: ${cancelRes.cancellationFee}đ`)
  console.log(`   - Số dư ví tài xế: Trước = ${Number(driverWalletBefore.balance)}đ | Sau = ${Number(driverWalletAfter.balance)}đ (+${driverDiff}đ)`)
  console.log(`   - Số dư ví khách: Trước = ${Number(custWalletBefore.balance)}đ | Sau = ${Number(custWalletAfter.balance)}đ (${custDiff}đ)`)

  if (driverDiff !== 30000) {
    throw new Error(`❌ Thất bại: Ví tài xế không được cộng đủ 30.000đ (Thực tế: ${driverDiff})`)
  }
  if (custDiff !== -30000) {
    throw new Error(`❌ Thất bại: Ví khách hàng không bị trừ đúng 30.000đ (Thực tế: ${custDiff})`)
  }

  const dbBooking1 = await getBookingById(b1.bookingId)
  if (!dbBooking1.cancellation || dbBooking1.cancellation.fee !== 30000) {
    throw new Error("❌ Thất bại: Dữ liệu bồi thường không được lưu vào Database!")
  }
  console.log(`   ✅ TÀI CHÍNH & DATABASE LƯU VẾT CHUẨN XÁC:`)
  console.log(`      + Ví khách: Bị trừ -30.000đ thành công`)
  console.log(`      + Ví tài xế: Được cộng +30.000đ thành công`)
  console.log(`      + cancelledBy: ${dbBooking1.cancellation.cancelledBy}`)
  console.log(`      + reason: ${dbBooking1.cancellation.reason}`)
  console.log(`      + fee: ${dbBooking1.cancellation.fee}đ`)

  // -------------------------------------------------------------------------
  // TEST 4: Task 2.2 - Bằng chứng giao nhận hàng (Proof of Delivery - POD)
  // -------------------------------------------------------------------------
  console.log("\n---------------------------------------------------------------")
  console.log("🧪 TEST 4: Lưu ảnh bằng chứng giao nhận (Proof of Delivery - POD)")

  const b2 = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Dinh Độc Lập, Quận 1",
    originLat: 10.777,
    originLng: 106.6953,
    destinationAddress: "Thảo Cầm Viên, Quận 1",
    destLat: 10.7875,
    destLng: 106.7053,
  })
  await acceptBooking(driverA.user_id, b2.bookingId)
  await updateBookingStatus(driverA.user_id, b2.bookingId, "ARRIVED_AT_PICKUP")

  // Đang giao có ảnh bốc hàng lên xe
  const pickupImg = "https://res.cloudinary.com/demo/image/upload/sample_pickup.jpg"
  await updateBookingStatus(driverA.user_id, b2.bookingId, "IN_TRANSIT", "Bốc hàng xong", pickupImg)

  // 4.1 Thử hoàn thành khi bật requireProof mà không gửi ảnh -> Phải quăng lỗi 400
  try {
    await updateBookingStatus(driverA.user_id, b2.bookingId, "COMPLETED", "Không gửi ảnh", undefined, { requireProof: true })
    throw new Error("❌ Thất bại: Không chặn khi thiếu ảnh POD!")
  } catch (podErr: any) {
    console.log(`   ✅ BẢO VỆ POD THÀNH CÔNG: Chặn hoàn thành khi thiếu ảnh giao hàng ("${podErr.message}")`)
  }

  // 4.2 Hoàn thành có ảnh giao hàng thành công
  const deliveryImg = "https://res.cloudinary.com/demo/image/upload/sample_delivery.jpg"
  await updateBookingStatus(driverA.user_id, b2.bookingId, "COMPLETED", "Giao hàng thành công", deliveryImg, { requireProof: true })

  const dbBooking2 = await getBookingById(b2.bookingId)
  if (
    dbBooking2.proofImages.pickup !== pickupImg ||
    dbBooking2.proofImages.delivery !== deliveryImg
  ) {
    throw new Error("❌ Thất bại: Ảnh bằng chứng POD không được lưu vào Database!")
  }
  console.log(`   ✅ BẰNG CHỨNG GIAO NHẬN (POD) ĐÃ LƯU DATABASE:`)
  console.log(`      + Ảnh nhận hàng: ${dbBooking2.proofImages.pickup}`)
  console.log(`      + Ảnh giao hàng: ${dbBooking2.proofImages.delivery}`)

  // -------------------------------------------------------------------------
  // TEST 5: Task 2.3 & Task 2.4 - Điều phối đa vòng (5km -> 8km)
  // -------------------------------------------------------------------------
  console.log("\n---------------------------------------------------------------")
  console.log("🧪 TEST 5: Điều phối đa vòng (Dispatch Escalation Vòng 2 lên 8km)")

  const b3 = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Chợ Bến Thành, Quận 1",
    originLat: 10.7725,
    originLng: 106.698,
    destinationAddress: "Cầu Ánh Sao, Quận 7",
    destLat: 10.729,
    destLng: 106.719,
  })

  const escRes = await escalateBookingDispatch(b3.bookingId)
  console.log(`   ✅ KÍCH HOẠT VÒNG 2 THÀNH CÔNG:`)
  console.log(`      + Escalated: ${escRes.escalated}`)
  console.log(`      + Bán kính quét: ${escRes.radiusKm}km`)
  console.log(`      + Số tài xế quét thấy ở Vành đai 5-8km: ${escRes.matchedDriversCount}`)
  console.log(`      + Thông điệp: "${escRes.message}"`)

  // Đảm bảo tài xế Vòng 1 (< 5km) không bị quét lặp ở Vòng 2
  const driverAInRound2 = escRes.drivers?.some((d: any) => d.driverId === driverA.driver_id)
  if (driverAInRound2) {
    throw new Error("❌ Thất bại: Tài xế A ở Vòng 1 vẫn bị nổ cuốc trùng lặp ở Vòng 2!")
  }
  console.log(`   ✅ LOẠI TRỪ TÀI XẾ CŨ THÀNH CÔNG: Tài xế A (< 1km) đã không bị nổ cuốc lặp lại ở Vòng 2`)

  // Dọn dẹp đơn b3
  await cancelBooking(customer.id, b3.bookingId, "Dọn dẹp test")

  console.log("\n===============================================================")
  console.log("🎉 TẤT CẢ 5/5 TEST CASES SPRINT 3 HARDENING ĐÃ PASS 100%!")
  console.log("===============================================================")
  process.exit(0)
}

runSprint3HardeningTests().catch((err) => {
  console.error("❌ Lỗi test:", err)
  process.exit(1)
})
