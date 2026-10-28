-- ==============================================================================
-- 009_DRIVER_RATINGS.SQL
-- Bảng lưu trữ toàn bộ đánh giá, nhận xét (Feedback & Reviews) của khách hàng về tài xế
-- ==============================================================================

CREATE TABLE IF NOT EXISTS driver_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    tags TEXT[] DEFAULT '{}',
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_booking_customer_rating UNIQUE (booking_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver_id ON driver_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_customer_id ON driver_ratings(customer_id);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_rating ON driver_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_driver_ratings_created_at ON driver_ratings(created_at DESC);
