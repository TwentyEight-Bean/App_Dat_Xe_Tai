import ExcelJS from "exceljs"
import { client } from "../db"
import { ApiError } from "./errors"

export interface AccountingFilter {
  startDate?: string
  endDate?: string
  paymentMethod?: string
  vehicleTypeId?: string
  driverId?: string
  status?: string
}

export interface AccountingSummary {
  grossRevenue: number
  platformCommission: number
  driverNetEarnings: number
  totalTrips: number
  completedTrips: number
  cancelledTrips: number
  activeTrips: number
  pendingTrips: number
  completionRate: number
  averageTripValue: number
  averageDistanceKm: number
}

export interface PaymentMethodStats {
  method: string
  totalTrips: number
  totalRevenue: number
  commission: number
  percentage: number
}

export interface VehicleTypeStats {
  vehicleTypeId: string
  vehicleCode: string
  vehicleName: string
  completedTrips: number
  revenue: number
  percentage: number
}

export interface DailyTrendStats {
  date: string
  completedTrips: number
  cancelledTrips: number
  revenue: number
  commission: number
}

export interface TopDriverStats {
  driverId: string
  driverName: string
  driverPhone: string
  licensePlate: string
  ratingAvg: number
  completedTrips: number
  grossRevenue: number
  driverEarnings: number
  commissionPaid: number
}

export interface WalletAccountingStats {
  totalDriverBalance: number
  totalTopupInPeriod: number
  totalCommissionDeductedInPeriod: number
}

export interface AccountingDashboardData {
  timeRange: {
    startDate: string
    endDate: string
  }
  summary: AccountingSummary
  byPaymentMethod: PaymentMethodStats[]
  byVehicleType: VehicleTypeStats[]
  dailyTrend: DailyTrendStats[]
  topDrivers: TopDriverStats[]
  walletStats: WalletAccountingStats
}

/**
 * Xử lý khoảng thời gian lọc mặc định: 30 ngày gần nhất
 */
function resolveDateRange(startDate?: string, endDate?: string) {
  const end = endDate ? new Date(endDate) : new Date()
  if (!endDate) {
    end.setHours(23, 59, 59, 999)
  }

  const start = startDate ? new Date(startDate) : new Date()
  if (!startDate) {
    start.setDate(end.getDate() - 30)
    start.setHours(0, 0, 0, 0)
  }

  return {
    startStr: start.toISOString(),
    endStr: end.toISOString(),
    displayStart: start.toISOString().split("T")[0],
    displayEnd: end.toISOString().split("T")[0],
  }
}

/**
 * 1. Lấy dữ liệu thống kê Dashboard Kế toán
 */
