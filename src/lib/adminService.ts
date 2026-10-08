import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import {
  driverProfiles,
  driverDocuments,
  vehicleTypes,
  users,
} from '../db/schema';
import { ApiError } from './errors';

/**
 * 1. Lấy danh sách hồ sơ tài xế đang chờ phê duyệt KYC
 */
export async function getPendingKycDrivers(page = 1, limit = 20) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

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
    .where(eq(driverProfiles.kycStatus, 'PENDING'))
    .orderBy(desc(driverProfiles.updatedAt))
    .limit(safeLimit)
    .offset(offset);

  // Đính kèm giấy tờ và loại xe cho từng tài xế
  const results = await Promise.all(
    pendingProfiles.map(async (dp) => {
      let vehicleType = null;
      if (dp.vehicleTypeId) {
        const vt = await db
          .select()
          .from(vehicleTypes)
          .where(eq(vehicleTypes.id, dp.vehicleTypeId))
          .limit(1);
        if (vt.length > 0) vehicleType = vt[0];
      }

      const docs = await db
        .select()
        .from(driverDocuments)
        .where(eq(driverDocuments.driverId, dp.id));

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
      };
    })
  );

  return {
    drivers: results,
    page: safePage,
    limit: safeLimit,
    total: results.length,
  };
}

/**
 * 2. Lấy chi tiết hồ sơ tài xế theo driverId
 */
export async function getDriverKycDetail(driverId: string) {
  if (!driverId) {
    throw new ApiError(400, 'Thiếu mã tài xế (driverId)');
  }

  const profiles = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.id, driverId))
    .limit(1);

  if (profiles.length === 0) {
    throw new ApiError(404, 'Không tìm thấy hồ sơ tài xế');
  }

  const p = profiles[0];

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
    .limit(1);

  let vehicleType = null;
  if (p.vehicleTypeId) {
    const vt = await db
      .select()
      .from(vehicleTypes)
      .where(eq(vehicleTypes.id, p.vehicleTypeId))
      .limit(1);
    if (vt.length > 0) vehicleType = vt[0];
  }

  const docs = await db
    .select()
    .from(driverDocuments)
    .where(eq(driverDocuments.driverId, p.id));

  return {
    ...p,
    user: userList[0] || null,
    vehicleType,
    documents: docs,
  };
}

/**
 * 3. Phê duyệt hồ sơ KYC tài xế (APPROVED)
 */
export async function approveDriverKyc(driverId: string) {
  if (!driverId) {
    throw new ApiError(400, 'Thiếu mã tài xế (driverId)');
  }

  const existing = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.id, driverId))
    .limit(1);

  if (existing.length === 0) {
    throw new ApiError(404, 'Không tìm thấy hồ sơ tài xế để phê duyệt');
  }

  const updated = await db
    .update(driverProfiles)
    .set({
      kycStatus: 'APPROVED',
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.id, driverId))
    .returning();

  // Đảm bảo role của user là DRIVER
  await db
    .update(users)
    .set({ role: 'DRIVER' })
    .where(eq(users.id, existing[0].userId));

  return {
    driverId,
    kycStatus: updated[0].kycStatus,
    message: 'Phê duyệt hồ sơ KYC tài xế thành công. Tài xế hiện đã có thể bật Trực tuyến.',
  };
}

/**
 * 4. Từ chối hồ sơ KYC tài xế (REJECTED) kèm lý do
 */
export async function rejectDriverKyc(driverId: string, reason: string) {
  if (!driverId) {
    throw new ApiError(400, 'Thiếu mã tài xế (driverId)');
  }

  if (!reason || !reason.trim()) {
    throw new ApiError(400, 'Lý do từ chối hồ sơ không được để trống');
  }

  const existing = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.id, driverId))
    .limit(1);

  if (existing.length === 0) {
    throw new ApiError(404, 'Không tìm thấy hồ sơ tài xế để xử lý');
  }

  // Cập nhật trạng thái REJECTED, ghi lý do và buộc ngắt kết nối (isOnline = false)
  const updated = await db
    .update(driverProfiles)
    .set({
      kycStatus: 'REJECTED',
      rejectionReason: reason.trim(),
      isOnline: false,
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.id, driverId))
    .returning();

  return {
    driverId,
    kycStatus: updated[0].kycStatus,
    rejectionReason: updated[0].rejectionReason,
    isOnline: updated[0].isOnline,
    message: 'Đã từ chối phê duyệt hồ sơ KYC tài xế.',
  };
}

/**
 * 5. Lấy danh sách tất cả tài xế với bộ lọc trạng thái KYC, trực tuyến và tìm kiếm
 */
export async function getAllDrivers(params: {
  kycStatus?: string;
  isOnline?: boolean;
  search?: string;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

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
    .innerJoin(users, eq(driverProfiles.userId, users.id));

  const conditions = [];

  if (params.kycStatus && params.kycStatus !== 'ALL') {
    conditions.push(eq(driverProfiles.kycStatus, params.kycStatus as any));
  }

  if (params.isOnline !== undefined) {
    conditions.push(eq(driverProfiles.isOnline, params.isOnline));
  }

  const finalQuery = conditions.length > 0 ? query.where(and(...conditions)) : query;

  const rawList = await finalQuery
    .orderBy(desc(driverProfiles.updatedAt))
    .limit(limit)
    .offset(offset);

  // Đính kèm loại xe và số lượng giấy tờ
  const results = await Promise.all(
    rawList.map(async (dp) => {
      let vehicleType = null;
      if (dp.vehicleTypeId) {
        const vt = await db
          .select()
          .from(vehicleTypes)
          .where(eq(vehicleTypes.id, dp.vehicleTypeId))
          .limit(1);
        if (vt.length > 0) vehicleType = vt[0];
      }

      const docs = await db
        .select()
        .from(driverDocuments)
        .where(eq(driverDocuments.driverId, dp.id));

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
      };
    })
  );

  return {
    drivers: results,
    page,
    limit,
    total: results.length,
  };
}

/**
 * 6. Khóa hoặc kích hoạt lại tài khoản tài xế
 */
export async function setDriverActiveStatus(driverId: string, isActive: boolean) {
  if (!driverId) {
    throw new ApiError(400, 'Thiếu mã tài xế (driverId)');
  }

  const existing = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.id, driverId))
    .limit(1);

  if (existing.length === 0) {
    throw new ApiError(404, 'Không tìm thấy hồ sơ tài xế');
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
    .returning();

  return {
    driverId,
    isActive: updated[0].isActive,
    isOnline: updated[0].isOnline,
    message: isActive ? 'Đã kích hoạt tài xế' : 'Đã tạm khóa tài khoản tài xế',
  };
}
