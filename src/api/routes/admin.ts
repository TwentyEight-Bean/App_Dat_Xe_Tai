import { Router } from "express"
import { eq, desc } from "drizzle-orm"
import { db } from "../../db"
import { complaints, users } from "../../db/schema"

import {
  getPendingKycDrivers,
  getDriverKycDetail,
  approveDriverKyc,
  rejectDriverKyc,
  getAllDrivers,
  setDriverActiveStatus,
  getAllUsers,
  setUserStatus,
  getDashboardSummary,
  getAdminBookings,
  adminCancelBooking,
  adminAssignDriver,
  adminRefundBooking,
  getAllDriverRatings,
} from "../../lib/adminService"

import { requireAuth, requireRoles, type AuthRequest } from "../middleware"

import {
  getAllDriverWallets,
  getWalletDetails,
  getWalletTransactions,
  adminAdjustWallet,
} from "../../lib/walletService"

import {
  getPendingTopUpRequests,
  adminApproveTopUpRequest,
  adminRejectTopUpRequest,
} from "../../lib/paymentService"

import {
  getCronSystemStatus,
  autoBlockLowRatingDrivers,
  autoBackupDatabase,
} from "../../lib/cronJobs"

import pricingRouter from "./pricing_admin"

import b2bRouter from "./b2b"

const router = Router()

router.use(requireAuth, requireRoles(["ADMIN"]))

/**
 * GET /api/v1/admin/ratings
 * Lấy danh sách toàn bộ đánh giá của tài xế từ khách hàng kèm bộ lọc và thống kê
 */
