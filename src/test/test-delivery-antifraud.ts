import { client } from "../db"
import {
  createBooking,
  acceptBooking,
  updateBookingStatus,
  getBookingById,
} from "../lib/bookingService"

async function runDeliveryAntiFraudTests() {
  console.log("===============================================================")
  console.log("🛡️ BẮT ĐẦU TEST TOÀN DIỆN: HỆ THỐNG CHỐNG GIAN LẬN HOÀN THÀNH CUỐC")
  console.log("===============================================================\n")

  // 1. Chuẩn bị dữ liệu khách hàng và tài xế
  const customers = await client.unsafe(
    `SELECT u.id, u.phone, u.full_name FROM users u WHERE u.role = 'CUSTOMER' LIMIT 1`,
  )
  const drivers = await client.unsafe(
    `SELECT dp.id as driver_id, dp.user_id, u.full_name, dp.vehicle_type_id 
     FROM driver_profiles dp 
     JOIN users u ON u.id = dp.user_id 
     WHERE dp.kyc_status = 'APPROVED' LIMIT 1`,
  )

  if (customers.length === 0 || drivers.length === 0) {
    throw new Error("Không đủ dữ liệu khách hàng hoặc tài xế để chạy test!")
  }

  const customer = customers[0]
  const driver = drivers[0]
  const vehicleTypeId = driver.vehicle_type_id

  console.log(`👤 Khách hàng test: ${customer.full_name} (${customer.id})`)
  console.log(`🚚 Tài xế test: ${driver.full_name} (${driver.driver_id})\n`)

  // Đảm bảo tài xế online và số dư ví ký quỹ đủ >= 200k
  await client.unsafe(
    `UPDATE driver_profiles SET is_online = true, is_active = true WHERE id = $1::uuid`,
    [driver.driver_id],
  )
  await client.unsafe(
    `INSERT INTO wallets (user_id, balance, min_deposit_limit) 
     VALUES ($1::uuid, 1000000, 200000) 
     ON CONFLICT (user_id) DO UPDATE SET balance = 1000000`,
    [driver.user_id],
  )

  // Điểm giao hàng: Nhà thờ Đức Bà (10.779785, 106.699017)
  const destLat = 10.779785
  const destLng = 106.699017

  // =========================================================================
  // TEST CASE 1: TẠO ĐƠN VÀ KIỂM TRA MÃ OTP TỰ ĐỘNG SINH (4 CHỮ SỐ)
  // =========================================================================
  console.log("--- BƯỚC 1: Tạo đơn hàng và xác thực sinh mã OTP tự động ---")
  const booking1 = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Chợ Bến Thành, Quận 1, TP.HCM",
    originLat: 10.7725,
    originLng: 106.698,
    destinationAddress: "Nhà thờ Đức Bà, Bến Nghé, Quận 1, TP.HCM",
    destLat,
    destLng,
  })

  console.log(`✅ Đã tạo cuốc xe: ${booking1.bookingCode} | ID: ${booking1.bookingId}`)
  console.log(`🔑 Mã OTP nhận hàng được sinh tự động: [ ${booking1.deliveryOtp} ]`)

  if (!booking1.deliveryOtp || booking1.deliveryOtp.length !== 4) {
    throw new Error(`❌ Mã OTP sinh ra không hợp lệ: ${booking1.deliveryOtp}`)
  }

  // Khách hàng tra cứu đơn qua getBookingById thấy mã OTP
  const detail = await getBookingById(booking1.bookingId)
  if (detail.deliveryOtp !== booking1.deliveryOtp) {
    throw new Error("❌ Mã OTP trong database không khớp với mã trả về lúc tạo đơn!")
  }
  console.log("✅ getBookingById trả về đúng deliveryOtp cho màn hình Tracking của khách hàng.\n")

  // Tài xế nhận đơn và chuyển trạng thái tới IN_TRANSIT
  await acceptBooking(driver.user_id, booking1.bookingId)
  await updateBookingStatus(driver.user_id, booking1.bookingId, "ARRIVED_AT_PICKUP")
  await updateBookingStatus(
    driver.user_id,
    booking1.bookingId,
    "IN_TRANSIT",
    "Đã bốc hàng lên xe",
    "https://res.cloudinary.com/demo/image/upload/sample_pickup.jpg",
  )
  console.log("🚚 Cuốc xe đã chuyển sang trạng thái IN_TRANSIT (Đang vận chuyển giao hàng).\n")

  // =========================================================================
  // TEST CASE 2: CHỐNG GIAN LẬN LỚP 1 - CHẶN KHI THIẾU ẢNH BẰNG CHỨNG (POD)
  // =========================================================================
  console.log("--- BƯỚC 2: Thử hoàn thành khi KHÔNG gửi ảnh POD (Kỳ vọng bị chặn) ---")
  try {
    await updateBookingStatus(
      driver.user_id,
      booking1.bookingId,
      "COMPLETED",
      "Giao hàng xong",
      undefined, // Thiếu ảnh POD
      {
        requireProof: true,
        requireOtp: true,
        deliveryOtp: booking1.deliveryOtp,
        driverLat: destLat,
        driverLng: destLng,
      },
    )
    throw new Error("❌ LỖI: Hệ thống cho phép hoàn thành khi thiếu ảnh POD!")
  } catch (err: any) {
    if (err.errorCode === "MISSING_DELIVERY_PROOF" || err.message.includes("Proof of Delivery")) {
      console.log(`✅ Chặn thành công khi thiếu ảnh POD! Lỗi nhận được: "${err.message}"\n`)
    } else {
      throw err
    }
  }

  // =========================================================================
  // TEST CASE 3: CHỐNG GIAN LẬN LỚP 2 - CHẶN KHI NHẬP SAI MÃ OTP NGƯỜI NHẬN
  // =========================================================================
  console.log("--- BƯỚC 3: Thử hoàn thành khi NHẬP SAI MÃ OTP (Kỳ vọng bị chặn) ---")
  try {
    await updateBookingStatus(
      driver.user_id,
      booking1.bookingId,
      "COMPLETED",
      "Giao hàng xong",
      "https://res.cloudinary.com/demo/image/upload/sample_pod.jpg",
      {
        requireProof: true,
        requireOtp: true,
        deliveryOtp: "0000", // Sai OTP
        driverLat: destLat,
        driverLng: destLng,
      },
    )
    throw new Error("❌ LỖI: Hệ thống cho phép hoàn thành khi nhập sai mã OTP!")
  } catch (err: any) {
    if (err.errorCode === "INVALID_DELIVERY_OTP" || err.message.includes("OTP")) {
      console.log(`✅ Chặn thành công khi sai mã OTP! Lỗi nhận được: "${err.message}"\n`)
    } else {
      throw err
    }
  }

  // =========================================================================
  // TEST CASE 4: CHỐNG GIAN LẬN LỚP 3 - CHẶN KHI Ở XA ĐIỂM GIAO (GEOFENCE > 500M)
  // =========================================================================
  console.log("--- BƯỚC 4: Thử hoàn thành khi TỌA ĐỘ GPS Ở XA 4.5KM (Kỳ vọng bị chặn) ---")
  // Tọa độ xa: Khu vực Phú Mỹ Hưng Quận 7 (10.7300, 106.7050) cách Nhà thờ Đức Bà ~5.5 km
  const farLat = 10.7300
  const farLng = 106.7050
  try {
    await updateBookingStatus(
      driver.user_id,
      booking1.bookingId,
      "COMPLETED",
      "Giao hàng xong",
      "https://res.cloudinary.com/demo/image/upload/sample_pod.jpg",
      {
        requireProof: true,
        requireOtp: true,
        deliveryOtp: booking1.deliveryOtp, // Đúng OTP
        driverLat: farLat,                 // Nhưng GPS ở xa
        driverLng: farLng,
      },
    )
    throw new Error("❌ LỖI: Hệ thống cho phép hoàn thành khi tài xế ở xa điểm giao!")
  } catch (err: any) {
    if (err.errorCode === "GEOFENCE_TOO_FAR" || err.message.includes("phạm vi 500m")) {
      console.log(`✅ Chặn thành công khi ở xa điểm giao! Lỗi nhận được: "${err.message}"\n`)
    } else {
      throw err
    }
  }

  // =========================================================================
  // TEST CASE 5: THÀNH CÔNG KHI ĐẦY ĐỦ CẢ 3 LỚP (POD + ĐÚNG OTP + VỊ TRÍ ≤ 500M)
  // =========================================================================
  console.log("--- BƯỚC 5: Hoàn thành cuốc xe HỢP LỆ (POD + OTP đúng + Vị trí cách 30m) ---")
  // Tọa độ gần: Cách Nhà thờ Đức Bà ~30 mét
  const validLat = 10.779900
  const validLng = 106.699100

  const completeResult = await updateBookingStatus(
    driver.user_id,
    booking1.bookingId,
    "COMPLETED",
    "Giao hàng thành công tận tay khách",
    "https://res.cloudinary.com/demo/image/upload/sample_pod.jpg",
    {
      requireProof: true,
      requireOtp: true,
      deliveryOtp: booking1.deliveryOtp,
      driverLat: validLat,
      driverLng: validLng,
    },
  )

  console.log(`🎉 Chuyến xe chuyển trạng thái thành công: ${completeResult.status}`)
  console.log(`   - Thanh toán: ${completeResult.paymentStatus}`)
  console.log(`   - Ảnh POD: ${completeResult.proofImages?.delivery}`)

  // Kiểm tra lưu vết trong database
  const afterDb = await getBookingById(booking1.bookingId)
  if (afterDb.status !== "COMPLETED" || afterDb.pricing.paymentStatus !== "PAID") {
    throw new Error("❌ Trạng thái trong database chưa được chốt COMPLETED/PAID!")
  }
  if (!afterDb.proofImages.delivery) {
    throw new Error("❌ Chưa lưu ảnh delivery_proof_image vào database!")
  }
  if (!afterDb.completedAt || !afterDb.completedLat || !afterDb.completedLng) {
    throw new Error("❌ Chưa lưu vết completed_at, completed_lat, completed_lng vào database!")
  }
  console.log(`✅ Đã lưu vết kiểm toán: Tọa độ lúc hoàn thành (${afterDb.completedLat}, ${afterDb.completedLng}) vào lúc ${afterDb.completedAt}\n`)

  // =========================================================================
  // TEST CASE 6: CƠ CHẾ NGOẠI LỆ BYPASS GEOFENCE KHI ĐỖ XE NGOÀI ĐƯỜNG LỚN
  // =========================================================================
  console.log("--- BƯỚC 6: Kiểm tra cơ chế ngoại lệ Bypass Geofence (Đỗ xe ngoài đường lớn) ---")
  const booking2 = await createBooking(customer.id, {
    vehicleTypeId,
    originAddress: "Chợ Bến Thành, Quận 1, TP.HCM",
    originLat: 10.7725,
    originLng: 106.698,
    destinationAddress: "Hẻm sâu 200m Lê Thánh Tôn, Quận 1",
    destLat: 10.7750,
    destLng: 106.7010,
  })

  await acceptBooking(driver.user_id, booking2.bookingId)
  await updateBookingStatus(driver.user_id, booking2.bookingId, "ARRIVED_AT_PICKUP")
  await updateBookingStatus(driver.user_id, booking2.bookingId, "IN_TRANSIT")

  // Tài xế ở cách 1.2km nhưng có cờ bypassGeofence: true
  const bypassResult = await updateBookingStatus(
    driver.user_id,
    booking2.bookingId,
    "COMPLETED",
    "Đỗ xe ngoài đường lớn vì hẻm cấm xe tải",
    "https://res.cloudinary.com/demo/image/upload/sample_pod_alley.jpg",
    {
      requireProof: true,
      requireOtp: true,
      deliveryOtp: booking2.deliveryOtp,
      driverLat: 10.7600, // Cách 1.6km
      driverLng: 106.6900,
      bypassGeofence: true,
      bypassReason: "Đỗ xe ngoài đường lớn",
    },
  )
  console.log(`✅ Cơ chế ngoại lệ bypassGeofence hoạt động hoàn hảo: Trạng thái ${bypassResult.status}\n`)

  console.log("===============================================================")
  console.log("🏆 TẤT CẢ CÁC BÀI TEST CHỐNG GIAN LẬN HOÀN THÀNH CUỐC ĐỀU PASS 100%!")
  console.log("===============================================================")
}

runDeliveryAntiFraudTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err)
    process.exit(1)
  })
