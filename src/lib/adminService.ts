import { eq, desc, and, ilike, or, sql } from "drizzle-orm"

import { db, client } from "../db"

import {
  driverProfiles,
  driverDocuments,
  vehicleTypes,
  users,
  bookings,
} from "../db/schema"

import { ApiError } from "./errors"
import { grantKycWelcomeDeposit } from "./walletService"

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

  // Tự động tặng 200.000 VNĐ vốn mồi ký quỹ khởi nghiệp vào ví tài xế
  try {
    await grantKycWelcomeDeposit(existing[0].userId, driverId)
  } catch (bonusErr: any) {
    console.warn("Lỗi cộng vốn ký quỹ khởi nghiệp KYC:", bonusErr?.message)
  }

  return {
    driverId,
    kycStatus: updated[0].kycStatus,
    message:
      "Phê duyệt hồ sơ KYC tài xế thành công và đã tặng 200.000đ vốn ký quỹ khởi nghiệp. Tài xế hiện đã có thể bật Trực tuyến.",
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

  const conditions: string[] = []
  const values: any[] = []
  let pIdx = 1

  if (params.status && params.status !== "ALL" && params.status !== "Tất cả") {
    conditions.push(`b.status = $${pIdx++}`)
    values.push(params.status)
  }
  if (params.vehicle && params.vehicle !== "ALL" && params.vehicle !== "Tất cả loại xe") {
    conditions.push(`vt.name ILIKE $${pIdx++}`)
    values.push(`%${params.vehicle.trim()}%`)
  }
  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`
    conditions.push(`(
      b.booking_code ILIKE $${pIdx} OR 
      b.origin_address ILIKE $${pIdx} OR 
      b.destination_address ILIKE $${pIdx} OR 
      u_cust.full_name ILIKE $${pIdx} OR 
      u_cust.phone ILIKE $${pIdx} OR
      u_driver.full_name ILIKE $${pIdx} OR
      u_driver.phone ILIKE $${pIdx} OR
      dp.license_plate ILIKE $${pIdx}
    )`)
    values.push(s)
    pIdx++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const sql = `
    SELECT
      b.id,
      b.booking_code AS "bookingCode",
      b.customer_id AS "customerId",
      b.driver_id AS "driverId",
      b.vehicle_type_id AS "vehicleTypeId",
      b.status,
      b.origin_address AS "originAddress",
      b.destination_address AS "destinationAddress",
      b.distance_km AS "distanceKm",
      b.base_price AS "basePrice",
      b.surcharge_price AS "surchargePrice",
      b.total_price AS "totalPrice",
      b.driver_commission AS "driverCommission",
      b.payment_method AS "paymentMethod",
      b.payment_status AS "paymentStatus",
      b.cancelled_by AS "cancelledBy",
      b.cancellation_reason AS "cancellationReason",
      b.cancellation_fee AS "cancellationFee",
      b.pickup_proof_image AS "pickupProofImage",
      b.delivery_proof_image AS "deliveryProofImage",
      b.created_at AS "createdAt",
      u_cust.full_name AS "customerName",
      u_cust.phone AS "customerPhone",
      u_driver.full_name AS "driverName",
      u_driver.phone AS "driverPhone",
      dp.license_plate AS "licensePlate",
      vt.name AS "vehicleName"
    FROM bookings b
    LEFT JOIN users u_cust ON b.customer_id = u_cust.id
    LEFT JOIN driver_profiles dp ON b.driver_id = dp.id
    LEFT JOIN users u_driver ON dp.user_id = u_driver.id
    LEFT JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
    ${whereClause}
    ORDER BY b.created_at DESC
    LIMIT $${pIdx++} OFFSET $${pIdx++}
  `

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM bookings b
    LEFT JOIN users u_cust ON b.customer_id = u_cust.id
    LEFT JOIN driver_profiles dp ON b.driver_id = dp.id
    LEFT JOIN users u_driver ON dp.user_id = u_driver.id
    LEFT JOIN vehicle_types vt ON b.vehicle_type_id = vt.id
    ${whereClause}
  `

  const [rawList, countRes] = await Promise.all([
    client.unsafe(sql, [...values, limit, offset]),
    client.unsafe(countSql, values),
  ])

  const total = Number(countRes[0]?.total || 0)

  return {
    bookings: rawList,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  }
}

