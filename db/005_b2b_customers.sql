-- ==============================================================================
-- MIGRATION: 005_b2b_customers.sql
-- PURPOSE: Schema quản lý khách hàng doanh nghiệp B2B & công nợ
-- SPRINT: 2 (Task 2.4 - Admin Management)
-- ==============================================================================

-- 1. BẢNG KHÁCH HÀNG DOANH NGHIỆP (B2B_CUSTOMERS)
CREATE TABLE IF NOT EXISTS b2b_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Tài khoản đại diện doanh nghiệp (nếu có)
    company_name VARCHAR(200) NOT NULL, -- Tên đầy đủ của công ty / doanh nghiệp
    tax_code VARCHAR(50) UNIQUE NOT NULL, -- Mã số thuế doanh nghiệp (Duy nhất)
    business_address TEXT NOT NULL, -- Địa chỉ trụ sở kinh doanh
    contact_name VARCHAR(100) NOT NULL, -- Họ tên người đại diện liên hệ
    contact_phone VARCHAR(20) NOT NULL, -- SĐT liên hệ
    invoice_email VARCHAR(100), -- Email nhận hóa đơn điện tử VAT
    credit_limit DECIMAL(15,2) DEFAULT 0, -- Hạn mức công nợ cho phép (VD: 50.000.000 VNĐ)
    current_debt DECIMAL(15,2) DEFAULT 0, -- Dư nợ hiện tại chưa thanh toán
    payment_term_days INT DEFAULT 30, -- Kỳ hạn thanh toán công nợ (VD: 30 ngày)
    discount_percent DECIMAL(5,2) DEFAULT 0, -- Chiết khấu hợp đồng doanh nghiệp (VD: 5%)
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE (Hoạt động), SUSPENDED (Tạm ngưng)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_b2b_customers_tax_code ON b2b_customers(tax_code);
CREATE INDEX IF NOT EXISTS idx_b2b_customers_status ON b2b_customers(status);

-- 2. SEED DỮ LIỆU KHÁCH HÀNG DOANH NGHIỆP MẪU
INSERT INTO b2b_customers (
    company_name, tax_code, business_address, contact_name, contact_phone, 
    invoice_email, credit_limit, current_debt, payment_term_days, discount_percent, status, notes
)
VALUES
(
    'Công ty TNHH Logistics Tân Bình Phát',
    '0315891234',
    '45 Phổ Quang, Phường 2, Quận Tân Bình, TP. Hồ Chí Minh',
    'Trần Thanh Phong',
    '0909123456',
    'ketoan@tanbinhlogistics.vn',
    50000000.00,
    14500000.00,
    30,
    8.00,
    'ACTIVE',
    'Đối tác giao hàng kho lạnh và hàng bách hóa nội thành'
),
(
    'Công ty Cổ phần Thương mại & Xuất nhập khẩu Á Đông',
    '0309876543',
    '120 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh',
    'Lê Thu Trang',
    '0918765432',
    'accounting@adongcorp.com',
    100000000.00,
    42800000.00,
    45,
    10.00,
    'ACTIVE',
    'Ký hợp đồng vận chuyển nguyên chuyến xe 2 Tấn định kỳ'
)
ON CONFLICT (tax_code) DO NOTHING;
