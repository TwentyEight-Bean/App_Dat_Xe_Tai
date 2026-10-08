import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import {
  pricingRules,
  vehicleTypes,
  surchargeServices,
} from '../db/schema';
import { calculateRouteDistance, DistanceResult } from './distanceService';
import { ApiError } from './errors';

export interface EstimatePriceInput {
  vehicleTypeId: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  services?: string[]; // Mảng mã phụ phí: ['LOADING_FLOOR', 'EXTRA_STOP']
  bookingTime?: string; // Thời gian đặt chuyến (ISO 8601)
  isNight?: boolean; // Tùy chọn ép buộc tính phụ phí đêm
}

export interface SurchargeItemResult {
  code: string;
  name: string;
  price: number;
  description?: string | null;
}

export interface PriceEstimateResult {
  vehicleType: {
    id: string;
    code: string;
    name: string;
    payloadCapacityKg: string;
  };
  distanceKm: number;
  durationMinutes: number;
  routingSource: string;
  breakdown: {
    basePrice: number;
    baseDistanceKm: number;
    extraDistanceKm: number;
    pricePerKm: number;
    extraKmPrice: number;
    transportPrice: number;
    surcharges: SurchargeItemResult[];
    surchargeTotal: number;
    totalPrice: number;
    driverCommissionRate: number; // 20%
    platformFee: number; // Tiền sàn thu
    driverEarnings: number; // Tài xế thực nhận
  };
}

/**
 * 1. Lấy danh sách bảng giá cước của tất cả các loại xe
 */
export async function getPricingRules() {
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
    .where(eq(vehicleTypes.isActive, true));

  return list;
}

/**
 * 2. Lấy danh mục các dịch vụ phụ phí hiện có
 */
export async function getSurchargeServices() {
  return await db
    .select()
    .from(surchargeServices)
    .where(eq(surchargeServices.isActive, true));
}

/**
 * 3. Quản trị viên cập nhật bảng giá của loại xe
 */
export async function updatePricingRule(
  vehicleTypeId: string,
  data: {
    basePrice?: number;
    baseDistanceKm?: number;
    pricePerKm?: number;
  }
) {
  if (!vehicleTypeId) {
    throw new ApiError(400, 'Thiếu mã loại xe (vehicleTypeId)');
  }

  const existing = await db
    .select()
    .from(pricingRules)
    .where(eq(pricingRules.vehicleTypeId, vehicleTypeId))
    .limit(1);

  if (existing.length === 0) {
    throw new ApiError(404, 'Không tìm thấy bảng giá của loại xe này');
  }

  const updateFields: any = {
    updatedAt: new Date(),
  };

  if (data.basePrice !== undefined) {
    if (data.basePrice < 0) throw new ApiError(400, 'Giá mở cửa không được âm');
    updateFields.basePrice = String(data.basePrice);
  }

  if (data.baseDistanceKm !== undefined) {
    if (data.baseDistanceKm <= 0) throw new ApiError(400, 'Cự ly mở cửa phải lớn hơn 0');
    updateFields.baseDistanceKm = String(data.baseDistanceKm);
  }

  if (data.pricePerKm !== undefined) {
    if (data.pricePerKm < 0) throw new ApiError(400, 'Giá mỗi km không được âm');
    updateFields.pricePerKm = String(data.pricePerKm);
  }

  const updated = await db
    .update(pricingRules)
    .set(updateFields)
    .where(eq(pricingRules.vehicleTypeId, vehicleTypeId))
    .returning();

  return updated[0];
}

/**
 * 3.1 Quản trị viên tạo mới hoặc cập nhật bảng giá loại xe
 */
export async function createPricingRule(data: {
  vehicleTypeId: string;
  basePrice: number;
  baseDistanceKm?: number;
  pricePerKm: number;
}) {
  if (!data.vehicleTypeId) throw new ApiError(400, 'Thiếu mã loại xe');
  const baseDistanceKm = data.baseDistanceKm ?? 4.0;

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
    .returning();

  return inserted[0];
}

/**
 * 3.2 Quản trị viên tạo mới dịch vụ phụ phí
 */
export async function createSurchargeService(data: {
  code: string;
  name: string;
  price: number;
  description?: string;
}) {
  if (!data.code || !data.name || data.price === undefined) {
    throw new ApiError(400, 'Thiếu thông tin phụ phí bắt buộc (code, name, price)');
  }

  const cleanCode = data.code.trim().toUpperCase();

  const inserted = await db
    .insert(surchargeServices)
    .values({
      code: cleanCode,
      name: data.name.trim(),
      price: String(data.price),
      description: data.description?.trim() || null,
      isActive: true,
    })
    .returning();

  return inserted[0];
}

/**
 * 3.3 Quản trị viên cập nhật dịch vụ phụ phí
 */
