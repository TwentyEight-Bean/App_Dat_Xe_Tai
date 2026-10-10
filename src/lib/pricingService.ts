import { eq, and } from "drizzle-orm"
import { db } from "../db"
import { pricingRules, vehicleTypes, surchargeServices } from "../db/schema"
import { calculateRouteDistance, DistanceResult } from "./distanceService"
import { ApiError } from "./errors"

export interface EstimatePriceInput {
  vehicleTypeId: string
  originLat: number
  originLng: number
  destLat: number
  destLng: number
  services?: string[] // Mảng mã phụ phí: ['LOADING_FLOOR', 'EXTRA_STOP']
  bookingTime?: string // Thời gian đặt chuyến (ISO 8601)
  isNight?: boolean // Tùy chọn ép buộc tính phụ phí đêm
}

export interface SurchargeItemResult {
  code: string
  name: string
  price: number
  description?: string | null
}

export interface PriceEstimateResult {
  vehicleType: {
    id: string
    code: string
    name: string
    payloadCapacityKg: string
  }
  distanceKm: number
  durationMinutes: number
  routingSource: string
  breakdown: {
    basePrice: number
    baseDistanceKm: number
    extraDistanceKm: number
    pricePerKm: number
    extraKmPrice: number
    transportPrice: number
    surcharges: SurchargeItemResult[]
    surchargeTotal: number
    totalPrice: number
    driverCommissionRate: number // 20%
    platformFee: number // Tiền sàn thu
    driverEarnings: number // Tài xế thực nhận
  }
}

// Fallback data khi chưa kết nối Database PostgreSQL
const MOCK_PRICING_RULES = [
  {
    id: "p-500kg",
    vehicleTypeId: "v-500kg",
    basePrice: "150000",
    baseDistanceKm: "4.0",
    pricePerKm: "15000",
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicleCode: "500KG",
    vehicleName: "Xe Van 500kg",
    payloadCapacityKg: "500",
    dimensionsLxwxh: "1.7m x 1.2m x 1.2m",
  },
  {
    id: "p-1ton",
    vehicleTypeId: "v-1ton",
    basePrice: "200000",
    baseDistanceKm: "4.0",
    pricePerKm: "17000",
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicleCode: "1TON",
    vehicleName: "Xe tải 1 tấn",
    payloadCapacityKg: "1000",
    dimensionsLxwxh: "3.0m x 1.6m x 1.7m",
  },
  {
    id: "p-2ton-thungkin",
    vehicleTypeId: "v-2ton-thungkin",
    basePrice: "280000",
    baseDistanceKm: "4.0",
    pricePerKm: "21000",
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicleCode: "2TON_THUNGKIN",
    vehicleName: "Xe tải 2 tấn (Thùng kín)",
    payloadCapacityKg: "2000",
    dimensionsLxwxh: "4.3m x 1.8m x 1.8m",
  },
  {
    id: "p-2ton-muibat",
    vehicleTypeId: "v-2ton-muibat",
    basePrice: "280000",
    baseDistanceKm: "4.0",
    pricePerKm: "21000",
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicleCode: "2TON_MUIBAT",
    vehicleName: "Xe tải 2 tấn (Mui bạt)",
    payloadCapacityKg: "2000",
    dimensionsLxwxh: "4.3m x 1.8m x 1.9m",
  },
  {
    id: "p-5ton",
    vehicleTypeId: "v-5ton",
    basePrice: "450000",
    baseDistanceKm: "4.0",
    pricePerKm: "28000",
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicleCode: "5TON",
    vehicleName: "Xe tải 5 tấn",
    payloadCapacityKg: "5000",
    dimensionsLxwxh: "6.0m x 2.2m x 2.2m",
  },
]

