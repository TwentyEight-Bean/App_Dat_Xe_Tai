# KẾ HOẠCH HOÀN THIỆN & ĐẤU NỐI GIAO DIỆN (UI) SPRINT 4
**Dự án:** Ứng dụng Đặt Xe Tải (Truck Booking App)  
**Phạm vi:** Sprint 4 (Ví Ký Quỹ, Hoa Hồng, Cổng Thanh Toán VNPay/MoMo, Chat In-App, Tổng Đài Ảo Stringee, Kế Toán & Excel, Cronjobs Hệ Thống)  
**Mục tiêu:** Đồng bộ 100% các API Backend đã xây dựng trong Sprint 4 vào giao diện Khách hàng (`App.tsx`, `account.tsx`), Tài xế (`Driver.tsx`, `chat.tsx`) và Admin Portal (`Admin.tsx`, `admin/*`), xóa bỏ hoàn toàn dữ liệu giả lập (mock data) và bổ sung các màn hình/modal còn thiếu.

---

## I. TỔNG QUAN HIỆN TRẠNG & ĐỐI CHIẾU

### 1. Phía Backend Sprint 4 (Đã hoàn thiện 100% & Pass toàn bộ Test Suites)
- **Ví Ký Quỹ & Hoa hồng:** Tự động trừ 20% hoa hồng cuốc tiền mặt, cộng 80% thu nhập cuốc online, chặn bật trực tuyến & nhận cuốc khi số dư khả dụng < 200.000đ, kiểm tra Idempotency chống trừ trùng lặp.
- **Cổng thanh toán VNPay & MoMo:** Tạo link thanh toán nạp ví hoặc trả cước xe, xác thực chữ ký số HMAC-SHA512/SHA256, xử lý webhook IPN tự động cập nhật số dư hoặc chuyển trạng thái đơn `PAID`.
- **In-App Chat:** Lưu tin nhắn DB (`booking_messages`), phân quyền 403 bảo mật, hỗ trợ đa loại tin nhắn (chữ, ảnh, vị trí), bắn Pusher realtime tinh gọn payload và gửi FCM Notification.
- **Tổng đài ảo Stringee:** Cấp token JWT, cấp phép cuộc gọi giấu số qua Hotline 1900-8888, webhook SCCO ghi âm cuộc gọi, xử lý sự kiện đàm thoại.
- **Kế toán & Xuất file Excel:** Dashboard KPIs doanh thu tổng, 20% hoa hồng sàn, 80% tài xế, tỷ lệ hoàn thành, xu hướng ngày, top 10 tài xế; xuất file Excel `.xlsx` 3 sheets chuyên nghiệp qua `exceljs`.
- **Cronjob & Sao lưu DB:** Quét tự động khóa tài xế điểm thấp (< 4.0 sao), tự động sao lưu Database hàng đêm lúc 02:00 AM (có fallback JSON), API kích hoạt thủ công cho Admin.

### 2. Phía Frontend UI (Tồn tại sự đứt gãy giữa Giao diện và API)
- **Nhóm 1 (Đã có UI nhưng đang chạy Mock data):** Màn hình Chat (`chat.tsx`) đang dùng mảng RAM `let state: Conv[]`, thẻ Thu nhập tài xế (`Driver.tsx`) đang hardcode `1.254.000 đ`, các nút bấm Gọi điện thoại chưa gán hàm `onClick`.
- **Nhóm 2 (Chưa có UI để sử dụng API):** Chưa có Modal Nạp tiền ví tài xế, chưa có UI chọn thanh toán VNPay/MoMo khi đặt xe, chưa có Popup màn hình đàm thoại giấu số, chưa có Trang Kế toán/Xuất Excel trong Admin, chưa có Trang Quản lý Ví và Trang Quản trị Cronjob trong Admin.

---

## II. PHẦN 1: ĐẤU NỐI CÁC GIAO DIỆN ĐÃ CÓ (UI WIRING)
*(Thay thế state cục bộ/mock data bằng API fetch và sự kiện Pusher)*

