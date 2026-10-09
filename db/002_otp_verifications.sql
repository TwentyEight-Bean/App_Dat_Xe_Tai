-- ==============================================================================
-- MIGRATION: 002_otp_verifications.sql
-- PURPOSE: Quản lý vòng đời mã OTP cho đăng nhập / đăng ký
-- AUTHOR: BE-01
-- ==============================================================================

CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    is_used BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone ON otp_verifications(phone);
