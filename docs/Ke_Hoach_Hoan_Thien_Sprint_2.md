# BẢNG KẾ HOẠCH HOÀN THIỆN & SỬA LỖI SPRINT 2
**Dự án:** App Đặt Xe Tải (Truck Booking System)  
**Phạm vi:** Sprint 2 (Người dùng, KYC Tài xế, Engine Tính cước, Quản trị Admin cơ bản)  
**Trạng thái:** Sẵn sàng triển khai  

---

## 🎯 MỤC TIÊU TỔNG QUÁT
1. **Khắc phục triệt để các lỗi logic** tiềm ẩn trong hệ thống (lỗi phân trang admin, vô hiệu hóa tìm kiếm, lưu OTP khi gửi thất bại, lệch múi giờ phụ phí ban đêm).
2. **Hoàn thiện các mắt xích nghiệp vụ còn thiếu** (kiểm tra đủ bộ giấy tờ KYC, phụ phí hỗ trợ số lượng, tính khoảng cách đa điểm dừng, phân trang sổ địa chỉ).
3. **Đảm bảo tính độc lập & vững chắc** của Sprint 2 trước khi kết nối sâu vào luồng Realtime (Sprint 3) và Thanh toán (Sprint 4).

---

## 📌 PHẦN 1: KHẮC PHỤC CÁC LỖI SAI LOGIC & BUGS TIỀM ẨN (ƯU TIÊN CAO)

### Task 1.1: Sửa lỗi tính sai tổng số lượng (`total`) khi phân trang Admin
* **Mục đích:** 
  - Hiển thị đúng tổng số lượng tài xế trên hệ thống để người quản trị nắm được quy mô.
  - Sửa lỗi UI phân trang Frontend bị ẩn mất các trang sau (do API đang trả về `total` bằng đúng số bản ghi của trang hiện tại thay vì toàn bộ DB).
