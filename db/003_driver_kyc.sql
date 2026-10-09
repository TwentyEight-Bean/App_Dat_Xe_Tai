-- ==============================================================================
-- MIGRATION: 003_driver_kyc.sql
-- PURPOSE: Schema cho quy trình KYC tài xế và quản lý tài liệu, phương tiện
-- SPRINT: 2 (Task 2.2)
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE kyc_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE driver_doc_type AS ENUM (
        'CCCD_FRONT',
        'CCCD_BACK',
        'DRIVER_LICENSE',
        'VEHICLE_REGISTRATION',
        'PORTRAIT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. VEHICLE_TYPES
CREATE TABLE IF NOT EXISTS vehicle_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    payload_capacity_kg DECIMAL(10,2) NOT NULL,
    dimensions_lxwxh JSONB,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed danh mục loại xe mẫu nếu chưa có
INSERT INTO vehicle_types (code, name, payload_capacity_kg, dimensions_lxwxh, description)
VALUES
('500KG', 'Xe tải 500kg', 500, '{"length": 2.0, "width": 1.3, "height": 1.3}', 'Phù hợp chở đồ đạc nhỏ, chuyển phòng trọ'),
('1TON', 'Xe tải 1 Tấn', 1000, '{"length": 3.0, "width": 1.6, "height": 1.7}', 'Phù hợp chuyển nhà 1 phòng ngủ, hàng hóa vừa'),
('2TON_THUNGKIN', 'Xe tải 2 Tấn (Thùng kín)', 2000, '{"length": 4.3, "width": 1.8, "height": 1.8}', 'Chở hàng điện tử, chống nước tốt'),
('2TON_MUIBAT', 'Xe tải 2 Tấn (Mui bạt)', 2000, '{"length": 4.3, "width": 1.8, "height": 1.8}', 'Có thể cơi nới nhẹ, dễ bốc dỡ')
ON CONFLICT (code) DO NOTHING;

-- 3. DRIVER_PROFILES
CREATE TABLE IF NOT EXISTS driver_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type_id UUID REFERENCES vehicle_types(id),
    license_plate VARCHAR(20) UNIQUE,
    driver_license_no VARCHAR(50) UNIQUE,
    kyc_status kyc_status DEFAULT 'PENDING',
    rejection_reason TEXT,
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    is_online BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Đảm bảo cột rejection_reason tồn tại nếu bảng đã được tạo trước đó
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 4. DRIVER_DOCUMENTS
CREATE TABLE IF NOT EXISTS driver_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
    doc_type driver_doc_type NOT NULL,
    file_url TEXT NOT NULL,
    doc_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_driver_doc UNIQUE (driver_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON driver_documents(driver_id);
