import { eq, and, desc, ne } from 'drizzle-orm';
import { db } from '../db';
import { customerAddresses } from '../db/schema';
import { validateAndNormalizePhone } from './sms/types';

export interface CreateAddressInput {
  title?: string;
  addressText: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  contactName?: string;
  contactPhone?: string;
  isDefault?: boolean;
}

export interface UpdateAddressInput {
  title?: string;
  addressText?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  contactName?: string;
  contactPhone?: string;
  isDefault?: boolean;
}

/**
 * Validate tọa độ địa lý WGS 84
 */
function validateCoordinates(lat?: number | string | null, lng?: number | string | null) {
  if (lat !== undefined && lat !== null && lat !== '') {
    const latNum = Number(lat);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      throw new Error('Vĩ độ (Latitude) không hợp lệ (phải từ -90 đến 90)');
    }
  }

  if (lng !== undefined && lng !== null && lng !== '') {
    const lngNum = Number(lng);
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      throw new Error('Kinh độ (Longitude) không hợp lệ (phải từ -180 đến 180)');
    }
  }
}

/**
 * 1. Lấy danh sách sổ địa chỉ của khách hàng
 */
export async function getCustomerAddresses(userId: string) {
  if (!userId) {
    throw new Error('Thiếu ID người dùng');
  }

  const list = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.userId, userId))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));

  return list;
}

/**
 * 2. Thêm địa chỉ mới vào sổ địa chỉ
 */
export async function createCustomerAddress(userId: string, input: CreateAddressInput) {
  if (!userId) {
    throw new Error('Thiếu ID người dùng');
  }

  if (!input.addressText || !input.addressText.trim()) {
    throw new Error('Địa chỉ chi tiết (addressText) không được để trống');
  }

  validateCoordinates(input.latitude, input.longitude);

  let contactPhone = input.contactPhone?.trim();
  if (contactPhone) {
    const phoneCheck = validateAndNormalizePhone(contactPhone);
    if (phoneCheck.valid) {
      contactPhone = phoneCheck.standardPhone;
    }
  }

  // Đếm xem user đã có địa chỉ nào chưa
  const existingList = await db
    .select({ id: customerAddresses.id })
    .from(customerAddresses)
    .where(eq(customerAddresses.userId, userId));

  // Nếu là địa chỉ đầu tiên thì luôn là mặc định
  let shouldBeDefault = input.isDefault ?? false;
  if (existingList.length === 0) {
    shouldBeDefault = true;
  }

  // Nếu địa chỉ mới là mặc định, reset các địa chỉ cũ thành false
  if (shouldBeDefault) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.userId, userId));
  }

  const inserted = await db
    .insert(customerAddresses)
    .values({
      userId,
      title: input.title?.trim() || null,
      addressText: input.addressText.trim(),
      latitude: input.latitude !== undefined && input.latitude !== null && input.latitude !== '' ? String(input.latitude) : null,
      longitude: input.longitude !== undefined && input.longitude !== null && input.longitude !== '' ? String(input.longitude) : null,
      contactName: input.contactName?.trim() || null,
      contactPhone: contactPhone || null,
      isDefault: shouldBeDefault,
    })
    .returning();

  return inserted[0];
}

/**
 * 3. Cập nhật thông tin địa chỉ
 */
export async function updateCustomerAddress(userId: string, addressId: string, input: UpdateAddressInput) {
  if (!userId || !addressId) {
    throw new Error('Thiếu ID người dùng hoặc ID địa chỉ');
  }

  // Kiểm tra địa chỉ có tồn tại và thuộc về user không
  const existing = await db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Địa chỉ không tồn tại hoặc bạn không có quyền chỉnh sửa địa chỉ này');
  }

  validateCoordinates(input.latitude, input.longitude);

  let contactPhone = input.contactPhone !== undefined ? input.contactPhone?.trim() : existing[0].contactPhone;
  if (contactPhone) {
    const phoneCheck = validateAndNormalizePhone(contactPhone);
    if (phoneCheck.valid) {
      contactPhone = phoneCheck.standardPhone;
    }
  }

  // Nếu cập nhật thành mặc định, reset các địa chỉ khác
  if (input.isDefault === true) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(and(eq(customerAddresses.userId, userId), ne(customerAddresses.id, addressId)));
  }

  const updated = await db
    .update(customerAddresses)
    .set({
      title: input.title !== undefined ? (input.title?.trim() || null) : existing[0].title,
      addressText: input.addressText !== undefined ? input.addressText.trim() : existing[0].addressText,
      latitude: input.latitude !== undefined ? (input.latitude !== null && input.latitude !== '' ? String(input.latitude) : null) : existing[0].latitude,
      longitude: input.longitude !== undefined ? (input.longitude !== null && input.longitude !== '' ? String(input.longitude) : null) : existing[0].longitude,
      contactName: input.contactName !== undefined ? (input.contactName?.trim() || null) : existing[0].contactName,
      contactPhone: contactPhone || null,
      isDefault: input.isDefault !== undefined ? input.isDefault : existing[0].isDefault,
    })
    .where(eq(customerAddresses.id, addressId))
    .returning();

  return updated[0];
}

/**
 * 4. Xóa địa chỉ khỏi sổ
 */
export async function deleteCustomerAddress(userId: string, addressId: string) {
  if (!userId || !addressId) {
    throw new Error('Thiếu ID người dùng hoặc ID địa chỉ');
  }

  const existing = await db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Địa chỉ không tồn tại hoặc bạn không có quyền xóa địa chỉ này');
  }

  const wasDefault = existing[0].isDefault;

  // Thực hiện xóa
  await db.delete(customerAddresses).where(eq(customerAddresses.id, addressId));

  // Nếu địa chỉ vừa xóa là mặc định, tự động gán địa chỉ mới nhất còn lại làm mặc định
  if (wasDefault) {
    const remaining = await db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.userId, userId))
      .orderBy(desc(customerAddresses.createdAt))
      .limit(1);

    if (remaining.length > 0) {
      await db
        .update(customerAddresses)
        .set({ isDefault: true })
        .where(eq(customerAddresses.id, remaining[0].id));
    }
  }

  return {
    success: true,
    message: 'Đã xóa địa chỉ thành công',
  };
}

/**
 * 5. Đặt làm địa chỉ mặc định
 */
export async function setDefaultCustomerAddress(userId: string, addressId: string) {
  if (!userId || !addressId) {
    throw new Error('Thiếu ID người dùng hoặc ID địa chỉ');
  }

  const existing = await db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Địa chỉ không tồn tại hoặc bạn không có quyền sửa địa chỉ này');
  }

  // Bỏ mặc định tất cả các địa chỉ khác
  await db
    .update(customerAddresses)
    .set({ isDefault: false })
    .where(eq(customerAddresses.userId, userId));

  // Đặt địa chỉ này làm mặc định
  const updated = await db
    .update(customerAddresses)
    .set({ isDefault: true })
    .where(eq(customerAddresses.id, addressId))
    .returning();

  return updated[0];
}
