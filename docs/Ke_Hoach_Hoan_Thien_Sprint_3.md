# BẢNG KẾ HOẠCH HOÀN THIỆN & SỬA LỖI SPRINT 3
**Dự án:** Ứng dụng Đặt Xe Tải (Truck Booking System)  
**Phạm vi:** Sprint 3 (Real-time, Điều phối cuốc xe, PostGIS, State Machine, Pusher & Push Notification)  
**Trạng thái:** Chờ phê duyệt (Ready for Review)  

---

## 🎯 MỤC TIÊU TỔNG QUÁT SPRINT 3
1. **Khắc phục triệt để các lỗi sai logic cốt lõi**:
   - Chặn rò rỉ đơn hàng khi tài xế đang ở điểm lấy hàng (`ARRIVED_AT_PICKUP`).
   - Buộc tuân thủ quy trình tuần tự của State Machine (không nhảy cóc trạng thái).
   - Chuẩn hóa cấu hình Pusher và Firebase Admin SDK chống lỗi crash/log 400.
2. **Hoàn thiện các mắt xích nghiệp vụ vận tải thực tế**:
   - Lưu vết lý do hủy đơn và tính phí bồi thường cho tài xế khi khách hủy tại điểm đón.
   - Bổ sung chụp ảnh bằng chứng giao nhận (Proof of Delivery - POD).
   - Lọc tài xế đủ điều kiện ký quỹ 200k ngay từ câu query PostGIS.
   - Thêm cơ chế mở rộng bán kính quét cuốc đa vòng (Vòng 1: 5km -> Vòng 2: 8km).
   - Bảo mật kênh Pusher qua Private Channel Auth endpoint.
3. **Chuẩn bị nền tảng hoàn hảo để đấu nối UI Realtime**:
   - Popup nổ cuốc đếm ngược 20s trên app tài xế.
   - Màn hình tìm xe và Live Tracking bản đồ xe chạy trên app khách hàng.

---

## 📌 PHẦN 1: KHẮC PHỤC CÁC LỖI SAI LOGIC (ƯU TIÊN CAO)

### Task 1.1: Sửa lỗi bỏ quên trạng thái `ARRIVED_AT_PICKUP` khi lọc tài xế bận
* **Mục đích:** 
  - Ngăn chặn hệ thống phát thêm cuốc mới cho tài xế đang có mặt tại điểm lấy hàng chờ bốc xếp đồ.
