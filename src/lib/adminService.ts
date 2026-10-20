import { eq, desc, and, ilike, or, sql } from "drizzle-orm"

import { db } from "../db"

import {
  driverProfiles,
  driverDocuments,
  vehicleTypes,
  users,
  bookings,
} from "../db/schema"

import { ApiError } from "./errors"

/**
 * 1. Lấy danh sách hồ sơ tài xế đang chờ phê duyệt KYC
 */

export async function getAllUsers() {
  const allUsers = await db

    .select({
      id: users.id,

      fullName: users.fullName,

      phone: users.phone,

      email: users.email,

      role: users.role,

      status: users.status,

      createdAt: users.createdAt,
    })

    .from(users)

    .where(eq(users.role, "CUSTOMER"))

    .orderBy(desc(users.createdAt))

  return allUsers
}

export async function getPendingKycDrivers(page = 1, limit = 20) {
  const safePage = Math.max(1, page)

  const safeLimit = Math.min(100, Math.max(1, limit))

  const offset = (safePage - 1) * safeLimit

  // Lấy các hồ sơ PENDING

  const pendingProfiles = await db

    .select({
      id: driverProfiles.id,

      userId: driverProfiles.userId,

      vehicleTypeId: driverProfiles.vehicleTypeId,

      licensePlate: driverProfiles.licensePlate,

      driverLicenseNo: driverProfiles.driverLicenseNo,

      kycStatus: driverProfiles.kycStatus,

      ratingAvg: driverProfiles.ratingAvg,

      isOnline: driverProfiles.isOnline,

      isActive: driverProfiles.isActive,

      rejectionReason: driverProfiles.rejectionReason,

      createdAt: driverProfiles.createdAt,

      updatedAt: driverProfiles.updatedAt,

      // User info

      userName: users.fullName,

      userPhone: users.phone,

      userEmail: users.email,

      userAvatar: users.avatarUrl,
    })

    .from(driverProfiles)

    .innerJoin(users, eq(driverProfiles.userId, users.id))

    .where(eq(driverProfiles.kycStatus, "PENDING"))

    .orderBy(desc(driverProfiles.updatedAt))

    .limit(safeLimit)

    .offset(offset)

  // Đính kèm giấy tờ và loại xe cho từng tài xế

  const results = await Promise.all(
    pendingProfiles.map(async (dp) => {
      let vehicleType = null

      if (dp.vehicleTypeId) {
        const vt = await db

          .select()

          .from(vehicleTypes)

          .where(eq(vehicleTypes.id, dp.vehicleTypeId))

          .limit(1)

        if (vt.length > 0) vehicleType = vt[0]
      }

      const docs = await db

        .select()

        .from(driverDocuments)

        .where(eq(driverDocuments.driverId, dp.id))

      return {
        id: dp.id,

        userId: dp.userId,

        driverName: dp.userName,

        phone: dp.userPhone,

        email: dp.userEmail,

        avatarUrl: dp.userAvatar,

        licensePlate: dp.licensePlate,

        driverLicenseNo: dp.driverLicenseNo,

        kycStatus: dp.kycStatus,

        isOnline: dp.isOnline,

        isActive: dp.isActive,

        vehicleType,

        documents: docs,

        submittedAt: dp.updatedAt || dp.createdAt,
      }
    }),
  )

  // Đếm tổng số lượng hồ sơ PENDING
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(driverProfiles)
    .where(eq(driverProfiles.kycStatus, "PENDING"))

  const total = countResult[0]?.count || 0

  return {
    drivers: results,

    page: safePage,

    limit: safeLimit,

    total,

    totalPages: Math.ceil(total / safeLimit),
  }
}

/**
 * 2. Lấy chi tiết hồ sơ tài xế theo driverId
 */

