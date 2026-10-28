-- ==============================================================================
-- 008_DELIVERY_ANTIFRAUD.SQL
-- Bổ sung các cột phục vụ chống gian lận khi hoàn thành cuốc xe:
-- 1. Mã OTP xác nhận giao hàng từ người nhận (delivery_otp)
-- 2. Tọa độ GPS lúc tài xế hoàn thành đơn (completed_lat, completed_lng)
-- 3. Mốc thời gian bắt đầu giao và kết thúc (in_transit_at, completed_at)
-- ==============================================================================

ALTER TABLE bookings 
    ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(10),
    ADD COLUMN IF NOT EXISTS completed_lat DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS completed_lng DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
