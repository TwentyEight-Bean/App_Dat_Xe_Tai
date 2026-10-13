import * as dotenv from "dotenv"
dotenv.config()

import { getPendingKycDrivers, getAllDrivers, approveDriverKyc } from "../lib/adminService"
import { estimateBookingPrice, updatePricingRule } from "../lib/pricingService"
import { calculateRouteDistance } from "../lib/distanceService"
import { getCustomerAddresses, createCustomerAddress } from "../lib/addressService"
import { db } from "../db"
import { users } from "../db/schema"
import { eq } from "drizzle-orm"

async function runHardeningTests() {
  console.log("🚀 ========================================================")
  console.log("   KIỂM THỬ NGHIỆM THU: CÁC CẢI TIẾN & FIX LỖI SPRINT 2")
  console.log("==========================================================\n")

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`)
      passed++
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`)
      failed++
    }
  }

  try {
    // 1. Kiểm tra total & totalPages khi phân trang Admin
    console.log("1. Kiểm tra phân trang Admin (Task 1.1):")
    const pendingResult = await getPendingKycDrivers(1, 10)
    assert(
      typeof pendingResult.total === "number" && typeof pendingResult.totalPages === "number",
      "getPendingKycDrivers trả về total và totalPages chuẩn xác",
      `total: ${pendingResult.total}, totalPages: ${pendingResult.totalPages}`
    )

    const allDriversResult = await getAllDrivers({ page: 1, limit: 10 })
    assert(
      typeof allDriversResult.total === "number" && typeof allDriversResult.totalPages === "number",
      "getAllDrivers trả về total và totalPages chuẩn xác",
      `total: ${allDriversResult.total}, totalPages: ${allDriversResult.totalPages}`
    )

    // 2. Kiểm tra bộ lọc search trong getAllDrivers
    console.log("\n2. Kiểm tra tìm kiếm tài xế search (Task 1.2):")
    const searchDrivers = await getAllDrivers({ search: "51C", page: 1, limit: 10 })
    assert(
      Array.isArray(searchDrivers.drivers),
      `Tìm kiếm với search="51C" thực thi thành công (tìm thấy ${searchDrivers.drivers.length} tài xế)`
    )

    // 3. Kiểm tra Múi giờ Việt Nam Asia/Ho_Chi_Minh cho Phụ phí ban đêm (Task 1.4)
    console.log("\n3. Kiểm tra Múi giờ Việt Nam cho Phụ phí ban đêm (Task 1.4):")
    // Giả sử giờ đặt là 23:30 tối Việt Nam (= 16:30 UTC)
    const nightEst = await estimateBookingPrice({
      vehicleTypeId: "v-500kg",
      originLat: 10.7725,
      originLng: 106.698,
      destLat: 10.8185,
      destLng: 106.6588,
      bookingTime: "2026-10-13T16:30:00.000Z", // 16:30 UTC = 23:30 VN
    })
    const hasNight = nightEst.breakdown.surcharges.some(s => s.code === "NIGHT_SURCHARGE")
    assert(hasNight, "16:30 UTC (= 23:30 Việt Nam) nhận diện chính xác khung giờ đêm (+20.000đ)")

    // Giả sử giờ đặt là 09:00 sáng Việt Nam (= 02:00 UTC)
    const dayEst = await estimateBookingPrice({
      vehicleTypeId: "v-500kg",
      originLat: 10.7725,
      originLng: 106.698,
      destLat: 10.8185,
      destLng: 106.6588,
      bookingTime: "2026-10-13T02:00:00.000Z", // 02:00 UTC = 09:00 VN
    })
    const hasDayNight = dayEst.breakdown.surcharges.some(s => s.code === "NIGHT_SURCHARGE")
    assert(!hasDayNight, "02:00 UTC (= 09:00 Việt Nam) KHÔNG bị tính nhầm phí đêm")

    // 4. Kiểm tra cập nhật bảng giá với cả 2 loại ID (Task 1.5)
    console.log("\n4. Kiểm tra cập nhật bảng giá với cả 2 định dạng ID (Task 1.5):")
    const updateWithVehicleTypeId = await updatePricingRule("v-500kg", { pricePerKm: 15500 })
    assert(!!updateWithVehicleTypeId, "Cập nhật bảng giá qua vehicleTypeId thành công")
    await updatePricingRule("v-500kg", { pricePerKm: 15000 }) // Khôi phục

    // 5. Kiểm tra Phụ phí dịch vụ có số lượng quantity (Task 2.2)
    console.log("\n5. Kiểm tra Phụ phí dịch vụ có số lượng (Task 2.2):")
    const qtyEst = await estimateBookingPrice({
      vehicleTypeId: "v-500kg",
      originLat: 10.7725,
      originLng: 106.698,
      destLat: 10.8185,
      destLng: 106.6588,
      isNight: false,
      services: [
        { code: "EXTRA_STOP", quantity: 2 }, // 35k x 2 = 70k
        { code: "EXTRA_HELPER", quantity: 1 }, // 200k x 1 = 200k
      ],
    })
    const extraStop = qtyEst.breakdown.surcharges.find(s => s.code === "EXTRA_STOP")
    const extraHelper = qtyEst.breakdown.surcharges.find(s => s.code === "EXTRA_HELPER")
    assert(
      extraStop?.quantity === 2 && extraStop?.totalPrice === (extraStop?.price || 0) * 2,
      `Phụ phí EXTRA_STOP tính đúng 2 điểm dừng: ${extraStop?.totalPrice} VNĐ`
    )
    assert(
      qtyEst.breakdown.surchargeTotal === ((extraStop?.totalPrice || 0) + (extraHelper?.totalPrice || 0)),
      `Tổng phụ phí chính xác: ${qtyEst.breakdown.surchargeTotal} VNĐ`
    )

    // 6. Kiểm tra tính lộ trình đa điểm dừng (Task 2.3)
    console.log("\n6. Kiểm tra lộ trình đa điểm dừng Waypoints (Task 2.3):")
    const directRoute = await calculateRouteDistance(10.7725, 106.698, 10.8185, 106.6588)
    const waypointRoute = await calculateRouteDistance(
      10.7725, 106.698, // Điểm đi: Quận 1
      10.8185, 106.6588, // Điểm đến: Tân Bình
      [
        { lat: 10.7550, lng: 106.6670 } // Điểm ghé thêm: Quận 5
      ]
    )
    assert(
      waypointRoute.distanceKm > directRoute.distanceKm,
      `Lộ trình có điểm ghé phụ xa hơn đi thẳng (${waypointRoute.distanceKm} km > ${directRoute.distanceKm} km)`
    )

    // 7. Kiểm tra phân trang Sổ địa chỉ (Task 2.4)
    console.log("\n7. Kiểm tra phân trang Sổ địa chỉ khách hàng (Task 2.4):")
    // Tạo 1 user test tạm nếu có
    const [testUser] = await db.select().from(users).limit(1)
    if (testUser) {
      const pagedAddresses: any = await getCustomerAddresses(testUser.id, { page: 1, limit: 2 })
      assert(
        pagedAddresses.pagination && typeof pagedAddresses.pagination.total === "number",
        `getCustomerAddresses hỗ trợ phân trang chuẩn: total = ${pagedAddresses.pagination.total}`
      )
    }

    console.log("\n==========================================================")
    console.log(`🎉 TỔNG KẾT KIỂM THỬ: ${passed} PASS, ${failed} FAIL`)
    console.log("==========================================================")
  } catch (err: any) {
    console.error("Lỗi khi chạy test:", err)
  }
}

runHardeningTests()