export async function getDriverKycDetail(driverId: string) {
  if (!driverId) {
    throw new ApiError(400, "Thiếu mã tài xế (driverId)")
  }

  const profiles = await db

    .select()

    .from(driverProfiles)

    .where(eq(driverProfiles.id, driverId))

    .limit(1)

  if (profiles.length === 0) {
    throw new ApiError(404, "Không tìm thấy hồ sơ tài xế")
  }

  const p = profiles[0]

  const userList = await db

    .select({
      id: users.id,

      fullName: users.fullName,

      phone: users.phone,

      email: users.email,

      avatarUrl: users.avatarUrl,

      role: users.role,

      status: users.status,
    })

    .from(users)

    .where(eq(users.id, p.userId))

    .limit(1)

  let vehicleType = null

  if (p.vehicleTypeId) {
    const vt = await db

      .select()

      .from(vehicleTypes)

      .where(eq(vehicleTypes.id, p.vehicleTypeId))

      .limit(1)

    if (vt.length > 0) vehicleType = vt[0]
  }

  const docs = await db

    .select()

    .from(driverDocuments)

    .where(eq(driverDocuments.driverId, p.id))

  return {
    ...p,

    user: userList[0] || null,

    vehicleType,

    documents: docs,
  }
}

/**
 * 3. Phê duyệt hồ sơ KYC tài xế (APPROVED)
 */

export async function approveDriverKyc(driverId: string) {
  if (!driverId) {
    throw new ApiError(400, "Thiếu mã tài xế (driverId)")
  }

  const existing = await db

    .select()

    .from(driverProfiles)

    .where(eq(driverProfiles.id, driverId))

    .limit(1)

  if (existing.length === 0) {
    throw new ApiError(404, "Không tìm thấy hồ sơ tài xế để phê duyệt")
  }

  // Task 2.1: Kiểm tra đủ bộ 4 loại giấy tờ cốt lõi trước khi phê duyệt KYC
  const docs = await db
    .select({ docType: driverDocuments.docType })
    .from(driverDocuments)
    .where(eq(driverDocuments.driverId, driverId))

  const submittedTypes = new Set(docs.map((d) => d.docType))
  const requiredTypes = [
    "CCCD_FRONT",
    "CCCD_BACK",
    "DRIVER_LICENSE",
    "VEHICLE_REGISTRATION",
  ]
  const missing = requiredTypes.filter((t) => !submittedTypes.has(t as any))
  if (missing.length > 0) {
    throw new ApiError(
      400,
      `Không thể phê duyệt: Tài xế chưa nộp đủ giấy tờ bắt buộc (${missing.join(", ")})`,
    )
  }

  const updated = await db

    .update(driverProfiles)

    .set({
      kycStatus: "APPROVED",

      rejectionReason: null,

      updatedAt: new Date(),
    })

    .where(eq(driverProfiles.id, driverId))

    .returning()

  // Đảm bảo role của user là DRIVER

  await db

    .update(users)

    .set({ role: "DRIVER" })

    .where(eq(users.id, existing[0].userId))

  return {
    driverId,

    kycStatus: updated[0].kycStatus,

    message:
      "Phê duyệt hồ sơ KYC tài xế thành công. Tài xế hiện đã có thể bật Trực tuyến.",
  }
}

/**
 * 4. Từ chối hồ sơ KYC tài xế (REJECTED) kèm lý do
 */

export async function rejectDriverKyc(driverId: string, reason: string) {
  if (!driverId) {
    throw new ApiError(400, "Thiếu mã tài xế (driverId)")
  }

  if (!reason || !reason.trim()) {
    throw new ApiError(400, "Lý do từ chối hồ sơ không được để trống")
  }

  const existing = await db

    .select()

    .from(driverProfiles)

    .where(eq(driverProfiles.id, driverId))

    .limit(1)

  if (existing.length === 0) {
    throw new ApiError(404, "Không tìm thấy hồ sơ tài xế để xử lý")
  }

  // Cập nhật trạng thái REJECTED, ghi lý do và buộc ngắt kết nối (isOnline = false)

  const updated = await db

    .update(driverProfiles)

    .set({
      kycStatus: "REJECTED",

      rejectionReason: reason.trim(),

      isOnline: false,

      updatedAt: new Date(),
    })

    .where(eq(driverProfiles.id, driverId))

    .returning()

  return {
    driverId,

    kycStatus: updated[0].kycStatus,

    rejectionReason: updated[0].rejectionReason,

    isOnline: updated[0].isOnline,

    message: "Đã từ chối phê duyệt hồ sơ KYC tài xế.",
  }
}

