import { Router } from "express"
import { requireAuth, requireRoles, type AuthRequest } from "../middleware"
import {
  getAccountingDashboard,
  exportAccountingExcel,
  type AccountingFilter,
} from "../../lib/accountingService"

const router = Router()

// Bắt buộc xác thực và yêu cầu quyền ADMIN
router.use(requireAuth, requireRoles(["ADMIN"]))

/**
 * GET /accounting/dashboard
 * Lấy dữ liệu thống kê KPIs doanh thu, số chuyến, hoa hồng, phương thức TT, xu hướng ngày
 */
router.get("/dashboard", async (req: AuthRequest, res, next) => {
  try {
    const filters: AccountingFilter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      paymentMethod: req.query.paymentMethod as string,
      vehicleTypeId: req.query.vehicleTypeId as string,
      driverId: req.query.driverId as string,
    }

    const data = await getAccountingDashboard(filters)
    res.json({
      success: true,
      data,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /accounting/export-excel
 * Xuất file Excel báo cáo kế toán tài chính chi tiết
 */
router.get("/export-excel", async (req: AuthRequest, res, next) => {
  try {
    const filters: AccountingFilter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      paymentMethod: req.query.paymentMethod as string,
      vehicleTypeId: req.query.vehicleTypeId as string,
      status: req.query.status as string,
    }

    const excelBuffer = await exportAccountingExcel(filters)

    const dateTag = new Date().toISOString().split("T")[0]
    const filename = `Bao_Cao_Ke_Toan_${dateTag}.xlsx`

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.setHeader("Content-Length", excelBuffer.length)

    res.send(excelBuffer)
  } catch (err) {
    next(err)
  }
})

export default router
