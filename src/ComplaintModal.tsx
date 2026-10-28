import React, { useState } from "react"

interface ComplaintModalProps {
  isOpen: boolean
  onClose: () => void
  bookingCode?: string | null
  bookingId?: string | null
  driverName?: string | null
}

const CATEGORIES = [
  { id: "cargo_damage", label: "📦 Hàng hóa bị bể vỡ / móp méo / thất thoát" },
  { id: "accident", label: "💥 Xe gặp tai nạn / sự cố giao thông trên đường" },
  { id: "off_app", label: "🚫 Tài xế gạ hủy chuyến để chở ngoài sàn" },
  { id: "wrong_dest", label: "📍 Giao sai địa điểm / chạy lệch lộ trình" },
  { id: "overcharge", label: "💵 Tài xế vòi thêm tiền / thu sai cước quy định" },
  { id: "attitude", label: "⚠️ Thái độ phục vụ không đúng mực" },
  { id: "other", label: "📝 Lý do khác" },
]

export default function ComplaintModal({
  isOpen,
  onClose,
  bookingCode,
  bookingId,
  driverName,
}: ComplaintModalProps) {
  const [selectedCat, setSelectedCat] = useState("cargo_damage")
  const [description, setDescription] = useState("")
  const [estimatedLoss, setEstimatedLoss] = useState("")
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  if (!isOpen) return null

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview trực tiếp bằng FileReader
    const reader = new FileReader()
    reader.onload = () => {
      setProofImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) {
      alert("Vui lòng mô tả chi tiết sự cố gặp phải.")
      return
    }

    setIsSubmitting(true)
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSuccess(true)
    }, 600)
  }

  const handleClose = () => {
    setIsSuccess(false)
    setDescription("")
    setEstimatedLoss("")
    setProofImage(null)
    onClose()
  }

  return (
    <div
      className="customer-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Báo cáo sự cố và khiếu nại"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 22,
          width: "100%",
          maxWidth: 420,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 14px",
            background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                display: "grid",
                placeItems: "center",
                fontSize: 20,
              }}
            >
              🚨
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Báo Cáo Sự Cố & Khiếu Nại
              </h3>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: "#fecaca",
                  fontWeight: 500,
                }}
              >
                Mã đơn: {bookingCode || bookingId || "Đang cập nhật"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#ffffff",
              width: 30,
              height: 30,
              borderRadius: "50%",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div
            style={{
              padding: "36px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: "#ecfdf5",
                color: "#059669",
                display: "grid",
                placeItems: "center",
                fontSize: 32,
                border: "2px solid #a7f3d0",
              }}
            >
              ✓
            </div>
            <h4
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Đã Tiếp Nhận Khiếu Nại!
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              Bộ phận Chăm sóc khách hàng và Pháp chế đang trích xuất dữ liệu GPS hành trình của chuyến xe. Chúng tôi sẽ liên hệ với bạn trong vòng <strong>24 giờ</strong> để thẩm định và bồi thường.
            </p>
            <button
              type="button"
              onClick={handleClose}
              style={{
                marginTop: 12,
                padding: "10px 24px",
                borderRadius: 12,
                backgroundColor: "#059669",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Đóng thông báo
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              padding: "16px 20px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* Nhắc nhở lộ trình */}
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                fontSize: 12,
                color: "#92400e",
                lineHeight: 1.45,
                display: "flex",
                gap: 8,
              }}
            >
              <span>ℹ️</span>
              <span>
                <strong>Lưu ý:</strong> Khiếu nại bảo hiểm chỉ được xem xét nếu chuyến xe diễn ra đúng lộ trình GPS đã đăng ký trên hệ thống.
              </span>
            </div>

            {/* Loại khiếu nại */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: 6,
                }}
              >
                Loại sự cố gặp phải <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 13,
                  color: "#0f172a",
                  backgroundColor: "#f8fafc",
                  outline: "none",
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Giá trị thiệt hại ước tính */}
            {selectedCat === "cargo_damage" && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Giá trị thiệt hại ước tính (VNĐ)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 2.500.000 (nếu có)"
                  value={estimatedLoss}
                  onChange={(e) => setEstimatedLoss(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
              </div>
            )}

            {/* Mô tả chi tiết */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: 6,
                }}
              >
                Mô tả chi tiết sự cố <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Mô tả cụ thể tình trạng hàng hóa, địa điểm hoặc hành vi tài xế..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Ảnh chụp bằng chứng */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: 6,
                }}
              >
                Ảnh chụp bằng chứng hiện trường / hàng vỡ
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ fontSize: 12 }}
              />
              {proofImage && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={proofImage}
                    alt="Bằng chứng hiện trường"
                    style={{
                      width: "100%",
                      maxHeight: 140,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 6,
                paddingTop: 10,
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  flex: 2,
                  padding: "10px",
                  borderRadius: 10,
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(220, 38, 38, 0.25)",
                }}
              >
                {isSubmitting ? "Đang gửi..." : "Gửi Báo Cáo Sự Cố"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