/**
 * 5. Lấy danh sách tất cả tài xế với bộ lọc trạng thái KYC, trực tuyến và tìm kiếm
 */

export async function getAllDrivers(
  params: {
    kycStatus?: string

    isOnline?: boolean

    search?: string

    page?: number

    limit?: number
  } = {},
) {
  const page = Math.max(1, params.page || 1)

  const limit = Math.min(100, Math.max(1, params.limit || 20))

  const offset = (page - 1) * limit

  let query = db

    .select({
      id: driverProfiles.id,

      userId: driverProfiles.userId,

      vehicleTypeId: driverProfiles.vehicleTypeId,

      licensePlate: driverProfiles.licensePlate,

      driverLicenseNo: driverProfiles.driverLicenseNo,

      kycStatus: driverProfiles.kycStatus,

      ratingAvg: driverProfiles.ratingAvg,

      isOnline: driverProfiles.isOnline,

      isActive: driverProfiles.isActive,

      rejectionReason: driverProfiles.rejectionReason,

      createdAt: driverProfiles.createdAt,

      updatedAt: driverProfiles.updatedAt,

      // User info

      userName: users.fullName,

      userPhone: users.phone,

      userEmail: users.email,

      userAvatar: users.avatarUrl,
    })

    .from(driverProfiles)

    .innerJoin(users, eq(driverProfiles.userId, users.id))

  const conditions = []

  if (params.kycStatus && params.kycStatus !== "ALL") {
    conditions.push(eq(driverProfiles.kycStatus, params.kycStatus as any))
  }

  if (params.isOnline !== undefined) {
    conditions.push(eq(driverProfiles.isOnline, params.isOnline))
  }

  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`
    conditions.push(
      or(
        ilike(users.fullName, s),
        ilike(users.phone, s),
        ilike(driverProfiles.licensePlate, s),
      )!,
    )
  }

  const finalQuery =
    conditions.length > 0 ? query.where(and(...conditions)) : query

  const rawList = await finalQuery

    .orderBy(desc(driverProfiles.updatedAt))

    .limit(limit)

    .offset(offset)

  // Đính kèm loại xe và số lượng giấy tờ

  const results = await Promise.all(
    rawList.map(async (dp) => {
      let vehicleType = null

      if (dp.vehicleTypeId) {
        const vt = await db

          .select()

          .from(vehicleTypes)

          .where(eq(vehicleTypes.id, dp.vehicleTypeId))

          .limit(1)

        if (vt.length > 0) vehicleType = vt[0]
      }

      const docs = await db

        .select()

        .from(driverDocuments)

        .where(eq(driverDocuments.driverId, dp.id))

      return {
        id: dp.id,

        userId: dp.userId,

        driverName: dp.userName,

        phone: dp.userPhone,

        email: dp.userEmail,

        avatarUrl: dp.userAvatar,

        licensePlate: dp.licensePlate,

        driverLicenseNo: dp.driverLicenseNo,

        kycStatus: dp.kycStatus,

        isOnline: dp.isOnline,

        isActive: dp.isActive,

        vehicleType,

        documentsCount: docs.length,

        rejectionReason: dp.rejectionReason,

        updatedAt: dp.updatedAt,
      }
    }),
  )

  // Đếm tổng số lượng tài xế thỏa mãn điều kiện
  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(driverProfiles)
    .innerJoin(users, eq(driverProfiles.userId, users.id))

  const countResult = await (conditions.length > 0
    ? countQuery.where(and(...conditions))
    : countQuery)

  const total = countResult[0]?.count || 0

  return {
    drivers: results,

    page,

    limit,

    total,

    totalPages: Math.ceil(total / limit),
  }
}

/**
 * 6. Khóa hoặc kích hoạt lại tài khoản tài xế
 */

export async function setDriverActiveStatus(
  driverId: string,

  isActive: boolean,
) {
  if (!driverId) {
    throw new ApiError(400, "Thiếu mã tài xế (driverId)")
  }

  const existing = await db

    .select()

    .from(driverProfiles)

    .where(eq(driverProfiles.id, driverId))

    .limit(1)

  if (existing.length === 0) {
    throw new ApiError(404, "Không tìm thấy hồ sơ tài xế")
  }

  // Nếu bị khóa, tự động chuyển isOnline = false

  const updated = await db

    .update(driverProfiles)

    .set({
      isActive,

      isOnline: isActive ? existing[0].isOnline : false,

      updatedAt: new Date(),
    })

    .where(eq(driverProfiles.id, driverId))

    .returning()

  return {
    driverId,
    isActive: updated[0].isActive,
    isOnline: updated[0].isOnline,
    message: isActive ? "Đã kích hoạt tài xế" : "Đã tạm khóa tài khoản tài xế",
  }
}

/**
 * 6. Lấy danh sách toàn bộ đơn hàng (bookings) thực tế trong CSDL
 */
export async function getAdminBookings(params: {
  page?: number
  limit?: number
  status?: string
  search?: string
  vehicle?: string
} = {}) {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 20))
  const offset = (page - 1) * limit

  const conditions = []
  if (params.status && params.status !== "ALL" && params.status !== "Tất cả") {
    conditions.push(eq(bookings.status, params.status as any))
  }
  if (params.vehicle && params.vehicle !== "ALL" && params.vehicle !== "Tất cả loại xe") {
    conditions.push(ilike(vehicleTypes.name, `%${params.vehicle.trim()}%`))
  }
  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`
    conditions.push(
      or(
        ilike(bookings.bookingCode, s),
        ilike(bookings.originAddress, s),
        ilike(bookings.destinationAddress, s),
        ilike(users.fullName, s),
        ilike(users.phone, s),
      ),
    )
  }

  const query = db
    .select({
      id: bookings.id,
      bookingCode: bookings.bookingCode,
      customerId: bookings.customerId,
      driverId: bookings.driverId,
      vehicleTypeId: bookings.vehicleTypeId,
      status: bookings.status,
      originAddress: bookings.originAddress,
      destinationAddress: bookings.destinationAddress,
      distanceKm: bookings.distanceKm,
      basePrice: bookings.basePrice,
      surchargePrice: bookings.surchargePrice,
      totalPrice: bookings.totalPrice,
      driverCommission: bookings.driverCommission,
      paymentMethod: bookings.paymentMethod,
      paymentStatus: bookings.paymentStatus,
      cancelledBy: bookings.cancelledBy,
      cancellationReason: bookings.cancellationReason,
      cancellationFee: bookings.cancellationFee,
      pickupProofImage: bookings.pickupProofImage,
      deliveryProofImage: bookings.deliveryProofImage,
      createdAt: bookings.createdAt,
      customerName: users.fullName,
      customerPhone: users.phone,
      vehicleName: vehicleTypes.name,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.customerId, users.id))
    .leftJoin(vehicleTypes, eq(bookings.vehicleTypeId, vehicleTypes.id))

  const finalQuery = conditions.length > 0 ? query.where(and(...conditions)) : query

  const rawList = await finalQuery
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(offset)

  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .leftJoin(users, eq(bookings.customerId, users.id))
    .leftJoin(vehicleTypes, eq(bookings.vehicleTypeId, vehicleTypes.id))
  const countResult = await (conditions.length > 0 ? countQuery.where(and(...conditions)) : countQuery)
  const total = countResult[0]?.count || 0

  return {
    bookings: rawList,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  }
}

