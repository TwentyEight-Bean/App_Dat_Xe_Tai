# KẾ HOẠCH CHI TIẾT THIẾT KẾ VÀ TÍCH HỢP GIAO DIỆN CHO 13 API CHƯA CÓ UI (SPRINT 4)

**Dự án:** Ứng dụng Đặt Xe Tải (Truck Booking App)  
**Phạm vi:** 13 API Backend đã hoàn thành ở Sprint 4 nhưng hiện tại chưa có màn hình/component UI để người dùng thao tác.  
**Nguyên tắc cam kết:** *Bản kế hoạch này chỉ phục vụ việc rà soát và phê duyệt kiến trúc/giao diện trước. Không can thiệp sửa đổi mã nguồn ứng dụng (`src/*.tsx`) cho đến khi có xác nhận chính thức từ người dùng.*

---

## I. DANH SÁCH 13 API & PHÂN NHÓM MÀN HÌNH GIAO DIỆN

Để giao diện gọn gàng, trực quan và chuẩn UX/UI, 13 API sẽ được phân bổ vào **4 cụm màn hình giao diện**:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                           13 API CHƯA CÓ GIAO DIỆN Ở SPRINT 4                                  │
├───────────────────────────────┬───────────────────────────────────────────────────────────────┤
│ CỤM 1: ADMIN PORTAL           │ • GET /api/v1/accounting/dashboard    (1) Dashboard Kế toán   │
│ (3 Phân hệ mới trong Admin)   │ • GET /api/v1/accounting/export-excel (2) Xuất file Excel     │
│                               │ • GET /api/v1/admin/wallets           (3) Bảng ví tài xế      │
│                               │ • GET /api/v1/admin/wallets/:userId   (4) Chi tiết ví         │
│                               │ • GET /api/v1/admin/wallets/:id/txs   (5) Lịch sử ví          │
│                               │ • POST /api/v1/admin/wallets/:id/adj  (6) Điều chỉnh số dư    │
│                               │ • GET /api/v1/admin/cron/status       (7) Trạng thái Cron     │
│                               │ • POST /admin/cron/trigger-block      (8) Khóa tài xế vi phạm │
│                               │ • POST /admin/cron/trigger-backup     (9) Sao lưu CSDL        │
├───────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ CỤM 2: LỊCH SỬ CỔNG THANH TOÁN│ • GET /api/v1/payments/history        (10) Lịch sử nạp VNPay/ │
│ (Khách hàng & Tài xế)         │                                            MoMo               │
├───────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ CỤM 3: HỘI THOẠI CHAT REALTIME│ • GET /api/v1/chat/conversations      (11) Danh sách hội thoại│
│ (Màn hình tin nhắn)           │                                            chuyến xe          │
├───────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ CỤM 4: NHẬT KÝ & CUỘC GỌI     │ • GET /api/v1/calls/trip/:bookingId   (12) Log cuộc gọi cuốc  │
│ (Stringee Hotline 1900-8888)  │ • GET /api/v1/calls/history           (13) Log cuộc gọi user  │
│                               │ • GET /api/v1/calls/token             (Phụ trợ SDK Token)     │
└───────────────────────────────┴───────────────────────────────────────────────────────────────┘
```

---

## II. THIẾT KẾ CHI TIẾT TỪNG MÀN HÌNH & LUỒNG TÍCH HỢP API

### CỤM 1: CÁC PHÂN HỆ QUẢN TRỊ TRONG ADMIN PORTAL (9 API)

#### 1. Phân hệ Kế Toán & Xuất File Excel (`src/admin/Accounting.tsx`)
* **API kết nối:**
  - `GET /api/v1/accounting/dashboard`
  - `GET /api/v1/accounting/export-excel`
* **Vị trí tích hợp:** Bổ sung mục `"accounting"` (Kế toán & Doanh thu) vào sidebar [`src/Admin.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/Admin.tsx).
* **Bố cục giao diện chi tiết:**
  1. **Thanh lọc thời gian:**
     - Các nút chọn nhanh: `[Hôm nay]` `[7 ngày qua]` `[30 ngày qua]` `[Tháng này]`.
     - Bộ chọn khoảng ngày tùy chỉnh: Từ ngày (Start Date) -> Đến ngày (End Date).
     - Bộ lọc theo phương thức thanh toán (`CASH`, `VNPAY`, `MOMO`) và loại xe tải.
  2. **4 Thẻ KPIs Tài chính hàng đầu (Stat Cards):**
     - **Tổng doanh thu cước xe (Gross Revenue):** Số tiền VND + Tỷ lệ tăng trưởng.
     - **Doanh thu hoa hồng sàn (20% Platform Commission):** Doanh thu thực giữ của nền tảng.
     - **Thu nhập thực nhận của tài xế (80% Driver Net):** Tổng số tiền chuyển về tài xế.
     - **Tổng số chuyến xe & Tỷ lệ hoàn thành:** Tổng cuốc, cuốc thành công, tỷ lệ % hoàn thành.
  3. **Biểu đồ phân tích tỷ trọng:**
     - Thanh phân bổ doanh thu theo hình thức thanh toán: Tiền mặt vs VNPay vs MoMo.
     - Biểu đồ phân bổ cước theo tải trọng xe: Xe 500kg, Xe 1 tấn, Xe 2 tấn, Xe 5 tấn...
  4. **Bảng Top 10 Tài xế có doanh thu cao nhất:**
     - Cột: Xếp hạng, Tên tài xế, Số điện thoại, Biển số xe, Số cuốc hoàn thành, Tổng doanh thu, Hoa hồng đã nộp.
  5. **Nút bấm "XUẤT BÁO CÁO EXCEL":**
     - Nút màu xanh lá nổi bật (chuẩn màu Microsoft Excel) với icon bảng tính.
     - Khi Admin bấm: Gọi `GET /api/v1/accounting/export-excel` với các filter đang chọn.
     - Phản hồi từ server là file nhị phân buffer, trình duyệt tự động kích hoạt tải file `Bao_Cao_Ke_Toan_[YYYY-MM-DD].xlsx` (gồm 3 sheets: Tổng quan, Chi tiết đơn hàng, Top tài xế) mà không cần reload trang.

