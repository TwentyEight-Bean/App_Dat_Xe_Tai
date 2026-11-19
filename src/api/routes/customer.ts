import { Router } from "express"
import { eq, desc, and, sql } from "drizzle-orm"
import { db } from "../../db"
import { notifications, complaints } from "../../db/schema"

import {
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from "../../lib/addressService"

import {
  getWalletDetails,
  getWalletTransactions,
  topUpWallet,
} from "../../lib/walletService"

import { requireAuth, requireRoles, type AuthRequest } from "../middleware"

const router = Router()

router.use(requireAuth, requireRoles(["CUSTOMER", "ADMIN"]))

/**
 * GET /customer/wallet
 * Lấy thông tin chi tiết ví của khách hàng (Số dư khả dụng, hạn mức)
 */

router.get("/wallet", async (req: AuthRequest, res, next) => {
  try {
    const wallet = await getWalletDetails(req.user!.userId)

    res.json({
      success: true,

      data: wallet,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /customer/wallet/topup
 * Nạp tiền vào ví khách hàng (thanh toán cước xe hoặc trả nợ phạt hủy chuyến)
 */
router.post("/wallet/topup", async (req: AuthRequest, res, next) => {
  try {
    const { amount, description, referenceCode } = req.body

    const result = await topUpWallet({
      userId: req.user!.userId,
      amount: Number(amount),
      description:
        description ||
        `Khách hàng nạp ${Number(amount).toLocaleString("vi-VN")} đ vào ví`,
      referenceCode,
      performedByUserId: req.user!.userId,
    })

    res.json({
      success: true,
      message: result.message,
      data: result.wallet,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /customer/wallet/transactions
 * Lấy lịch sử biến động số dư ví khách hàng (Nạp tiền MoMo/VNPay, trả cước)
 */

router.get("/wallet/transactions", async (req: AuthRequest, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1

    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20

    const type = req.query.type ? String(req.query.type) : undefined

    const result = await getWalletTransactions(req.user!.userId, {
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

router.get("/addresses", async (req: AuthRequest, res, next) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined

    const result = await getCustomerAddresses(req.user!.userId, { page, limit })

    if (page !== undefined || limit !== undefined) {
      const paginated = result as { addresses: any[]; pagination: any }
      res.json({
        success: true,
        data: paginated.addresses,
        pagination: paginated.pagination,
      })
    } else {
      res.json({ success: true, data: result })
    }
  } catch (err) {
    next(err)
  }
})

router.post("/addresses", async (req: AuthRequest, res, next) => {
  try {
    const newAddress = await createCustomerAddress(req.user!.userId, req.body)

    res.status(201).json({
      success: true,

      message: "Thêm địa chỉ vào sổ thành công",

      data: newAddress,
    })
  } catch (err) {
    next(err)
  }
})

router.patch("/addresses/:id/default", async (req: AuthRequest, res, next) => {
  try {
    const updated = await setDefaultCustomerAddress(
      req.user!.userId,

      req.params.id as string,
    )

    res.json({
      success: true,

      message: "Đã đặt làm địa chỉ mặc định",

      data: updated,
    })
  } catch (err) {
    next(err)
  }
})

router.put("/addresses/:id", async (req: AuthRequest, res, next) => {
  try {
    const updated = await updateCustomerAddress(
      req.user!.userId,

      req.params.id as string,

      req.body,
    )

    res.json({
      success: true,

      message: "Cập nhật địa chỉ thành công",

      data: updated,
    })
  } catch (err) {
    next(err)
  }
})

router.delete("/addresses/:id", async (req: AuthRequest, res, next) => {
  try {
    const result = await deleteCustomerAddress(
      req.user!.userId,

      req.params.id as string,
    )

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/customer/notifications — Lấy danh sách thông báo
router.get("/notifications", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50)
    return res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/customer/notifications/read-all — Đánh dấu tất cả đã đọc
router.patch("/notifications/read-all", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, req.user!.userId),
          eq(notifications.isRead, false),
        ),
      )
    return res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/customer/notifications/unread-count — Số thông báo chưa đọc
router.get("/notifications/unread-count", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, req.user!.userId),
          eq(notifications.isRead, false),
        ),
      )
    return res.json({ success: true, count: result[0]?.count || 0 })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/customer/complaints — Gửi khiếu nại mới
router.post("/complaints", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { bookingId, driverId, category, description, estimatedLoss, proofImageUrls } = req.body
    if (!category || !description?.trim()) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn danh mục và mô tả chi tiết sự cố." })
    }

    const isValidUuid = (id?: any): boolean =>
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    const [complaint] = await db.insert(complaints).values({
      userId: req.user!.userId,
      bookingId: isValidUuid(bookingId) ? bookingId : null,
      driverId: isValidUuid(driverId) ? driverId : null,
      category,
      description: description.trim(),
      estimatedLoss: estimatedLoss || null,
      proofImageUrls: Array.isArray(proofImageUrls) ? proofImageUrls : (proofImageUrls ? [proofImageUrls] : []),
    }).returning()
    return res.json({ success: true, data: complaint })
  } catch (err) { next(err) }
})

// GET /api/v1/customer/complaints — Lịch sử khiếu nại của khách
router.get("/complaints", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const result = await db.select().from(complaints)
      .where(eq(complaints.userId, req.user!.userId))
      .orderBy(desc(complaints.createdAt))
      .limit(50)
    return res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

export default router
