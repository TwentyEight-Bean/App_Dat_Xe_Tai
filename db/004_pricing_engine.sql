-- ==============================================================================
-- MIGRATION: 004_pricing_engine.sql
-- PURPOSE: Schema bảng giá gốc theo loại xe tải và danh mục phụ phí dịch vụ
-- SPRINT: 2 (Task 2.3 - Pricing Engine)
-- ==============================================================================

-- 1. BẢNG BẢNG GIÁ GỐC (PRICING_RULES)
CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id) ON DELETE CASCADE,
    base_price DECIMAL(12,2) NOT NULL, -- Giá mở cửa (VD: 150.000đ)
    base_distance_km DECIMAL(5,2) NOT NULL DEFAULT 4.0, -- Cự ly mở cửa (VD: 4 km đầu)
    price_per_km DECIMAL(10,2) NOT NULL, -- Giá mỗi km tiếp theo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pricing_vehicle_type UNIQUE (vehicle_type_id)
);

-- 2. BẢNG PHỤ PHÍ DỊCH VỤ (SURCHARGE_SERVICES)
CREATE TABLE IF NOT EXISTS surcharge_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- VD: LOADING_FLOOR, LOADING_STAIRS
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. SEED BẢNG GIÁ THEO TỪNG LOẠI XE TẢI (Khớp danh mục vehicle_types)
-- 500KG: Mở cửa 150.000đ (4km), mỗi km tiếp theo 15.000đ
INSERT INTO pricing_rules (vehicle_type_id, base_price, base_distance_km, price_per_km)
SELECT id, 150000, 4.0, 15000 FROM vehicle_types WHERE code = '500KG'
ON CONFLICT (vehicle_type_id) DO UPDATE 
SET base_price = EXCLUDED.base_price, base_distance_km = EXCLUDED.base_distance_km, price_per_km = EXCLUDED.price_per_km;

-- 1TON: Mở cửa 200.000đ (4km), mỗi km tiếp theo 17.000đ
INSERT INTO pricing_rules (vehicle_type_id, base_price, base_distance_km, price_per_km)
SELECT id, 200000, 4.0, 17000 FROM vehicle_types WHERE code = '1TON'
ON CONFLICT (vehicle_type_id) DO UPDATE 
SET base_price = EXCLUDED.base_price, base_distance_km = EXCLUDED.base_distance_km, price_per_km = EXCLUDED.price_per_km;

-- 2TON_THUNGKIN: Mở cửa 280.000đ (4km), mỗi km tiếp theo 21.000đ
INSERT INTO pricing_rules (vehicle_type_id, base_price, base_distance_km, price_per_km)
SELECT id, 280000, 4.0, 21000 FROM vehicle_types WHERE code = '2TON_THUNGKIN'
ON CONFLICT (vehicle_type_id) DO UPDATE 
SET base_price = EXCLUDED.base_price, base_distance_km = EXCLUDED.base_distance_km, price_per_km = EXCLUDED.price_per_km;

-- 2TON_MUIBAT: Mở cửa 280.000đ (4km), mỗi km tiếp theo 21.000đ
INSERT INTO pricing_rules (vehicle_type_id, base_price, base_distance_km, price_per_km)
SELECT id, 280000, 4.0, 21000 FROM vehicle_types WHERE code = '2TON_MUIBAT'
ON CONFLICT (vehicle_type_id) DO UPDATE 
SET base_price = EXCLUDED.base_price, base_distance_km = EXCLUDED.base_distance_km, price_per_km = EXCLUDED.price_per_km;

-- 4. SEED DANH MỤC PHỤ PHÍ THỰC TẾ XE TẢI
INSERT INTO surcharge_services (code, name, description, price, is_active)
VALUES
('LOADING_FLOOR', 'Bốc xếp tầng trệt', 'Tài xế hỗ trợ bốc xếp hàng hóa lên/xuống xe tại tầng trệt (bán kính dưới 10m)', 50000, true),
('LOADING_STAIRS', 'Bốc xếp lầu / thang bộ', 'Khuân vác hàng hóa lên/xuống cầu thang bộ (không có thang máy)', 100000, true),
('EXTRA_HELPER', 'Thêm 1 người bốc xếp theo xe', 'Bố trí thêm 1 phụ xe đi cùng hỗ trợ bốc xếp các kiện hàng cồng kềnh', 200000, true),
('NIGHT_SURCHARGE', 'Phụ phí ban đêm (22:00 - 06:00)', 'Phụ thu chạy xe và giao hàng khung giờ đêm', 20000, true),
('EXTRA_STOP', 'Thêm điểm giao hàng phụ', 'Dừng thêm 1 điểm trên cùng tuyến đường (bán kính lệch dưới 5km)', 35000, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, is_active = EXCLUDED.is_active;
