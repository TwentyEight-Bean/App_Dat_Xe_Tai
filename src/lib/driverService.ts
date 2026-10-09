import { eq, and, ne } from 'drizzle-orm';
import { db } from '../db';
import {
  driverProfiles,
  driverDocuments,
  vehicleTypes,
  users,
} from '../db/schema';
import { ApiError } from './errors';

export type DriverDocType =
  | 'CCCD_FRONT'
  | 'CCCD_BACK'
  | 'DRIVER_LICENSE'
  | 'VEHICLE_REGISTRATION'
  | 'PORTRAIT';

export const REQUIRED_KYC_DOC_TYPES: DriverDocType[] = [
  'CCCD_FRONT',
  'CCCD_BACK',
  'DRIVER_LICENSE',
  'VEHICLE_REGISTRATION',
];

export interface SubmitKycDocumentDto {
  docType: DriverDocType;
  fileUrl: string;
  docNumber?: string;
}

export interface SubmitDriverKycDto {
  vehicleTypeId?: string;
  licensePlate?: string;
  driverLicenseNo?: string;
  documents: SubmitKycDocumentDto[];
}

/**
 * 1. Lấy danh sách các loại xe tải đang hoạt động
 */
export async function getVehicleTypes() {
  return await db
    .select()
    .from(vehicleTypes)
    .where(eq(vehicleTypes.isActive, true));
}

/**
 * 2. Lấy hoặc tự động khởi tạo hồ sơ tài xế cho user
 */
export async function getOrCreateDriverProfile(userId: string) {
  if (!userId) {
    throw new ApiError(400, 'Thiếu thông tin người dùng (userId)');
  }

  // Kiểm tra user có tồn tại không
  const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userList.length === 0) {
    throw new ApiError(404, 'Không tìm thấy người dùng trong hệ thống');
  }

  // Tìm hồ sơ tài xế hiện có
  let profile = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, userId))
    .limit(1);

  if (profile.length > 0) {
    return profile[0];
  }

  // Nếu chưa có, tạo mới hồ sơ tài xế với trạng thái mặc định
  const inserted = await db
    .insert(driverProfiles)
    .values({
      userId,
      kycStatus: 'PENDING',
      isOnline: false,
      isActive: true,
    })
    .returning();

  // Đảm bảo role của user là DRIVER
  if (userList[0].role !== 'DRIVER') {
    await db.update(users).set({ role: 'DRIVER' }).where(eq(users.id, userId));
  }

  return inserted[0];
}

/**
 * 3. Lấy hồ sơ tài xế chi tiết kèm danh sách giấy tờ đã nộp
 */