### 1. Đấu nối Màn hình Chat In-App thời gian thực
* **File giao diện:** [`src/chat.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/chat.tsx)
* **Các API Backend sử dụng:**
  - `GET /api/v1/chat/:bookingId/messages`
  - `POST /api/v1/chat/send`
  - `PATCH /api/v1/chat/:bookingId/read`
  - Pusher Events: `chat:new-message`, `chat:messages-read` trên kênh `chat-{bookingId}`
* **Nội dung thực hiện:**
  - **Tải lịch sử tin nhắn:** Khi mở component `ChatView`, gọi `GET /api/v1/chat/:bookingId/messages?page=1&limit=50`. Nạp danh sách tin nhắn thực tế từ DB vào state (thay thế mảng tĩnh `state: Conv[]`).
  - **Gửi tin nhắn thực tế:** Khi người dùng bấm nút Gửi (hoặc bấm Quick Chips):
    - Gửi request `POST /api/v1/chat/send` kèm `{ bookingId, content, messageType: "TEXT" }`.
    - Hỗ trợ gửi ảnh: Tích hợp hàm upload ảnh lên Cloudinary lấy link CDN ➔ gửi `{ bookingId, messageType: "IMAGE", mediaUrl }`.
    - Hỗ trợ gửi vị trí: Lấy tọa độ GPS hiện tại ➔ gửi `{ bookingId, messageType: "LOCATION", content: "Vị trí hiện tại của tôi" }`.
  - **Lắng nghe Pusher Realtime:** Đăng ký kênh `chat-{bookingId}`. Khi nhận event `chat:new-message`, tự động append tin nhắn mới vào danh sách chat với hiệu ứng mượt mà.
  - **Đồng bộ đã xem (Read Receipt):** Khi người nhận mở màn hình chat, gọi `PATCH /api/v1/chat/:bookingId/read` để thông báo cho người gửi biết tin nhắn đã được đọc (hiển thị biểu tượng `✓✓` đã xem).

---

### 2. Đấu nối Thẻ Số Dư & Lịch Sử Giao Dịch Ví Tài Xế
* **File giao diện:** [`src/Driver.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/Driver.tsx) (Tab `earnings` - Thu nhập)
* **Các API Backend sử dụng:**
  - `GET /api/v1/driver/wallet`
  - `GET /api/v1/driver/wallet/transactions`
