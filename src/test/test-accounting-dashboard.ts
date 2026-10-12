import {
  getAccountingDashboard,
  exportAccountingExcel,
} from "../lib/accountingService"
import ExcelJS from "exceljs"

async function runTests() {
  console.log(
    "=== BẮT ĐẦU TEST TASK 4.5: DASHBOARD KẾ TOÁN & XUẤT FILE EXCEL ===",
  )

  try {
    // 1. Test getAccountingDashboard với thời gian mặc định
    console.log("\n[TEST 1] Gọi getAccountingDashboard()...")
    const dashboard = await getAccountingDashboard()

    console.log("-> Khoảng thời gian:", dashboard.timeRange)
    console.log("-> Chỉ số KPIs tổng quan:", {
      grossRevenue: dashboard.summary.grossRevenue,
      platformCommission: dashboard.summary.platformCommission,
      driverNetEarnings: dashboard.summary.driverNetEarnings,
      totalTrips: dashboard.summary.totalTrips,
      completedTrips: dashboard.summary.completedTrips,
      cancelledTrips: dashboard.summary.cancelledTrips,
      completionRate: `${dashboard.summary.completionRate}%`,
      averageTripValue: dashboard.summary.averageTripValue,
    })

    if (typeof dashboard.summary.grossRevenue !== "number") {
      throw new Error("grossRevenue phải là số")
    }
    if (typeof dashboard.summary.platformCommission !== "number") {
      throw new Error("platformCommission phải là số")
    }
    console.log("✓ TEST 1 PASSED: Dữ liệu KPIs tổng quan hợp lệ.")

    // 2. Test thống kê phân loại
    console.log("\n[TEST 2] Kiểm tra phân bổ phương thức TT & Loại xe...")
    console.log(
      "-> Số phương thức TT có phát sinh:",
      dashboard.byPaymentMethod.length,
    )
    console.log(
      "-> Số loại xe tải trong hệ thống:",
      dashboard.byVehicleType.length,
    )
    console.log("-> Số ngày có dữ liệu:", dashboard.dailyTrend.length)
    console.log("-> Top tài xế:", dashboard.topDrivers.length)
    console.log("-> Dòng tiền ví tài xế:", dashboard.walletStats)

    if (!Array.isArray(dashboard.byPaymentMethod)) {
      throw new Error("byPaymentMethod phải là mảng")
    }
    if (!Array.isArray(dashboard.byVehicleType)) {
      throw new Error("byVehicleType phải là mảng")
    }
    console.log("✓ TEST 2 PASSED: Các mảng thống kê chi tiết hợp lệ.")

    // 3. Test xuất file Excel
    console.log("\n[TEST 3] Gọi exportAccountingExcel()...")
    const excelBuffer = await exportAccountingExcel()

    console.log(
      "-> Dung lượng file Excel sinh ra:",
      excelBuffer.length,
      "bytes",
    )
    if (excelBuffer.length < 2000) {
      throw new Error("File Excel sinh ra quá nhỏ (< 2000 bytes)")
    }

    // 4. Kiểm tra cấu trúc file Excel bằng cách load lại vào workbook
    console.log(
      "\n[TEST 4] Đọc lại Workbook từ Buffer để verify cấu trúc sheets...",
    )
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(excelBuffer as any)

    const sheetNames = workbook.worksheets.map((ws) => ws.name)
    console.log("-> Các sheets có trong file Excel:", sheetNames)

    const expectedSheets = [
      "Tổng quan Doanh thu",
      "Danh sách Chuyến xe",
      "Giao dịch Ví & Cổng TT",
    ]

    for (const name of expectedSheets) {
      if (!sheetNames.includes(name)) {
        throw new Error(`Thiếu sheet '${name}' trong file Excel`)
      }
    }

    const s1 = workbook.getWorksheet("Tổng quan Doanh thu")
    const titleValue = s1?.getCell("A2").value
    console.log("-> Sheet 1 Tiêu đề:", titleValue)

    const s2 = workbook.getWorksheet("Danh sách Chuyến xe")
    console.log("-> Sheet 2 Số dòng dữ liệu:", s2?.rowCount)

    const s3 = workbook.getWorksheet("Giao dịch Ví & Cổng TT")
    console.log("-> Sheet 3 Số dòng dữ liệu:", s3?.rowCount)

    console.log(
      "✓ TEST 3 & 4 PASSED: File Excel hợp lệ với đầy đủ 3 sheets chuyên nghiệp!",
    )

    console.log("\n=======================================================")
    console.log("🎉 TẤT CẢ CÁC BÀI TEST TASK 4.5 ĐỀU THÀNH CÔNG RỰC RỠ!")
    console.log("=======================================================")
    process.exit(0)
  } catch (err) {
    console.error("❌ TEST THẤT BẠI:", err)
    process.exit(1)
  }
}

runTests()
