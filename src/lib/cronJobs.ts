import cron from "node-cron"
import fs from "node:fs"
import path from "node:path"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { client } from "../db"
import { triggerEvent } from "./pusher"
import { sendPushNotificationToUser } from "./notificationService"

const execAsync = promisify(exec)

export interface BlockedDriverRecord {
  driverId: string
  userId: string
  driverName: string
  phone: string
  licensePlate: string
  ratingAvg: number
  completedTrips: number
  blockedAt: string
}

export interface BackupResult {
  success: boolean
  filename: string
  filepath: string
  fileSizeBytes: number
  method: "pg_dump" | "json_snapshot"
  timestamp: string
  cleanedOldFilesCount: number
  error?: string
}

export interface CronSystemStatus {
  isRunning: boolean
  jobs: {
    blockLowRating: {
      cronSchedule: string
      lastRunAt: string | null
      lastRunStatus: string
      lastProcessedCount: number
    }
    databaseBackup: {
      cronSchedule: string
      lastRunAt: string | null
      lastRunStatus: string
      lastBackupFile: string | null
    }
  }
  backupFiles: {
    filename: string
    sizeBytes: number
    createdAt: string
  }[]
}

// Lưu trạng thái chạy trong bộ nhớ
const systemStatus: CronSystemStatus = {
  isRunning: false,
  jobs: {
    blockLowRating: {
      cronSchedule: "0 3 * * *", // 03:00 sáng hàng ngày
      lastRunAt: null,
      lastRunStatus: "IDLE",
      lastProcessedCount: 0,
    },
    databaseBackup: {
      cronSchedule: "0 2 * * *", // 02:00 sáng hàng ngày
      lastRunAt: null,
      lastRunStatus: "IDLE",
      lastBackupFile: null,
    },
  },
  backupFiles: [],
}

/**
 * 1. JOB: TỰ ĐỘNG KHÓA TÀI XẾ CÓ ĐIỂM ĐÁNH GIÁ THẤP (< 4.0 SAO VỚI TỐI THIỂU MIN_TRIPS CUỐC)
 */
export async function autoBlockLowRatingDrivers(
  minTrips = 5,
  ratingThreshold = 4.0,
): Promise<{
  processedCount: number
  blockedDrivers: BlockedDriverRecord[]
}> {
  console.log(
    `⏳ [CronJob] Bắt đầu quét tài xế điểm thấp (< ${ratingThreshold} sao, tối thiểu ${minTrips} cuốc)...`,
  )

  systemStatus.jobs.blockLowRating.lastRunAt = new Date().toISOString()
  systemStatus.jobs.blockLowRating.lastRunStatus = "RUNNING"

  try {
    // Tìm các tài xế:
    // - rating_avg < ratingThreshold (và rating_avg > 0)
    // - driver_profiles.is_active = true
    // - Đã hoàn thành ít nhất minTrips cuốc xe
    const candidates = await client`
      SELECT
        dp.id AS driver_id,
        dp.user_id,
        u.full_name AS driver_name,
        u.phone,
        dp.license_plate,
        dp.rating_avg::float AS rating_avg,
        COUNT(b.id)::int AS completed_trips
      FROM driver_profiles dp
      JOIN users u ON dp.user_id = u.id
      LEFT JOIN bookings b ON b.driver_id = dp.id AND b.status = 'COMPLETED'
      WHERE dp.is_active = true
        AND dp.rating_avg IS NOT NULL
        AND dp.rating_avg > 0
        AND dp.rating_avg < ${ratingThreshold}
      GROUP BY dp.id, dp.user_id, u.full_name, u.phone, dp.license_plate, dp.rating_avg
      HAVING COUNT(b.id) >= ${minTrips}
    `

    const blockedDrivers: BlockedDriverRecord[] = []

    for (const d of candidates) {
      const now = new Date().toISOString()
      const reason = `Tài khoản tạm khóa tự động: Điểm đánh giá trung bình ${d.rating_avg} sao dưới chuẩn tối thiểu (${ratingThreshold} sao)`

      // 1. Cập nhật hồ sơ tài xế: is_active = false, is_online = false
      await client`
        UPDATE driver_profiles
        SET 
          is_active = false,
          is_online = false,
          rejection_reason = ${reason},
          updated_at = NOW()
        WHERE id = ${d.driver_id}::uuid
      `

      // 2. Cập nhật tài khoản người dùng: status = 'BLOCKED'
      await client`
        UPDATE users
        SET 
          status = 'BLOCKED',
          updated_at = NOW()
        WHERE id = ${d.user_id}::uuid
      `

      // 3. Gửi thông báo Push Notification tới tài xế
      await sendPushNotificationToUser(d.user_id, {
        title: "⚠️ Tài khoản tài xế bị tạm khóa",
        body: `Điểm đánh giá trung bình của bạn là ${d.rating_avg} sao (dưới ngưỡng ${ratingThreshold} sao). Tài khoản đã tạm thời bị khóa. Vui lòng liên hệ tổng đài để được hỗ trợ đào tạo lại.`,
        data: {
          type: "ACCOUNT_BLOCKED",
          ratingAvg: String(d.rating_avg),
          reason,
        },
      })

      // 4. Bắn sự kiện Pusher thông báo cho Admin Realtime
      await triggerEvent("private-admin", "driver:auto-blocked", {
        driverId: d.driver_id,
        userId: d.user_id,
        driverName: d.driver_name,
        phone: d.phone,
        licensePlate: d.license_plate,
        ratingAvg: d.rating_avg,
        completedTrips: d.completed_trips,
        blockedAt: now,
      })

      blockedDrivers.push({
        driverId: d.driver_id,
        userId: d.user_id,
        driverName: d.driver_name,
        phone: d.phone,
        licensePlate: d.license_plate,
        ratingAvg: d.rating_avg,
        completedTrips: d.completed_trips,
        blockedAt: now,
      })
    }

    systemStatus.jobs.blockLowRating.lastRunStatus = "SUCCESS"
    systemStatus.jobs.blockLowRating.lastProcessedCount = blockedDrivers.length

    console.log(
      `✅ [CronJob] Hoàn tất quét tài xế: Đã khóa ${blockedDrivers.length} tài xế vi phạm điểm số.`,
    )

    return {
      processedCount: blockedDrivers.length,
      blockedDrivers,
    }
  } catch (err: any) {
    systemStatus.jobs.blockLowRating.lastRunStatus = `FAILED: ${err.message}`
    console.error("❌ [CronJob] Lỗi quét tài xế điểm thấp:", err)
    throw err
  }
}