---

#### 2. Phân hệ Quản Lý Ví Ký Quỹ Tài Xế (`src/admin/Wallets.tsx`)
* **API kết nối:**
  - `GET /api/v1/admin/wallets`
  - `GET /api/v1/admin/wallets/:userId`
  - `GET /api/v1/admin/wallets/:userId/transactions`
  - `POST /api/v1/admin/wallets/:userId/adjust`
* **Vị trí tích hợp:** Bổ sung mục `"wallets"` (Ví tài xế) vào sidebar [`src/Admin.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/Admin.tsx).
* **Bố cục giao diện chi tiết:**
  1. **Bảng danh sách Ví ký quỹ:**
     - Thanh tìm kiếm: Tìm nhanh theo Tên, Số điện thoại hoặc Biển số xe của tài xế.
     - Cột dữ liệu:
       - Thông tin tài xế (Avatar, Tên, SĐT, Biển số xe).
       - **Số dư ví thực tế** (`balance`).
       - **Số dư khả dụng** (`availableBalance`).
       - **Hạn mức ký quỹ tối thiểu** (`minDepositLimit`: mặc định 200.000 đ).
       - **Trạng thái ký quỹ**: 
         - Badge xanh lá `[ĐỦ ĐIỀU KIỆN]`: Khi số dư khả dụng >= 200.000đ.
         - Badge đỏ `[THIẾU KÝ QUỸ]`: Kèm số tiền cần nạp thêm `(-[shortfall] đ)` nếu < 200.000đ.
       - Cột thao tác: Nút "Xem lịch sử ví" và nút "Điều chỉnh số dư".
     - Thanh phân trang: Trang trước / Trang sau / Chọn số bản ghi.
  2. **Modal Xem chi tiết & Lịch sử biến động số dư ví:**
     - Bấm "Xem lịch sử ví" ➔ Gọi `GET /api/v1/admin/wallets/:userId/transactions`.
     - Hiển thị bảng Ledger chi tiết: Ngày giờ, Loại biến động (`COMMISSION_DEDUCTION`, `TRIP_INCOME`, `TOPUP`, `BONUS`, `PENALTY`), Số tiền (+/-), Số dư trước/sau, Mã chuyến xe liên quan.
  3. **Modal Điều chỉnh số dư thủ công (Admin Adjustment):**
     - Bấm "Điều chỉnh số dư" ➔ Mở modal cho Admin:
       - Chọn loại điều chỉnh: `Thưởng (BONUS)`, `Phạt vi phạm (PENALTY)`, `Nạp tiền thủ công (TOPUP)`, `Hoàn tiền (REFUND)`.
       - Nhập số tiền (VND).
       - Nhập lý do điều chỉnh bắt buộc (VD: *"Thưởng đạt mốc 50 chuyến tuần"*, *"Phạt hủy cuốc không lý do"*).
       - Nút "Xác nhận điều chỉnh" ➔ Gửi `POST /api/v1/admin/wallets/:userId/adjust`.
       - Sau khi thành công: Cập nhật lại số dư tức thì trên bảng ví mà không cần reload trang.

---

#### 3. Phân hệ Quản Trị Tác Vụ Nền & Sao Lưu CSDL (`src/admin/SystemCron.tsx`)
* **API kết nối:**
  - `GET /api/v1/admin/cron/status`
  - `POST /api/v1/admin/cron/trigger-block-drivers`
  - `POST /api/v1/admin/cron/trigger-backup`
* **Vị trí tích hợp:** Bổ sung mục `"system"` hoặc tab con trong Cài đặt hệ thống của [`src/Admin.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/Admin.tsx).
* **Bố cục giao diện chi tiết:**
  1. **Thẻ Tác vụ "Tự động khóa tài xế điểm thấp":**
     - Chu kỳ chạy: `03:00 AM hàng ngày`.
     - Thông số: Ngưỡng đánh giá vi phạm `< 4.0 sao` (tối thiểu từ 5 cuốc xe).
     - Thời gian chạy gần nhất & Số tài xế đã bị khóa tự động trong lần chạy gần nhất.
     - **Thao tác thủ công:** Nút bấm **"Quét & Khóa ngay"**:
       - Cho phép Admin nhập thử nghiệm ngưỡng sao (mặc định 4.0) và số chuyến tối thiểu.
       - Bấm chạy ➔ Gọi `POST /api/v1/admin/cron/trigger-block-drivers` ➔ Trả về popup thông báo số lượng tài xế đã bị khóa.
  2. **Thẻ Tác vụ "Tự động sao lưu CSDL Neon":**
     - Chu kỳ chạy: `02:00 AM hàng đêm`.
     - Trạng thái sao lưu gần nhất: Thành công / Thất bại, dung lượng bản sao lưu.
     - **Thao tác thủ công:** Nút bấm **"Sao lưu CSDL ngay"**:
       - Bấm chạy ➔ Gọi `POST /api/v1/admin/cron/trigger-backup` ➔ Tạo ngay một bản snapshot sao lưu CSDL an toàn.
  3. **Bảng Danh sách các bản Snapshot Backup Database:**
     - Gọi từ `GET /api/v1/admin/cron/status` hiển thị mảng `recentBackups`:
     - Cột: Tên file snapshot (`backup_snapshot_YYYYMMDD_HHMMSS.json`), Kích thước file (KB/MB), Thời gian tạo.

