import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../db';
import { b2bCustomers, users, driverProfiles, vehicleTypes, surchargeServices } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  getB2bCustomers,
  getB2bCustomerDetail,
  createB2bCustomer,
  updateB2bCustomer,
  setB2bCustomerStatus,
  recordB2bPayment,
} from '../lib/b2bService';
import {
  getAllDrivers,
  setDriverActiveStatus,
} from '../lib/adminService';
import {
  createPricingRule,
  createSurchargeService,
  updateSurchargeService,
  getPricingRules,
} from '../lib/pricingService';
import { generateToken } from '../lib/auth';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware';

async function runAdminFeaturesTests() {
  console.log('🛡️ ========================================================');
  console.log('   BẮT ĐẦU KIỂM THỬ: API ADMIN (SPRINT 2 - TASK 2.4)');
  console.log('   BẢNG GIÁ, DUYỆT TÀI XẾ, KHÁCH HÀNG DOANH NGHIỆP B2B');
  console.log('==========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Kiểm tra Khách hàng Doanh nghiệp B2B (Tạo mới, trùng MST, tính công nợ)
    console.log('1. Kiểm tra Module Khách hàng Doanh nghiệp B2B:');
    const testTaxCode = '0319876001';

    // Dọn dẹp dữ liệu test cũ nếu có
    await db.delete(b2bCustomers).where(eq(b2bCustomers.taxCode, testTaxCode));

    const newB2b = await createB2bCustomer({
      companyName: 'Công ty Cổ phần Giao nhận Nhanh VinaExpress',
      taxCode: testTaxCode,
      businessAddress: '78 Trường Sơn, Phường 2, Tân Bình, TP.HCM',
      contactName: 'Đặng Quốc Huy',
      contactPhone: '0938112233',
      invoiceEmail: 'hoadon@vinaexpress.vn',
      creditLimit: 60000000, // 60 triệu
      paymentTermDays: 30,
      discountPercent: 7.5,
      notes: 'Hợp đồng giao nhận linh kiện điện tử',
    });

    assert(!!newB2b.id, 'Tạo mới đối tác doanh nghiệp B2B thành công');
    assert(newB2b.taxCode === testTaxCode, 'Lưu đúng mã số thuế doanh nghiệp');
    assert(Number(newB2b.creditLimit) === 60000000, 'Hạn mức công nợ ban đầu: 60.000.000 VNĐ');

    // Kiểm tra chặn trùng Mã số thuế
    let duplicateBlocked = false;
    try {
      await createB2bCustomer({
        companyName: 'Công ty Trùng MST',
        taxCode: testTaxCode,
        businessAddress: 'Quận 1',
        contactName: 'Người đại diện',
        contactPhone: '0900000000',
      });
    } catch (err: any) {
      duplicateBlocked = err.message.includes('đã tồn tại');
    }
    assert(duplicateBlocked, 'Hệ thống chặn trùng lặp Mã số thuế doanh nghiệp');

    // 2. Tra cứu danh sách và chi tiết B2B
    console.log('\n2. Tra cứu danh sách và chi tiết khách hàng B2B:');
    const b2bList = await getB2bCustomers({ search: 'VinaExpress', page: 1, limit: 10 });
    const found = b2bList.customers.find((c) => c.taxCode === testTaxCode);
    assert(!!found, 'Tìm kiếm đối tác B2B theo tên/MST thành công');
    assert(found?.availableCredit === 60000000, 'Công nợ khả dụng ban đầu = Hạn mức được cấp (60tr)');

    const detail = await getB2bCustomerDetail(newB2b.id);
    assert(detail.companyName === newB2b.companyName, 'Lấy chi tiết hồ sơ doanh nghiệp thành công');

    // 3. Cập nhật thông tin & Ghi nhận thanh toán công nợ
    console.log('\n3. Cập nhật thông tin & Thanh toán công nợ B2B:');
    const updatedB2b = await updateB2bCustomer(newB2b.id, {
      creditLimit: 80000000, // Nâng hạn mức lên 80 triệu
      discountPercent: 9.0, // Nâng chiết khấu lên 9%
    });
    assert(Number(updatedB2b.creditLimit) === 80000000, 'Nâng hạn mức công nợ lên 80.000.000 VNĐ');
    assert(Number(updatedB2b.discountPercent) === 9.0, 'Cập nhật chiết khấu hợp đồng lên 9%');

    // Giả lập phát sinh nợ rồi thanh toán
    await db.update(b2bCustomers).set({ currentDebt: '25000000' }).where(eq(b2bCustomers.id, newB2b.id));
    const payment = await recordB2bPayment(newB2b.id, 15000000, 'Thanh toán đợt 1 tháng 10');
    assert(payment.paidAmount === 15000000, 'Ghi nhận số tiền thanh toán 15.000.000 VNĐ');
    assert(payment.remainingDebt === 10000000, 'Dư nợ còn lại chính xác: 10.000.000 VNĐ (25tr - 15tr)');

    // Bật/tắt trạng thái đối tác
    const suspendResult = await setB2bCustomerStatus(newB2b.id, 'SUSPENDED');
    assert(suspendResult.status === 'SUSPENDED', 'Tạm ngưng đối tác B2B thành công');
    const activeResult = await setB2bCustomerStatus(newB2b.id, 'ACTIVE');
    assert(activeResult.status === 'ACTIVE', 'Kích hoạt lại đối tác B2B thành công');

    // 4. Kiểm tra Quản lý Tài xế (Danh sách tổng, khóa tài khoản)
    console.log('\n4. Kiểm tra Quản lý Tài xế nâng cao:');
    const driversResult = await getAllDrivers({ page: 1, limit: 10 });
    assert(Array.isArray(driversResult.drivers), 'Lấy danh sách toàn bộ tài xế thành công');

    // Tạo 1 tài xế mẫu để test khóa tài khoản
    const testDriverPhone = '0977889900';
    await db.delete(users).where(eq(users.phone, testDriverPhone));
    const [testUser] = await db
      .insert(users)
      .values({ phone: testDriverPhone, role: 'DRIVER', fullName: 'Tài xế VIP' })
      .returning();
    const [testDriver] = await db
      .insert(driverProfiles)
      .values({ userId: testUser.id, kycStatus: 'APPROVED', isOnline: true, isActive: true })
      .returning();

    // Khóa tài xế
    const lockResult = await setDriverActiveStatus(testDriver.id, false);
    assert(lockResult.isActive === false && lockResult.isOnline === false, 'Khóa tài xế thành công và tự động ngắt Online');

    // Mở khóa tài xế
    const unlockResult = await setDriverActiveStatus(testDriver.id, true);
    assert(unlockResult.isActive === true, 'Mở khóa kích hoạt lại tài xế thành công');

    // 5. Kiểm tra Quản lý Bảng giá & Phụ phí
    console.log('\n5. Kiểm tra Admin Quản lý Bảng giá & Phụ phí:');
    const vTypes = await db.select().from(vehicleTypes).limit(1);
    const targetVehicle = vTypes[0];

    const pricingUpdate = await createPricingRule({
      vehicleTypeId: targetVehicle.id,
      basePrice: 155000,
      baseDistanceKm: 4.0,
      pricePerKm: 15500,
    });
    assert(Number(pricingUpdate.basePrice) === 155000, 'Admin cấu hình giá mở cửa mới thành công');

    // Thêm phụ phí mới
    const testSurchargeCode = 'TAILGATE_LIFT';
    await db.delete(surchargeServices).where(eq(surchargeServices.code, testSurchargeCode));
    const newSurcharge = await createSurchargeService({
      code: testSurchargeCode,
      name: 'Hỗ trợ bửng nâng hạ thủy lực',
      price: 70000,
      description: 'Phù hợp hàng nặng trên 200kg cần bửng nâng',
    });
    assert(newSurcharge.code === testSurchargeCode, 'Thêm mới phụ phí bửng nâng hạ thành công');

    // Cập nhật phụ phí
    const updatedSurcharge = await updateSurchargeService(testSurchargeCode, {
      price: 80000,
      isActive: true,
    });
    assert(Number(updatedSurcharge.price) === 80000, 'Cập nhật giá phụ phí lên 80.000đ thành công');

    // 6. Kiểm tra Phân quyền bảo mật (Security Authorization)
    console.log('\n6. Kiểm tra Phân quyền chặt chẽ (Role Authorization):');
    const customerToken = generateToken({
      userId: '44444444-5555-6666-7777-888888888888',
      role: 'CUSTOMER',
      phone: '0901112233',
    });
    const adminToken = generateToken({
      userId: '55555555-6666-7777-8888-999999999999',
      role: 'ADMIN',
      phone: '0909999999',
    });

    let customerBlocked = false;
    try {
      const decoded = authenticate(`Bearer ${customerToken}`);
      authorizeRoles(decoded, ['ADMIN']);
    } catch {
      customerBlocked = true;
    }
    assert(customerBlocked, 'Chặn tài khoản CUSTOMER truy cập các API Quản trị Admin');

    let adminAllowed = false;
    try {
      const decoded = authenticate(`Bearer ${adminToken}`);
      authorizeRoles(decoded, ['ADMIN']);
      adminAllowed = true;
    } catch {
      adminAllowed = false;
    }
    assert(adminAllowed, 'ADMIN có toàn quyền truy cập các API quản trị');

    // Dọn dẹp dữ liệu test
    await db.delete(b2bCustomers).where(eq(b2bCustomers.id, newB2b.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    await db.delete(surchargeServices).where(eq(surchargeServices.code, testSurchargeCode));

    console.log('\n==========================================================');
    console.log(`🎉 KẾT QUẢ KIỂM THỬ ADMIN & B2B: ${passed} PASS, ${failed} FAIL`);
    console.log('==========================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err);
    process.exit(1);
  }
}

runAdminFeaturesTests();