/**
 * 2. JOB: TỰ ĐỘNG SAO LƯU DATABASE HÀNG NGÀY & DỌN DẸP BẢN SAO LƯU CŨ
 */
export async function autoBackupDatabase(
  customDir?: string,
  keepDays = 7,
): Promise<BackupResult> {
  console.log("⏳ [CronJob] Bắt đầu quy trình sao lưu Database tự động...")

  systemStatus.jobs.databaseBackup.lastRunAt = new Date().toISOString()
  systemStatus.jobs.databaseBackup.lastRunStatus = "RUNNING"

  const backupDir = customDir || path.resolve(process.cwd(), "backups")
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/T/, "_")
    .replace(/:/g, "-")
    .split(".")[0]

  const dbUrl = process.env.DATABASE_URL
  let backupFile = ""
  let fileSizeBytes = 0
  let backupMethod: "pg_dump" | "json_snapshot" = "pg_dump"

  try {
    // 2.1 Thử nghiệm pg_dump trước nếu có DATABASE_URL
    let pgDumpSuccess = false
    if (dbUrl) {
      backupFile = path.join(backupDir, `backup_pg_${timestamp}.sql`)
      try {
        // Chạy pg_dump với timeout 60s
        await execAsync(
          `pg_dump "${dbUrl}" --clean --if-exists -f "${backupFile}"`,
          {
            timeout: 60000,
          },
        )

        if (fs.existsSync(backupFile)) {
          const stats = fs.statSync(backupFile)
          if (stats.size > 0) {
            fileSizeBytes = stats.size
            pgDumpSuccess = true
            backupMethod = "pg_dump"
          }
        }
      } catch (dumpErr: any) {
        console.warn(
          "⚠️ [CronJob pg_dump] Không thể chạy pg_dump trực tiếp:",
          dumpErr.message,
          "-> Chuyển sang sao lưu snapshot JSON tự động.",
        )
      }
    }

    // 2.2 Fallback: Snapshot JSON data các bảng quan trọng nếu pg_dump không khả dụng
    if (!pgDumpSuccess) {
      backupMethod = "json_snapshot"
      backupFile = path.join(backupDir, `backup_snapshot_${timestamp}.json`)

      console.log(
        "📦 [CronJob] Đang trích xuất snapshot dữ liệu qua kết nối Client...",
      )
      const [
        usersData,
        driversData,
        vehicleData,
        pricingData,
        bookingsData,
        walletsData,
        walletTxData,
        paymentTxData,
        messagesData,
        callsData,
      ] = await Promise.all([
        client`SELECT * FROM users ORDER BY created_at DESC LIMIT 5000`,
        client`SELECT * FROM driver_profiles ORDER BY created_at DESC LIMIT 5000`,
        client`SELECT * FROM vehicle_types`,
        client`SELECT * FROM pricing_rules`,
        client`SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5000`,
        client`SELECT * FROM wallets`,
        client`SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 10000`,
        client`SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 5000`,
        client`SELECT * FROM booking_messages ORDER BY created_at DESC LIMIT 10000`,
        client`SELECT * FROM call_logs ORDER BY created_at DESC LIMIT 5000`,
      ])

      const snapshot = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: "1.0",
          type: "APP_DAT_XE_TAI_FULL_SNAPSHOT",
        },
        counts: {
          users: usersData.length,
          drivers: driversData.length,
          vehicleTypes: vehicleData.length,
          pricingRules: pricingData.length,
          bookings: bookingsData.length,
          wallets: walletsData.length,
          walletTransactions: walletTxData.length,
          paymentTransactions: paymentTxData.length,
          messages: messagesData.length,
          callLogs: callsData.length,
        },
        tables: {
          users: usersData,
          driverProfiles: driversData,
          vehicleTypes: vehicleData,
          pricingRules: pricingData,
          bookings: bookingsData,
          wallets: walletsData,
          walletTransactions: walletTxData,
          paymentTransactions: paymentTxData,
          bookingMessages: messagesData,
          callLogs: callsData,
        },
      }

      fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), "utf-8")
      const stats = fs.statSync(backupFile)
      fileSizeBytes = stats.size
    }

    // 2.3 Xóa các bản backup cũ quá keepDays ngày
    let cleanedCount = 0
    const now = Date.now()
    const maxAgeMs = keepDays * 24 * 60 * 60 * 1000
    const existingFiles = fs.readdirSync(backupDir)

    for (const f of existingFiles) {
      if (f.startsWith("backup_")) {
        const fullPath = path.join(backupDir, f)
        const fileStat = fs.statSync(fullPath)
        if (now - fileStat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath)
          cleanedCount++
          console.log(`🧹 [CronJob] Đã xóa bản backup cũ quá hạn: ${f}`)
        }
      }
    }

    // Ghi nhật ký vào file log
    const logEntry = `[${new Date().toISOString()}] BACKUP SUCCESS: ${path.basename(backupFile)} (${fileSizeBytes} bytes, method: ${backupMethod}, cleaned: ${cleanedCount} files)\n`
    fs.appendFileSync(path.join(backupDir, "backup_history.log"), logEntry)

    systemStatus.jobs.databaseBackup.lastRunStatus = "SUCCESS"
    systemStatus.jobs.databaseBackup.lastBackupFile = path.basename(backupFile)

    console.log(
      `✅ [CronJob] Sao lưu Database thành công: ${path.basename(backupFile)} (${fileSizeBytes} bytes)`,
    )

    return {
      success: true,
      filename: path.basename(backupFile),
      filepath: backupFile,
      fileSizeBytes,
      method: backupMethod,
      timestamp: new Date().toISOString(),
      cleanedOldFilesCount: cleanedCount,
    }
  } catch (err: any) {
    systemStatus.jobs.databaseBackup.lastRunStatus = `FAILED: ${err.message}`
    console.error("❌ [CronJob] Lỗi sao lưu Database:", err)
    throw err
  }
}