const MOCK_SURCHARGE_SERVICES: Array<{
  id: string
  code: string
  name: string
  description: string | null
  price: string
  isActive: boolean
  createdAt: Date
}> = [
  {
    id: "s-loading-floor",
    code: "LOADING_FLOOR",
    name: "Bốc xếp tầng trệt",
    description:
      "Tài xế hỗ trợ bốc xếp hàng hóa lên/xuống xe tại tầng trệt (bán kính dưới 10m)",
    price: "50000",
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: "s-loading-stairs",
    code: "LOADING_STAIRS",
    name: "Bốc xếp lầu / thang bộ",
    description:
      "Khuân vác hàng hóa lên/xuống cầu thang bộ (không có thang máy)",
    price: "100000",
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: "s-extra-helper",
    code: "EXTRA_HELPER",
    name: "Thêm 1 người bốc xếp theo xe",
    description:
      "Bố trí thêm 1 phụ xe đi cùng hỗ trợ bốc xếp các kiện hàng cồng kềnh",
    price: "200000",
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: "s-night-surcharge",
    code: "NIGHT_SURCHARGE",
    name: "Phụ phí ban đêm (22:00 - 06:00)",
    description: "Phụ thu chạy xe và giao hàng khung giờ đêm",
    price: "20000",
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: "s-extra-stop",
    code: "EXTRA_STOP",
    name: "Thêm điểm giao hàng phụ",
    description:
      "Dừng thêm 1 điểm trên cùng tuyến đường (bán kính lệch dưới 5km)",
    price: "35000",
    isActive: true,
    createdAt: new Date(),
  },
]

/**
 * 1. Lấy danh sách bảng giá cước của tất cả các loại xe
 */
export async function getPricingRules() {
  try {
    const list = await db
      .select({
        id: pricingRules.id,
        vehicleTypeId: pricingRules.vehicleTypeId,
        basePrice: pricingRules.basePrice,
        baseDistanceKm: pricingRules.baseDistanceKm,
        pricePerKm: pricingRules.pricePerKm,
        createdAt: pricingRules.createdAt,
        updatedAt: pricingRules.updatedAt,
        vehicleCode: vehicleTypes.code,
        vehicleName: vehicleTypes.name,
        payloadCapacityKg: vehicleTypes.payloadCapacityKg,
        dimensionsLxwxh: vehicleTypes.dimensionsLxwxh,
      })
      .from(pricingRules)
      .innerJoin(vehicleTypes, eq(pricingRules.vehicleTypeId, vehicleTypes.id))
      .where(eq(vehicleTypes.isActive, true))

    if (list.length > 0) return list
    return MOCK_PRICING_RULES
  } catch (err) {
    console.warn(
      "[pricingService] Không thể kết nối Database, chuyển sang dữ liệu mặc định:",
      (err as any)?.message,
    )
    return MOCK_PRICING_RULES
  }
}

/**
 * 2. Lấy danh mục các dịch vụ phụ phí hiện có
 */
export async function getSurchargeServices() {
  try {
    const list = await db
      .select()
      .from(surchargeServices)
      .where(eq(surchargeServices.isActive, true))

    if (list.length > 0) return list
    return MOCK_SURCHARGE_SERVICES
  } catch (err) {
    console.warn(
      "[pricingService] Không thể kết nối Database, chuyển sang phụ phí mặc định:",
      (err as any)?.message,
    )
    return MOCK_SURCHARGE_SERVICES
  }
}

/**
 * 3. Quản trị viên cập nhật bảng giá của loại xe
 */