export async function updateSurchargeService(
  code: string,
  data: {
    name?: string;
    price?: number;
    description?: string;
    isActive?: boolean;
  }
) {
  if (!code) throw new ApiError(400, 'Thiếu mã phụ phí (code)');

  const cleanCode = code.trim().toUpperCase();
  const updateFields: any = {};

  if (data.name !== undefined) updateFields.name = data.name.trim();
  if (data.price !== undefined) updateFields.price = String(data.price);
  if (data.description !== undefined) updateFields.description = data.description.trim();
  if (data.isActive !== undefined) updateFields.isActive = data.isActive;

  const updated = await db
    .update(surchargeServices)
    .set(updateFields)
    .where(eq(surchargeServices.code, cleanCode))
    .returning();

  if (updated.length === 0) {
    throw new ApiError(404, `Không tìm thấy phụ phí với mã "${cleanCode}"`);
  }

  return updated[0];
}

/**
 * 4. Engine Báo giá Cuốc xe (Price Estimator Core Engine)
 * SPRINT 2 - TASK 2.3
 */
export async function estimateBookingPrice(input: EstimatePriceInput): Promise<PriceEstimateResult> {
  const { vehicleTypeId, originLat, originLng, destLat, destLng, services = [] } = input;

  if (!vehicleTypeId) {
    throw new ApiError(400, 'Vui lòng chọn loại xe tải (vehicleTypeId)');
  }

  // 1. Kiểm tra loại xe và bảng giá
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
    .limit(1);

  if (ruleQuery.length === 0) {
    throw new ApiError(404, `Không tìm thấy cấu hình bảng giá cho loại xe "${vehicleTypeId}"`);
  }

  const rule = ruleQuery[0];

  // 2. Tính khoảng cách & thời gian qua Open-Source OSRM / Haversine (0 VNĐ)
  const route: DistanceResult = await calculateRouteDistance(
    Number(originLat),
    Number(originLng),
    Number(destLat),
    Number(destLng)
  );

  const distanceKm = route.distanceKm;
  const durationMinutes = route.durationMinutes;

  // 3. Tính cước vận chuyển gốc theo bảng giá bậc thang
  const basePrice = Number(rule.basePrice);
  const baseDistanceKm = Number(rule.baseDistanceKm);
  const pricePerKm = Number(rule.pricePerKm);

  // Km vượt ngoài cự ly mở cửa
  const extraDistanceKm = Math.max(0, Number((distanceKm - baseDistanceKm).toFixed(1)));
  const extraKmPrice = Math.round(extraDistanceKm * pricePerKm);
  const transportPrice = basePrice + extraKmPrice;

  // 4. Tính các phụ phí dịch vụ đính kèm
  const allActiveSurcharges = await getSurchargeServices();
  const selectedSurcharges: SurchargeItemResult[] = [];

  // Tra cứu các phụ phí khách chọn trong mảng `services`
  const requestedCodes = new Set(services.map((s) => s.toUpperCase()));

  for (const sc of allActiveSurcharges) {
    if (requestedCodes.has(sc.code.toUpperCase())) {
      selectedSurcharges.push({
        code: sc.code,
        name: sc.name,
        price: Number(sc.price),
        description: sc.description,
      });
    }
  }

  // Tự động kiểm tra phụ phí ban đêm (22:00 đến 06:00 sáng hôm sau)
  let isNightTime = false;
  if (typeof input.isNight === 'boolean') {
    isNightTime = input.isNight;
  } else if (input.bookingTime) {
    const targetDate = new Date(input.bookingTime);
    const hour = targetDate.getHours();
    isNightTime = hour >= 22 || hour < 6;
  } else {
    const currentHour = new Date().getHours();
    isNightTime = currentHour >= 22 || currentHour < 6;
  }

  const hasNightSurchargeSelected = selectedSurcharges.some((s) => s.code === 'NIGHT_SURCHARGE');
  if (isNightTime && !hasNightSurchargeSelected) {
    const nightService = allActiveSurcharges.find((s) => s.code === 'NIGHT_SURCHARGE');
    if (nightService) {
      selectedSurcharges.push({
        code: nightService.code,
        name: nightService.name,
        price: Number(nightService.price),
        description: 'Tự động áp dụng cho khung giờ giao hàng đêm (22:00 - 06:00)',
      });
    }
  }

  // Tổng tiền phụ phí
  const surchargeTotal = selectedSurcharges.reduce((sum, item) => sum + item.price, 0);

  // 5. Tổng cước khách hàng thanh toán
  const totalPrice = transportPrice + surchargeTotal;

  // 6. Phân bổ hoa hồng: Sàn thu 20% cước vận chuyển, tài xế nhận 80% cước + 100% tiền bốc xếp
  const commissionRate = 0.20; // 20%
  const platformFee = Math.round(transportPrice * commissionRate);
  const driverEarnings = totalPrice - platformFee;

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
  };
}