export async function getDriverProfile(userId: string) {
  if (!userId) {
    throw new ApiError(400, 'Thiếu thông tin người dùng (userId)');
  }

  const profile = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, userId))
    .limit(1);

  if (profile.length === 0) {
    return null;
  }

  const p = profile[0];

  // Lấy thông tin loại xe
  let vehicleType = null;
  if (p.vehicleTypeId) {
    const vList = await db
      .select()
      .from(vehicleTypes)
      .where(eq(vehicleTypes.id, p.vehicleTypeId))
      .limit(1);
    if (vList.length > 0) {
      vehicleType = vList[0];
    }
  }

  // Lấy thông tin user
  const uList = await db
    .select({
      id: users.id,
      phone: users.phone,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Lấy danh sách tài liệu
  const docs = await db
    .select()
    .from(driverDocuments)
    .where(eq(driverDocuments.driverId, p.id));

  return {
    ...p,
    user: uList[0] || null,
    vehicleType,
    documents: docs,
  };
}

/**
 * 4. Nộp hồ sơ KYC tài xế (Giấy tờ, Biển số, Loại xe, Số bằng lái)
 */
export async function submitDriverKyc(userId: string, data: SubmitDriverKycDto) {
  if (!userId) {
    throw new ApiError(400, 'Thiếu thông tin người dùng');
  }

  if (!data || !Array.isArray(data.documents) || data.documents.length === 0) {
    throw new ApiError(400, 'Danh sách giấy tờ (documents) không được để trống');
  }

  // Xác thực từng giấy tờ
  const validDocTypes: DriverDocType[] = [
    'CCCD_FRONT',
    'CCCD_BACK',
    'DRIVER_LICENSE',
    'VEHICLE_REGISTRATION',
    'PORTRAIT',
  ];

  for (const doc of data.documents) {
    if (!validDocTypes.includes(doc.docType)) {
      throw new ApiError(
        400,
        `Loại tài liệu "${doc.docType}" không hợp lệ. Cho phép: ${validDocTypes.join(', ')}`
      );
    }
    if (!doc.fileUrl || typeof doc.fileUrl !== 'string' || !doc.fileUrl.trim()) {
      throw new ApiError(400, `Đường dẫn ảnh/tài liệu "${doc.docType}" không được để trống`);
    }
  }

  // Lấy hoặc khởi tạo profile
  const profile = await getOrCreateDriverProfile(userId);

  // Kiểm tra loại xe nếu có gửi lên
  if (data.vehicleTypeId) {
    const vCheck = await db
      .select()
      .from(vehicleTypes)
      .where(eq(vehicleTypes.id, data.vehicleTypeId))
      .limit(1);
    if (vCheck.length === 0) {
      throw new ApiError(400, 'Mã loại xe (vehicleTypeId) không tồn tại');
    }
  }

  // Kiểm tra biển số xe trùng lặp với tài xế khác
  if (data.licensePlate) {
    const cleanPlate = data.licensePlate.trim().toUpperCase();
    const existingPlate = await db
      .select()
      .from(driverProfiles)
      .where(
        and(
          eq(driverProfiles.licensePlate, cleanPlate),
          ne(driverProfiles.id, profile.id)
        )
      )
      .limit(1);

    if (existingPlate.length > 0) {
      throw new ApiError(400, `Biển số xe "${cleanPlate}" đã được đăng ký bởi tài xế khác`);
    }
    data.licensePlate = cleanPlate;
  }

  // Kiểm tra số GPLX trùng lặp với tài xế khác
  if (data.driverLicenseNo) {
    const cleanLicense = data.driverLicenseNo.trim();
    const existingLicense = await db
      .select()
      .from(driverProfiles)
      .where(
        and(
          eq(driverProfiles.driverLicenseNo, cleanLicense),
          ne(driverProfiles.id, profile.id)
        )
      )
      .limit(1);

    if (existingLicense.length > 0) {
      throw new ApiError(400, `Số giấy phép lái xe "${cleanLicense}" đã được đăng ký bởi tài xế khác`);
    }
    data.driverLicenseNo = cleanLicense;
  }

  // Cập nhật thông tin hồ sơ tài xế: chuyển về PENDING để admin xét duyệt
  const updateFields: any = {
    kycStatus: 'PENDING',
    rejectionReason: null, // Reset lý do từ chối cũ
    updatedAt: new Date(),
  };

  if (data.vehicleTypeId) updateFields.vehicleTypeId = data.vehicleTypeId;
  if (data.licensePlate) updateFields.licensePlate = data.licensePlate;
  if (data.driverLicenseNo) updateFields.driverLicenseNo = data.driverLicenseNo;

  await db
    .update(driverProfiles)
    .set(updateFields)
    .where(eq(driverProfiles.id, profile.id));

  // Lưu hoặc cập nhật các giấy tờ
  for (const doc of data.documents) {
    // Xóa giấy tờ cùng loại cũ nếu có
    await db
      .delete(driverDocuments)
      .where(
        and(
          eq(driverDocuments.driverId, profile.id),
          eq(driverDocuments.docType, doc.docType)
        )
      );

    // Chèn giấy tờ mới
    await db.insert(driverDocuments).values({
      driverId: profile.id,
      docType: doc.docType,
      fileUrl: doc.fileUrl.trim(),
      docNumber: doc.docNumber ? doc.docNumber.trim() : null,
    });
  }

  // Trả về hồ sơ đầy đủ sau khi nộp
  return await getDriverProfile(userId);
}

/**
 * 5. Lấy trạng thái KYC hiện tại của tài xế
 */
export async function getDriverKycStatus(userId: string) {
  const profile = await getDriverProfile(userId);
  if (!profile) {
    return {
      hasProfile: false,
      kycStatus: null,
      isOnline: false,
      isActive: false,
      canGoOnline: false,
      missingDocuments: REQUIRED_KYC_DOC_TYPES,
      message: 'Chưa có hồ sơ tài xế',
    };
  }

  const submittedDocTypes = (profile.documents || []).map((d: any) => d.docType as DriverDocType);
  const missingDocuments = REQUIRED_KYC_DOC_TYPES.filter(
    (reqDoc) => !submittedDocTypes.includes(reqDoc)
  );

  const canGoOnline = profile.kycStatus === 'APPROVED' && profile.isActive === true;

  return {
    hasProfile: true,
    driverId: profile.id,
    kycStatus: profile.kycStatus,
    rejectionReason: profile.rejectionReason,
    isOnline: profile.isOnline,
    isActive: profile.isActive,
    canGoOnline,
    licensePlate: profile.licensePlate,
    driverLicenseNo: profile.driverLicenseNo,
    vehicleType: profile.vehicleType,
    documentsCount: profile.documents.length,
    missingDocuments,
  };
}

/**
 * 6. Bật/Tắt trạng thái Trực tuyến (Online / Offline Toggle)
 * 
 * RÀNG BUỘC NGHIÊM NGẶT:
 * - Nếu isOnline = true, bắt buộc kycStatus === 'APPROVED' và isActive === true.
 * - Nếu không thỏa mãn, chặn ngay với mã lỗi 403 Forbidden (KYC_NOT_APPROVED).
 */
export async function setDriverOnlineStatus(userId: string, isOnline: boolean) {
  if (!userId) {
    throw new ApiError(400, 'Thiếu thông tin người dùng');
  }

  if (typeof isOnline !== 'boolean') {
    throw new ApiError(400, 'Trạng thái isOnline phải là giá trị boolean (true/false)');
  }

  const profile = await db
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, userId))
    .limit(1);

  if (profile.length === 0) {
    throw new ApiError(404, 'Không tìm thấy hồ sơ tài xế');
  }

  const p = profile[0];

  // Khi tài xế muốn BẬT Trực tuyến (isOnline = true):
  if (isOnline) {
    // 1. Kiểm tra trạng thái phê duyệt KYC
    if (p.kycStatus !== 'APPROVED') {
      const statusText =
        p.kycStatus === 'PENDING'
          ? 'Hồ sơ đang chờ Quản trị viên xét duyệt'
          : p.kycStatus === 'REJECTED'
          ? `Hồ sơ đã bị từ chối (${p.rejectionReason || 'Vui lòng nộp lại giấy tờ'})`
          : 'Chưa hoàn tất nộp hồ sơ KYC';

      throw new ApiError(
        403,
        `FORBIDDEN: Bạn chưa thể bật trực tuyến. ${statusText}. Chỉ tài xế có hồ sơ ĐÃ ĐƯỢC PHÊ DUYỆT mới có thể nhận chuyến.`,
        'KYC_NOT_APPROVED'
      );
    }

    // 2. Kiểm tra trạng thái hoạt động của tài khoản
    if (!p.isActive) {
      throw new ApiError(
        403,
        'FORBIDDEN: Tài khoản tài xế của bạn đang bị tạm ngưng hoặc vô hiệu hóa. Vui lòng liên hệ tổng đài hỗ trợ.',
        'DRIVER_INACTIVE'
      );
    }
  }

  // Cập nhật trạng thái trực tuyến
  const updated = await db
    .update(driverProfiles)
    .set({
      isOnline,
      updatedAt: new Date(),
    })
    .where(eq(driverProfiles.id, p.id))
    .returning();

  return {
    driverId: p.id,
    isOnline: updated[0].isOnline,
    kycStatus: updated[0].kycStatus,
    message: isOnline
      ? 'Đã bật trạng thái trực tuyến thành công. Bạn đã sẵn sàng nhận chuyến!'
      : 'Đã tắt trạng thái trực tuyến. Bạn đang ở chế độ nghỉ (Ngoại tuyến).',
  };
}
