import { Router } from "express"
import {
  getB2bCustomers,
  getB2bCustomerDetail,
  createB2bCustomer,
  updateB2bCustomer,
  setB2bCustomerStatus,
  recordB2bPayment,
} from "../../lib/b2bService"
import { requireAuth, requireRoles } from "../middleware"

const router = Router()

// /api/admin/b2b/customers ...
// wait, the b2b router is mounted at /api/admin/b2b by admin.ts
// so we need /customers

router.get("/customers", async (req, res, next) => {
  try {
    const search = req.query.search as string | undefined
    const status = req.query.status as string | undefined
    const page = parseInt(req.query.page as string || "1", 10)
    const limit = parseInt(req.query.limit as string || "20", 10)

    const result = await getB2bCustomers({ search, status, page, limit })
    res.json({
      success: true,
      data: result.customers,
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

router.post("/customers", async (req, res, next) => {
  try {
    const created = await createB2bCustomer(req.body)
    res.status(201).json({
      success: true,
      message: "Thêm mới khách hàng doanh nghiệp B2B thành công",
      data: created,
    })
  } catch (err) {
    next(err)
  }
})

router.get("/customers/:id", async (req, res, next) => {
  try {
    const detail = await getB2bCustomerDetail(req.params.id)
    res.json({ success: true, data: detail })
  } catch (err) {
    next(err)
  }
})

router.put("/customers/:id", async (req, res, next) => {
  try {
    const updated = await updateB2bCustomer(req.params.id, req.body)
    res.json({
      success: true,
      message: "Cập nhật thông tin doanh nghiệp thành công",
      data: updated,
    })
  } catch (err) {
    next(err)
  }
})

router.patch("/customers/:id/status", async (req, res, next) => {
  try {
    const result = await setB2bCustomerStatus(req.params.id, req.body.status)
    res.json({ success: true, message: result.message, data: result })
  } catch (err) {
    next(err)
  }
})

router.post("/customers/:id/payment", async (req, res, next) => {
  try {
    const result = await recordB2bPayment(
      req.params.id,
      Number(req.body.amount),
      req.body.note,
    )
    res.json({ success: true, message: result.message, data: result })
  } catch (err) {
    next(err)
  }
})

export default router
