-- ==============================================================================
-- 010_CANCELLATION_POLICY.SQL
-- Bổ sung các cột phục vụ chính sách hủy chuyến mới:
-- 1. accepted_at: Thời điểm tài xế nhận cuốc
-- 2. initial_distance_to_pickup: Khoảng cách từ tài xế đến điểm đón lúc nhận cuốc (mét)
-- ==============================================================================

ALTER TABLE bookings 
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS initial_distance_to_pickup DECIMAL(10,2);
