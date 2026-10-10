import { Router } from "express"
import {
  createBooking,
  getBookingById,
  getCustomerBookings,
  cancelBooking,
} from "../../lib/bookingService"
import { requireAuth, type AuthRequest } from "../middleware"

import { estimateBookingPrice } from "../../lib/pricingService"

const router = Router()

/**
 * POST /api/v1/bookings/estimate
 * Ước tính cước phí chuyến xe trước khi đặt (Public/Auth)
 */
router.post("/estimate", async (req, res, next) => {
  try {
    const result = await estimateBookingPrice(req.body)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// Tất cả các thao tác đặt chuyến còn lại yêu cầu đăng nhập
router.use(requireAuth)

/**
 * POST /api/v1/bookings
 * Tạo chuyến xe mới -> Tự động tìm tài xế lân cận bằng PostGIS -> Bắn sự kiện Pusher nổ cuốc
 */
router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const result = await createBooking(req.user!.userId, req.body)
    res.status(201).json({
      success: true,
      message: "Đặt xe thành công, đang tìm tài xế gần nhất",
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/bookings/:id
 * Lấy chi tiết chuyến xe (Khách hàng / Tài xế xem sau khi nhận tín hiệu Pusher)
 */
router.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const booking = await getBookingById(req.params.id as string)
    res.json({
      success: true,
      data: booking,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/bookings/:id/track
 * Khách hàng theo dõi vị trí live của tài xế và trạng thái chuyến xe
 */
router.get("/:id/track", async (req: AuthRequest, res, next) => {
  try {
    const booking = await getBookingById(req.params.id as string)
    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        origin: booking.origin,
        destination: booking.destination,
        distanceKm: booking.distanceKm,
        driver: booking.driver
          ? {
              id: booking.driver.id,
              name: booking.driver.name,
              phone: booking.driver.phone,
              avatarUrl: booking.driver.avatarUrl,
              licensePlate: booking.driver.licensePlate,
              vehicleTypeName: booking.driver.vehicleTypeName,
              currentLocation: booking.driver.currentLocation,
            }
          : null,
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/v1/bookings
 * Lịch sử danh sách chuyến đi của khách hàng
 */
router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const list = await getCustomerBookings(req.user!.userId)
    res.json({
      success: true,
      count: list.length,
      data: list,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/bookings/:id/cancel
 * Khách hàng hủy chuyến xe (trước khi hàng đang được vận chuyển)
 */
router.post("/:id/cancel", async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body
    const result = await cancelBooking(
      req.user!.userId,
      req.params.id as string,
      reason,
    )
    res.json({
      success: true,
      message: result.message,
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

export default router