/**
 * 3. LẤY TRẠNG THÁI HỆ THỐNG CRONJOB & DANH SÁCH FILE SAO LƯU
 */
export function getCronSystemStatus(): CronSystemStatus {
  const backupDir = path.resolve(process.cwd(), "backups")
  const backupFiles: {
    filename: string
    sizeBytes: number
    createdAt: string
  }[] = []

  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir)
    for (const f of files) {
      if (f.startsWith("backup_")) {
        const fullPath = path.join(backupDir, f)
        const stats = fs.statSync(fullPath)
        backupFiles.push({
          filename: f,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString(),
        })
      }
    }
  }

  // Sắp xếp file mới nhất lên đầu
  backupFiles.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return {
    ...systemStatus,
    backupFiles,
  }
}

/**
 * 4. KHỞI TẠO TẤT CẢ CRONJOBS CHO SERVER
 */
export function initCronJobs() {
  if (systemStatus.isRunning) {
    console.log("ℹ️ [CronJob] Các lịch trình đã được khởi tạo trước đó.")
    return
  }

  console.log("⏰ [CronJob] Đang đăng ký các lịch trình tác vụ ngầm...")

  // Job 1: Quét khóa tài xế điểm thấp lúc 03:00 sáng mỗi ngày
  cron.schedule(systemStatus.jobs.blockLowRating.cronSchedule, async () => {
    try {
      await autoBlockLowRatingDrivers()
    } catch (err) {
      console.error(
        "❌ [CronJob Schedule] Lỗi khi chạy autoBlockLowRatingDrivers:",
        err,
      )
    }
  })

  // Job 2: Tự động sao lưu Database lúc 02:00 sáng mỗi ngày
  cron.schedule(systemStatus.jobs.databaseBackup.cronSchedule, async () => {
    try {
      await autoBackupDatabase()
    } catch (err) {
      console.error(
        "❌ [CronJob Schedule] Lỗi khi chạy autoBackupDatabase:",
        err,
      )
    }
  })

  systemStatus.isRunning = true
  console.log("🚀 [CronJob] Khởi tạo các lịch trình thành công:")
  console.log("   - Quét tài xế điểm thấp: Mỗi ngày lúc 03:00 sáng (0 3 * * *)")
  console.log(
    "   - Sao lưu Database Neon: Mỗi ngày lúc 02:00 sáng (0 2 * * *)\n",
  )
}