---

### CỤM 2: MÀN HÌNH LỊCH SỬ GIAO DỊCH CỔNG THANH TOÁN (1 API)

#### 4. Tab Lịch Sử Nạp & Thanh Toán Cổng VNPay/MoMo
* **API kết nối:** `GET /api/v1/payments/history?limit=20`
* **Vị trí tích hợp:**
  - Phía Khách hàng: Thêm mục "Lịch sử thanh toán" trong [`src/account.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/account.tsx).
  - Phía Tài xế: Thêm tab phụ "Lịch sử nạp cổng" ngay trong Thẻ Thu nhập của [`src/Driver.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/Driver.tsx).
* **Bố cục giao diện chi tiết:**
  - Danh sách thẻ giao dịch dạng card/list:
    - **Logo/Badge cổng:** Icon VNPay hoặc MoMo.
    - **Mã giao dịch:** Mã đơn hàng thanh toán (VD: `TOPUP_1712...` hoặc `BOOKING_PAYMENT_...`).
    - **Mục đích:** *"Nạp tiền ví ký quỹ"* hoặc *"Thanh toán cước chuyến xe"*.
    - **Số tiền:** Định dạng VND rõ ràng (VD: `+500.000 đ`).
    - **Trạng thái:**
      - Xanh lá: `Thành công (SUCCESS)`
      - Cam: `Đang chờ thanh toán (PENDING)`
      - Đỏ: `Thất bại / Hết hạn (FAILED)`
    - **Thời gian:** Ngày giờ thực hiện giao dịch.