router.get("/ratings", async (req, res, next) => {
  try {
    const rating = req.query.rating ? parseInt(req.query.rating as string, 10) : undefined
    const driverId = req.query.driverId as string | undefined
    const search = req.query.search as string | undefined
    const page = parseInt((req.query.page as string) || "1", 10)
    const limit = parseInt((req.query.limit as string) || "20", 10)

    const result = await getAllDriverRatings({
      rating,
      driverId,
      search,
      page,
      limit,
    })

    res.json({
      success: true,
      data: result.ratings,
      summary: result.summary,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.get("/dashboard/summary", async (req, res, next) => {
  try {
    const summary = await getDashboardSummary()
    res.json({ success: true, data: summary })
  } catch (err) {
    next(err)
  }
})

router.get("/users", async (req, res, next) => {
  try {
    const allUsers = await getAllUsers()

    res.json({ success: true, data: allUsers })
  } catch (err) {
    next(err)
  }
})

router.patch("/users/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body
    const updated = await setUserStatus(req.params.id as string, status)
    res.json({
      success: true,
      message:
        status === "BLOCKED"
          ? "Đã tạm khóa tài khoản khách hàng"
          : "Đã mở khóa tài khoản khách hàng",
      data: updated,
    })
  } catch (err) {
    next(err)
  }
})

router.get("/drivers/kyc-pending", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string || "1", 10)

    const limit = parseInt(req.query.limit as string || "20", 10)

    const result = await getPendingKycDrivers(page, limit)

    res.json({
      success: true,

      data: result.drivers,

      pagination: {
        page: result.page,

        limit: result.limit,

        total: result.total,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.patch("/drivers/:id/kyc", async (req, res, next) => {
  try {
    if (req.body.action === "approve") {
      const result = await approveDriverKyc(req.params.id)

      res.json({ success: true, data: result })
    } else if (req.body.action === "reject") {
      const result = await rejectDriverKyc(req.params.id, req.body.reason)

      res.json({ success: true, data: result })
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid action (must be approve or reject)",
      })
    }
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/drivers/:id/kyc/approve
 * Phê duyệt hồ sơ tài xế (OpenAPI & Postman spec)
 */
router.post("/drivers/:id/kyc/approve", async (req, res, next) => {
  try {
    const result = await approveDriverKyc(req.params.id)
    res.json({
      success: true,
      message: "Phê duyệt hồ sơ tài xế thành công",
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/drivers/:id/kyc/reject
 * Từ chối hồ sơ tài xế kèm lý do (OpenAPI & Postman spec)
 */
router.post("/drivers/:id/kyc/reject", async (req, res, next) => {
  try {
    const result = await rejectDriverKyc(req.params.id, req.body?.reason)
    res.json({
      success: true,
      message: "Đã từ chối hồ sơ tài xế",
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

router.patch("/drivers/:id/status", async (req, res, next) => {
  try {
    const result = await setDriverActiveStatus(
      req.params.id,

      Boolean(req.body.isActive),
    )

    res.json({ success: true, message: result.message, data: result })
  } catch (err) {
    next(err)
  }
})

router.get("/drivers/:id", async (req, res, next) => {
  try {
    const detail = await getDriverKycDetail(req.params.id)

    res.json({ success: true, data: detail })
  } catch (err) {
    next(err)
  }
})

router.get("/drivers", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string || "1", 10)

    const limit = parseInt(req.query.limit as string || "20", 10)

    const kycStatus = req.query.kycStatus as string || undefined

    const isOnlineParam = req.query.isOnline

    const isOnline =
      isOnlineParam !== undefined ? isOnlineParam === "true" : undefined

    const search = req.query.search as string || undefined

    const result = await getAllDrivers({
      page,

      limit,

      kycStatus,

      isOnline,

      search,
    })

    res.json({
      success: true,

      data: result.drivers,

      pagination: {
        page: result.page,

        limit: result.limit,

        total: result.total,
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /admin/wallets
 * Admin xem danh sách ví của tất cả tài xế kèm số dư và trạng thái ký quỹ
 */

router.get("/wallets", async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20

    const search = req.query.search ? String(req.query.search) : undefined

    const result = await getAllDriverWallets({ page, limit, search })

    res.json({
      success: true,

      ...result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /admin/wallets/topup-requests
 * Lấy danh sách các yêu cầu nạp tiền VietQR đang chờ Admin xác minh và phê duyệt
 */
router.get("/wallets/topup-requests", async (req: AuthRequest, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined
    const search = req.query.search ? String(req.query.search) : undefined
    const result = await getPendingTopUpRequests({ status, search })
    res.json({
      success: true,
      ...result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/wallets/topup-requests/:id/approve
 * Admin xác nhận đã nhận được tiền sao kê -> Duyệt nạp tiền vào ví tài xế
 */
router.post("/wallets/topup-requests/:id/approve", async (req: AuthRequest, res, next) => {
  try {
    const result = await adminApproveTopUpRequest(req.params.id as string, req.user!.userId)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/wallets/topup-requests/:id/reject
 * Admin từ chối yêu cầu nạp tiền (chưa nhận được tiền hoặc sai nội dung)
 */
router.post("/wallets/topup-requests/:id/reject", async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body
    const result = await adminRejectTopUpRequest(req.params.id as string, req.user!.userId, reason)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /admin/wallets/:userId
 * Admin xem chi tiết ví người dùng
 */

router.get("/wallets/:userId", async (req, res, next) => {
  try {
    const details = await getWalletDetails(req.params.userId)

    res.json({
      success: true,

      data: details,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /admin/wallets/:userId/transactions
 * Admin xem lịch sử giao dịch ví người dùng
 */

router.get("/wallets/:userId/transactions", async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20

    const type = req.query.type ? String(req.query.type) : undefined

    const result = await getWalletTransactions(req.params.userId, {
      page,

      limit,

      type,
    })

    res.json({
      success: true,

      ...result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/wallets/:userId/adjust
 */
// Idempotency cache chống gửi trùng lặp điều chỉnh số dư trong 5 phút
const walletAdjustIdempotencyCache = new Map<string, { result: any; expiresAt: number }>()

function cleanExpiredIdempotency() {
  const now = Date.now()
  for (const [key, val] of walletAdjustIdempotencyCache.entries()) {
    if (val.expiresAt < now) walletAdjustIdempotencyCache.delete(key)
  }
}

/**
 * POST /admin/wallets/:userId/adjust
 * Admin điều chỉnh số dư ví (Nạp, Thưởng, Phạt, Hoàn tiền) - Có bảo vệ Idempotency
 */
router.post("/wallets/:userId/adjust", async (req: AuthRequest, res, next) => {
  try {
    const { amount, type, description, referenceCode, idempotencyKey } = req.body

    cleanExpiredIdempotency()

    // Nếu đã xử lý khóa này trong 5 phút, trả về ngay kết quả trước đó
    if (idempotencyKey && walletAdjustIdempotencyCache.has(idempotencyKey)) {
      const cached = walletAdjustIdempotencyCache.get(idempotencyKey)!
      return res.json({
        success: true,
        message: "(Yêu cầu trùng lặp - Đã hoàn tất trước đó) " + cached.result.message,
        data: cached.result,
      })
    }

    const result = await adminAdjustWallet({
      targetUserId: req.params.userId as string,
      amount: Number(amount),
      type: type || "ADMIN_ADJUSTMENT",
      description,
      referenceCode,
      adminUserId: req.user!.userId,
    })

    if (idempotencyKey) {
      walletAdjustIdempotencyCache.set(idempotencyKey, {
        result,
        expiresAt: Date.now() + 5 * 60 * 1000,
      })
    }

    res.json({
      success: true,
      message: result.message,
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /admin/cron/status
 * Xem trạng thái các tác vụ định kỳ và danh sách file sao lưu Database
 */

router.get("/cron/status", async (req: AuthRequest, res, next) => {
  try {
    const status = getCronSystemStatus()

    res.json({
      success: true,

      data: status,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/cron/trigger-block-drivers
 * Kích hoạt ngay lập tức tác vụ quét và tự động khóa tài xế điểm thấp
 */

router.post(
  "/cron/trigger-block-drivers",

  async (req: AuthRequest, res, next) => {
    try {
      const minTrips = req.body.minTrips ? Number(req.body.minTrips) : 5

      const ratingThreshold = req.body.ratingThreshold
        ? Number(req.body.ratingThreshold)
        : 4.0

      const result = await autoBlockLowRatingDrivers(minTrips, ratingThreshold)

      res.json({
        success: true,

        message: `Đã quét và khóa ${result.processedCount} tài xế vi phạm điểm số.`,

        data: result,
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * POST /admin/cron/trigger-backup
 * Kích hoạt ngay lập tức tác vụ sao lưu Database Neon
 */

router.post("/cron/trigger-backup", async (req: AuthRequest, res, next) => {
  try {
    const keepDays = req.body.keepDays ? Number(req.body.keepDays) : 7

    const result = await autoBackupDatabase(undefined, keepDays)

    res.json({
      success: true,

      message: "Sao lưu Database thành công.",

      data: result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /admin/bookings
 * Lấy danh sách toàn bộ đơn hàng thực tế trong CSDL
 */
router.get("/bookings", async (req, res, next) => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10)
    const limit = parseInt((req.query.limit as string) || "20", 10)
    const status = req.query.status as string | undefined
    const search = req.query.search as string | undefined
    const vehicle = req.query.vehicle as string | undefined

    const result = await getAdminBookings({ page, limit, status, search, vehicle })
    res.json({
      success: true,
      data: result.bookings,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/bookings/:id/cancel
 * Admin hủy đơn hàng (bắt buộc nhập lý do)
 */
router.post("/bookings/:id/cancel", async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body
    const updated = await adminCancelBooking(req.params.id as string, reason)
    res.json({
      success: true,
      message: `Đã hủy đơn ${updated.bookingCode}`,
      data: updated,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/bookings/:id/assign-driver
 * Admin gán / điều phối tài xế thủ công cho đơn đang chờ
 */
router.post("/bookings/:id/assign-driver", async (req: AuthRequest, res, next) => {
  try {
    const { driverId } = req.body
    const updated = await adminAssignDriver(req.params.id as string, driverId)
    res.json({
      success: true,
      message: `Đã điều phối tài xế cho đơn ${updated.bookingCode}`,
      data: updated,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /admin/bookings/:id/refund
 * Admin hoàn tiền vào ví khách hàng cho đơn đã thanh toán
 */
router.post("/bookings/:id/refund", async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body
    const updated = await adminRefundBooking(
      req.params.id as string,
      reason,
      req.user!.userId,
    )
    res.json({
      success: true,
      message: `Đã hoàn tiền cho đơn ${updated.bookingCode}`,
      data: updated,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/admin/complaints — Danh sách khiếu nại (Admin)
 */
router.get("/complaints", requireAuth, requireRoles(["ADMIN"]), async (req, res, next) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as Record<string, string>
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10)
    let query = db.select({
      complaint: complaints,
      userName: users.fullName,
      userPhone: users.phone,
    }).from(complaints)
      .leftJoin(users, eq(complaints.userId, users.id))

    if (status) {
      let dbStatus = status
      if (status === "Mới") dbStatus = "PENDING"
      else if (status === "Đang xử lý") dbStatus = "PROCESSING"
      else if (status === "Đã giải quyết") dbStatus = "RESOLVED"
      else if (status === "Từ chối") dbStatus = "REJECTED"
      query = query.where(eq(complaints.status, dbStatus as any)) as any
    }

    const result = await query
      .orderBy(desc(complaints.createdAt))
      .limit(parseInt(limit, 10))
      .offset(offset)

    return res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

/**
 * PATCH /api/v1/admin/complaints/:id — Cập nhật trạng thái khiếu nại
 */
router.patch("/complaints/:id", requireAuth, requireRoles(["ADMIN"]), async (req, res, next) => {
  try {
    const complaintId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!complaintId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(complaintId)) {
      return res.status(400).json({ success: false, message: "ID khiếu nại không hợp lệ" })
    }
    const { status, adminNotes } = req.body
    const updateData: any = { updatedAt: new Date() }
    if (status) {
      let dbStatus = status
      if (status === "Mới") dbStatus = "PENDING"
      else if (status === "Đang xử lý") dbStatus = "PROCESSING"
      else if (status === "Đã giải quyết") dbStatus = "RESOLVED"
      else if (status === "Từ chối") dbStatus = "REJECTED"
      updateData.status = dbStatus
      if (dbStatus === "RESOLVED") updateData.resolvedAt = new Date()
    }
    if (adminNotes) updateData.adminNotes = adminNotes

    const [updated] = await db.update(complaints)
      .set(updateData)
      .where(eq(complaints.id, complaintId))
      .returning()

    if (!updated) return res.status(404).json({ success: false, message: "Khiếu nại không tồn tại" })
    return res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

router.use("/pricing", pricingRouter)

router.use("/b2b", b2bRouter)

export default router
