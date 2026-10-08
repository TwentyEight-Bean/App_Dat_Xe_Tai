import type { IncomingMessage, ServerResponse } from 'node:http';
import { requestOtp, verifyOtp } from '../lib/otpService';
import {
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from '../lib/addressService';
import {
  getVehicleTypes,
  getDriverProfile,
  getOrCreateDriverProfile,
  submitDriverKyc,
  getDriverKycStatus,
  setDriverOnlineStatus,
} from '../lib/driverService';
import {
  getPendingKycDrivers,
  getDriverKycDetail,
  approveDriverKyc,
  rejectDriverKyc,
  getAllDrivers,
  setDriverActiveStatus,
} from '../lib/adminService';
import {
  getPricingRules,
  getSurchargeServices,
  estimateBookingPrice,
  updatePricingRule,
  createPricingRule,
  createSurchargeService,
  updateSurchargeService,
} from '../lib/pricingService';
import {
  getB2bCustomers,
  getB2bCustomerDetail,
  createB2bCustomer,
  updateB2bCustomer,
  setB2bCustomerStatus,
  recordB2bPayment,
} from '../lib/b2bService';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware';

/**
 * Đọc JSON body từ HTTP Request
 */
async function parseJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      // Chặn payload quá lớn (> 1MB)
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Trả về JSON Response chuẩn
 */
function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.end(JSON.stringify(data));
}

/**
 * Router chính xử lý tất cả các API `/api/v1/*`
 */