* **Vị trí code:** [dispatchService.ts:L451-L457](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/dispatchService.ts#L451-L457) (`findNearbyDrivers`).
* **Giải pháp kỹ thuật:**
  - Cập nhật điều kiện loại trừ:
    ```sql
    NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.driver_id = dp.id
        AND b.status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
    )
    ```
* **Phân công:** BE-Lead
* **Thời gian ước tính:** 30 phút

---

### Task 1.2: Chuẩn hóa State Machine — Bắt buộc đi qua bước `ARRIVED_AT_PICKUP`
* **Mục đích:** 
  - Đảm bảo tài xế phải xác nhận đã đến điểm lấy hàng trước khi bắt đầu chặng vận chuyển, tránh việc tài xế chưa tới nơi đã bấm "Đang giao hàng".
  - Giúp khách hàng nhận đúng thông báo "Xe đã tới nơi" để kịp thời chuẩn bị hàng hóa.
* **Vị trí code:** [bookingService.ts:L860-L872](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/bookingService.ts#L860-L872) (`VALID_TRANSITIONS`).
* **Giải pháp kỹ thuật:**
  - Sửa mảng chuyển đổi hợp lệ của `ACCEPTED`:
    ```ts
    const VALID_TRANSITIONS: Record<string, string[]> = {
      SEARCHING: ["ACCEPTED", "CANCELLED"],
      ACCEPTED: ["ARRIVED_AT_PICKUP", "CANCELLED"], // Xóa IN_TRANSIT khỏi đây
      ARRIVED_AT_PICKUP: ["IN_TRANSIT", "CANCELLED"],
      IN_TRANSIT: ["COMPLETED"],
      COMPLETED: [],
      CANCELLED: [],
    }
    ```
* **Phân công:** BE-01
* **Thời gian ước tính:** 30 phút

---

### Task 1.3: Sửa lỗi cú pháp khởi tạo Firebase Admin SDK
* **Mục đích:** 
  - Khắc phục lỗi `Cannot read properties of undefined (reading 'cert')` trong môi trường ESM TypeScript.
  - Đảm bảo khi gắn Service Account Credentials thật vào `.env`, Firebase hoạt động ngay lập tức mà không bị văng sang Mock Mode.
* **Vị trí code:** [notificationService.ts:L45-L80](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/notificationService.ts#L45-L80) (`initFirebaseAdmin`).
* **Giải pháp kỹ thuật:**
  - Sử dụng cú pháp import tương thích ESM của Firebase Admin SDK:
    ```ts
    import admin from "firebase-admin"
    // Sử dụng cert từ admin.credential hoặc import { cert } from "firebase-admin/app"
    const credential = admin.credential 
      ? admin.credential.cert({ projectId, clientEmail, privateKey })
      : undefined
    ```
  - Kiểm tra nếu `projectId` chứa giá trị mẫu `your_...` thì tự động bật Dev Mock an toàn.
* **Phân công:** BE-01
* **Thời gian ước tính:** 45 phút

---

### Task 1.4: Chuẩn hóa kiểm tra cấu hình Pusher — Loại bỏ lỗi HTTP 400
* **Mục đích:** 
  - Ngăn chặn hệ thống gửi request với App ID giả (`your_pusher_app_id`) lên server Pusher gây lỗi `Unexpected status code 400` đỏ rực trên console log.
* **Vị trí code:** [pusher.ts:L9-L28](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/pusher.ts#L9-L28).
* **Giải pháp kỹ thuật:**
  - Bổ sung hàm kiểm tra tính hợp lệ của biến môi trường:
    ```ts
    const isPusherConfigured = Boolean(
      process.env.PUSHER_APP_ID &&
      !process.env.PUSHER_APP_ID.startsWith("your_") &&
      process.env.PUSHER_KEY &&
      !process.env.PUSHER_KEY.startsWith("your_") &&
      process.env.PUSHER_SECRET
    )
    ```
* **Phân công:** BE-Lead
* **Thời gian ước tính:** 30 phút

---

## 📌 PHẦN 2: BỔ SUNG CÁC THIẾU SÓT NGHIỆP VỤ (ƯU TIÊN VỪA)

### Task 2.1: Lưu vết Hủy đơn vào Database & Tính phí bồi thường hủy đơn
* **Mục đích:** 
  - Lưu lại đối tượng hủy (`CUSTOMER` / `DRIVER`), lý do hủy và thời điểm hủy để phục vụ tra cứu lịch sử và báo cáo Admin.
  - Áp dụng chính sách bồi thường: Nếu khách hàng hủy khi tài xế đã đến điểm đón (`ARRIVED_AT_PICKUP`), tự động tính phụ phí bồi thường cho tài xế (mặc định: 30.000đ - 50.000đ).
* **Vị trí code:** 
  - Database: Bổ sung các cột vào bảng `bookings`: `cancelled_by`, `cancellation_reason`, `cancellation_fee`, `cancelled_at`.
  - Service: [bookingService.ts:L1145-L1205](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/bookingService.ts#L1145-L1205) (`cancelBooking`).
* **Giải pháp kỹ thuật:**
  - Nếu `currentStatus === 'ARRIVED_AT_PICKUP'` và `isCustomer === true`:
    - Tính `cancellationFee = 30000`.
    - Trừ tiền ví khách / ghi nhận nợ, cộng tiền bồi thường vào ví tài xế qua `walletService`.
* **Phân công:** BE-02
* **Thời gian ước tính:** 2.5 giờ

---

### Task 2.2: Bổ sung Bằng chứng giao nhận hàng (Proof of Delivery - POD)
* **Mục đích:** 
  - Tài xế chụp ảnh hàng hóa lúc nhận và ảnh kiện hàng kèm chữ ký/vị trí lúc giao để làm bằng chứng bảo vệ đôi bên chống khiếu nại thất thoát, hư hỏng.
* **Vị trí code:**
  - Database: Thêm các cột vào `bookings`: `pickup_proof_image`, `delivery_proof_image`.
  - Service: [bookingService.ts:L888-L1000](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/bookingService.ts#L888-L1000) (`updateBookingStatus`).
* **Giải pháp kỹ thuật:**
  - Bổ sung tham số `proofImageUrl?: string` trong DTO cập nhật trạng thái:
    - Khi chuyển sang `IN_TRANSIT`: Lưu `pickup_proof_image`.
    - Khi chuyển sang `COMPLETED`: Bắt buộc hoặc ưu tiên có `delivery_proof_image`.
* **Phân công:** BE-01
* **Thời gian ước tính:** 2 giờ

---

### Task 2.3: Lọc tài xế đủ điều kiện ví ký quỹ ngay trong truy vấn PostGIS
* **Mục đích:** 
  - Không gửi lời mời cuốc xe đến các tài xế có số dư ví < 200.000đ, tránh tình trạng tài xế thấy đơn nổ nhưng bấm vào lại bị báo lỗi thiếu tiền ký quỹ.
* **Vị trí code:** [dispatchService.ts:L410-L470](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/dispatchService.ts#L410-L470) (`findNearbyDrivers`).
* **Giải pháp kỹ thuật:**
  - Thêm điều kiện JOIN bảng `wallets`:
    ```sql
    JOIN wallets w ON w.user_id = dp.user_id
    WHERE w.balance >= w.min_deposit_limit
    ```
* **Phân công:** BE-Lead
* **Thời gian ước tính:** 1.5 giờ

---

### Task 2.4: Điều phối đa vòng tự động (Dispatch Escalation Vòng 1 & Vòng 2)
* **Mục đích:** 
  - Tự động mở rộng bán kính tìm xe từ 3-5km lên 5-8km nếu sau 20 giây chưa có tài xế nào nhận cuốc, tăng tỉ lệ khớp đơn thành công.
* **Vị trí code:** [bookingService.ts:L268-L325](file:///d:/WEB/App_Dat_Xe_Tai/src/lib/bookingService.ts#L268-L325) (`createBooking`).
* **Giải pháp kỹ thuật:**
  - Tạo hàm `escalateBookingDispatch(bookingId)`:
    - Kiểm tra nếu sau 20 giây trạng thái vẫn là `SEARCHING`.
    - Tự động quét vòng 2 với `radiusKm: 8`, loại trừ các tài xế vòng 1 đã từ chối.
    - Bắn sự kiện Pusher đợt 2.
* **Phân công:** BE-Lead
* **Thời gian ước tính:** 2.5 giờ

---

### Task 2.5: Bổ sung Endpoint xác thực Pusher Private Channel Auth
* **Mục đích:** 
  - Bảo mật kết nối Realtime, ngăn chặn người ngoài nghe trộm sự kiện vị trí GPS và tin nhắn của chuyến xe.
* **Vị trí code:** Tạo route mới tại `src/api/routes/pusher.ts` (`POST /api/v1/pusher/auth`).
* **Giải pháp kỹ thuật:**
  - Nhận `socket_id` và `channel_name`.
  - Dùng middleware `requireAuth` để xác thực JWT người dùng và kiểm tra quyền sở hữu ID chuyến xe trước khi cấp phép qua `pusherServer.authorizeChannel(...)`.
* **Phân công:** BE-02
* **Thời gian ước tính:** 1.5 giờ

---

## 📌 PHẦN 3: HOÀN THIỆN & KẾT NỐI UI REALTIME (FRONTEND WIRING)

### Task 3.1: Giao diện Tài xế — Popup "Nổ cuốc mới" đếm ngược 20s & Nhận cuốc
* **File giao diện:** [`src/Driver.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/Driver.tsx)
* **Công việc thực hiện:**
  - Kết nối Pusher Client lắng nghe kênh `driver-{driverId}` -> sự kiện `booking:new-offer`.
  - Hiển thị Modal Popup "CUỐC XE MỚI GẦN BẠN":
    - Điểm đón, điểm trả, khoảng cách (km), giá cước (VND), loại hàng.
    - Thanh đếm ngược thời gian từ 20 giây về 0s kèm âm thanh tít tít.
    - Nút bấm to màu xanh "NHẬN CUỐC" (gọi `POST /api/v1/driver/bookings/:id/accept`).
  - Khi nhận thành công: Chuyển sang màn hình điều hướng chuyến đi với 3 nút chuyển trạng thái lớn:
    - Nút 1: "ĐÃ ĐẾN ĐIỂM ĐÓN" (`ARRIVED_AT_PICKUP`)
    - Nút 2: "BẮT ĐẦU VẬN CHUYỂN" (`IN_TRANSIT`)
    - Nút 3: "GIAO HÀNG THÀNH CÔNG" (`COMPLETED`)
* **Phân công:** FE-Team
* **Thời gian ước tính:** 3.5 giờ

---

### Task 3.2: Giao diện Khách hàng — Radar tìm xe & Màn hình Live Tracking
* **File giao diện:** [`src/App.tsx`](file:///d:/WEB/App_Dat_Xe_Tai/src/App.tsx)
* **Công việc thực hiện:**
  - Sau khi khách bấm "Đặt xe" (`POST /api/v1/bookings`):
    - Chuyển sang màn hình quét sóng Radar "Đang tìm tài xế gần bạn nhất...".
    - Lắng nghe sự kiện `booking:accepted` trên kênh `trip-{bookingId}` qua Pusher.
  - Khi tài xế nhận đơn:
    - Bật màn hình Live Tracking hiển thị thông tin tài xế (Ảnh đại diện, Họ tên, SĐT, Biển số xe, Loại xe).
    - Lắng nghe sự kiện `driver:location-update` để cập nhật icon chiếc xe tải di chuyển mượt mà trên bản đồ Goong Map.
    - Hiển thị thanh tiến trình 4 bước: [Đã nhận] -> [Xe đã đến] -> [Đang giao] -> [Hoàn thành].
* **Phân công:** FE-Team
* **Thời gian ước tính:** 4 giờ

---

## 📊 BẢNG TỔNG HỢP TIẾN ĐỘ & PHÂN CÔNG SPRINT 3

| Mã Task | Hạng mục công việc | Phân loại | Phân công | Thời gian | Mức ưu tiên |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1.1** | Fix bỏ quên `ARRIVED_AT_PICKUP` khi lọc tài xế bận | Bug Fix | **BE-Lead** | 0.5h | 🔴 Cao |
| **1.2** | Fix State Machine nhảy cóc từ `ACCEPTED` sang `IN_TRANSIT` | Logic Fix | **BE-01** | 0.5h | 🔴 Cao |
| **1.3** | Fix lỗi cú pháp khởi tạo Firebase Admin SDK | SDK Fix | **BE-01** | 0.75h | 🔴 Cao |
| **1.4** | Fix kiểm tra cấu hình Pusher tránh lỗi HTTP 400 | Config Fix | **BE-Lead** | 0.5h | 🔴 Cao |
| **2.1** | Lưu vết hủy đơn & Phí bồi thường hủy tại điểm đón | Nghiệp vụ | **BE-02** | 2.5h | 🟡 Vừa |
| **2.2** | Bằng chứng giao nhận hàng (Proof of Delivery - POD) | Nghiệp vụ | **BE-01** | 2.0h | 🟡 Vừa |
| **2.3** | Lọc tài xế đủ ký quỹ 200k trong query PostGIS | Tối ưu DB | **BE-Lead** | 1.5h | 🟡 Vừa |
| **2.4** | Điều phối mở rộng bán kính đa vòng (5km -> 8km) | Thuật toán | **BE-Lead** | 2.5h | 🟡 Vừa |
| **2.5** | Endpoint xác thực Pusher Private Channel Auth | Bảo mật | **BE-02** | 1.5h | 🟡 Vừa |
| **3.1** | Giao diện Tài xế: Popup nổ cuốc đếm ngược 20s & Nhận cuốc | Frontend UI | **FE-Team** | 3.5h | 🟢 Tiếp theo |
| **3.2** | Giao diện Khách: Radar tìm xe & Màn hình Live Tracking | Frontend UI | **FE-Team** | 4.0h | 🟢 Tiếp theo |

**Tổng thời gian dự kiến:** ~20 giờ làm việc.

---

## 🧪 KỊCH BẢN KIỂM THỬ NGHIỆM THU (ACCEPTANCE CRITERIA)

| STT | Test Case | Kết quả mong đợi |
| :---: | :--- | :--- |
| **TC-01** | Tài xế đang ở trạng thái `ARRIVED_AT_PICKUP` tại một đơn khác | Gọi API tìm tài xế lân cận -> Tài xế này **không** xuất hiện trong danh sách kết quả. |
| **TC-02** | Tài xế bấm chuyển từ `ACCEPTED` thẳng sang `IN_TRANSIT` | Hệ thống trả lỗi `400 Bad Request`, bắt buộc phải chuyển sang `ARRIVED_AT_PICKUP` trước. |
| **TC-03** | Chạy kiểm thử khi chưa có key Pusher thật trong `.env` | Hệ thống tự động chuyển sang chế độ Mock an toàn, không còn dòng lỗi đỏ `Unexpected status code 400`. |
| **TC-04** | Khách hàng hủy đơn khi tài xế đã đến điểm đón (`ARRIVED_AT_PICKUP`) | Chuyến xe chuyển sang `CANCELLED`, lưu `cancellation_reason` vào DB, tự động trừ 30.000đ bồi thường cho tài xế. |
| **TC-05** | Tài xế hoàn thành đơn hàng kèm ảnh chụp kiện hàng lúc giao | Link ảnh được lưu vào `delivery_proof_image` và trạng thái chuyển thành `COMPLETED`. |
| **TC-06** | Tài xế có số dư ví 50.000đ (dưới 200k) | Không nhận được tín hiệu nổ cuốc xe mới khi khách đặt xe trong bán kính 1km. |
| **TC-07** | Khách đặt xe trên Web, tài xế mở app di động | Trong vòng 1 giây: Màn hình tài xế phát chuông và bật Popup đếm ngược 20s nhận cuốc. |