* **Vị trí code:** [adminService.ts:L172](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/adminService.ts#L172) (`getPendingKycDrivers`) và [adminService.ts:L534](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/adminService.ts#L534) (`getAllDrivers`).
* **Giải pháp kỹ thuật:**
  - Thay thế `total: results.length` bằng câu lệnh đếm độc lập `SELECT count(*)::int`.
  - Bổ sung trường `totalPages = Math.ceil(total / limit)` đồng bộ như chuẩn tại [b2bService.ts](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/b2bService.ts).
* **Phân công:** BE-02
* **Thời gian ước tính:** 1.5 giờ

---

### Task 1.2: Kích hoạt bộ lọc tìm kiếm tài xế (`search`) trong danh sách Admin
* **Mục đích:** 
  - Cho phép Admin tìm kiếm nhanh tài xế theo Số điện thoại, Họ tên, hoặc Biển số xe thay vì phải duyệt thủ công qua từng trang.
* **Vị trí code:** [adminService.ts:L444-L455](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/adminService.ts#L444-L455) (`getAllDrivers`).
* **Giải pháp kỹ thuật:**
  - Đưa `params.search` vào mệnh đề `WHERE` với điều kiện tìm kiếm không phân biệt hoa thường (`ilike`):
    ```ts
    if (params.search && params.search.trim()) {
      const s = `%${params.search.trim()}%`
      conditions.push(or(
        ilike(users.fullName, s),
        ilike(users.phone, s),
        ilike(driverProfiles.licensePlate, s)
      ))
    }
    ```
* **Phân công:** BE-02
* **Thời gian ước tính:** 1 giờ

---

### Task 1.3: Đảo thứ tự gửi SMS Gateway trước khi ghi nhận OTP vào Database
* **Mục đích:** 
  - Tránh trừ oan hạn mức nhận mã OTP của người dùng (tối đa 5 lần/ngày và giới hạn gửi liên tiếp 60 giây) nếu tin nhắn thực tế không gửi được do lỗi nhà mạng hoặc số dư tài khoản SMS Gateway bị hết.
* **Vị trí code:** [otpService.ts:L160-L181](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/otpService.ts#L160-L181) (`requestOtp`).
* **Giải pháp kỹ thuật:**
  - Gọi `smsProvider.sendOtp(phone, otpCode)` trước.
  - Chỉ khi nhà mạng phản hồi thành công (`sendResult.success === true`) mới thực hiện `db.insert(otpVerifications)`.
  - Nếu gửi SMS lỗi, ném ngoại lệ ngay lập tức và không lưu bản ghi rác.
* **Phân công:** BE-01
* **Thời gian ước tính:** 1 giờ

---

### Task 1.4: Chuẩn hóa Múi giờ Việt Nam (UTC+7) cho Phụ phí ban đêm
* **Mục đích:** 
  - Tính chính xác phụ phí ban đêm (22:00 - 06:00 sáng hôm sau) trên mọi môi trường máy chủ (Server deploy quốc tế chạy UTC+0 như Docker/Vercel/Render).
  - Khắc phục tình trạng ban ngày (8h sáng VN = 1h sáng UTC) bị tính nhầm phí đêm, và ban đêm (23h VN = 16h UTC) lại không được cộng phí đêm.
* **Vị trí code:** [pricingService.ts:L874-L884](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/pricingService.ts#L874-L884).
* **Giải pháp kỹ thuật:**
  - Lấy giờ theo múi giờ `Asia/Ho_Chi_Minh` bằng `Intl.DateTimeFormat`:
    ```ts
    const vnHour = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "numeric",
      hour12: false
    }).format(targetDate))
    isNightTime = vnHour >= 22 || vnHour < 6
    ```
* **Phân công:** BE-Lead
* **Thời gian ước tính:** 1 giờ

---

### Task 1.5: Hỗ trợ linh hoạt cả 2 định dạng ID khi cập nhật bảng giá xe
* **Mục đích:** 
  - Tránh lỗi `404 Not Found` khi frontend hoặc đối tác gọi API `PATCH /api/admin/pricing/rules/:id`.
  - Hỗ trợ cả trường hợp gửi `vehicleTypeId` lẫn trường hợp gửi `pricingRules.id`.
* **Vị trí code:** [pricingService.ts:L413](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/pricingService.ts#L413) (`updatePricingRule`).
* **Giải pháp kỹ thuật:**
  - Cập nhật câu truy vấn kiểm tra:
    ```ts
    .where(or(
      eq(pricingRules.vehicleTypeId, vehicleTypeId),
      eq(pricingRules.id, vehicleTypeId)
    ))
    ```
* **Phân công:** BE-02
* **Thời gian ước tính:** 30 phút

---

### Task 1.6: Chuẩn hóa phản hồi khi tài xế mới bật Online (Hướng dẫn nạp ký quỹ)
* **Mục đích:** 
  - Ngăn ngừa tình trạng tài xế vừa được duyệt KYC xong, hồ sơ hợp lệ nhưng khi bấm "Bật trực tuyến" lại bị lỗi `403` cụt lủn do số dư ví = 0đ.
  - Trả về mã lỗi có cấu trúc chuẩn để ứng dụng di động hiển thị Popup điều hướng tài xế nạp tiền ký quỹ (>= 200.000đ) để bắt đầu nhận chuyến.
* **Vị trí code:** [driverService.ts:L570-L582](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/driverService.ts#L570-L582) (`setDriverOnlineStatus`).
* **Giải pháp kỹ thuật:**
  - Trả về mã lỗi chuẩn `REQUIRE_WALLET_DEPOSIT`, kèm các thông tin phụ: `minDepositLimit`, `availableBalance`, `shortfall`.
* **Phân công:** BE-02
* **Thời gian ước tính:** 1 giờ

---

## 📌 PHẦN 2: BỔ SUNG CÁC THIẾU SÓT NGHIỆP VỤ (ƯU TIÊN VỪA)

### Task 2.1: Kiểm tra bắt buộc đủ 4 loại giấy tờ cốt lõi trước khi duyệt KYC
* **Mục đích:** 
  - Tránh trường hợp tài xế mới nộp 1 ảnh (ví dụ CCCD mặt trước) đã nhảy sang trạng thái `PENDING` làm rác danh sách chờ duyệt của Admin.
  - Ngăn Admin vô tình phê duyệt một tài xế chưa nộp đủ giấy tờ hợp pháp (bằng lái xe, đăng ký xe).
* **Vị trí code:** [driverService.ts:L360](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/driverService.ts#L360) (`submitDriverKyc`) và [adminService.ts:L264](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/adminService.ts#L264) (`approveDriverKyc`).
* **Giải pháp kỹ thuật:**
  - Đối chiếu danh sách giấy tờ nộp với `REQUIRED_KYC_DOC_TYPES` (`CCCD_FRONT`, `CCCD_BACK`, `DRIVER_LICENSE`, `VEHICLE_REGISTRATION`).
  - Nếu thiếu: giữ trạng thái hồ sơ ở `DRAFT` và trả về danh sách `missingDocuments`.
  - Trong hàm `approveDriverKyc`: Nếu tài xế chưa nộp đủ 4 giấy tờ, chặn không cho duyệt và trả lỗi `400 Bad Request`.
* **Phân công:** BE-02
* **Thời gian ước tính:** 2 giờ

---

### Task 2.2: Nâng cấp Phụ phí dịch vụ hỗ trợ Số lượng (Quantity)
* **Mục đích:** 
  - Phục vụ các nhu cầu vận chuyển thực tế: khách cần thuê **2 người phụ bốc xếp** (`EXTRA_HELPER` x 2) hoặc giao hàng qua **3 điểm dừng phụ** (`EXTRA_STOP` x 2).
* **Vị trí code:** [pricingService.ts:L700-L865](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/pricingService.ts#L700-L865) (`estimateBookingPrice`).
* **Giải pháp kỹ thuật:**
  - Cho phép tham số `services` nhận cả mảng chuỗi mã hoặc mảng object có số lượng:
    ```ts
    services?: Array<string | { code: string; quantity: number }>
    ```
  - Công thức tính phụ phí: `surchargeItem.price * (item.quantity || 1)`.
* **Phân công:** BE-Lead
* **Thời gian ước tính:** 2 giờ

---

### Task 2.3: Tính khoảng cách lộ trình đa điểm dừng (Waypoints) với Goong.io
* **Mục đích:** 
  - Tính chính xác số Km và thời gian lộ trình thực tế khi chuyến xe có ghé qua các điểm giao hàng phụ, tránh việc cuốc xe đi xa gấp đôi nhưng hệ thống chỉ tính km từ điểm đầu đến điểm cuối.
* **Vị trí code:** [distanceService.ts:L87](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/distanceService.ts#L87) (`calculateRouteDistance`).
* **Giải pháp kỹ thuật:**
  - Mở rộng hàm nhận thêm mảng tọa độ các điểm dừng: `waypoints?: Array<{ lat: number; lng: number }>`.
  - Gọi Goong Direction API nối các điểm dừng: `origin -> waypoint1 -> waypoint2 -> destination`.
* **Phân công:** BE-Lead
* **Thời gian ước tính:** 3 giờ

---

### Task 2.4: Bổ sung phân trang cho Sổ địa chỉ khách hàng
* **Mục đích:** 
  - Tối ưu hóa hiệu năng và dung lượng truyền tải mạng cho các khách hàng doanh nghiệp B2B lưu trữ hàng chục địa chỉ kho bãi giao nhận.
* **Vị trí code:** [addressService.ts:L71](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/addressService.ts#L71) và [customer.ts:L72](file:///d:/WEB/App_Dat_Xe_Tai/src/api/routes/customer.ts#L72).
* **Giải pháp kỹ thuật:**
  - Bổ sung query params `page` (mặc định 1) và `limit` (mặc định 20).
  - Trả về cấu trúc chuẩn: `{ data: addresses, pagination: { page, limit, total } }`.
* **Phân công:** BE-01
* **Thời gian ước tính:** 1 giờ

---

## 📊 BẢNG TỔNG HỢP TIẾN ĐỘ & PHÂN CÔNG THỰC HIỆN

| Mã Task | Hạng mục công việc | Người phụ trách | Thời gian | Mức độ ưu tiên | Trạng thái |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1.1** | Fix lỗi Phân trang Admin (`total`) | **BE-02** | 1.5h | 🔴 Cao | ✅ Đã hoàn thành |
| **1.2** | Fix tìm kiếm tài xế (`search`) | **BE-02** | 1.0h | 🔴 Cao | ✅ Đã hoàn thành |
| **1.3** | Fix thứ tự SMS Gateway & Lưu OTP | **BE-01** | 1.0h | 🔴 Cao | ✅ Đã hoàn thành |
| **1.4** | Chuẩn hóa Múi giờ UTC+7 cho Phí ban đêm | **BE-Lead** | 1.0h | 🔴 Cao | ✅ Đã hoàn thành |
| **1.5** | Hỗ trợ 2 định dạng ID khi cập nhật giá | **BE-02** | 0.5h | 🔴 Cao | ✅ Đã hoàn thành |
| **1.6** | Chuẩn hóa mã lỗi nạp tiền ký quỹ khi Online | **BE-02** | 1.0h | 🔴 Cao | ✅ Đã hoàn thành |
| **2.1** | Kiểm tra đủ bộ 4 giấy tờ KYC | **BE-02** | 2.0h | 🟡 Vừa | ✅ Đã hoàn thành |
| **2.2** | Hỗ trợ số lượng (`quantity`) cho phụ phí | **BE-Lead** | 2.0h | 🟡 Vừa | ✅ Đã hoàn thành |
| **2.3** | Tính khoảng cách đa điểm dừng (Goong.io) | **BE-Lead** | 3.0h | 🟡 Vừa | ✅ Đã hoàn thành |
| **2.4** | Thêm phân trang Sổ địa chỉ khách hàng | **BE-01** | 1.0h | 🟢 Thấp | ✅ Đã hoàn thành |

**Tiến độ:** Đã hoàn thành 10/10 tasks và vượt qua toàn bộ kịch bản kiểm thử tự động.

---

## 🧪 KỊCH BẢN KIỂM THỬ NGHIỆM THU (ACCEPTANCE CRITERIA)

| STT | Kịch bản kiểm thử (Test Case) | Kết quả mong đợi |
| :---: | :--- | :--- |
| **TC-01** | Gọi API danh sách tài xế với `limit=5` trên tổng 12 tài xế | Trả về `total: 12`, `totalPages: 3`, mảng `drivers` gồm 5 phần tử. |
| **TC-02** | Gọi API `GET /admin/drivers?search=0988` | Chỉ trả về đúng danh sách các tài xế có SĐT chứa `0988`. |
| **TC-03** | Giả lập SMS Gateway lỗi mạng khi gọi `request-otp` | API trả về lỗi 500, bảng `otp_verifications` **không** có bản ghi mới, người dùng không bị phạt cooldown. |
| **TC-04** | Báo giá cuốc xe với thời gian đặt lúc 23:30 đêm trên server UTC | Hệ thống tự động nhận diện giờ đêm Việt Nam và cộng phụ phí `NIGHT_SURCHARGE` (+20.000đ). |
| **TC-05** | Báo giá với 2 phụ xe (`EXTRA_HELPER`, `quantity = 2`) | Tổng phụ phí bốc xếp tự động nhân 2 thành 400.000đ. |
| **TC-06** | Tài xế mới duyệt KYC có số dư ví 0đ bấm Bật trực tuyến | Trả về lỗi `403` có mã `REQUIRE_WALLET_DEPOSIT`, thông báo thiếu 200.000đ ký quỹ rõ ràng. |
| **TC-07** | Admin bấm duyệt tài xế mới chỉ nộp 1 ảnh CCCD | Hệ thống từ chối duyệt với lỗi `400`, thông báo thiếu GPLX và Đăng ký xe. |
