-- ==============================================================================
-- 007_SPRINT3_ENHANCEMENTS.SQL
-- Bổ sung các cột phục vụ Sprint 3: Lưu vết hủy đơn, Bằng chứng giao nhận (POD)
-- và hạn mức ký quỹ ví tối thiểu của tài xế
-- ==============================================================================

-- 1. Bổ sung các cột hủy đơn và bằng chứng giao nhận vào bảng bookings
ALTER TABLE bookings 
    ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(20),
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_fee DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS pickup_proof_image TEXT,
    ADD COLUMN IF NOT EXISTS delivery_proof_image TEXT;

-- 2. Bổ sung cột hạn mức ký quỹ tối thiểu vào bảng wallets (mặc định: 200.000 VNĐ)
ALTER TABLE wallets 
    ADD COLUMN IF NOT EXISTS min_deposit_limit DECIMAL(15,2) DEFAULT 200000;
