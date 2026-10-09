import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { b2bCustomers } from '../db/schema';
import { ApiError } from './errors';

export interface CreateB2bCustomerInput {
  userId?: string;
  companyName: string;
  taxCode: string;
  businessAddress: string;
  contactName: string;
  contactPhone: string;
  invoiceEmail?: string;
  creditLimit?: number;
  paymentTermDays?: number;
  discountPercent?: number;
  notes?: string;
}

export interface UpdateB2bCustomerInput {
  companyName?: string;
  taxCode?: string;
  businessAddress?: string;
  contactName?: string;
  contactPhone?: string;
  invoiceEmail?: string;
  creditLimit?: number;
  paymentTermDays?: number;
  discountPercent?: number;
  status?: string;
  notes?: string;
}

/**
 * 1. Lấy danh sách khách hàng doanh nghiệp B2B (kèm tìm kiếm & phân trang)
 */
export async function getB2bCustomers(params: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  let query = db.select().from(b2bCustomers);

  const conditions = [];

  if (params.status && params.status !== 'ALL') {
    conditions.push(eq(b2bCustomers.status, params.status.toUpperCase()));
  }

  if (params.search && params.search.trim()) {
    const s = `%${params.search.trim()}%`;
    conditions.push(
      or(
        ilike(b2bCustomers.companyName, s),
        ilike(b2bCustomers.taxCode, s),
        ilike(b2bCustomers.contactPhone, s),
        ilike(b2bCustomers.contactName, s)
      )
    );
  }

  const finalQuery = conditions.length > 0
    ? query.where(and(...conditions))
    : query;

  const rawList = await finalQuery
    .orderBy(desc(b2bCustomers.createdAt))
    .limit(limit)
    .offset(offset);

  // Đếm tổng số lượng
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(b2bCustomers)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const total = countResult[0]?.count || 0;

  // Tính toán hạn mức công nợ khả dụng cho từng doanh nghiệp
  const customers = rawList.map((c) => {
    const creditLimit = Number(c.creditLimit || 0);
    const currentDebt = Number(c.currentDebt || 0);
    const availableCredit = Math.max(0, creditLimit - currentDebt);
    const debtUsagePercent = creditLimit > 0 ? Math.round((currentDebt / creditLimit) * 100) : 0;

    return {
      ...c,
      creditLimit,
      currentDebt,
      availableCredit,
      debtUsagePercent,
      discountPercent: Number(c.discountPercent || 0),
    };
  });

  return {
    customers,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 2. Lấy thông tin chi tiết một khách hàng B2B theo ID
 */
export async function getB2bCustomerDetail(id: string) {
  if (!id) throw new ApiError(400, 'Thiếu mã khách hàng doanh nghiệp (id)');

  const list = await db
    .select()
    .from(b2bCustomers)
    .where(eq(b2bCustomers.id, id))
    .limit(1);

  if (list.length === 0) {
    throw new ApiError(404, 'Không tìm thấy khách hàng doanh nghiệp');
  }

  const c = list[0];
  const creditLimit = Number(c.creditLimit || 0);
  const currentDebt = Number(c.currentDebt || 0);
  const availableCredit = Math.max(0, creditLimit - currentDebt);
  const debtUsagePercent = creditLimit > 0 ? Math.round((currentDebt / creditLimit) * 100) : 0;

  return {
    ...c,
    creditLimit,
    currentDebt,
    availableCredit,
    debtUsagePercent,
    discountPercent: Number(c.discountPercent || 0),
  };
}

/**
 * 3. Tạo mới khách hàng doanh nghiệp B2B
 */
export async function createB2bCustomer(input: CreateB2bCustomerInput) {
  if (!input.companyName || !input.companyName.trim()) {
    throw new ApiError(400, 'Tên doanh nghiệp không được để trống');
  }

  if (!input.taxCode || !input.taxCode.trim()) {
    throw new ApiError(400, 'Mã số thuế không được để trống');
  }

  if (!input.businessAddress || !input.businessAddress.trim()) {
    throw new ApiError(400, 'Địa chỉ trụ sở doanh nghiệp không được để trống');
  }

  if (!input.contactName || !input.contactName.trim()) {
    throw new ApiError(400, 'Tên người liên hệ không được để trống');
  }

  if (!input.contactPhone || !input.contactPhone.trim()) {
    throw new ApiError(400, 'Số điện thoại liên hệ không được để trống');
  }

  const cleanTaxCode = input.taxCode.trim();

  // Kiểm tra trùng Mã số thuế
  const existing = await db
    .select()
    .from(b2bCustomers)
    .where(eq(b2bCustomers.taxCode, cleanTaxCode))
    .limit(1);

  if (existing.length > 0) {
    throw new ApiError(400, `Mã số thuế "${cleanTaxCode}" đã tồn tại trong hệ thống`);
  }

  const inserted = await db
    .insert(b2bCustomers)
    .values({
      userId: input.userId || null,
      companyName: input.companyName.trim(),
      taxCode: cleanTaxCode,
      businessAddress: input.businessAddress.trim(),
      contactName: input.contactName.trim(),
      contactPhone: input.contactPhone.trim(),
      invoiceEmail: input.invoiceEmail?.trim() || null,
      creditLimit: String(input.creditLimit ?? 0),
      currentDebt: '0',
      paymentTermDays: input.paymentTermDays ?? 30,
      discountPercent: String(input.discountPercent ?? 0),
      status: 'ACTIVE',
      notes: input.notes?.trim() || null,
    })
    .returning();

  return inserted[0];
}

/**
 * 4. Cập nhật thông tin khách hàng B2B
 */
export async function updateB2bCustomer(id: string, input: UpdateB2bCustomerInput) {
  if (!id) throw new ApiError(400, 'Thiếu mã khách hàng doanh nghiệp (id)');

  const existing = await db
    .select()
    .from(b2bCustomers)
    .where(eq(b2bCustomers.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw new ApiError(404, 'Không tìm thấy khách hàng doanh nghiệp để cập nhật');
  }

  // Kiểm tra trùng MST nếu đổi MST
  if (input.taxCode && input.taxCode.trim() !== existing[0].taxCode) {
    const cleanTaxCode = input.taxCode.trim();
    const duplicate = await db
      .select()
      .from(b2bCustomers)
      .where(eq(b2bCustomers.taxCode, cleanTaxCode))
      .limit(1);

    if (duplicate.length > 0) {
      throw new ApiError(400, `Mã số thuế "${cleanTaxCode}" đã thuộc về doanh nghiệp khác`);
    }
  }

  const updateFields: any = {
    updatedAt: new Date(),
  };

  if (input.companyName !== undefined) updateFields.companyName = input.companyName.trim();
  if (input.taxCode !== undefined) updateFields.taxCode = input.taxCode.trim();
  if (input.businessAddress !== undefined) updateFields.businessAddress = input.businessAddress.trim();
  if (input.contactName !== undefined) updateFields.contactName = input.contactName.trim();
  if (input.contactPhone !== undefined) updateFields.contactPhone = input.contactPhone.trim();
  if (input.invoiceEmail !== undefined) updateFields.invoiceEmail = input.invoiceEmail?.trim() || null;
  if (input.creditLimit !== undefined) updateFields.creditLimit = String(input.creditLimit);
  if (input.paymentTermDays !== undefined) updateFields.paymentTermDays = input.paymentTermDays;
  if (input.discountPercent !== undefined) updateFields.discountPercent = String(input.discountPercent);
  if (input.status !== undefined) updateFields.status = input.status.toUpperCase();
  if (input.notes !== undefined) updateFields.notes = input.notes?.trim() || null;

  const updated = await db
    .update(b2bCustomers)
    .set(updateFields)
    .where(eq(b2bCustomers.id, id))
    .returning();

  return updated[0];
}

/**
 * 5. Bật/Tắt trạng thái hoạt động của đối tác B2B (ACTIVE / SUSPENDED)
 */
export async function setB2bCustomerStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
  if (!id) throw new ApiError(400, 'Thiếu mã khách hàng doanh nghiệp');
  if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
    throw new ApiError(400, 'Trạng thái phải là ACTIVE hoặc SUSPENDED');
  }

  const updated = await db
    .update(b2bCustomers)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(b2bCustomers.id, id))
    .returning();

  if (updated.length === 0) {
    throw new ApiError(404, 'Không tìm thấy khách hàng doanh nghiệp');
  }

  return {
    id,
    status: updated[0].status,
    message: status === 'ACTIVE' ? 'Đã kích hoạt đối tác B2B thành công' : 'Đã tạm ngưng đối tác B2B',
  };
}

/**
 * 6. Ghi nhận thanh toán công nợ (Doanh nghiệp chuyển khoản trả nợ)
 */
export async function recordB2bPayment(id: string, amount: number, note?: string) {
  if (!id) throw new ApiError(400, 'Thiếu mã khách hàng doanh nghiệp');
  if (!amount || amount <= 0) {
    throw new ApiError(400, 'Số tiền thanh toán phải lớn hơn 0');
  }

  const existing = await db
    .select()
    .from(b2bCustomers)
    .where(eq(b2bCustomers.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw new ApiError(404, 'Không tìm thấy khách hàng doanh nghiệp');
  }

  const currentDebt = Number(existing[0].currentDebt || 0);
  const newDebt = Math.max(0, currentDebt - amount);

  const updated = await db
    .update(b2bCustomers)
    .set({
      currentDebt: String(newDebt),
      updatedAt: new Date(),
    })
    .where(eq(b2bCustomers.id, id))
    .returning();

  return {
    id,
    paidAmount: amount,
    previousDebt: currentDebt,
    remainingDebt: newDebt,
    note: note || 'Thanh toán công nợ kỳ',
    message: `Đã ghi nhận thanh toán ${amount.toLocaleString()} VNĐ thành công`,
  };
}