* **Nội dung thực hiện:**
  - **Đọc số dư thực tế từ DB:** Thay thế hoàn toàn dòng code `useState(1254000)` (line 2016). Trong `useEffect` khi tài xế đăng nhập hoặc vào tab Thu nhập:
    - Gọi `GET /api/v1/driver/wallet`.
    - Hiển thị: **Số dư thực tế (`balance`)**, **Số dư khả dụng (`availableBalance`)**, và **Hạn mức ký quỹ tối thiểu (`minDepositLimit`: 200.000 đ)**.
    - Nếu `isDepositQualified === false`: Hiển thị dải băng cảnh báo màu đỏ/cam: *"Số dư ký quỹ chưa đạt hạn mức tối thiểu 200.000đ. Vui lòng nạp thêm tối thiểu [shortfall]đ để bật trực tuyến và nhận cuốc."*
  - **Đọc lịch sử giao dịch ví:** Gọi `GET /api/v1/driver/wallet/transactions?page=1&limit=20`.
    - Hiển thị danh sách biến động số dư thực tế:
      - `COMMISSION_DEDUCTION`: `-60.000 đ` (Khấu trừ hoa hồng 20% cuốc xe #BK...)
      - `TRIP_INCOME`: `+240.000 đ` (Cộng doanh thu cuốc thanh toán online #BK...)
      - `TOPUP`: `+500.000 đ` (Nạp tiền vào ví ký quỹ)
      - `BONUS` / `PENALTY`: Tiền thưởng/phạt từ Admin.

---

### 3. Kích hoạt Nút Bấm Gọi Điện Thoại Giấu Số (Call Action)
* **File giao diện:**
  - Khách gọi tài xế: [`src/App.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/App.tsx#L1500)
  - Tài xế gọi khách: [`src/Driver.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/Driver.tsx#L567)
  - Gọi trong màn hình chat: [`src/chat.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/chat.tsx#L635)
* **API Backend sử dụng:** `POST /api/v1/calls/authorize`
* **Nội dung thực hiện:**
  - Gán hàm `handleCallPartner()` vào thuộc tính `onClick` của các nút bấm trên.
  - Khi người dùng bấm nút: Gửi request `POST /api/v1/calls/authorize` với `{ bookingId }`.
  - Nhận về: `maskedDisplayNumber: "1900-8888"`, `stringeeCallId`, `clientToken`.
  - Mở **Modal Màn hình Cuộc gọi (Calling Screen)** (được thiết kế mới ở Phần 2).

---

## III. PHẦN 2: THIẾT KẾ MỚI CÁC GIAO DIỆN & MODAL CÒN THIẾU (NEW UI DESIGN)
*(Xây dựng mới các thành phần UI để hoàn thiện trải nghiệm người dùng)*

### 4. Thiết kế Modal "Nạp Tiền Vào Ví Ký Quỹ" cho Tài Xế (Top-Up Modal)
* **Vị trí tích hợp:** [`src/Driver.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/Driver.tsx) (Tab Thu nhập & Popup cảnh báo thiếu ký quỹ)
* **Các API Backend sử dụng:**
  - `POST /api/v1/driver/wallet/topup` (Nạp tiền mặt/chuyển khoản)
  - `POST /api/v1/payments/create-url` (Tạo link thanh toán qua cổng VNPay / MoMo)
* **Thiết kế chi tiết:**
  - Thêm nút bấm nổi bật **"+ Nạp tiền ví"** cạnh thẻ số dư ví tài xế.
  - Khi bấm, mở Modal Popup:
    - **Chọn mệnh giá nạp nhanh:** [100.000đ], [200.000đ], [500.000đ], [1.000.000đ], hoặc ô tự nhập số tiền.
    - **Chọn phương thức nạp tiền:**
      1. Cổng thanh toán **VNPay** (Thẻ ATM, Mobile Banking, VNPAY-QR).
      2. Ví điện tử **MoMo** (Mã QR MoMo).
      3. **Nộp tiền mặt** trực tiếp tại điểm giao dịch/chuyển khoản văn phòng.
    - Nút bấm **"XÁC NHẬN NẠP TIỀN"**:
      - Nếu chọn VNPay/MoMo: Gọi `POST /api/v1/payments/create-url` ➔ Chuyển hướng hoặc mở QR Code để tài xế thanh toán.
      - Sau khi nạp thành công: Tự động cập nhật lại số dư ví mới và cho phép Bật trực tuyến.

---

### 5. Thiết kế Bộ Chọn Phương Thức Thanh Toán & Màn Hình Thanh Toán Trực Tuyến (Khách hàng)
* **Vị trí tích hợp:** [`src/App.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/App.tsx) (Form Đặt xe & Màn hình thanh toán)
* **Các API Backend sử dụng:**
  - `POST /api/v1/payments/create-url`
  - `GET /api/v1/payments/status/:transactionCode`
* **Thiết kế chi tiết:**
  - **Tại bước chọn thanh toán trước khi Đặt xe:**
    - Thay thế giá trị hardcode `paymentMethod: "CASH"` bằng giao diện cho phép khách lựa chọn:
      - 💵 **Tiền mặt (CASH)**: Thanh toán trực tiếp cho tài xế khi giao hàng.
      - 💳 **Cổng VNPay (VNPAY)**: Quét mã VNPAY-QR hoặc thẻ ATM nội địa.
      - 👛 **Ví MoMo (MOMO)**: Thanh toán qua app MoMo.
      - 💼 **Ví điện tử tài khoản (WALLET)**: Trừ trực tiếp vào số dư ví của khách (nếu đủ tiền).
  - **Modal Quét mã QR Thanh toán (Payment QR Modal):**
    - Khi khách chọn VNPay hoặc MoMo và bấm Đặt xe:
      - Gọi `POST /api/v1/payments/create-url` với `{ bookingId, gateway, amount, purpose: "BOOKING_PAYMENT" }`.
      - Hiển thị Modal popup với hình ảnh **Mã QR Code**, số tiền, mã đơn hàng và hướng dẫn thanh toán.
      - Bộ đếm ngược 15 phút.
      - Cơ chế tự động Polling `GET /api/v1/payments/status/:transactionCode` mỗi 3 giây (hoặc lắng nghe Pusher). Ngay khi thanh toán thành công, tự động đóng Modal, hiển thị tích xanh *"Đã thanh toán thành công"* và chuyển khách sang màn hình Tìm kiếm tài xế.

---

### 6. Thiết kế Màn Hình Cuộc Gọi Giấu Số (Stringee Calling Screen Modal)
* **Vị trí tích hợp:** Tạo component mới `src/CallingModal.tsx` dùng chung cho cả Khách hàng (`App.tsx`) và Tài xế (`Driver.tsx`).
* **Các API Backend sử dụng:** `POST /api/v1/calls/authorize`, Stringee SDK Web
* **Thiết kế chi tiết:**
  - Giao diện Popup cuộc gọi chuyên nghiệp (phong cách màn hình cuộc gọi điện thoại):
    - Nền tối mờ sang trọng (Backdrop blur).
    - Avatar to tròn của người nhận, Tên hiển thị (Tài xế / Khách hàng).
    - Dòng trạng thái nổi bật:
      - *"Đang kết nối qua Tổng đài bảo mật..."*
      - Hiển thị số đại diện: **Hotline 1900-8888 (Số điện thoại được bảo mật 100%)**
    - Bộ đếm thời gian đàm thoại (00:00, 00:01, 00:02...).
    - **Các nút chức năng:**
      - Nút tròn Mute (Bật/Tắt Microphone).
      - Nút tròn Speaker (Bật/Tắt Loa ngoài).
      - Nút đỏ lớn **"KẾT THÚC CUỘC GỌI"**: Gác máy và đóng Modal.

---

### 7. Thiết kế Phân Hệ "Kế Toán & Doanh Thu" trong Admin Portal (Admin Accounting)
* **Vị trí tích hợp:** Tạo mới [`src/admin/Accounting.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/admin/Accounting.tsx) và thêm mục `"accounting"` vào sidebar [`src/Admin.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/Admin.tsx).
* **Các API Backend sử dụng:**
  - `GET /api/v1/accounting/dashboard`
  - `GET /api/v1/accounting/export-excel`
* **Thiết kế chi tiết:**
  - **Thanh công cụ lọc:** Chọn khoảng thời gian (Hôm nay, 7 ngày qua, 30 ngày qua, Tháng này, hoặc Tùy chọn Ngày bắt đầu - Ngày kết thúc).
  - **4 Thẻ KPIs Tài chính hàng đầu:**
    1. **Tổng doanh thu cước xe (Gross Revenue)** (VND).
    2. **Doanh thu hoa hồng sàn (20% Platform Commission)** (VND).
    3. **Thu nhập thực nhận của tài xế (80% Driver Net Earnings)** (VND).
    4. **Tổng số chuyến xe & Tỷ lệ hoàn thành** (VD: *69/96 cuốc - 71.9%*).
  - **Bảng phân tích tỷ trọng:**
    - Doanh thu theo phương thức thanh toán: Tiền mặt vs VNPay vs MoMo (kèm thanh phần trăm).
    - Doanh thu theo loại xe tải: Xe 500kg, Xe 1 tấn, Xe 2 tấn...
  - **Bảng Top 10 Tài xế đạt doanh thu cao nhất:** Tên, Số điện thoại, Biển số, Số cuốc hoàn thành, Tổng doanh thu, Hoa hồng đã đóng.
  - **NÚT BẤM "XUẤT BÁO CÁO EXCEL":**
    - Nút màu xanh lá chuẩn Excel với biểu tượng file bảng tính.
    - Khi Admin bấm: Gọi `GET /api/v1/accounting/export-excel`, trình duyệt tự động tải về file `Bao_Cao_Ke_Toan_[ngay].xlsx` gồm đầy đủ 3 sheets dữ liệu định dạng chuẩn.

---

### 8. Thiết kế Phân Hệ "Quản Lý Ví Tài Xế" trong Admin Portal (Admin Wallets)
* **Vị trí tích hợp:** Tạo mới [`src/admin/Wallets.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/admin/Wallets.tsx) tích hợp vào menu Admin.
* **Các API Backend sử dụng:**
  - `GET /api/v1/admin/wallets`
  - `POST /api/v1/admin/wallets/:userId/adjust`
  - `PUT /api/v1/admin/wallets/:userId/min-deposit-limit`
* **Thiết kế chi tiết:**
  - **Bảng danh sách Ví ký quỹ tài xế:**
    - Cột: Họ tên tài xế, Số điện thoại, Biển số xe, **Số dư ví**, **Số dư khả dụng**, **Hạn mức yêu cầu (200k)**, **Trạng thái ký quỹ** (Badge xanh: *Đạt chuẩn*, Badge đỏ: *Thiếu ký quỹ [shortfall]*).
    - Ô tìm kiếm theo tên hoặc số điện thoại tài xế.
  - **Modal Điều chỉnh số dư Ví:**
    - Admin chọn hành động: **Thưởng (Bonus)**, **Phạt vi phạm (Penalty)**, **Nạp tiền thủ công (Top-up)**, **Hoàn tiền (Refund)**.
    - Nhập số tiền và lý do điều chỉnh.
    - Bấm xác nhận ➔ Gửi `POST /api/v1/admin/wallets/:userId/adjust` ➔ Cập nhật ngay lập tức vào số dư ví tài xế.

---

### 9. Thiết kế Phân Hệ "Hệ Thống & Tác Vụ Nền" trong Admin Portal (System & Cronjobs)
* **Vị trí tích hợp:** Tạo mới [`src/admin/SystemCron.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/admin/SystemCron.tsx) (hoặc tích hợp vào mục Cài đặt `settings`).
* **Các API Backend sử dụng:**
  - `GET /api/v1/admin/cron/status`
  - `POST /api/v1/admin/cron/trigger-block-drivers`
  - `POST /api/v1/admin/cron/trigger-backup`
* **Thiết kế chi tiết:**
  - **Thẻ hiển thị trạng thái 2 Cronjob tự động:**
    1. *Tự động khóa tài xế điểm thấp*: Lịch chạy `03:00 AM hàng ngày` | Trạng thái lần chạy gần nhất | Số tài xế đã xử lý.
       - Nút thao tác: **"Quét & Khóa ngay"** (cho phép Admin chọn ngưỡng sao < 4.0 và số cuốc tối thiểu để chạy ngay lập tức).
    2. *Tự động sao lưu CSDL*: Lịch chạy `02:00 AM hàng ngày` | Trạng thái lần chạy gần nhất.
       - Nút thao tác: **"Sao lưu CSDL ngay"** (tạo bản backup tức thì vào thư mục hệ thống).
  - **Bảng danh sách các bản Backup Database:**
    - Hiển thị tên file (`backup_snapshot_...json` hoặc `.sql`), kích thước file, thời gian tạo.

---

## IV. LỘ TRÌNH THỰC HIỆN (MILESTONES & PHÂN KỲ)

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                                LỘ TRÌNH ĐỒNG BỘ UI SPRINT 4                                    │
├────────────┬────────────────────────────────────────────────────────┬─────────────────────────┤
│ GIAI ĐOẠN  │ HẠNG MỤC THỰC HIỆN                                     │ KẾT QUẢ ĐẠT ĐƯỢC        │
├────────────┼────────────────────────────────────────────────────────┼─────────────────────────┤
│ Giai đoạn 1│ Đấu nối In-App Chat thực tế & Thẻ Số dư ví tài xế      │ Chat lưu DB & Realtime, │
│            │ (Thay thế hoàn toàn dữ liệu mock trong chat & earnings)│ Ví tài xế đọc từ DB.    │
├────────────┼────────────────────────────────────────────────────────┼─────────────────────────┤
│ Giai đoạn 2│ Dựng Modal Nạp tiền ví & Cổng thanh toán VNPay/MoMo    │ Nạp ví trực tuyến &     │
│            │ (Cho cả khách hàng đặt xe và tài xế nạp ký quỹ)        │ Thanh toán cước qua QR. │
├────────────┼────────────────────────────────────────────────────────┼─────────────────────────┤
│ Giai đoạn 3│ Dựng Modal Cuộc gọi giấu số Stringee 1900-8888         │ Bấm icon gọi hiện popup │
│            │ (Kích hoạt các nút gọi ở App.tsx, Driver.tsx, chat.tsx)│ đàm thoại bảo mật.      │
├────────────┼────────────────────────────────────────────────────────┼─────────────────────────┤
│ Giai đoạn 4│ Xây dựng Phân hệ Admin: Kế toán, Xuất Excel & Cronjob  │ Dashboard doanh thu,    │
│            │ (Accounting.tsx, Wallets.tsx, SystemCron.tsx)          │ Xuất file Excel 3 sheet.│
├────────────┼────────────────────────────────────────────────────────┼─────────────────────────┤
│ Giai đoạn 5│ Kiểm thử Toàn trình End-to-End (E2E Integration Test)  │ Đảm bảo 100% UI khớp API│
└────────────┴────────────────────────────────────────────────────────┴─────────────────────────┘
```

---

## V. ĐÁNH GIÁ TÁC ĐỘNG & BẢO ĐẢM AN TOÀN

1. **Tính tương thích ngược:** Việc đấu nối UI không làm thay đổi cấu trúc database hoặc phá vỡ các API backend đã vượt qua kiểm thử của Sprint 1, 2, 3 và 4.
2. **Khả năng dự phòng (Graceful Degradation):** Nếu cổng thanh toán hoặc dịch vụ thứ ba (Pusher/Stringee) gặp sự cố mạng, ứng dụng luôn có cơ chế fallback thông báo thân thiện tới người dùng thay vì gây crash màn hình.
3. **Hiệu năng giao diện:** Áp dụng debounce cho các tác vụ tìm kiếm, tối ưu hóa kích thước file tải về và chỉ gọi API khi component được kích hoạt (lazy load).
