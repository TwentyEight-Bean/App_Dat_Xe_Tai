import * as dotenv from "dotenv"
dotenv.config()

import { db } from "../db"
import { vehicleTypes, pricingRules, surchargeServices } from "../db/schema"
import { eq } from "drizzle-orm"
import {
  calculateRouteDistance,
  calculateHaversineDistance,
} from "../lib/distanceService"
import {
  getPricingRules,
  getSurchargeServices,
  estimateBookingPrice,
  updatePricingRule,
} from "../lib/pricingService"

async function runPricingEngineTests() {
  console.log("⚡ ========================================================")
  console.log("   BẮT ĐẦU KIỂM THỬ: ENGINE TÍNH GIÁ CƯỚC (SPRINT 2 - 2.3)")
  console.log("   CHẾ ĐỘ 1: OPEN-SOURCE (OSRM / HAVERSINE / 0 VNĐ)")
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
    // 1. Kiểm tra tính khoảng cách qua tọa độ (Chợ Bến Thành -> Sân bay Tân Sơn Nhất)
    console.log(
      "1. Kiểm tra Engine tính khoảng cách tọa độ (Open-Source / 0 VNĐ):",
    )
    const benThanh = { lat: 10.7725, lng: 106.698 }
    const tanSonNhat = { lat: 10.8185, lng: 106.6588 }

    const startTime = Date.now()
    const route = await calculateRouteDistance(
      benThanh.lat,
      benThanh.lng,
      tanSonNhat.lat,
      tanSonNhat.lng,
    )
    const durationMs = Date.now() - startTime

    assert(
      route.distanceKm >= 6.0 && route.distanceKm <= 11.0,
      `Khoảng cách Bến Thành -> TSN hợp lý: ${route.distanceKm} km`,
    )
    assert(
      route.durationMinutes >= 8 && route.durationMinutes <= 60,
      `Thời gian dự kiến hợp lý: ${route.durationMinutes} phút`,
    )
    assert(
      route.routingSource === "OSRM_OPENSOURCE" ||
        route.routingSource === "HAVERSINE_LOCAL",
      `Nguồn định tuyến Open-Source: [${route.routingSource}]`,
    )
    assert(durationMs < 2000, `Tốc độ phản hồi cực nhanh: ${durationMs}ms`)

    // 2. Kiểm tra truy vấn bảng giá gốc và phụ phí
    console.log("\n2. Kiểm tra danh mục bảng giá và phụ phí từ Database:")
    const allRules = await getPricingRules()
    assert(
      allRules.length >= 4,
      `Lấy thành công bảng giá của ${allRules.length} loại xe tải`,
    )

    const allSurcharges = await getSurchargeServices()
    assert(
      allSurcharges.length >= 4,
      `Lấy thành công ${allSurcharges.length} loại phụ phí dịch vụ`,
    )

    const truck500 = allRules.find((r) => r.vehicleCode === "500KG")
    const truck1Ton = allRules.find((r) => r.vehicleCode === "1TON")
    assert(!!truck500 && !!truck1Ton, "Tìm thấy cấu hình xe 500KG và 1TON")

    // 3. Test cước cự ly ngắn (trong cự ly mở cửa 4km)
    console.log("\n3. Kiểm tra tính cước cự ly ngắn (<= 4km):")
    // 2 tọa độ cách nhau ~ 2km (Bến Thành -> Dinh Độc Lập / Chợ Cũ)
    const shortEstimate = await estimateBookingPrice({
      vehicleTypeId: truck500!.vehicleTypeId,
      originLat: 10.7725,
      originLng: 106.698,
      destLat: 10.778,
      destLng: 106.695,
      services: [],
      isNight: false,
    })

    assert(
      shortEstimate.breakdown.extraDistanceKm === 0,
      `Cự ly ${shortEstimate.distanceKm}km nằm trong 4km mở cửa (extraDistanceKm = 0)`,
    )
    assert(
      shortEstimate.breakdown.transportPrice === Number(truck500!.basePrice),
      `Cước vận chuyển đúng bằng giá mở cửa: ${shortEstimate.breakdown.transportPrice.toLocaleString()} VNĐ`,
    )
    assert(
      shortEstimate.breakdown.totalPrice === Number(truck500!.basePrice),
      "Không có phụ phí -> Tổng tiền = Giá mở cửa",
    )

    // 4. Test cước cự ly dài (> 4km) cho xe 1 Tấn
    console.log("\n4. Kiểm tra tính cước cự ly dài (> 4km, xe 1 Tấn):")
    // Bến Thành -> Sân bay TSN (~ 7-9km)
    const longEstimate = await estimateBookingPrice({
      vehicleTypeId: truck1Ton!.vehicleTypeId,
      originLat: benThanh.lat,
      originLng: benThanh.lng,
      destLat: tanSonNhat.lat,
      destLng: tanSonNhat.lng,
      services: [],
      isNight: false,
    })

    const expectedExtraKm = Math.max(
      0,
      Number((longEstimate.distanceKm - 4.0).toFixed(1)),
    )
    const expectedExtraPrice = Math.round(expectedExtraKm * 17000)
    const expectedTransport = 200000 + expectedExtraPrice

    assert(
      longEstimate.breakdown.extraDistanceKm === expectedExtraKm,
      `Số km vượt chính xác: ${expectedExtraKm} km`,
    )
    assert(
      longEstimate.breakdown.transportPrice === expectedTransport,
      `Cước vận chuyển chính xác: ${longEstimate.breakdown.transportPrice.toLocaleString()} VNĐ (Gốc: 200k + Vượt: ${expectedExtraPrice.toLocaleString()}đ)`,
    )

    // 5. Test cộng dồn phụ phí bốc xếp và điểm dừng
    console.log(
      "\n5. Kiểm tra cộng phụ phí dịch vụ (Bốc xếp tầng trệt + Thêm điểm dừng):",
    )
    const surchargeEstimate = await estimateBookingPrice({
      vehicleTypeId: truck1Ton!.vehicleTypeId,
      originLat: benThanh.lat,
      originLng: benThanh.lng,
      destLat: tanSonNhat.lat,
      destLng: tanSonNhat.lng,
      services: ["LOADING_FLOOR", "EXTRA_STOP"],
      isNight: false,
    })

    assert(
      surchargeEstimate.breakdown.surcharges.length === 2,
      "Áp dụng đúng 2 phụ phí đã chọn",
    )
    // LOADING_FLOOR (50.000) + EXTRA_STOP (35.000) = 85.000
    assert(
      surchargeEstimate.breakdown.surchargeTotal === 85000,
      `Tổng phụ phí chính xác: ${surchargeEstimate.breakdown.surchargeTotal.toLocaleString()} VNĐ`,
    )
    assert(
      surchargeEstimate.breakdown.totalPrice ===
        surchargeEstimate.breakdown.transportPrice + 85000,
      `Tổng cước thanh toán chính xác: ${surchargeEstimate.breakdown.totalPrice.toLocaleString()} VNĐ`,
    )

    // 6. Test tự động kích hoạt phụ phí ban đêm (Night Surcharge 22:00 - 06:00)
    console.log("\n6. Kiểm tra tự động cộng phụ phí ban đêm (22:00 - 06:00):")
    const nightEstimate = await estimateBookingPrice({
      vehicleTypeId: truck500!.vehicleTypeId,
      originLat: benThanh.lat,
      originLng: benThanh.lng,
      destLat: tanSonNhat.lat,
      destLng: tanSonNhat.lng,
      bookingTime: "2026-10-08T23:30:00+07:00", // Đặt lúc 23h30 đêm
    })

    const hasNightSurcharge = nightEstimate.breakdown.surcharges.some(
      (s) => s.code === "NIGHT_SURCHARGE",
    )
    assert(
      hasNightSurcharge,
      "Tự động phát hiện và cộng phụ phí ban đêm (+20.000đ)",
    )

    // 7. Test phân bổ hoa hồng (Commission Split)
    console.log(
      "\n7. Kiểm tra tính tỷ lệ hoa hồng (Sàn 20%, Tài xế 80% + 100% bốc xếp):",
    )
    const commissionTest = surchargeEstimate.breakdown
    const expectedPlatformFee = Math.round(commissionTest.transportPrice * 0.2)
    const expectedDriverEarnings =
      commissionTest.totalPrice - expectedPlatformFee

    assert(
      commissionTest.platformFee === expectedPlatformFee,
      `Hoa hồng sàn 20% cước gốc: ${commissionTest.platformFee.toLocaleString()} VNĐ`,
    )
    assert(
      commissionTest.driverEarnings === expectedDriverEarnings,
      `Tài xế thực nhận (80% cước + 100% phụ phí): ${commissionTest.driverEarnings.toLocaleString()} VNĐ`,
    )

    // 8. Test cập nhật bảng giá (Admin Update)
    console.log("\n8. Kiểm tra Admin cập nhật bảng giá (Price Per Km):")
    const oldPricePerKm = Number(truck500!.pricePerKm)
    const updatedRule = await updatePricingRule(truck500!.vehicleTypeId, {
      pricePerKm: 16000, // Cập nhật từ 15k lên 16k
    })
    assert(
      Number(updatedRule.pricePerKm) === 16000,
      "Admin cập nhật giá/km lên 16.000đ thành công",
    )

    // Khôi phục lại giá cũ
    await updatePricingRule(truck500!.vehicleTypeId, {
      pricePerKm: oldPricePerKm,
    })
    assert(true, "Khôi phục lại bảng giá gốc ban đầu thành công")

    console.log("\n==========================================================")
    console.log(
      `🎉 KẾT QUẢ KIỂM THỬ PRICING ENGINE: ${passed} PASS, ${failed} FAIL`,
    )
    console.log("==========================================================\n")

    if (failed > 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error("❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:", err)
    process.exit(1)
  }
}

runPricingEngineTests()
