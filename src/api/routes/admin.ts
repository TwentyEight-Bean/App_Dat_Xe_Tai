import { Router } from "express"
import {
  getPendingKycDrivers,
  getDriverKycDetail,
  approveDriverKyc,
  rejectDriverKyc,
  getAllDrivers,
  setDriverActiveStatus,
  getAllUsers,
} from "../../lib/adminService"
import { requireAuth, requireRoles, type AuthRequest } from "../middleware"
import {
  getAllDriverWallets,
  getWalletDetails,
  getWalletTransactions,
  adminAdjustWallet,
} from "../../lib/walletService"
import {
  getCronSystemStatus,
  autoBlockLowRatingDrivers,
  autoBackupDatabase,
} from "../../lib/cronJobs"
import pricingRouter from "./pricing_admin"
import b2bRouter from "./b2b"

const router = Router()

router.use(requireAuth, requireRoles(["ADMIN"]))

router.get("/users", async (req, res, next) => {
  try {
    const allUsers = await getAllUsers()
    res.json({ success: true, data: allUsers })
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
 * Admin điều chỉnh số dư ví (Nạp, Thưởng, Phạt, Hoàn tiền)
 */
router.post("/wallets/:userId/adjust", async (req: AuthRequest, res, next) => {
  try {
    const { amount, type, description, referenceCode } = req.body
    const result = await adminAdjustWallet({
      targetUserId: req.params.userId as string,
      amount: Number(amount),
      type: type || "ADMIN_ADJUSTMENT",
      description,
      referenceCode,
      adminUserId: req.user!.userId,
    })

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
  "/admin/cron/trigger-block-drivers",
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

router.use("/pricing", pricingRouter)
router.use("/b2b", b2bRouter)

export default router