export async function updatePricingRule(
  vehicleTypeId: string,
  data: {
    basePrice?: number
    baseDistanceKm?: number
    pricePerKm?: number
  },
) {
  if (!vehicleTypeId) {
    throw new ApiError(400, "Thiếu mã loại xe (vehicleTypeId)")
  }

  try {
    const existing = await db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.vehicleTypeId, vehicleTypeId))
      .limit(1)

    if (existing.length === 0) {
      throw new ApiError(404, "Không tìm thấy bảng giá của loại xe này")
    }

    const updateFields: any = {
      updatedAt: new Date(),
    }

    if (data.basePrice !== undefined) {
      if (data.basePrice < 0)
        throw new ApiError(400, "Giá mở cửa không được âm")
      updateFields.basePrice = String(data.basePrice)
    }

    if (data.baseDistanceKm !== undefined) {
      if (data.baseDistanceKm <= 0)
        throw new ApiError(400, "Cự ly mở cửa phải lớn hơn 0")
      updateFields.baseDistanceKm = String(data.baseDistanceKm)
    }

    if (data.pricePerKm !== undefined) {
      if (data.pricePerKm < 0)
        throw new ApiError(400, "Giá mỗi km không được âm")
      updateFields.pricePerKm = String(data.pricePerKm)
    }

    const updated = await db
      .update(pricingRules)
      .set(updateFields)
      .where(eq(pricingRules.vehicleTypeId, vehicleTypeId))
      .returning()

    return updated[0]
  } catch (err) {
    if (err instanceof ApiError) throw err
    // Fallback cho chế độ offline/mock
    const found = MOCK_PRICING_RULES.find(
      (r) => r.vehicleTypeId === vehicleTypeId || r.id === vehicleTypeId,
    )
    if (found) {
      if (data.basePrice !== undefined) found.basePrice = String(data.basePrice)
      if (data.baseDistanceKm !== undefined)
        found.baseDistanceKm = String(data.baseDistanceKm)
      if (data.pricePerKm !== undefined)
        found.pricePerKm = String(data.pricePerKm)
      return found
    }
    throw new ApiError(
      500,
      "Cập nhật bảng giá thất bại. Vui lòng kiểm tra kết nối Database.",
    )
  }
}

/**
 * 3.1 Quản trị viên tạo mới hoặc cập nhật bảng giá loại xe
 */