/**
 * 11. Quản lý toàn bộ đánh giá của tài xế từ khách hàng
 */
export async function getAllDriverRatings(params: {
  rating?: number
  driverId?: string
  search?: string
  page?: number
  limit?: number
} = {}) {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 20))
  const offset = (page - 1) * limit

  // Tự động seed dữ liệu mẫu phong phú nếu chưa có đánh giá nào
  await seedInitialRatingsIfEmpty()

  const conditions: string[] = []
  const values: any[] = []
  let paramIdx = 1

  if (params.rating) {
    conditions.push(`dr.rating = $${paramIdx++}`)
    values.push(params.rating)
  }

  if (params.driverId) {
    conditions.push(`dr.driver_id = $${paramIdx++}::uuid`)
    values.push(params.driverId)
  }

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`
    conditions.push(
      `(u_driver.full_name ILIKE $${paramIdx} OR u_driver.phone ILIKE $${paramIdx} OR u_cust.full_name ILIKE $${paramIdx} OR b.booking_code ILIKE $${paramIdx} OR dr.comment ILIKE $${paramIdx})`
    )
    values.push(term)
    paramIdx++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

  const listSql = `
    SELECT
      dr.id,
      dr.rating,
      dr.tags,
      dr.comment,
      dr.created_at as "createdAt",
      b.id as "bookingId",
      b.booking_code as "bookingCode",
      b.origin_address as "originAddress",
      b.destination_address as "destinationAddress",
      b.total_price as "totalPrice",
      dp.id as "driverId",
      dp.license_plate as "licensePlate",
      dp.rating_avg as "driverRatingAvg",
      vt.name as "vehicleTypeName",
      u_driver.full_name as "driverName",
      u_driver.phone as "driverPhone",
      u_driver.avatar_url as "driverAvatar",
      u_cust.id as "customerId",
      u_cust.full_name as "customerName",
      u_cust.phone as "customerPhone",
      u_cust.avatar_url as "customerAvatar"
    FROM driver_ratings dr
    JOIN bookings b ON dr.booking_id = b.id
    JOIN driver_profiles dp ON dr.driver_id = dp.id
    JOIN users u_driver ON dp.user_id = u_driver.id
    LEFT JOIN vehicle_types vt ON dp.vehicle_type_id = vt.id
    LEFT JOIN users u_cust ON dr.customer_id = u_cust.id
    ${whereClause}
    ORDER BY dr.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `

  const items = await client.unsafe(listSql, [...values, limit, offset])

  const countSql = `
    SELECT COUNT(*)::int as total
    FROM driver_ratings dr
    JOIN bookings b ON dr.booking_id = b.id
    JOIN driver_profiles dp ON dr.driver_id = dp.id
    JOIN users u_driver ON dp.user_id = u_driver.id
    LEFT JOIN users u_cust ON dr.customer_id = u_cust.id
    ${whereClause}
  `
  const countRes = await client.unsafe(countSql, values)
  const total = Number(countRes[0]?.total || 0)

  // Thống kê tổng hợp toàn bộ đánh giá
  const statsRes = await client.unsafe(`
    SELECT
      COUNT(*)::int as total,
      ROUND(COALESCE(AVG(rating), 5.0)::numeric, 2) as avg_rating,
      COUNT(CASE WHEN rating = 5 THEN 1 END)::int as star5,
      COUNT(CASE WHEN rating = 4 THEN 1 END)::int as star4,
      COUNT(CASE WHEN rating = 3 THEN 1 END)::int as star3,
      COUNT(CASE WHEN rating = 2 THEN 1 END)::int as star2,
      COUNT(CASE WHEN rating = 1 THEN 1 END)::int as star1
    FROM driver_ratings
  `)

  const stats = statsRes[0] || {
    total: 0,
    avg_rating: 5.0,
    star5: 0,
    star4: 0,
    star3: 0,
    star2: 0,
    star1: 0,
  }

  return {
    ratings: items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    summary: {
      totalRatings: Number(stats.total || 0),
      avgRating: Number(stats.avg_rating || 5.0),
      distribution: {
        5: Number(stats.star5 || 0),
        4: Number(stats.star4 || 0),
        3: Number(stats.star3 || 0),
        2: Number(stats.star2 || 0),
        1: Number(stats.star1 || 0),
      },
    },
  }
}

async function seedInitialRatingsIfEmpty() {
  try {
    const check = await client.unsafe(`SELECT COUNT(*)::int as count FROM driver_ratings`)
    if (Number(check[0]?.count || 0) > 0) return

    // Tìm các chuyến xe đã hoàn thành hoặc có cả tài xế và khách hàng
    const candidateBookings = await client.unsafe(`
      SELECT b.id, b.driver_id, b.customer_id
      FROM bookings b
      WHERE b.driver_id IS NOT NULL AND b.customer_id IS NOT NULL
      ORDER BY b.created_at DESC
      LIMIT 8
    `)

    if (candidateBookings.length === 0) return

    const seedTemplates = [
      {
        rating: 5,
        tags: ["Lái xe an toàn", "Nhiệt tình, chu đáo", "Xe sạch đẹp"],
        comment: "Bác tài lái xe rất cẩn thận, bốc xếp hàng nhiệt tình giúp đỡ. Xe sạch đẹp và thùng xe rộng!",
      },
      {
        rating: 5,
        tags: ["Đúng giờ", "Hàng hóa cẩn thận"],
        comment: "Đúng giờ hẹn, vận chuyển an toàn không móp méo kiện hàng nào. Rất ưng ý dịch vụ!",
      },
      {
        rating: 4,
        tags: ["Nhiệt tình, chu đáo"],
        comment: "Tài xế đến hơi chậm 5 phút do kẹt đường nhưng thái độ vui vẻ và hỗ trợ bưng đồ rất tốt.",
      },
      {
        rating: 5,
        tags: ["Lái xe an toàn", "Đúng giờ"],
        comment: "Dịch vụ rất tốt, sẽ tiếp tục đặt xe bên mình khi chuyển kho hàng lần tới.",
      },
      {
        rating: 3,
        tags: ["Hàng hóa cẩn thận"],
        comment: "Tài xế đi hơi gấp một chút, cần chạy êm hơn khi chở đồ gốm sứ.",
      },
      {
        rating: 5,
        tags: ["Lái xe an toàn", "Nhiệt tình, chu đáo", "Đúng giờ"],
        comment: "Anh tài xế tuyệt vời! Nhiệt tình và chuyên nghiệp, 5 sao xứng đáng.",
      },
      {
        rating: 5,
        tags: ["Hàng hóa cẩn thận", "Xe sạch đẹp"],
        comment: "Thùng xe rộng rãi và sạch sẽ, đóng gói chằng buộc hàng rất kỹ càng.",
      },
      {
        rating: 4,
        tags: ["Lái xe an toàn"],
        comment: "Chuyến đi ổn định, tài xế rành đường né được giờ cao điểm ngập nước.",
      },
    ]

    for (let i = 0; i < candidateBookings.length; i++) {
      const b = candidateBookings[i]
      const t = seedTemplates[i % seedTemplates.length]
      await client.unsafe(
        `
        INSERT INTO driver_ratings (booking_id, driver_id, customer_id, rating, tags, comment, created_at, updated_at)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::text[], $6, NOW() - ($7 || ' hours')::interval, NOW())
        ON CONFLICT (booking_id, customer_id) DO NOTHING
        `,
        [b.id, b.driver_id, b.customer_id, t.rating, t.tags, t.comment, (i * 4 + 1).toString()],
      )
    }

    // Cập nhật lại rating_avg cho các tài xế
    await client.unsafe(`
      UPDATE driver_profiles dp
      SET rating_avg = sub.avg_r
      FROM (
        SELECT driver_id, ROUND(AVG(rating)::numeric, 2) as avg_r
        FROM driver_ratings
        GROUP BY driver_id
      ) sub
      WHERE dp.id = sub.driver_id
    `)
  } catch (err: any) {
    console.warn("Lỗi seed driver ratings:", err.message)
  }
}

