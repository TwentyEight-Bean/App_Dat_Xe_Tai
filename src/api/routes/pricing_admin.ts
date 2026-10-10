import { Router } from "express"
import {
  updatePricingRule,
  createPricingRule,
  createSurchargeService,
  updateSurchargeService,
  getSurchargeServices,
} from "../../lib/pricingService"

const router = Router()

router.patch("/rules/:id", async (req, res, next) => {
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
})

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

router.patch("/surcharges/:code", async (req, res, next) => {
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
})

export default router