export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const method = req.method?.toUpperCase() || 'GET';

  // Xử lý CORS Preflight
  if (method === 'OPTIONS') {
    sendJson(res, 204, null);
    return true;
  }

  // Chỉ bắt các request bắt đầu bằng /api/v1 hoặc /api
  const parsedUrl = new URL(url, 'http://localhost');
  const pathname = parsedUrl.pathname.replace(/^\/api\/v1/, '/api');

  if (!pathname.startsWith('/api')) {
    return false; // Không phải API request, chuyển tiếp cho Vite/Static server
  }

  try {
    // =========================================================================
    // 1. AUTH MODULE
    // =========================================================================

    // POST /api/auth/request-otp
    if (pathname === '/api/auth/request-otp' && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await requestOtp(body.phone);
      sendJson(res, 200, result);
      return true;
    }

    // POST /api/auth/verify-otp
    if (pathname === '/api/auth/verify-otp' && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await verifyOtp(body.phone, body.otp);
      sendJson(res, 200, result);
      return true;
    }

    // GET /api/auth/me (Lấy thông tin tài khoản hiện tại từ Token)
    if (pathname === '/api/auth/me' && method === 'GET') {
      const payload = authenticate(req.headers.authorization);
      sendJson(res, 200, {
        success: true,
        user: payload,
      });
      return true;
    }

    // =========================================================================
    // 2. CUSTOMER ADDRESS BOOK MODULE
    // =========================================================================

    // GET /api/customer/addresses -> Lấy danh sách địa chỉ
    if (pathname === '/api/customer/addresses' && method === 'GET') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['CUSTOMER', 'ADMIN']);
      const addresses = await getCustomerAddresses(user.userId);
      sendJson(res, 200, {
        success: true,
        data: addresses,
      });
      return true;
    }

    // POST /api/customer/addresses -> Thêm địa chỉ mới
    if (pathname === '/api/customer/addresses' && method === 'POST') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['CUSTOMER', 'ADMIN']);
      const body = await parseJsonBody(req);
      const newAddress = await createCustomerAddress(user.userId, body);
      sendJson(res, 201, {
        success: true,
        message: 'Thêm địa chỉ vào sổ thành công',
        data: newAddress,
      });
      return true;
    }

    // Các routes có chứa addressId: /api/customer/addresses/:id
    const addressIdMatch = pathname.match(/^\/api\/customer\/addresses\/([a-zA-Z0-9\-]+)(\/(default|set-default))?$/);
    if (addressIdMatch) {
      const addressId = addressIdMatch[1];
      const subAction = addressIdMatch[3];

      // PATCH /api/customer/addresses/:id/default hoặc set-default -> Đặt mặc định
      if ((method === 'PATCH' || method === 'POST') && (subAction === 'default' || subAction === 'set-default')) {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['CUSTOMER', 'ADMIN']);
        const updated = await setDefaultCustomerAddress(user.userId, addressId);
        sendJson(res, 200, {
          success: true,
          message: 'Đã đặt làm địa chỉ mặc định',
          data: updated,
        });
        return true;
      }

      // PUT /api/customer/addresses/:id -> Sửa địa chỉ
      if (method === 'PUT' && !subAction) {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['CUSTOMER', 'ADMIN']);
        const body = await parseJsonBody(req);
        const updated = await updateCustomerAddress(user.userId, addressId, body);
        sendJson(res, 200, {
          success: true,
          message: 'Cập nhật địa chỉ thành công',
          data: updated,
        });
        return true;
      }

      // DELETE /api/customer/addresses/:id -> Xóa địa chỉ
      if (method === 'DELETE' && !subAction) {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['CUSTOMER', 'ADMIN']);
        const result = await deleteCustomerAddress(user.userId, addressId);
        sendJson(res, 200, result);
        return true;
      }
    }

    // =========================================================================
    // 3. DRIVER MODULE (KYC & ONLINE/OFFLINE STATUS)
    // =========================================================================

    // GET /api/driver/vehicle-types -> Lấy danh sách loại xe tải
    if (pathname === '/api/driver/vehicle-types' && method === 'GET') {
      const types = await getVehicleTypes();
      sendJson(res, 200, {
        success: true,
        data: types,
      });
      return true;
    }

    // GET /api/driver/profile -> Lấy thông tin hồ sơ tài xế hiện tại
    if (pathname === '/api/driver/profile' && method === 'GET') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['DRIVER', 'ADMIN']);
      const profile = await getDriverProfile(user.userId);
      sendJson(res, 200, {
        success: true,
        data: profile,
      });
      return true;
    }

    // GET /api/driver/kyc/status -> Lấy trạng thái duyệt hồ sơ KYC
    if (pathname === '/api/driver/kyc/status' && method === 'GET') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['DRIVER', 'ADMIN']);
      const status = await getDriverKycStatus(user.userId);
      sendJson(res, 200, {
        success: true,
        data: status,
      });
      return true;
    }

    // POST /api/driver/kyc/submit -> Nộp hồ sơ và giấy tờ KYC
    if (pathname === '/api/driver/kyc/submit' && method === 'POST') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['DRIVER', 'ADMIN']);
      const body = await parseJsonBody(req);
      const updatedProfile = await submitDriverKyc(user.userId, body);
      sendJson(res, 200, {
        success: true,
        message: 'Nộp hồ sơ KYC thành công. Vui lòng chờ quản trị viên xét duyệt.',
        data: updatedProfile,
      });
      return true;
    }

    // PATCH /api/driver/status/online -> Bật/Tắt trạng thái Trực tuyến
    if ((pathname === '/api/driver/status/online' || pathname === '/api/driver/status') && (method === 'PATCH' || method === 'PUT')) {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['DRIVER', 'ADMIN']);
      const body = await parseJsonBody(req);
      const result = await setDriverOnlineStatus(user.userId, Boolean(body.isOnline));
      sendJson(res, 200, {
        success: true,
        message: result.message,
        data: result,
      });
      return true;
    }

    // =========================================================================
    // 4. ADMIN REVIEW MODULE (KYC APPROVAL / REJECTION)
    // =========================================================================

    // GET /api/admin/drivers/kyc-pending -> Danh sách tài xế chờ duyệt KYC
    if (pathname === '/api/admin/drivers/kyc-pending' && method === 'GET') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['ADMIN']);
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
      const result = await getPendingKycDrivers(page, limit);
      sendJson(res, 200, {
        success: true,
        data: result.drivers,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
      });
      return true;
    }

    // Các routes admin thao tác với driver cụ thể: /api/admin/drivers/:driverId
    const adminDriverMatch = pathname.match(/^\/api\/admin\/drivers\/([a-zA-Z0-9\-]+)(\/(kyc\/(approve|reject)|status|detail))?$/);
    if (adminDriverMatch) {
      const driverId = adminDriverMatch[1];
      const action = adminDriverMatch[3]; // 'approve' | 'reject' | 'status' | undefined

      // POST /api/admin/drivers/:driverId/kyc/approve -> Phê duyệt hồ sơ
      if (method === 'POST' && action === 'approve') {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['ADMIN']);
        const result = await approveDriverKyc(driverId);
        sendJson(res, 200, {
          success: true,
          message: result.message,
          data: result,
        });
        return true;
      }

      // POST /api/admin/drivers/:driverId/kyc/reject -> Từ chối hồ sơ kèm lý do
      if (method === 'POST' && action === 'reject') {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['ADMIN']);
        const body = await parseJsonBody(req);
        const result = await rejectDriverKyc(driverId, body.reason);
        sendJson(res, 200, {
          success: true,
          message: result.message,
          data: result,
        });
        return true;
      }

      // PATCH /api/admin/drivers/:driverId/status -> Khóa/kích hoạt tài khoản tài xế
      if (method === 'PATCH' && action === 'status') {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['ADMIN']);
        const body = await parseJsonBody(req);
        const result = await setDriverActiveStatus(driverId, Boolean(body.isActive));
        sendJson(res, 200, {
          success: true,
          message: result.message,
          data: result,
        });
        return true;
      }

      // GET /api/admin/drivers/:driverId -> Xem chi tiết hồ sơ tài xế
      if (method === 'GET' && !action) {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['ADMIN']);
        const detail = await getDriverKycDetail(driverId);
        sendJson(res, 200, {
          success: true,
          data: detail,
        });
        return true;
      }
    }

    // =========================================================================
    // 5. PRICING & ESTIMATION MODULE (SPRINT 2 - TASK 2.3)
    // =========================================================================

    // POST /api/pricing/estimate hoặc /api/bookings/estimate -> Ước tính cước phí chuyến đi
    if ((pathname === '/api/pricing/estimate' || pathname === '/api/bookings/estimate') && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await estimateBookingPrice(body);
      sendJson(res, 200, {
        success: true,
        data: result,
      });
      return true;
    }

    // GET /api/pricing/rules -> Lấy bảng giá các loại xe
    if (pathname === '/api/pricing/rules' && method === 'GET') {
      const rules = await getPricingRules();
      sendJson(res, 200, {
        success: true,
        data: rules,
      });
      return true;
    }

    // GET /api/pricing/services -> Lấy danh sách phụ phí dịch vụ
    if (pathname === '/api/pricing/services' && method === 'GET') {
      const services = await getSurchargeServices();
      sendJson(res, 200, {
        success: true,
        data: services,
      });
      return true;
    }

    // GET /api/admin/drivers -> Danh sách toàn bộ tài xế (lọc KYC, online, tìm kiếm)
    if (pathname === '/api/admin/drivers' && method === 'GET') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['ADMIN']);
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);
      const kycStatus = parsedUrl.searchParams.get('kycStatus') || undefined;
      const isOnlineParam = parsedUrl.searchParams.get('isOnline');
      const isOnline = isOnlineParam !== null ? isOnlineParam === 'true' : undefined;
      const search = parsedUrl.searchParams.get('search') || undefined;
      const result = await getAllDrivers({ page, limit, kycStatus, isOnline, search });
      sendJson(res, 200, {
        success: true,
        data: result.drivers,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
      });
      return true;
    }

    // PUT /api/admin/pricing/rules/:vehicleTypeId -> Admin cập nhật bảng giá loại xe
    const adminPricingMatch = pathname.match(/^\/api\/admin\/pricing\/rules\/([a-zA-Z0-9\-]+)$/);
    if (adminPricingMatch && (method === 'PUT' || method === 'PATCH')) {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['ADMIN']);
      const vehicleTypeId = adminPricingMatch[1];
      const body = await parseJsonBody(req);
      const updated = await updatePricingRule(vehicleTypeId, body);
      sendJson(res, 200, {
        success: true,
        message: 'Cập nhật bảng giá loại xe thành công',
        data: updated,
      });
      return true;
    }

    // POST /api/admin/pricing/rules -> Admin tạo mới bảng giá loại xe
    if (pathname === '/api/admin/pricing/rules' && method === 'POST') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['ADMIN']);
      const body = await parseJsonBody(req);
      const created = await createPricingRule(body);
      sendJson(res, 201, {
        success: true,
        message: 'Thiết lập bảng giá loại xe thành công',
        data: created,
      });
      return true;
    }

    // GET /api/admin/pricing/surcharges -> Admin lấy danh sách phụ phí
    if (pathname === '/api/admin/pricing/surcharges' && method === 'GET') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['ADMIN']);
      const services = await getSurchargeServices();
      sendJson(res, 200, {
        success: true,
        data: services,
      });
      return true;
    }

    // POST /api/admin/pricing/surcharges -> Admin tạo mới phụ phí
    if (pathname === '/api/admin/pricing/surcharges' && method === 'POST') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['ADMIN']);
      const body = await parseJsonBody(req);
      const created = await createSurchargeService(body);
      sendJson(res, 201, {
        success: true,
        message: 'Thêm mới phụ phí thành công',
        data: created,
      });
      return true;
    }

    // PUT /api/admin/pricing/surcharges/:code -> Admin cập nhật phụ phí
    const adminSurchargeMatch = pathname.match(/^\/api\/admin\/pricing\/surcharges\/([a-zA-Z0-9\-_]+)$/);
    if (adminSurchargeMatch && (method === 'PUT' || method === 'PATCH')) {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['ADMIN']);
      const code = adminSurchargeMatch[1];
      const body = await parseJsonBody(req);
      const updated = await updateSurchargeService(code, body);
      sendJson(res, 200, {
        success: true,
        message: 'Cập nhật phụ phí thành công',
        data: updated,
      });
      return true;
    }

    // =========================================================================
    // 6. ADMIN B2B CUSTOMERS MODULE (SPRINT 2 - TASK 2.4)
    // =========================================================================

    // GET /api/admin/b2b/customers -> Danh sách đối tác doanh nghiệp B2B
    if (pathname === '/api/admin/b2b/customers' && method === 'GET') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['ADMIN']);
      const search = parsedUrl.searchParams.get('search') || undefined;
      const status = parsedUrl.searchParams.get('status') || undefined;
      const page = parseInt(parsedUrl.searchParams.get('page') || '1', 10);
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '20', 10);

      const result = await getB2bCustomers({ search, status, page, limit });
      sendJson(res, 200, {
        success: true,
        data: result.customers,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
      return true;
    }

    // POST /api/admin/b2b/customers -> Thêm mới đối tác doanh nghiệp B2B
    if (pathname === '/api/admin/b2b/customers' && method === 'POST') {
      const user = authenticate(req.headers.authorization);
      authorizeRoles(user, ['ADMIN']);
      const body = await parseJsonBody(req);
      const created = await createB2bCustomer(body);
      sendJson(res, 201, {
        success: true,
        message: 'Thêm mới khách hàng doanh nghiệp B2B thành công',
        data: created,
      });
      return true;
    }

    // Routes thao tác với B2B customer cụ thể: /api/admin/b2b/customers/:id
    const b2bCustomerMatch = pathname.match(/^\/api\/admin\/b2b\/customers\/([a-zA-Z0-9\-]+)(\/(status|payment))?$/);
    if (b2bCustomerMatch) {
      const customerId = b2bCustomerMatch[1];
      const subAction = b2bCustomerMatch[3]; // 'status' | 'payment' | undefined

      // GET /api/admin/b2b/customers/:id -> Xem chi tiết khách hàng B2B
      if (method === 'GET' && !subAction) {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['ADMIN']);
        const detail = await getB2bCustomerDetail(customerId);
        sendJson(res, 200, {
          success: true,
          data: detail,
        });
        return true;
      }

      // PUT /api/admin/b2b/customers/:id -> Cập nhật thông tin B2B
      if (method === 'PUT' && !subAction) {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['ADMIN']);
        const body = await parseJsonBody(req);
        const updated = await updateB2bCustomer(customerId, body);
        sendJson(res, 200, {
          success: true,
          message: 'Cập nhật thông tin doanh nghiệp thành công',
          data: updated,
        });
        return true;
      }

      // PATCH /api/admin/b2b/customers/:id/status -> Khóa/kích hoạt đối tác B2B
      if (method === 'PATCH' && subAction === 'status') {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['ADMIN']);
        const body = await parseJsonBody(req);
        const result = await setB2bCustomerStatus(customerId, body.status);
        sendJson(res, 200, {
          success: true,
          message: result.message,
          data: result,
        });
        return true;
      }

      // POST /api/admin/b2b/customers/:id/payment -> Ghi nhận thanh toán công nợ
      if (method === 'POST' && subAction === 'payment') {
        const user = authenticate(req.headers.authorization);
        authorizeRoles(user, ['ADMIN']);
        const body = await parseJsonBody(req);
        const result = await recordB2bPayment(customerId, Number(body.amount), body.note);
        sendJson(res, 200, {
          success: true,
          message: result.message,
          data: result,
        });
        return true;
      }
    }

    // Tuyến đường API không tìm thấy
    sendJson(res, 404, {
      success: false,
      message: `Endpoint ${method} ${pathname} không tồn tại`,
    });
    return true;
  } catch (error: any) {
    const message = error.message || 'Lỗi hệ thống';
    const isAuthError = message.includes('UNAUTHORIZED') || message.includes('Token không hợp lệ');
    const isForbidden = message.includes('FORBIDDEN') || error.statusCode === 403;
    const statusCode = error.statusCode || (isAuthError ? 401 : isForbidden ? 403 : 400);

    sendJson(res, statusCode, {
      success: false,
      code: error.code,
      message,
    });
    return true;
  }
}