export async function createPricingRule(data: {
  vehicleTypeId: string
  basePrice: number
  baseDistanceKm?: number
  pricePerKm: number
}) {
  if (!data.vehicleTypeId) throw new ApiError(400, "Thiếu mã loại xe")
  const baseDistanceKm = data.baseDistanceKm ?? 4.0

  try {
    const inserted = await db
      .insert(pricingRules)
      .values({
        vehicleTypeId: data.vehicleTypeId,
        basePrice: String(data.basePrice),
        baseDistanceKm: String(baseDistanceKm),
        pricePerKm: String(data.pricePerKm),
      })
      .onConflictDoUpdate({
        target: pricingRules.vehicleTypeId,
        set: {
          basePrice: String(data.basePrice),
          baseDistanceKm: String(baseDistanceKm),
          pricePerKm: String(data.pricePerKm),
          updatedAt: new Date(),
        },
      })
      .returning()

    return inserted[0]
  } catch (err) {
    if (err instanceof ApiError) throw err
    return {
      id: `p-${Date.now()}`,
      vehicleTypeId: data.vehicleTypeId,
      basePrice: String(data.basePrice),
      baseDistanceKm: String(baseDistanceKm),
      pricePerKm: String(data.pricePerKm),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }
}

/**
 * 3.2 Quản trị viên tạo mới dịch vụ phụ phí
 */
export async function createSurchargeService(data: {
  code: string
  name: string
  price: number
  description?: string
}) {
  if (!data.code || !data.name || data.price === undefined) {
    throw new ApiError(
      400,
      "Thiếu thông tin phụ phí bắt buộc (code, name, price)",
    )
  }

  const cleanCode = data.code.trim().toUpperCase()

  try {
    const inserted = await db
      .insert(surchargeServices)
      .values({
        code: cleanCode,
        name: data.name.trim(),
        price: String(data.price),
        description: data.description?.trim() || null,
        isActive: true,
      })
      .returning()

    return inserted[0]
  } catch (err) {
    if (err instanceof ApiError) throw err
    const newItem = {
      id: `s-${Date.now()}`,
      code: cleanCode,
      name: data.name.trim(),
      price: String(data.price),
      description: data.description?.trim() || null,
      isActive: true,
      createdAt: new Date(),
    }
    MOCK_SURCHARGE_SERVICES.push(newItem)
    return newItem
  }
}

/**
 * 3.3 Quản trị viên cập nhật dịch vụ phụ phí
 */
export async function updateSurchargeService(
  code: string,
  data: {
    name?: string
    price?: number
    description?: string
    isActive?: boolean
  },
) {
  if (!code) throw new ApiError(400, "Thiếu mã phụ phí (code)")

  const cleanCode = code.trim().toUpperCase()
  const updateFields: any = {}

  if (data.name !== undefined) updateFields.name = data.name.trim()
  if (data.price !== undefined) updateFields.price = String(data.price)
  if (data.description !== undefined)
    updateFields.description = data.description.trim()
  if (data.isActive !== undefined) updateFields.isActive = data.isActive

  try {
    const updated = await db
      .update(surchargeServices)
      .set(updateFields)
      .where(eq(surchargeServices.code, cleanCode))
      .returning()

    if (updated.length === 0) {
      throw new ApiError(404, `Không tìm thấy phụ phí với mã "${cleanCode}"`)
    }

    return updated[0]
  } catch (err) {
    if (err instanceof ApiError) throw err
    const found = MOCK_SURCHARGE_SERVICES.find((s) => s.code === cleanCode)
    if (found) {
      if (data.name !== undefined) found.name = data.name.trim()
      if (data.price !== undefined) found.price = String(data.price)
      if (data.description !== undefined)
        found.description = data.description.trim()
      if (data.isActive !== undefined) found.isActive = data.isActive
      return found
    }
    throw new ApiError(500, "Cập nhật phụ phí thất bại.")
  }
}

/**
 * 4. Engine Báo giá Cuốc xe (Price Estimator Core Engine)
 * SPRINT 2 - TASK 2.3
 */
export async function estimateBookingPrice(
  input: EstimatePriceInput,
): Promise<PriceEstimateResult> {
  const {
    vehicleTypeId,
    originLat,
    originLng,
    destLat,
    destLng,
    services = [],
  } = input

  if (!vehicleTypeId) {
    throw new ApiError(400, "Vui lòng chọn loại xe tải (vehicleTypeId)")
  }

  // 1. Kiểm tra loại xe và bảng giá
  let rule: {
    ruleId: string
    basePrice: string | number
    baseDistanceKm: string | number
    pricePerKm: string | number
    vehicleId: string
    vehicleCode: string
    vehicleName: string
    payloadCapacityKg: string
  } | null = null

  try {
    const ruleQuery = await db
      .select({
        ruleId: pricingRules.id,
        basePrice: pricingRules.basePrice,
        baseDistanceKm: pricingRules.baseDistanceKm,
        pricePerKm: pricingRules.pricePerKm,
        vehicleId: vehicleTypes.id,
        vehicleCode: vehicleTypes.code,
        vehicleName: vehicleTypes.name,
        payloadCapacityKg: vehicleTypes.payloadCapacityKg,
      })
      .from(pricingRules)
      .innerJoin(vehicleTypes, eq(pricingRules.vehicleTypeId, vehicleTypes.id))
      .where(eq(vehicleTypes.id, vehicleTypeId))
      .limit(1)

    if (ruleQuery.length > 0) {
      rule = ruleQuery[0]
    }
  } catch (err) {
    console.warn(
      "[pricingService] Không thể truy vấn DB cho estimateBookingPrice, dùng mock:",
      (err as any)?.message,
    )
  }

  if (!rule) {
    const mockMatch =
      MOCK_PRICING_RULES.find(
        (r) =>
          r.vehicleTypeId === vehicleTypeId ||
          r.vehicleCode === vehicleTypeId ||
          r.id === vehicleTypeId,
      ) || MOCK_PRICING_RULES[0]
    rule = {
      ruleId: mockMatch.id,
      basePrice: mockMatch.basePrice,
      baseDistanceKm: mockMatch.baseDistanceKm,
      pricePerKm: mockMatch.pricePerKm,
      vehicleId: mockMatch.vehicleTypeId,
      vehicleCode: mockMatch.vehicleCode,
      vehicleName: mockMatch.vehicleName,
      payloadCapacityKg: mockMatch.payloadCapacityKg,
    }
  }

  // 2. Tính khoảng cách & thời gian qua Open-Source OSRM / Haversine (0 VNĐ)
  const route: DistanceResult = await calculateRouteDistance(
    Number(originLat),
    Number(originLng),
    Number(destLat),
    Number(destLng),
  )

  const distanceKm = route.distanceKm
  const durationMinutes = route.durationMinutes

  // 3. Tính cước vận chuyển gốc theo bảng giá bậc thang
  const basePrice = Number(rule.basePrice)
  const baseDistanceKm = Number(rule.baseDistanceKm)
  const pricePerKm = Number(rule.pricePerKm)

  // Km vượt ngoài cự ly mở cửa
  const extraDistanceKm = Math.max(
    0,
    Number((distanceKm - baseDistanceKm).toFixed(1)),
  )
  const extraKmPrice = Math.round(extraDistanceKm * pricePerKm)
  const transportPrice = basePrice + extraKmPrice

  // 4. Tính các phụ phí dịch vụ đính kèm
  const allActiveSurcharges = await getSurchargeServices()
  const selectedSurcharges: SurchargeItemResult[] = []

  // Tra cứu các phụ phí khách chọn trong mảng `services`
  const requestedCodes = new Set(services.map((s) => s.toUpperCase()))

  for (const sc of allActiveSurcharges) {
    if (requestedCodes.has(sc.code.toUpperCase())) {
      selectedSurcharges.push({
        code: sc.code,
        name: sc.name,
        price: Number(sc.price),
        description: sc.description,
      })
    }
  }

  // Tự động kiểm tra phụ phí ban đêm (22:00 đến 06:00 sáng hôm sau)
  let isNightTime = false
  if (typeof input.isNight === "boolean") {
    isNightTime = input.isNight
  } else if (input.bookingTime) {
    const targetDate = new Date(input.bookingTime)
    const hour = targetDate.getHours()
    isNightTime = hour >= 22 || hour < 6
  } else {
    const currentHour = new Date().getHours()
    isNightTime = currentHour >= 22 || currentHour < 6
  }

  const hasNightSurchargeSelected = selectedSurcharges.some(
    (s) => s.code === "NIGHT_SURCHARGE",
  )
  if (isNightTime && !hasNightSurchargeSelected) {
    const nightService = allActiveSurcharges.find(
      (s) => s.code === "NIGHT_SURCHARGE",
    )
    if (nightService) {
      selectedSurcharges.push({
        code: nightService.code,
        name: nightService.name,
        price: Number(nightService.price),
        description:
          "Tự động áp dụng cho khung giờ giao hàng đêm (22:00 - 06:00)",
      })
    }
  }

  // Tổng tiền phụ phí
  const surchargeTotal = selectedSurcharges.reduce(
    (sum, item) => sum + item.price,
    0,
  )

  // 5. Tổng cước khách hàng thanh toán
  const totalPrice = transportPrice + surchargeTotal

  // 6. Phân bổ hoa hồng: Sàn thu 20% cước vận chuyển, tài xế nhận 80% cước + 100% tiền bốc xếp
  const commissionRate = 0.2 // 20%
  const platformFee = Math.round(transportPrice * commissionRate)
  const driverEarnings = totalPrice - platformFee

  return {
    vehicleType: {
      id: rule.vehicleId,
      code: rule.vehicleCode,
      name: rule.vehicleName,
      payloadCapacityKg: rule.payloadCapacityKg,
    },
    distanceKm,
    durationMinutes,
    routingSource: route.routingSource,
    breakdown: {
      basePrice,
      baseDistanceKm,
      extraDistanceKm,
      pricePerKm,
      extraKmPrice,
      transportPrice,
      surcharges: selectedSurcharges,
      surchargeTotal,
      totalPrice,
      driverCommissionRate: commissionRate,
      platformFee,
      driverEarnings,
    },
  }
}
