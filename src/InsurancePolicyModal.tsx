import React from "react"

interface InsurancePolicyModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function InsurancePolicyModal({
  isOpen,
  onClose,
}: InsurancePolicyModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="customer-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Chính sách bảo hiểm hàng hóa"
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
        if (e.target === e.currentTarget) onClose()
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
          animation: "modalFadeIn 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px",
            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
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
              🛡️
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Bảo Hiểm Hàng Hóa Chuyến Đi
              </h3>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: "#d1fae5",
                  fontWeight: 500,
                }}
              >
                Bảo vệ toàn diện tới 50.000.000đ / cuốc
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        {/* Content Body */}
        <div
          style={{
            padding: "16px 20px",
            overflowY: "auto",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#334155",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Cảnh báo quan trọng */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              backgroundColor: "#fef2f2",
              border: "1.5px solid #fecaca",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#b91c1c",
                fontWeight: 800,
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>⛔</span>
              <span>ĐIỀU KHOẢN LOẠI TRỪ 100% MIỄN TRỪ TRÁCH NHIỆM</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#991b1b", lineHeight: 1.45 }}>
              Nền tảng <strong>TỪ CHỐI BỒI THƯỜNG 100%</strong> trong các trường hợp:
            </p>
            <ul
              style={{
                margin: "6px 0 0",
                paddingLeft: 18,
                fontSize: 12,
                color: "#7f1d1d",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <li>
                <strong>Sai lệch lộ trình:</strong> Tự ý yêu cầu tài xế chở đến địa điểm khác điểm giao trên app (ví dụ đặt nội thành nhưng chở đi tỉnh).
              </li>
              <li>
                <strong>Giao dịch ngoài app:</strong> Hủy chuyến trên app để trả tiền mặt ngoài né phí sàn.
              </li>
              <li>
                <strong>Không có ảnh chụp POD:</strong> Thiếu ảnh chụp kiện hàng lúc bốc lên xe và bàn giao.
              </li>
              <li>
                <strong>Hàng cấm / Hàng không nguồn gốc:</strong> Hàng thuộc danh mục cấm vận chuyển theo luật pháp.
              </li>
            </ul>
          </div>

          {/* Quyền lợi được bảo hiểm */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              backgroundColor: "#f0fdf4",
              border: "1.5px solid #bbf7d0",
            }}
          >
            <div
              style={{
                color: "#166534",
                fontWeight: 800,
                fontSize: 13,
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>✅</span>
              <span>QUYỀN LỢI ĐƯỢC BẢO HIỂM</span>
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 12,
                color: "#14532d",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <li>Bồi thường do tai nạn giao thông, lật xe, cháy nổ phương tiện trên đường.</li>
              <li>Bồi thường hàng hóa đổ vỡ, móp méo do lỗi chằng buộc hoặc thao tác của tài xế.</li>
              <li>Mức chi trả căn cứ trên giá trị thực tế theo Hóa đơn VAT / Phiếu xuất kho (tối đa 50 triệu đồng).</li>
            </ul>
          </div>

          {/* Quy trình giải quyết bồi thường */}
          <div>
            <h4
              style={{
                margin: "0 0 8px",
                fontSize: 13,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              📋 Quy trình yêu cầu bồi thường (3 bước):
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  background: "#f8fafc",
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
              >
                <span style={{ fontWeight: 800, color: "#0284c7" }}>1.</span>
                <span style={{ fontSize: 12 }}>
                  Bấm nút <strong>"Báo sự cố / Khiếu nại"</strong> trên ứng dụng trong vòng 24h kể từ khi chuyến đi kết thúc.
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  background: "#f8fafc",
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
              >
                <span style={{ fontWeight: 800, color: "#0284c7" }}>2.</span>
                <span style={{ fontSize: 12 }}>
                  Bộ phận Pháp chế đối soát dữ liệu hành trình GPS, ảnh chụp bàn giao và biên bản hiện trường.
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  background: "#f8fafc",
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
              >
                <span style={{ fontWeight: 800, color: "#0284c7" }}>3.</span>
                <span style={{ fontSize: 12 }}>
                  Chi trả trực tiếp qua tài khoản ngân hàng của chủ hàng trong 3 – 5 ngày làm việc.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              backgroundColor: "#059669",
              color: "#ffffff",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
            }}
          >
            Tôi đã hiểu & Đồng ý
          </button>
        </div>
      </div>
    </div>
  )
}
