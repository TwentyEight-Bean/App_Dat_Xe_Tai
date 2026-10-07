-- ==============================================================================
-- DATABASE SCHEMA: App Đặt Xe Tải (Truck Booking App)
-- TARGET: PostgreSQL (Neon) with PostGIS extension
-- AUTHOR: Tech Lead / Senior Backend Engineer
-- ==============================================================================

-- BƯỚC 1: BẬT EXTENSION POSTGIS (BẮT BUỘC TRÊN NEON ĐỂ XỬ LÝ TỌA ĐỘ)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. ENUMS (Kiểu dữ liệu định sẵn)
-- ==============================================================================
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'DRIVER', 'ADMIN');
CREATE TYPE account_status AS ENUM ('ACTIVE', 'BLOCKED', 'PENDING');
CREATE TYPE kyc_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE booking_status AS ENUM ('PENDING', 'SEARCHING', 'ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');
CREATE TYPE payment_method AS ENUM ('CASH', 'WALLET', 'VNPAY', 'MOMO');
CREATE TYPE payment_status AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- ==============================================================================
-- 2. BẢNG DỮ LIỆU CỐT LÕI (CORE TABLES)
-- ==============================================================================

-- 2.1 USERS: Bảng người dùng chung (Khách hàng, Tài xế, Admin)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(100),
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    status account_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.2 VEHICLE_TYPES: Danh mục loại xe (500kg, 1 tấn, 2 tấn...)
CREATE TABLE vehicle_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- Vd: 500KG, 1TON, 2TON_VAN
    name VARCHAR(100) NOT NULL,
    payload_capacity_kg DECIMAL(10,2) NOT NULL,
    dimensions_lxwxh JSONB, -- Vd: {"length": 2, "width": 1.5, "height": 1.5}
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.3 DRIVER_PROFILES: Hồ sơ chi tiết của tài xế
CREATE TABLE driver_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type_id UUID REFERENCES vehicle_types(id),
    license_plate VARCHAR(20) UNIQUE,
    driver_license_no VARCHAR(50) UNIQUE,
    kyc_status kyc_status DEFAULT 'PENDING',
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    is_online BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.4 CUSTOMER_ADDRESSES: Sổ địa chỉ của khách hàng
CREATE TABLE customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100), -- Vd: Nhà riêng, Công ty
    address_text TEXT NOT NULL,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 3. BẢNG ĐỊNH VỊ REAL-TIME (DÙNG POSTGIS)
-- ==============================================================================

-- 3.1 DRIVER_LOCATIONS: Tọa độ realtime của tài xế
CREATE TABLE driver_locations (
    driver_id UUID PRIMARY KEY REFERENCES driver_profiles(id) ON DELETE CASCADE,
    -- Cột location_point lưu tọa độ địa lý. 4326 là chuẩn WGS 84 (GPS)
    location_point GEOMETRY(Point, 4326) NOT NULL,
    heading DECIMAL(5,2), -- Hướng di chuyển (0-360 độ)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TẠO INDEX SPATIAL GIST ĐỂ TÌM KIẾM BÁN KÍNH SIÊU NHANH
CREATE INDEX idx_driver_locations_point ON driver_locations USING GIST (location_point);

-- ==============================================================================
-- 4. BẢNG GIAO DỊCH VÀ ĐƠN HÀNG
-- ==============================================================================

-- 4.1 PRICING_RULES: Bảng giá cước cấu hình theo loại xe
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id),
    base_price DECIMAL(12,2) NOT NULL, -- Giá mở cửa
    base_distance_km DECIMAL(5,2) NOT NULL, -- Khoảng cách mở cửa (Vd: 4km đầu)
    price_per_km DECIMAL(10,2) NOT NULL, -- Giá mỗi km tiếp theo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.2 BOOKINGS: Chuyến xe / Đơn hàng
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_code VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES users(id),
    driver_id UUID REFERENCES driver_profiles(id),
    vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id),
    status booking_status DEFAULT 'PENDING',
    
    -- Điểm lấy hàng và giao hàng
    origin_address TEXT NOT NULL,
    origin_point GEOMETRY(Point, 4326) NOT NULL,
    destination_address TEXT NOT NULL,
    destination_point GEOMETRY(Point, 4326) NOT NULL,
    
    distance_km DECIMAL(10,2) NOT NULL,
    
    -- Cơ cấu giá
    base_price DECIMAL(12,2) NOT NULL,
    surcharge_price DECIMAL(12,2) DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL,
    driver_commission DECIMAL(12,2) NOT NULL, -- Tiền hoa hồng thu của tài xế
    
    payment_method payment_method DEFAULT 'CASH',
    payment_status payment_status DEFAULT 'UNPAID',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TẠO INDEX SPATIAL CHO ĐIỂM LẤY HÀNG CỦA ĐƠN HÀNG
CREATE INDEX idx_bookings_origin_point ON bookings USING GIST (origin_point);

-- 4.3 WALLETS & TRANSACTIONS: Ví tiền và biến động số dư
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15,2) DEFAULT 0,
    locked_balance DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'VND',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    booking_id UUID REFERENCES bookings(id),
    amount DECIMAL(15,2) NOT NULL, -- Dương: Nạp tiền/Nhận tiền, Âm: Trừ tiền/Chiết khấu
    type VARCHAR(50) NOT NULL, -- Vd: 'DEPOSIT', 'COMMISSION_FEE', 'PAYMENT'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 5. SEED DỮ LIỆU MẪU (SEED DATA)
-- ==============================================================================

-- 5.1 Seed Loại xe tải
INSERT INTO vehicle_types (code, name, payload_capacity_kg, dimensions_lxwxh, description) VALUES
('500KG', 'Xe tải 500kg', 500, '{"length": 2.0, "width": 1.3, "height": 1.3}', 'Phù hợp chở đồ đạc nhỏ, chuyển phòng trọ'),
('1TON', 'Xe tải 1 Tấn', 1000, '{"length": 3.0, "width": 1.6, "height": 1.7}', 'Phù hợp chuyển nhà 1 phòng ngủ, hàng hóa vừa'),
('2TON_THUNGKIN', 'Xe tải 2 Tấn (Thùng kín)', 2000, '{"length": 4.3, "width": 1.8, "height": 1.8}', 'Chở hàng điện tử, chống nước tốt'),
('2TON_MUIBAT', 'Xe tải 2 Tấn (Mui bạt)', 2000, '{"length": 4.3, "width": 1.8, "height": 1.8}', 'Có thể cơi nới nhẹ, dễ bốc dỡ');

-- 5.2 Seed Bảng giá cước cơ bản (Ví dụ minh họa)
-- Lấy ID của các loại xe vừa tạo để map vào pricing_rules (Giả định bằng subquery)
INSERT INTO pricing_rules (vehicle_type_id, base_price, base_distance_km, price_per_km)
SELECT id, 150000, 4, 15000 FROM vehicle_types WHERE code = '500KG';

INSERT INTO pricing_rules (vehicle_type_id, base_price, base_distance_km, price_per_km)
SELECT id, 200000, 4, 17000 FROM vehicle_types WHERE code = '1TON';

-- ==============================================================================
-- KẾT THÚC SCRIPT
-- ==============================================================================
