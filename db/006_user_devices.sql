-- Bảng lưu trữ FCM Device Tokens của người dùng (Khách hàng & Tài xế)
-- Phục vụ Push Notification qua Firebase Cloud Messaging (FCM)
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    device_type VARCHAR(20) DEFAULT 'WEB', -- 'WEB', 'ANDROID', 'IOS'
    device_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_devices_token UNIQUE (user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_fcm_token ON user_devices(fcm_token);
