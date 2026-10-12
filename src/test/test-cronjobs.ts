import { client } from "../db"
import {
  autoBlockLowRatingDrivers,
  autoBackupDatabase,
  getCronSystemStatus,
} from "../lib/cronJobs"
import fs from "node:fs"
import path from "node:path"

async function runTests() {
  console.log(
    "=== BẮT ĐẦU TEST TASK 4.6: CRONJOB KHÓA TÀI XẾ & SAO LƯU DATABASE ===",
  )

  const testPhone = `0988${Math.floor(100000 + Math.random() * 900000)}`
  let testUserId = ""
  let testDriverId = ""
  const createdBookingIds: string[] = []

  try {
    // =========================================================================
    // PHẦN 1: TEST SAO LƯU DATABASE TỰ ĐỘNG
    // =========================================================================
    console.log("\n[TEST 1] Kích hoạt autoBackupDatabase()...")
    const backupDir = path.resolve(process.cwd(), "backups_test")
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // Tạo một file backup cũ giả lập hơn 8 ngày trước để test dọn dẹp
    const oldBackupFile = path.join(
      backupDir,
      "backup_snapshot_2020-01-01_00-00-00.json",
    )
    fs.writeFileSync(oldBackupFile, JSON.stringify({ old: true }))
    const pastTime = Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 ngày trước
    fs.utimesSync(oldBackupFile, pastTime / 1000, pastTime / 1000)

    const backupResult = await autoBackupDatabase(backupDir, 7)
    console.log("-> Kết quả backup:", {
      success: backupResult.success,
      filename: backupResult.filename,
      sizeBytes: backupResult.fileSizeBytes,
      method: backupResult.method,
      cleanedOldFiles: backupResult.cleanedOldFilesCount,
    })

    if (!backupResult.success || backupResult.fileSizeBytes <= 0) {
      throw new Error("File backup sinh ra không hợp lệ")
    }

    // Kiểm tra file cũ đã bị xóa chưa
    if (fs.existsSync(oldBackupFile)) {
      throw new Error("Cơ chế dọn dẹp file cũ không hoạt động")
    }

    console.log(
      "✓ TEST 1 PASSED: Sao lưu Database thành công và cơ chế dọn dẹp file cũ hoạt động chuẩn xác!",
    )

    // =========================================================================
    // PHẦN 2: TEST QUÉT VÀ TỰ ĐỘNG KHÓA TÀI XẾ ĐIỂM THẤP
    // =========================================================================
    console.log(
      "\n[TEST 2] Chuẩn bị dữ liệu tài xế vi phạm điểm số (< 4.0 sao)...",
    )

    // 2.1 Tạo user tài xế test
    const userRows = await client`
      INSERT INTO users (phone, full_name, role, status)
      VALUES (${testPhone}, 'Tài Xế Test Cron Vi Phạm', 'DRIVER', 'ACTIVE')
      RETURNING id
    `
    testUserId = userRows[0].id

    // Lấy 1 vehicle type
    const vtRows = await client`SELECT id FROM vehicle_types LIMIT 1`
    const vehicleTypeId = vtRows[0].id

    // 2.2 Tạo hồ sơ tài xế có rating_avg = 3.6 (< 4.0), is_active = true
    const driverRows = await client`
      INSERT INTO driver_profiles (
        user_id, vehicle_type_id, license_plate, rating_avg, is_active, is_online, kyc_status
      )
      VALUES (
        ${testUserId}::uuid, ${vehicleTypeId}::uuid, ${`51C-TEST${Math.floor(100 + Math.random() * 900)}`},
        3.60, true, true, 'APPROVED'
      )
      RETURNING id
    `
    testDriverId = driverRows[0].id

    // Lấy 1 customer để tạo cuốc
    const custRows =
      await client`SELECT id FROM users WHERE role = 'CUSTOMER' LIMIT 1`
    const customerId = custRows[0].id

    // 2.3 Tạo 5 cuốc COMPLETED cho tài xế này
    for (let i = 1; i <= 5; i++) {
      const code = `BK-CRON-${Date.now()}-${i}`
      const bRows = await client`
        INSERT INTO bookings (
          booking_code, customer_id, driver_id, vehicle_type_id, status,
          origin_address, origin_point, destination_address, destination_point,
          distance_km, base_price, total_price, driver_commission, payment_method, payment_status
        )
        VALUES (
          ${code}, ${customerId}::uuid, ${testDriverId}::uuid, ${vehicleTypeId}::uuid, 'COMPLETED',
          'Điểm A', ST_SetSRID(ST_MakePoint(106.68, 10.77), 4326),
          'Điểm B', ST_SetSRID(ST_MakePoint(106.70, 10.78), 4326),
          5.0, 100000, 100000, 80000, 'CASH', 'PAID'
        )
        RETURNING id
      `
      createdBookingIds.push(bRows[0].id)
    }

    console.log(
      "-> Đã tạo tài xế test ID:",
      testDriverId,
      "với 5 cuốc COMPLETED, Rating = 3.60",
    )

    // 2.4 Thực thi quét tự động khóa
    console.log("-> Thực thi autoBlockLowRatingDrivers(5, 4.0)...")
    const blockResult = await autoBlockLowRatingDrivers(5, 4.0)

    console.log(
      "-> Số tài xế bị khóa trong đợt quét:",
      blockResult.processedCount,
    )
    const targetBlocked = blockResult.blockedDrivers.find(
      (d) => d.driverId === testDriverId,
    )

    if (!targetBlocked) {
      throw new Error("Tài xế vi phạm điểm số không bị khóa như kỳ vọng")
    }

    // 2.5 Kiểm tra trực tiếp trong DB
    const [checkDriver] = await client`
      SELECT is_active, is_online, rejection_reason FROM driver_profiles WHERE id = ${testDriverId}::uuid
    `
    const [checkUser] = await client`
      SELECT status FROM users WHERE id = ${testUserId}::uuid
    `

    console.log("-> Trạng thái hồ sơ sau khi khóa:", {
      driverIsActive: checkDriver.is_active,
      driverIsOnline: checkDriver.is_online,
      userStatus: checkUser.status,
      rejectionReason: checkDriver.rejection_reason,
    })

    if (checkDriver.is_active !== false || checkDriver.is_online !== false) {
      throw new Error(
        "driver_profiles phải có is_active = false và is_online = false",
      )
    }
    if (checkUser.status !== "BLOCKED") {
      throw new Error("users phải có status = 'BLOCKED'")
    }

    console.log(
      "✓ TEST 2 PASSED: Tự động khóa tài xế điểm thấp chính xác tuyệt đối!",
    )

    // =========================================================================
    // PHẦN 3: TEST GET CRON SYSTEM STATUS
    // =========================================================================
    console.log("\n[TEST 3] Gọi getCronSystemStatus()...")
    const cronStatus = getCronSystemStatus()
    console.log("-> Trạng thái hệ thống Cron:", {
      blockLowRating: cronStatus.jobs.blockLowRating,
      databaseBackup: cronStatus.jobs.databaseBackup,
      backupFilesCount: cronStatus.backupFiles.length,
    })

    if (cronStatus.jobs.blockLowRating.lastRunStatus !== "SUCCESS") {
      throw new Error("lastRunStatus của blockLowRating phải là SUCCESS")
    }
    if (cronStatus.jobs.databaseBackup.lastRunStatus !== "SUCCESS") {
      throw new Error("lastRunStatus của databaseBackup phải là SUCCESS")
    }

    console.log(
      "✓ TEST 3 PASSED: Trạng thái CronJob hệ thống hoạt động hoàn hảo!",
    )

    // =========================================================================
    // DỌN DẸP DỮ LIỆU TEST
    // =========================================================================
    console.log("\n[CLEANUP] Dọn dẹp dữ liệu test...")
    if (createdBookingIds.length > 0) {
      await client`DELETE FROM bookings WHERE id = ANY(${createdBookingIds}::uuid[])`
    }
    if (testDriverId) {
      await client`DELETE FROM driver_profiles WHERE id = ${testDriverId}::uuid`
    }
    if (testUserId) {
      await client`DELETE FROM users WHERE id = ${testUserId}::uuid`
    }
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true })
    }
    console.log("✓ Cleanup hoàn tất.")

    console.log("\n=======================================================")
    console.log("🎉 TẤT CẢ CÁC BÀI TEST TASK 4.6 ĐỀU THÀNH CÔNG RỰC RỠ!")
    console.log("=======================================================")
    process.exit(0)
  } catch (err) {
    console.error("❌ TEST THẤT BẠI:", err)
    // Cleanup if error
    try {
      if (createdBookingIds.length > 0) {
        await client`DELETE FROM bookings WHERE id = ANY(${createdBookingIds}::uuid[])`
      }
      if (testDriverId) {
        await client`DELETE FROM driver_profiles WHERE id = ${testDriverId}::uuid`
      }
      if (testUserId) {
        await client`DELETE FROM users WHERE id = ${testUserId}::uuid`
      }
    } catch {}
    process.exit(1)
  }
}

runTests()
