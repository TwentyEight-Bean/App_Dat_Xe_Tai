import { Router } from "express"
import {
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from "../../lib/addressService"
import { requireAuth, requireRoles, type AuthRequest } from "../middleware"

const router = Router()

router.use(requireAuth, requireRoles(["CUSTOMER", "ADMIN"]))

router.get("/addresses", async (req: AuthRequest, res, next) => {
  try {
    const addresses = await getCustomerAddresses(req.user!.userId)
    res.json({ success: true, data: addresses })
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
      req.params.id,
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
      req.params.id,
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
    const result = await deleteCustomerAddress(req.user!.userId, req.params.id)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