export async function getAccountingDashboard(
  filters: AccountingFilter = {},
): Promise<AccountingDashboardData> {
  const { startStr, endStr, displayStart, displayEnd } = resolveDateRange(
    filters.startDate,
    filters.endDate,
  )

  // 1.1 Thống kê tổng hợp số chuyến theo trạng thái trong kỳ
  const tripCountRows = await client`
    SELECT
      COUNT(*)::int AS total_trips,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed_trips,
      COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::int AS cancelled_trips,
      COUNT(CASE WHEN status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT') THEN 1 END)::int AS active_trips,
      COUNT(CASE WHEN status IN ('PENDING', 'SEARCHING') THEN 1 END)::int AS pending_trips,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_price ELSE 0 END), 0)::float AS gross_revenue,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN (total_price - driver_commission) ELSE 0 END), 0)::float AS commission_calc,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN driver_commission ELSE 0 END), 0)::float AS driver_earnings,
      COALESCE(AVG(CASE WHEN status = 'COMPLETED' THEN distance_km END), 0)::float AS avg_distance
    FROM bookings
    WHERE created_at >= ${startStr}::timestamptz 
      AND created_at <= ${endStr}::timestamptz
      ${
        filters.paymentMethod
          ? client`AND payment_method = ${filters.paymentMethod}`
          : client``
      }
      ${
        filters.vehicleTypeId
          ? client`AND vehicle_type_id = ${filters.vehicleTypeId}`
          : client``
      }
      ${
        filters.driverId
          ? client`AND driver_id = ${filters.driverId}`
          : client``
      }
  `

  const tripCounts = tripCountRows[0] || {
    total_trips: 0,
    completed_trips: 0,
    cancelled_trips: 0,
    active_trips: 0,
    pending_trips: 0,
    gross_revenue: 0,
    commission_calc: 0,
    driver_earnings: 0,
    avg_distance: 0,
  }

  const totalTrips = Number(tripCounts.total_trips) || 0
  const completedTrips = Number(tripCounts.completed_trips) || 0
  const cancelledTrips = Number(tripCounts.cancelled_trips) || 0
  const activeTrips = Number(tripCounts.active_trips) || 0
  const pendingTrips = Number(tripCounts.pending_trips) || 0
  const grossRevenue = Number(tripCounts.gross_revenue) || 0
  const platformCommission = Number(tripCounts.commission_calc) || 0
  const driverNetEarnings = Number(tripCounts.driver_earnings) || 0
  const averageDistanceKm =
    Math.round((Number(tripCounts.avg_distance) || 0) * 10) / 10
  const completionRate =
    totalTrips > 0 ? Math.round((completedTrips / totalTrips) * 1000) / 10 : 0
  const averageTripValue =
    completedTrips > 0 ? Math.round(grossRevenue / completedTrips) : 0

  // 1.2 Thống kê theo phương thức thanh toán (chỉ tính cuốc COMPLETED)
  const paymentRows = await client`
    SELECT
      payment_method,
      COUNT(*)::int AS trips,
      COALESCE(SUM(total_price), 0)::float AS revenue,
      COALESCE(SUM(total_price - driver_commission), 0)::float AS commission
    FROM bookings
    WHERE status = 'COMPLETED'
      AND created_at >= ${startStr}::timestamptz 
      AND created_at <= ${endStr}::timestamptz
      ${
        filters.vehicleTypeId
          ? client`AND vehicle_type_id = ${filters.vehicleTypeId}`
          : client``
      }
      ${
        filters.driverId
          ? client`AND driver_id = ${filters.driverId}`
          : client``
      }
    GROUP BY payment_method
    ORDER BY revenue DESC
  `

  const byPaymentMethod: PaymentMethodStats[] = paymentRows.map((r) => {
    const rev = Number(r.revenue) || 0
    return {
      method: r.payment_method,
      totalTrips: Number(r.trips) || 0,
      totalRevenue: rev,
      commission: Number(r.commission) || 0,
      percentage:
        grossRevenue > 0 ? Math.round((rev / grossRevenue) * 1000) / 10 : 0,
    }
  })

  // 1.3 Thống kê theo loại xe tải
  const vehicleRows = await client`
    SELECT
      vt.id AS vehicle_type_id,
      vt.code AS vehicle_code,
      vt.name AS vehicle_name,
      COUNT(b.id)::int AS completed_trips,
      COALESCE(SUM(b.total_price), 0)::float AS revenue
    FROM vehicle_types vt
    LEFT JOIN bookings b ON b.vehicle_type_id = vt.id 
      AND b.status = 'COMPLETED'
      AND b.created_at >= ${startStr}::timestamptz 
      AND b.created_at <= ${endStr}::timestamptz
      ${
        filters.paymentMethod
          ? client`AND b.payment_method = ${filters.paymentMethod}`
          : client``
      }
      ${
        filters.driverId
          ? client`AND b.driver_id = ${filters.driverId}`
          : client``
      }
    GROUP BY vt.id, vt.code, vt.name
    ORDER BY revenue DESC
  `

  const byVehicleType: VehicleTypeStats[] = vehicleRows.map((r) => {
    const rev = Number(r.revenue) || 0
    return {
      vehicleTypeId: r.vehicle_type_id,
      vehicleCode: r.vehicle_code,
      vehicleName: r.vehicle_name,
      completedTrips: Number(r.completed_trips) || 0,
      revenue: rev,
      percentage:
        grossRevenue > 0 ? Math.round((rev / grossRevenue) * 1000) / 10 : 0,
    }
  })

  // 1.4 Xu hướng theo ngày (Daily trend)
  const dailyRows = await client`
    SELECT
      TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS trip_date,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed_trips,
      COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::int AS cancelled_trips,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_price ELSE 0 END), 0)::float AS revenue,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN (total_price - driver_commission) ELSE 0 END), 0)::float AS commission
    FROM bookings
    WHERE created_at >= ${startStr}::timestamptz 
      AND created_at <= ${endStr}::timestamptz
      ${
        filters.paymentMethod
          ? client`AND payment_method = ${filters.paymentMethod}`
          : client``
      }
      ${
        filters.vehicleTypeId
          ? client`AND vehicle_type_id = ${filters.vehicleTypeId}`
          : client``
      }
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY DATE_TRUNC('day', created_at) ASC
  `

  const dailyTrend: DailyTrendStats[] = dailyRows.map((r) => ({
    date: r.trip_date,
    completedTrips: Number(r.completed_trips) || 0,
    cancelledTrips: Number(r.cancelled_trips) || 0,
    revenue: Number(r.revenue) || 0,
    commission: Number(r.commission) || 0,
  }))

  // 1.5 Top 10 Tài xế có doanh thu cao nhất
  const topDriverRows = await client`
    SELECT
      dp.id AS driver_id,
      u.full_name AS driver_name,
      u.phone AS driver_phone,
      dp.license_plate,
      dp.rating_avg,
      COUNT(b.id)::int AS completed_trips,
      COALESCE(SUM(b.total_price), 0)::float AS gross_revenue,
      COALESCE(SUM(b.driver_commission), 0)::float AS driver_earnings,
      COALESCE(SUM(b.total_price - b.driver_commission), 0)::float AS commission_paid
    FROM driver_profiles dp
    JOIN users u ON dp.user_id = u.id
    LEFT JOIN bookings b ON b.driver_id = dp.id 
      AND b.status = 'COMPLETED'
      AND b.created_at >= ${startStr}::timestamptz 
      AND b.created_at <= ${endStr}::timestamptz
    GROUP BY dp.id, u.full_name, u.phone, dp.license_plate, dp.rating_avg
    HAVING COUNT(b.id) > 0
    ORDER BY gross_revenue DESC
    LIMIT 10
  `

  const topDrivers: TopDriverStats[] = topDriverRows.map((r) => ({
    driverId: r.driver_id,
    driverName: r.driver_name || "Tài xế",
    driverPhone: r.driver_phone,
    licensePlate: r.license_plate || "Chưa cập nhật",
    ratingAvg: Number(r.rating_avg || 5.0),
    completedTrips: Number(r.completed_trips) || 0,
    grossRevenue: Number(r.gross_revenue) || 0,
    driverEarnings: Number(r.driver_earnings) || 0,
    commissionPaid: Number(r.commission_paid) || 0,
  }))

  // 1.6 Thống kê ví tài xế và giao dịch ví trong kỳ
  const walletRows = await client`
    SELECT
      COALESCE(SUM(w.balance), 0)::float AS total_balance
    FROM wallets w
    JOIN users u ON w.user_id = u.id
    WHERE u.role = 'DRIVER'
  `

  const walletTxRows = await client`
    SELECT
      COALESCE(SUM(CASE WHEN type IN ('TOPUP', 'VNPAY_TOPUP', 'MOMO_TOPUP') THEN amount ELSE 0 END), 0)::float AS total_topup,
      COALESCE(SUM(CASE WHEN type = 'COMMISSION_DEDUCTION' THEN ABS(amount) ELSE 0 END), 0)::float AS total_commission
    FROM wallet_transactions
    WHERE created_at >= ${startStr}::timestamptz 
      AND created_at <= ${endStr}::timestamptz
  `

  const walletStats: WalletAccountingStats = {
    totalDriverBalance: Number(walletRows[0]?.total_balance) || 0,
    totalTopupInPeriod: Number(walletTxRows[0]?.total_topup) || 0,
    totalCommissionDeductedInPeriod:
      Number(walletTxRows[0]?.total_commission) || 0,
  }

  return {
    timeRange: {
      startDate: displayStart,
      endDate: displayEnd,
    },
    summary: {
      grossRevenue,
      platformCommission,
      driverNetEarnings,
      totalTrips,
      completedTrips,
      cancelledTrips,
      activeTrips,
      pendingTrips,
      completionRate,
      averageTripValue,
      averageDistanceKm,
    },
    byPaymentMethod,
    byVehicleType,
    dailyTrend,
    topDrivers,
    walletStats,
  }
}

