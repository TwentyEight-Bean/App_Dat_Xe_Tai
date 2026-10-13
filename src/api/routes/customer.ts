import { Router } from "express"

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

export default router
