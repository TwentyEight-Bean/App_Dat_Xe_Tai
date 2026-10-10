import { Router } from "express"
import {
  getVehicleTypes,
  getDriverProfile,
  submitDriverKyc,
  getDriverKycStatus,
  setDriverOnlineStatus,
  getOrCreateDriverProfile,
} from "../../lib/driverService"
import {
  findNearbyDrivers,
  updateDriverLocation,
  getDriverLocation,
} from "../../lib/dispatchService"
import {
  acceptBooking,
  updateBookingStatus,
  cancelBooking,
  getDriverActiveBooking,
} from "../../lib/bookingService"
import { requireAuth, requireRoles, type AuthRequest } from "../middleware"

const router = Router()

router.get("/vehicle-types", async (req, res, next) => {
  try {
    const types = await getVehicleTypes()
    res.json({ success: true, data: types })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /driver/nearby
 * Tìm kiếm danh sách tài xế đang online trong bán kính (mặc định 3-5km)
 * Phục vụ hiển thị xe trên bản đồ khách hàng hoặc điều phối hệ thống
 */
router.get("/nearby", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat || req.query.latitude)
    const lng = Number(req.query.lng || req.query.longitude)
    const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : undefined
    const radiusMeters = req.query.radiusMeters
      ? Number(req.query.radiusMeters)
      : undefined
    const vehicleTypeId = req.query.vehicleTypeId
      ? String(req.query.vehicleTypeId)
      : undefined
    const limit = req.query.limit ? Number(req.query.limit) : 10

    const drivers = await findNearbyDrivers({
      originLat: lat,
      originLng: lng,
      radiusKm,
      radiusMeters,
      vehicleTypeId,
      limit,
    })

    res.json({
      success: true,
      count: drivers.length,
      data: drivers,
    })
  } catch (err) {
    next(err)
  }
})

router.use(requireAuth, requireRoles(["DRIVER", "ADMIN"]))

router.get("/profile", async (req: AuthRequest, res, next) => {
  try {
    const profile = await getDriverProfile(req.user!.userId)
    res.json({ success: true, data: profile })
  } catch (err) {
    next(err)
  }
})

router.get("/kyc/status", async (req: AuthRequest, res, next) => {
  try {
    const status = await getDriverKycStatus(req.user!.userId)
    res.json({ success: true, data: status })
  } catch (err) {
    next(err)
  }
})

router.post("/kyc/submit", async (req: AuthRequest, res, next) => {
  try {
    const updatedProfile = await submitDriverKyc(req.user!.userId, req.body)
    res.json({
      success: true,
      message:
        "Nộp hồ sơ KYC thành công. Vui lòng chờ quản trị viên xét duyệt.",
      data: updatedProfile,
    })
  } catch (err) {
    next(err)
  }
})

router.patch("/status", async (req: AuthRequest, res, next) => {
  try {
    const result = await setDriverOnlineStatus(
      req.user!.userId,
      Boolean(req.body.isOnline),
    )
    res.json({ success: true, message: result.message, data: result })
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /driver/location
 * Cập nhật vị trí GPS realtime của tài xế vào PostGIS driver_locations
 */
router.put("/location", async (req: AuthRequest, res, next) => {
  try {
    const profile = await getOrCreateDriverProfile(req.user!.userId)
    const lat = req.body.lat !== undefined ? req.body.lat : req.body.latitude
    const lng = req.body.lng !== undefined ? req.body.lng : req.body.longitude
    const heading = req.body.heading
    const speed = req.body.speed

    const location = await updateDriverLocation(profile.id, {
      lat,
      lng,
      heading,
      speed,
    })

    res.json({
      success: true,
      message: location.activeBooking
        ? `Cập nhật tọa độ GPS thành công (Đang truyền realtime cho chuyến xe ${location.activeBooking.bookingCode})`
        : "Cập nhật tọa độ GPS thành công",
      data: location,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /driver/location
 * Lấy tọa độ GPS hiện tại của tài xế đang đăng nhập
 */
router.get("/location", async (req: AuthRequest, res, next) => {
  try {
    const profile = await getOrCreateDriverProfile(req.user!.userId)
    const location = await getDriverLocation(profile.id)

    res.json({
      success: true,
      data: location,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /driver/bookings/:bookingId/accept
 * Tài xế bấm nhận cuốc xe (Atomic update chống tranh chấp Race Condition)
 */
router.post(
  "/bookings/:bookingId/accept",
  async (req: AuthRequest, res, next) => {
    try {
      const result = await acceptBooking(req.user!.userId, req.params.bookingId)
      res.json({
        success: true,
        message: result.message,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * GET /driver/bookings/active
 * Lấy chuyến xe đang chạy hiện tại của tài xế (nếu có)
 */
router.get("/bookings/active", async (req: AuthRequest, res, next) => {
  try {
    const profile = await getOrCreateDriverProfile(req.user!.userId)
    const activeBooking = await getDriverActiveBooking(profile.id)
    res.json({
      success: true,
      data: activeBooking,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * PATCH /driver/bookings/:bookingId/status
 * Tài xế cập nhật trạng thái chuyến xe (ARRIVED_AT_PICKUP -> IN_TRANSIT -> COMPLETED)
 */
router.patch(
  "/bookings/:bookingId/status",
  async (req: AuthRequest, res, next) => {
    try {
      const { status, note } = req.body
      const result = await updateBookingStatus(
        req.user!.userId,
        req.params.bookingId,
        status,
        note,
      )
      res.json({
        success: true,
        message: result.message,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * POST /driver/bookings/:bookingId/cancel
 * Tài xế hủy chuyến xe (trước khi giao hàng)
 */
router.post(
  "/bookings/:bookingId/cancel",
  async (req: AuthRequest, res, next) => {
    try {
      const { reason } = req.body
      const result = await cancelBooking(
        req.user!.userId,
        req.params.bookingId,
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
  },
)

export default router