/**
 * 2. Xuất file Excel báo cáo Kế toán (.xlsx)
 */
export async function exportAccountingExcel(
  filters: AccountingFilter = {},
): Promise<Buffer> {
  const { startStr, endStr, displayStart, displayEnd } = resolveDateRange(
    filters.startDate,
    filters.endDate,
  )

  // Lấy dữ liệu tổng quan
  const dashboardData = await getAccountingDashboard(filters)

  // Lấy danh sách chi tiết tất cả các chuyến xe trong kỳ
  const tripDetails = await client`
    SELECT
      b.id,
      b.booking_code,
      b.created_at,
      b.updated_at,
      b.status,
      b.payment_method,
      b.payment_status,
      b.distance_km::float,
      b.base_price::float,
      b.surcharge_price::float,
      b.total_price::float,
      b.driver_commission::float,
      (b.total_price - b.driver_commission)::float AS platform_commission,
      b.origin_address,
      b.destination_address,
      cu.full_name AS customer_name,
      cu.phone AS customer_phone,
      du.full_name AS driver_name,
      du.phone AS driver_phone,
      dp.license_plate,
      vt.name AS vehicle_name
    FROM bookings b
    JOIN users cu ON b.customer_id = cu.id
    LEFT JOIN driver_profiles dp ON b.driver_id = dp.id
    LEFT JOIN users du ON dp.user_id = du.id
    LEFT JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
    WHERE b.created_at >= ${startStr}::timestamptz 
      AND b.created_at <= ${endStr}::timestamptz
      ${filters.status ? client`AND b.status = ${filters.status}` : client``}
      ${
        filters.paymentMethod
          ? client`AND b.payment_method = ${filters.paymentMethod}`
          : client``
      }
      ${
        filters.vehicleTypeId
          ? client`AND b.vehicle_type_id = ${filters.vehicleTypeId}`
          : client``
      }
    ORDER BY b.created_at DESC
  `

  // Lấy chi tiết lịch sử giao dịch ví trong kỳ
  const walletTransactions = await client`
    SELECT
      wt.id,
      wt.type,
      wt.amount::float,
      wt.balance_before::float,
      wt.balance_after::float,
      wt.description,
      wt.reference_code,
      wt.created_at,
      u.full_name AS user_name,
      u.phone AS user_phone,
      b.booking_code
    FROM wallet_transactions wt
    JOIN wallets w ON wt.wallet_id = w.id
    JOIN users u ON w.user_id = u.id
    LEFT JOIN bookings b ON wt.booking_id = b.id
    WHERE wt.created_at >= ${startStr}::timestamptz 
      AND wt.created_at <= ${endStr}::timestamptz
    ORDER BY wt.created_at DESC
    LIMIT 2000
  `

  // Tạo Excel Workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Hệ thống App Đặt Xe Tải"
  workbook.created = new Date()

  // Định dạng màu và font
  const navyHeaderFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" }, // Dark Navy Blue
  }
  const goldHeaderFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD97706" }, // Amber/Gold
  }
  const headerFont: Partial<ExcelJS.Font> = {
    name: "Arial",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  }
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  }

  // =========================================================================
  // SHEET 1: TỔNG QUAN BÁO CÁO (Overview)
  // =========================================================================
  const sheet1 = workbook.addWorksheet("Tổng quan Doanh thu", {
    views: [{ showGridLines: true }],
  })

  // Title
  sheet1.mergeCells("A2:F2")
  const titleCell = sheet1.getCell("A2")
  titleCell.value = "BÁO CÁO KẾ TOÁN & DOANH THU HỆ THỐNG VẬN TẢI"
  titleCell.font = {
    name: "Arial",
    size: 16,
    bold: true,
    color: { argb: "FF1E3A8A" },
  }
  titleCell.alignment = { horizontal: "center", vertical: "middle" }
  sheet1.getRow(2).height = 32

  // Subtitle / Date range
  sheet1.mergeCells("A3:F3")
  const subCell = sheet1.getCell("A3")
  subCell.value = `Kỳ báo cáo: Từ ngày ${displayStart} đến ngày ${displayEnd} | Xuất lúc: ${new Date().toLocaleString("vi-VN")}`
  subCell.font = {
    name: "Arial",
    size: 11,
    italic: true,
    color: { argb: "FF4B5563" },
  }
  subCell.alignment = { horizontal: "center", vertical: "middle" }
  sheet1.getRow(3).height = 20

  // 1.1 Bảng KPIs Tài chính
  sheet1.getCell("A5").value = "1. CHỈ SỐ TÀI CHÍNH TỔNG QUAN"
  sheet1.getCell("A5").font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FF111827" },
  }

  sheet1.getRow(6).values = [
    "STT",
    "Chỉ số tài chính",
    "Giá trị",
    "Đơn vị",
    "Ghi chú",
  ]
  sheet1.getRow(6).height = 24
  for (let c = 1; c <= 5; c++) {
    const cell = sheet1.getRow(6).getCell(c)
    cell.fill = navyHeaderFill
    cell.font = headerFont
    cell.alignment = { horizontal: "center", vertical: "middle" }
  }

  const kpiData = [
    [
      1,
      "Tổng Doanh thu Gộp (Gross Revenue)",
      dashboardData.summary.grossRevenue,
      "VNĐ",
      "Tính trên các chuyến hoàn thành",
    ],
    [
      2,
      "Tổng Hoa hồng Sàn thu được (Platform Commission 20%)",
      dashboardData.summary.platformCommission,
      "VNĐ",
      "Doanh thu thực tế của nền tảng",
    ],
    [
      3,
      "Tổng Thu nhập Tài xế đối tác (Driver Net 80%)",
      dashboardData.summary.driverNetEarnings,
      "VNĐ",
      "Chi trả cho đối tác tài xế",
    ],
    [
      4,
      "Tổng số chuyến xe phát sinh",
      dashboardData.summary.totalTrips,
      "Chuyến",
      "Bao gồm tất cả trạng thái",
    ],
    [
      5,
      "Số chuyến xe hoàn thành",
      dashboardData.summary.completedTrips,
      "Chuyến",
      "Hoàn tất giao nhận",
    ],
    [
      6,
      "Số chuyến xe bị hủy",
      dashboardData.summary.cancelledTrips,
      "Chuyến",
      "Khách hoặc tài xế hủy",
    ],
    [
      7,
      "Tỷ lệ hoàn thành chuyến",
      dashboardData.summary.completionRate / 100,
      "%",
      "Completed / Total trips",
    ],
    [
      8,
      "Giá trị trung bình mỗi chuyến (AOV)",
      dashboardData.summary.averageTripValue,
      "VNĐ",
      "Gross / Completed trips",
    ],
    [
      9,
      "Khoảng cách trung bình mỗi chuyến",
      dashboardData.summary.averageDistanceKm,
      "km",
      "Quãng đường vận chuyển",
    ],
    [
      10,
      "Tổng số dư ví ký quỹ tài xế hiện có",
      dashboardData.walletStats.totalDriverBalance,
      "VNĐ",
      "Tiền cọc trong ví tài xế",
    ],
    [
      11,
      "Tổng tiền tài xế nạp ví trong kỳ",
      dashboardData.walletStats.totalTopupInPeriod,
      "VNĐ",
      "Top-up qua MoMo, VNPay, Chuyển khoản",
    ],
    [
      12,
      "Tổng hoa hồng đã trừ qua ví",
      dashboardData.walletStats.totalCommissionDeductedInPeriod,
      "VNĐ",
      "Thu cấn trừ tự động",
    ],
  ]

  let currentRow = 7
  for (const row of kpiData) {
    const r = sheet1.getRow(currentRow)
    r.values = row
    r.height = 20
    r.getCell(1).alignment = { horizontal: "center" }
    r.getCell(2).alignment = { horizontal: "left" }
    r.getCell(3).alignment = { horizontal: "right" }
    r.getCell(4).alignment = { horizontal: "center" }
    r.getCell(5).alignment = { horizontal: "left" }

    // Format tiền tệ & số
    if (row[3] === "VNĐ") {
      r.getCell(3).numFmt = '#,##0 "₫"'
    } else if (row[3] === "%") {
      r.getCell(3).numFmt = "0.0%"
    } else {
      r.getCell(3).numFmt = "#,##0"
    }

    for (let c = 1; c <= 5; c++) {
      r.getCell(c).border = thinBorder
    }
    currentRow++
  }

  // 1.2 Bảng Doanh thu theo phương thức thanh toán
  currentRow += 2
  sheet1.getCell(`A${currentRow}`).value =
    "2. PHÂN BỔ THEO PHƯƠNG THỨC THANH TOÁN"
  sheet1.getCell(`A${currentRow}`).font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FF111827" },
  }
  currentRow++

  sheet1.getRow(currentRow).values = [
    "Phương thức thanh toán",
    "Số chuyến hoàn thành",
    "Tổng doanh thu",
    "Hoa hồng sàn 20%",
    "Tỷ trọng (%)",
  ]
  sheet1.getRow(currentRow).height = 24
  for (let c = 1; c <= 5; c++) {
    const cell = sheet1.getRow(currentRow).getCell(c)
    cell.fill = goldHeaderFill
    cell.font = headerFont
    cell.alignment = { horizontal: "center", vertical: "middle" }
  }
  currentRow++

  for (const pm of dashboardData.byPaymentMethod) {
    const r = sheet1.getRow(currentRow)
    const methodNames: Record<string, string> = {
      CASH: "Tiền mặt (CASH)",
      WALLET: "Ví tài khoản (WALLET)",
      VNPAY: "Cổng thanh toán VNPay",
      MOMO: "Ví điện tử MoMo",
    }
    r.values = [
      methodNames[pm.method] || pm.method,
      pm.totalTrips,
      pm.totalRevenue,
      pm.commission,
      pm.percentage / 100,
    ]
    r.height = 20
    r.getCell(1).alignment = { horizontal: "left" }
    r.getCell(2).alignment = { horizontal: "right" }
    r.getCell(3).alignment = { horizontal: "right" }
    r.getCell(4).alignment = { horizontal: "right" }
    r.getCell(5).alignment = { horizontal: "right" }

    r.getCell(2).numFmt = "#,##0"
    r.getCell(3).numFmt = '#,##0 "₫"'
    r.getCell(4).numFmt = '#,##0 "₫"'
    r.getCell(5).numFmt = "0.0%"

    for (let c = 1; c <= 5; c++) {
      r.getCell(c).border = thinBorder
    }
    currentRow++
  }

  // 1.3 Bảng Doanh thu theo loại xe tải
  currentRow += 2
  sheet1.getCell(`A${currentRow}`).value = "3. DOANH THU THEO TỪNG LOẠI XE TẢI"
  sheet1.getCell(`A${currentRow}`).font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FF111827" },
  }
  currentRow++

  sheet1.getRow(currentRow).values = [
    "Mã xe",
    "Tên loại xe tải",
    "Số chuyến hoàn thành",
    "Doanh thu đạt được",
    "Tỷ trọng đóng góp",
  ]
  sheet1.getRow(currentRow).height = 24
  for (let c = 1; c <= 5; c++) {
    const cell = sheet1.getRow(currentRow).getCell(c)
    cell.fill = navyHeaderFill
    cell.font = headerFont
    cell.alignment = { horizontal: "center", vertical: "middle" }
  }
  currentRow++

  for (const vt of dashboardData.byVehicleType) {
    const r = sheet1.getRow(currentRow)
    r.values = [
      vt.vehicleCode,
      vt.vehicleName,
      vt.completedTrips,
      vt.revenue,
      vt.percentage / 100,
    ]
    r.height = 20
    r.getCell(1).alignment = { horizontal: "center" }
    r.getCell(2).alignment = { horizontal: "left" }
    r.getCell(3).alignment = { horizontal: "right" }
    r.getCell(4).alignment = { horizontal: "right" }
    r.getCell(5).alignment = { horizontal: "right" }

    r.getCell(3).numFmt = "#,##0"
    r.getCell(4).numFmt = '#,##0 "₫"'
    r.getCell(5).numFmt = "0.0%"

    for (let c = 1; c <= 5; c++) {
      r.getCell(c).border = thinBorder
    }
    currentRow++
  }

  // Đặt độ rộng các cột sheet 1
  sheet1.getColumn(1).width = 18
  sheet1.getColumn(2).width = 46
  sheet1.getColumn(3).width = 24
  sheet1.getColumn(4).width = 22
  sheet1.getColumn(5).width = 35
  sheet1.getColumn(6).width = 20

  // =========================================================================
  // SHEET 2: CHI TIẾT CÁC CHUYẾN XE (Trips Detail)
  // =========================================================================
  const sheet2 = workbook.addWorksheet("Danh sách Chuyến xe", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: true }],
  })

  // Sheet 2 Title
  sheet2.mergeCells("A1:U1")
  const s2Title = sheet2.getCell("A1")
  s2Title.value = `BẢNG KÊ CHI TIẾT CHUYẾN XE (${displayStart} ĐẾN ${displayEnd})`
  s2Title.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FF1E3A8A" },
  }
  s2Title.alignment = { horizontal: "center", vertical: "middle" }
  sheet2.getRow(1).height = 28

  // Header row
  const s2Headers = [
    "STT",
    "Mã chuyến",
    "Thời gian tạo",
    "Trạng thái chuyến",
    "Tên khách hàng",
    "SĐT khách",
    "Tài xế nhận",
    "SĐT tài xế",
    "Biển số xe",
    "Loại xe",
    "Điểm đón (Origin)",
    "Điểm trả (Destination)",
    "Khoảng cách (km)",
    "Cước cơ bản (VNĐ)",
    "Phụ phí (VNĐ)",
    "Tổng tiền cước (VNĐ)",
    "Hoa hồng sàn 20% (VNĐ)",
    "Tài xế thực nhận 80% (VNĐ)",
    "Phương thức TT",
    "Trạng thái TT",
  ]
  sheet2.getRow(3).values = s2Headers
  sheet2.getRow(3).height = 26

  for (let c = 1; c <= s2Headers.length; c++) {
    const cell = sheet2.getRow(3).getCell(c)
    cell.fill = navyHeaderFill
    cell.font = headerFont
    cell.alignment = { horizontal: "center", vertical: "middle" }
  }

  let tripRowIdx = 4
  let totalGrossSum = 0
  let totalCommSum = 0
  let totalDriverSum = 0

  for (let i = 0; i < tripDetails.length; i++) {
    const t = tripDetails[i]
    const row = sheet2.getRow(tripRowIdx)

    const gross = Number(t.total_price) || 0
    const comm = Number(t.platform_commission) || 0
    const driverEarn = Number(t.driver_commission) || 0

    if (t.status === "COMPLETED") {
      totalGrossSum += gross
      totalCommSum += comm
      totalDriverSum += driverEarn
    }

    const createdAtStr = t.created_at
      ? new Date(t.created_at).toLocaleString("vi-VN")
      : ""

    row.values = [
      i + 1,
      t.booking_code,
      createdAtStr,
      t.status,
      t.customer_name || "Khách hàng",
      t.customer_phone,
      t.driver_name || "Chưa có",
      t.driver_phone || "",
      t.license_plate || "",
      t.vehicle_name || "",
      t.origin_address,
      t.destination_address,
      Number(t.distance_km) || 0,
      Number(t.base_price) || 0,
      Number(t.surcharge_price) || 0,
      gross,
      comm,
      driverEarn,
      t.payment_method,
      t.payment_status,
    ]
    row.height = 20

    row.getCell(1).alignment = { horizontal: "center" }
    row.getCell(2).alignment = { horizontal: "center" }
    row.getCell(3).alignment = { horizontal: "center" }
    row.getCell(4).alignment = { horizontal: "center" }
    row.getCell(6).alignment = { horizontal: "center" }
    row.getCell(8).alignment = { horizontal: "center" }
    row.getCell(9).alignment = { horizontal: "center" }
    row.getCell(13).alignment = { horizontal: "right" }
    row.getCell(14).alignment = { horizontal: "right" }
    row.getCell(15).alignment = { horizontal: "right" }
    row.getCell(16).alignment = { horizontal: "right" }
    row.getCell(17).alignment = { horizontal: "right" }
    row.getCell(18).alignment = { horizontal: "right" }
    row.getCell(19).alignment = { horizontal: "center" }
    row.getCell(20).alignment = { horizontal: "center" }

    row.getCell(13).numFmt = "0.0"
    row.getCell(14).numFmt = '#,##0 "₫"'
    row.getCell(15).numFmt = '#,##0 "₫"'
    row.getCell(16).numFmt = '#,##0 "₫"'
    row.getCell(17).numFmt = '#,##0 "₫"'
    row.getCell(18).numFmt = '#,##0 "₫"'

    for (let c = 1; c <= s2Headers.length; c++) {
      row.getCell(c).border = thinBorder
    }
    tripRowIdx++
  }

  // Row tổng cộng cuốc xe
  const totalRow = sheet2.getRow(tripRowIdx)
  totalRow.getCell(1).value = ""
  totalRow.getCell(2).value = "TỔNG CỘNG HOÀN THÀNH"
  totalRow.getCell(16).value = totalGrossSum
  totalRow.getCell(17).value = totalCommSum
  totalRow.getCell(18).value = totalDriverSum
  totalRow.height = 24
  totalRow.font = { name: "Arial", size: 11, bold: true }

  totalRow.getCell(16).numFmt = '#,##0 "₫"'
  totalRow.getCell(17).numFmt = '#,##0 "₫"'
  totalRow.getCell(18).numFmt = '#,##0 "₫"'

  for (let c = 1; c <= s2Headers.length; c++) {
    totalRow.getCell(c).border = thinBorder
    totalRow.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    }
  }

  // Đặt độ rộng các cột sheet 2
  sheet2.getColumn(1).width = 6
  sheet2.getColumn(2).width = 16
  sheet2.getColumn(3).width = 20
  sheet2.getColumn(4).width = 16
  sheet2.getColumn(5).width = 22
  sheet2.getColumn(6).width = 14
  sheet2.getColumn(7).width = 22
  sheet2.getColumn(8).width = 14
  sheet2.getColumn(9).width = 15
  sheet2.getColumn(10).width = 16
  sheet2.getColumn(11).width = 30
  sheet2.getColumn(12).width = 30
  sheet2.getColumn(13).width = 14
  sheet2.getColumn(14).width = 16
  sheet2.getColumn(15).width = 14
  sheet2.getColumn(16).width = 18
  sheet2.getColumn(17).width = 18
  sheet2.getColumn(18).width = 18
  sheet2.getColumn(19).width = 16
  sheet2.getColumn(20).width = 16

  // =========================================================================
  // SHEET 3: LỊCH SỬ GIAO DỊCH VÍ & CỔNG THANH TOÁN (Wallet Transactions)
  // =========================================================================
  const sheet3 = workbook.addWorksheet("Giao dịch Ví & Cổng TT", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: true }],
  })

  sheet3.mergeCells("A1:J1")
  const s3Title = sheet3.getCell("A1")
  s3Title.value = `NHẬT KÝ GIAO DỊCH VÍ & CỔNG THANH TOÁN (${displayStart} ĐẾN ${displayEnd})`
  s3Title.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FF1E3A8A" },
  }
  s3Title.alignment = { horizontal: "center", vertical: "middle" }
  sheet3.getRow(1).height = 28

  const s3Headers = [
    "STT",
    "Thời gian",
    "Tên người dùng",
    "Số điện thoại",
    "Loại giao dịch",
    "Số tiền (VNĐ)",
    "Số dư trước",
    "Số dư sau",
    "Mã cuốc liên quan",
    "Nội dung diễn giải",
  ]
  sheet3.getRow(3).values = s3Headers
  sheet3.getRow(3).height = 26

  for (let c = 1; c <= s3Headers.length; c++) {
    const cell = sheet3.getRow(3).getCell(c)
    cell.fill = navyHeaderFill
    cell.font = headerFont
    cell.alignment = { horizontal: "center", vertical: "middle" }
  }

  let txRowIdx = 4
  for (let i = 0; i < walletTransactions.length; i++) {
    const tx = walletTransactions[i]
    const row = sheet3.getRow(txRowIdx)

    const createdAtStr = tx.created_at
      ? new Date(tx.created_at).toLocaleString("vi-VN")
      : ""

    row.values = [
      i + 1,
      createdAtStr,
      tx.user_name || "Người dùng",
      tx.user_phone,
      tx.type,
      Number(tx.amount) || 0,
      Number(tx.balance_before) || 0,
      Number(tx.balance_after) || 0,
      tx.booking_code || "",
      tx.description || "",
    ]
    row.height = 20

    row.getCell(1).alignment = { horizontal: "center" }
    row.getCell(2).alignment = { horizontal: "center" }
    row.getCell(4).alignment = { horizontal: "center" }
    row.getCell(5).alignment = { horizontal: "center" }
    row.getCell(6).alignment = { horizontal: "right" }
    row.getCell(7).alignment = { horizontal: "right" }
    row.getCell(8).alignment = { horizontal: "right" }
    row.getCell(9).alignment = { horizontal: "center" }

    row.getCell(6).numFmt = '#,##0 "₫"'
    row.getCell(7).numFmt = '#,##0 "₫"'
    row.getCell(8).numFmt = '#,##0 "₫"'

    for (let c = 1; c <= s3Headers.length; c++) {
      row.getCell(c).border = thinBorder
    }
    txRowIdx++
  }

  sheet3.getColumn(1).width = 6
  sheet3.getColumn(2).width = 20
  sheet3.getColumn(3).width = 22
  sheet3.getColumn(4).width = 16
  sheet3.getColumn(5).width = 22
  sheet3.getColumn(6).width = 18
  sheet3.getColumn(7).width = 18
  sheet3.getColumn(8).width = 18
  sheet3.getColumn(9).width = 18
  sheet3.getColumn(10).width = 40

  // Xuất ra Buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
