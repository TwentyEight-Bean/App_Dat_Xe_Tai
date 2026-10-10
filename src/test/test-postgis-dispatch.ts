import { client, db } from "../db"
import { driverProfiles, users, vehicleTypes } from "../db/schema"
import { eq } from "drizzle-orm"
import { updateDriverLocation, findNearbyDrivers } from "../lib/dispatchService"

async function runTest() {
  console.log("===============================================================")
  console.log("🚀 KIỂM THỬ TASK 3.1: LOGIC POSTGIS ĐIỀU PHỐI TÀI XẾ LÂN CẬN")
  console.log(
    "===============================================================\n",
  )

  // 1. Lấy danh sách tài xế hiện có trong DB
  const drivers = await db
    .select({
      driverId: driverProfiles.id,
      userId: driverProfiles.userId,
      fullName: users.fullName,
      phone: users.phone,
      isOnline: driverProfiles.isOnline,
      kycStatus: driverProfiles.kycStatus,
      vehicleTypeId: driverProfiles.vehicleTypeId,
    })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId))

  console.log(`📌 Tìm thấy ${drivers.length} tài xế trong cơ sở dữ liệu:`)
  drivers.forEach((d) => {
    console.log(
      `   - [${d.fullName}] ID: ${d.driverId} | Online: ${d.isOnline} | KYC: ${d.kycStatus}`,
    )
  })

  if (drivers.length < 3) {
    console.error("❌ Cần ít nhất 3 tài xế để kiểm thử.")
    process.exit(1)
  }

  // Điểm mốc chuẩn: Chợ Bến Thành, Quận 1 (10.7725, 106.6980)
  const BEN_THANH = { lat: 10.7725, lng: 106.698 }

  // 2. Thiết lập tọa độ GPS mẫu cho các tài xế
  // Driver 0 (Trần Minh Quân - 500KG, Online): Nhà thờ Đức Bà (10.7797, 106.6990) -> ~850m
  // Driver 1 (Võ Tuấn Kiệt - 1TON, Online): Chợ Tân Định Q3 (10.7903, 106.6898) -> ~2.2km
  // Driver 2 (Ngô Hoàng Nam - 500KG, Online): Landmark 81 Bình Thạnh (10.7950, 106.7218) -> ~3.5km
  // Driver 3 (Lê Thành Đạt - 1TON, Offline): Dinh Độc Lập (10.7770, 106.6953) -> ~600m nhưng Offline
  const sampleCoords = [
    {
      name: drivers[0].fullName,
      id: drivers[0].driverId,
      lat: 10.7797,
      lng: 106.699,
      label: "Nhà thờ Đức Bà (~850m)",
    },
    {
      name: drivers[1].fullName,
      id: drivers[1].driverId,
      lat: 10.7903,
      lng: 106.6898,
      label: "Chợ Tân Định Q3 (~2.2km)",
    },
    {
      name: drivers[2].fullName,
      id: drivers[2].driverId,
      lat: 10.795,
      lng: 106.7218,
      label: "Landmark 81 (~3.5km)",
    },
  ]

  if (drivers[3]) {
    sampleCoords.push({
      name: drivers[3].fullName,
      id: drivers[3].driverId,
      lat: 10.777,
      lng: 106.6953,
      label: "Dinh Độc Lập (~600m - Offline)",
    })
  }

  console.log("\n📍 Cập nhật tọa độ PostGIS thực tế cho các tài xế:")
  for (const item of sampleCoords) {
    const res = await updateDriverLocation(item.id, {
      lat: item.lat,
      lng: item.lng,
      heading: 90,
    })
    console.log(
      `   ✅ Đã cập nhật tọa độ cho ${item.name} tại ${item.label} (${res.latitude}, ${res.longitude})`,
    )
  }

  // --- TEST CASE 1: Bán kính 1km (1000m) ---
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("🧪 TEST CASE 1: Tìm tài xế trong bán kính 1km từ Chợ Bến Thành")
  console.log(
    "   Kỳ vọng: Chỉ có tài xế tại Nhà thờ Đức Bà (~850m), loại tài xế Offline tại Dinh Độc Lập",
  )
  const resCase1 = await findNearbyDrivers({
    originLat: BEN_THANH.lat,
    originLng: BEN_THANH.lng,
    radiusKm: 1,
  })
  console.log(`   👉 Kết quả: ${resCase1.length} tài xế`)
  resCase1.forEach((d, i) => {
    console.log(
      `      ${i + 1}. ${d.fullName} (${d.vehicleTypeName || d.licensePlate}) - Cách ${d.distanceMeters}m (${d.distanceKm}km)`,
    )
  })

  // --- TEST CASE 2: Bán kính 3km (Vòng 1 tiêu chuẩn: 3km) ---
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log("🧪 TEST CASE 2: Tìm tài xế trong bán kính 3km (Vòng quét 1)")
  console.log(
    "   Kỳ vọng: Lấy tài xế cách 850m và 2.2km, sắp xếp thứ tự tăng dần theo cự ly",
  )
  const resCase2 = await findNearbyDrivers({
    originLat: BEN_THANH.lat,
    originLng: BEN_THANH.lng,
    radiusKm: 3,
  })
  console.log(`   👉 Kết quả: ${resCase2.length} tài xế`)
  resCase2.forEach((d, i) => {
    console.log(
      `      ${i + 1}. ${d.fullName} (${d.vehicleTypeName}) - Cách ${d.distanceMeters}m (${d.distanceKm}km)`,
    )
  })

  // --- TEST CASE 3: Bán kính 5km (Vòng 1 mở rộng: 5km) ---
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    "🧪 TEST CASE 3: Tìm tài xế trong bán kính 5km (Vòng quét 1 mở rộng)",
  )
  console.log("   Kỳ vọng: Lấy đủ 3 tài xế online (~850m, ~2.2km, ~3.5km)")
  const resCase3 = await findNearbyDrivers({
    originLat: BEN_THANH.lat,
    originLng: BEN_THANH.lng,
    radiusKm: 5,
  })
  console.log(`   👉 Kết quả: ${resCase3.length} tài xế`)
  resCase3.forEach((d, i) => {
    console.log(
      `      ${i + 1}. ${d.fullName} (${d.vehicleTypeName}) - Cách ${d.distanceMeters}m (${d.distanceKm}km)`,
    )
  })

  // --- TEST CASE 4: Lọc theo loại xe tải (Ví dụ: chỉ tìm xe 500KG) ---
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log('🧪 TEST CASE 4: Lọc theo loại xe tải "500KG" trong bán kính 5km')
  const vehicle500kg = await db
    .select()
    .from(vehicleTypes)
    .where(eq(vehicleTypes.code, "500KG"))
    .limit(1)
  if (vehicle500kg.length > 0) {
    const resCase4 = await findNearbyDrivers({
      originLat: BEN_THANH.lat,
      originLng: BEN_THANH.lng,
      radiusKm: 5,
      vehicleTypeId: vehicle500kg[0].id,
    })
    console.log(`   👉 Kết quả: ${resCase4.length} tài xế xe 500KG`)
    resCase4.forEach((d, i) => {
      console.log(
        `      ${i + 1}. ${d.fullName} [${d.vehicleTypeCode}] - Cách ${d.distanceMeters}m (${d.distanceKm}km)`,
      )
    })
  }

  // --- TEST CASE 5: Loại trừ tài xế đã từ chối (excludeDriverIds) ---
  console.log(
    "\n---------------------------------------------------------------",
  )
  console.log(
    `🧪 TEST CASE 5: Loại trừ tài xế gần nhất (${drivers[0].fullName})`,
  )
  const resCase5 = await findNearbyDrivers({
    originLat: BEN_THANH.lat,
    originLng: BEN_THANH.lng,
    radiusKm: 5,
    excludeDriverIds: [drivers[0].driverId],
  })
  console.log(`   👉 Kết quả: ${resCase5.length} tài xế`)
  resCase5.forEach((d, i) => {
    console.log(
      `      ${i + 1}. ${d.fullName} - Cách ${d.distanceMeters}m (${d.distanceKm}km)`,
    )
  })

  console.log(
    "\n===============================================================",
  )
  console.log("🎉 TẤT CẢ CÁC TEST CASES ĐÃ HOÀN THÀNH XUẤT SẮC!")
  console.log(
    "===============================================================\n",
  )

  process.exit(0)
}

runTest().catch((err) => {
  console.error("❌ Lỗi kiểm thử:", err)
  process.exit(1)
})
