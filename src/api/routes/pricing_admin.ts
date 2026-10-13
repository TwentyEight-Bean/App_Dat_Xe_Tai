import { Router } from "express"

import {
  getPricingRules,
  updatePricingRule,
  createPricingRule,
  createSurchargeService,
  updateSurchargeService,
  getSurchargeServices,
} from "../../lib/pricingService"

const router = Router()

/**
 * GET /admin/pricing/rules
 * Lấy danh sách toàn bộ bảng giá các loại xe (OpenAPI & Postman spec)
 */
router.get("/rules", async (req, res, next) => {
  try {
    const rules = await getPricingRules()
    res.json({ success: true, data: rules })
  } catch (err) {
    next(err)
  }
})

const handleUpdateRule = async (req: any, res: any, next: any) => {
  try {
    const updated = await updatePricingRule(req.params.id, req.body)
    res.json({
      success: true,
      message: "Cập nhật bảng giá loại xe thành công",
      data: updated,
    })
  } catch (err) {
    next(err)
  }
}

router.patch("/rules/:id", handleUpdateRule)
router.put("/rules/:id", handleUpdateRule)

router.post("/rules", async (req, res, next) => {
  try {
    const created = await createPricingRule(req.body)

    res.status(201).json({
      success: true,

      message: "Thiết lập bảng giá loại xe thành công",

      data: created,
    })
  } catch (err) {
    next(err)
  }
})

router.get("/surcharges", async (req, res, next) => {
  try {
    const services = await getSurchargeServices()

    res.json({ success: true, data: services })
  } catch (err) {
    next(err)
  }
})

router.post("/surcharges", async (req, res, next) => {
  try {
    const created = await createSurchargeService(req.body)

    res.status(201).json({
      success: true,

      message: "Thêm mới phụ phí thành công",

      data: created,
    })
  } catch (err) {
    next(err)
  }
})

const handleUpdateSurcharge = async (req: any, res: any, next: any) => {
  try {
    const updated = await updateSurchargeService(req.params.code, req.body)
    res.json({
      success: true,
      message: "Cập nhật phụ phí thành công",
      data: updated,
    })
  } catch (err) {
    next(err)
  }
}

router.patch("/surcharges/:code", handleUpdateSurcharge)
router.put("/surcharges/:code", handleUpdateSurcharge)

export default router