---

### CỤM 3: MÀN HÌNH DANH SÁCH HỘI THOẠI CHAT THỰC TẾ (1 API)

#### 5. Danh Sách Hội Thoại Tin Nhắn Chuyến Đi (`src/chat.tsx`)
* **API kết nối:** `GET /api/v1/chat/conversations`
* **Vị trí tích hợp:** Component `MessagesScreen` trong [`src/chat.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/chat.tsx) (màn hình hiển thị danh sách các cuộc trò chuyện khi bấm vào tab Tin nhắn ở thanh điều hướng dưới cùng).
* **Bố cục giao diện chi tiết:**
  - Thay thế danh sách giả định tĩnh bằng dữ liệu thực lấy từ DB:
    - Khi vào màn hình: Gọi `GET /api/v1/chat/conversations`.
    - Danh sách các chuyến xe đã từng nhắn tin:
      - Avatar và tên đối tác (Tài xế / Khách hàng).
      - Mã chuyến xe (VD: `#BK-1024`).
      - Nội dung tin nhắn gần nhất (`lastMessageContent`).
      - Thời gian gửi tin nhắn cuối cùng (VD: *"2 phút trước"*, *"Hôm qua"*).
      - Huy hiệu số tin nhắn chưa đọc (Badge màu đỏ nếu `unreadCount > 0`).
    - Khi người dùng bấm vào một mục hội thoại ➔ Chuyển sang màn hình `ChatScreen` với `bookingId` của chuyến xe đó.

---

### CỤM 4: NHẬT KÝ ĐÀM THOẠI & HẠ TẦNG CUỘC GỌI GIẤU SỐ (2 API)

#### 6. Nhật Ký Cuộc Gọi Trong Chuyến Xe & Lịch Sử Cuộc Gọi
* **API kết nối:**
  - `GET /api/v1/calls/trip/:bookingId`: Xem các cuộc gọi của 1 cuốc xe.
  - `GET /api/v1/calls/history`: Xem lịch sử cuộc gọi cá nhân.
* **Vị trí tích hợp:**
  - Trong Chi tiết đơn hàng (`OrderDetail` trong Admin và mục xem lại chuyến xe của Khách/Tài xế).
* **Bố cục giao diện chi tiết:**
  - Mục **"Nhật ký liên lạc bảo mật Hotline 1900-8888"**:
    - Danh sách các cuộc gọi phát sinh trong cuốc xe:
      - Người gọi: Khách hàng / Tài xế.
      - Thời điểm gọi: Giờ, ngày.
      - Thời lượng đàm thoại: Số phút, giây (VD: `01 phút 45 giây`).
      - Trạng thái cuộc gọi: `Thành công (ANSWERED)`, `Người nhận bận (BUSY)`, hoặc `Không bắt máy (NO_ANSWER)`.
      - (Dành cho Admin): Nút nghe lại đoạn ghi âm cuộc gọi (`recordingUrl`) để phục vụ giải quyết khiếu nại nếu có tranh chấp giữa khách và tài xế.

---

## III. LỘ TRÌNH VÀ PHÂN KỲ THỰC HIỆN ĐỀ XUẤT

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                          LỘ TRÌNH TRIỂN KHAI 13 API CHƯA CÓ UI                                │
├──────────┬────────────────────────────────────────────────────────┬───────────────────────────┤
│ BƯỚC     │ HẠNG MỤC THỰC HIỆN                                     │ ĐẦU RA SẢN PHẨM           │
├──────────┼────────────────────────────────────────────────────────┼───────────────────────────┤
│ Bước 1   │ Xây dựng 3 Component Admin mới:                        │ Admin có đủ 3 trang:      │
│          │ • src/admin/Accounting.tsx (KPIs & Xuất file Excel)    │ Kế toán, Quản lý ví và    │
│          │ • src/admin/Wallets.tsx (Bảng ví & Điều chỉnh số dư)   │ Quản trị Cronjob sao lưu. │
│          │ • src/admin/SystemCron.tsx (Giám sát & Nút bấm Cron)   │                           │
│          │ • Gắn 3 tab mới vào sidebar src/Admin.tsx              │                           │
├──────────┼────────────────────────────────────────────────────────┼───────────────────────────┤
│ Bước 2   │ Đấu nối Danh sách hội thoại thực tế:                   │ Tab Tin nhắn tải danh     │
│          │ • Nối GET /api/v1/chat/conversations vào MessagesScreen│ sách cuốc xe thật từ DB.  │
│          │   trong src/chat.tsx                                   │                           │
├──────────┼────────────────────────────────────────────────────────┼───────────────────────────┤
│ Bước 3   │ Đấu nối Lịch sử giao dịch Cổng thanh toán:             │ Khách và Tài xế xem được  │
│          │ • Nối GET /api/v1/payments/history vào account.tsx     │ biến động nạp tiền qua    │
│          │   và Driver.tsx                                        │ cổng VNPay/MoMo.          │
├──────────┼────────────────────────────────────────────────────────┼───────────────────────────┤
│ Bước 4   │ Đấu nối Nhật ký cuộc gọi giấu số:                      │ Chi tiết đơn hàng hiển thị│
│          │ • Nối GET /api/v1/calls/trip/:bookingId vào chi tiết   │ lịch sử gọi, thời lượng   │
│          │   cuốc xe & Admin                                      │ đàm thoại qua 1900-8888.  │
├──────────┼────────────────────────────────────────────────────────┼───────────────────────────┤
│ Bước 5   │ Kiểm thử giao diện & Build nghiệm thu                  │ Kiểm tra không lỗi TypeScript│
│          │                                                        │ và giao diện mượt mà.     │
└──────────┴────────────────────────────────────────────────────────┴───────────────────────────┘
```

---

## IV. CAM KẾT BẢO TOÀN HỆ THỐNG
1. **Dừng lại ở bước lập kế hoạch:** Bản kế hoạch này đã được lưu vào hệ thống tài liệu [`docs/Ke_Hoach_13_API_Thieu_UI_Sprint_4.md`](file:///d:/WEB/App_Dat_Xe_Tai/docs/Ke_Hoach_13_API_Thieu_UI_Sprint_4.md).
2. **Chưa có bất kỳ dòng code giao diện (`src/*.tsx`) nào bị can thiệp hay sửa đổi.**
3. Việc triển khai sẽ chỉ diễn ra sau khi bạn xem xét kỹ lưỡng và đưa ra lệnh cho phép bắt đầu.
