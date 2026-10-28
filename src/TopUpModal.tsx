import { useState, useEffect } from "react"

export interface TopUpModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newBalance: number) => void
  userRole?: "DRIVER" | "CUSTOMER"
  authToken?: string
  initialAmount?: number
  debtTitle?: string
}

const PRESET_AMOUNTS = [30000, 50000, 100000, 200000, 500000, 1000000]

export default function TopUpModal({
  isOpen,
  onClose,
  onSuccess,
  userRole = "DRIVER",
  authToken,
  initialAmount,
  debtTitle,
}: TopUpModalProps) {
  const [amount, setAmount] = useState<number>(initialAmount || 200000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [transactionCode, setTransactionCode] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // Reset khi mở lại modal
  useEffect(() => {
    if (isOpen) {
      setAmount(initialAmount && initialAmount > 0 ? initialAmount : 200000)
      setLoading(false)
      setError(null)
      setQrCodeUrl(null)
      setTransactionCode(null)
      setIsSuccess(false)
    }
  }, [isOpen, initialAmount])

  // Polling kiểm tra trạng thái thanh toán khi có transactionCode
  useEffect(() => {
    if (!transactionCode || isSuccess) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/payments/status/${transactionCode}`)
        const data = await res.json()
        if (data.success && data.data?.isSuccess) {
          setIsSuccess(true)
          clearInterval(interval)
          setTimeout(() => {
            onSuccess(amount)
            onClose()
          }, 1500)
        }
      } catch (err) {
        console.warn("Lỗi kiểm tra trạng thái thanh toán:", err)
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [transactionCode, isSuccess, amount, onSuccess, onClose])

  if (!isOpen) return null



  const handleStartTopup = async () => {
    setLoading(true)
    setError(null)

    try {
      // Chuyển khoản ngân hàng trực tiếp qua mã QR Vietcombank
      const txCode = `CK${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`
      const qrUrl = `https://img.vietqr.io/image/VCB-1049761056-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(txCode)}`
      setTransactionCode(txCode)
      setQrCodeUrl(qrUrl)
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi tạo mã chuyển khoản")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#1e293b",
          borderRadius: "16px",
          padding: "24px",
          color: "#ffffff",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: debtTitle ? "12px" : "20px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
              {debtTitle ? "Thanh Toán Nợ Phí Hủy" : userRole === "DRIVER" ? "Nạp Tiền Ví Ký Quỹ" : "Nạp Tiền Ví Điện Tử"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              {debtTitle ? "Thanh toán khoản nợ để khôi phục quyền đặt xe" : "Nạp tiền để duy trì nhận chuyến và giao dịch an toàn"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              color: "#ffffff",
              fontSize: "16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#22c55e",
                color: "#ffffff",
                fontSize: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              ✓
            </div>
            <h4 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 700, color: "#4ade80" }}>
              Nạp tiền thành công!
            </h4>
            <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
              Đã cộng +{amount.toLocaleString("vi-VN")} đ vào ví của bạn.
            </p>
          </div>
        ) : qrCodeUrl ? (
          /* Màn hình hiển thị QR Code Chuyển khoản ngân hàng */
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(37, 99, 235, 0.2)",
                padding: "4px 14px",
                borderRadius: "999px",
                marginBottom: "10px",
                border: "1px solid #3b82f6",
                fontSize: "12px",
                fontWeight: 700,
                color: "#60a5fa",
              }}
            >
              <span>🏦 Chuyển khoản ngân hàng trực tiếp</span>
            </div>

            <p style={{ fontSize: "13px", color: "#cbd5e1", margin: "0 0 10px" }}>
              Mở ứng dụng ngân hàng bất kỳ để quét mã QR chuyển khoản:
            </p>
            <div
              style={{
                background: "#ffffff",
                padding: "10px",
                borderRadius: "14px",
                display: "inline-block",
                marginBottom: "10px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
              }}
            >
              <img
                src={qrCodeUrl}
                alt="Mã QR Chuyển khoản"
                style={{ width: "220px", height: "auto", display: "block", borderRadius: "8px" }}
              />
            </div>

            {/* Khối thông tin số tài khoản chi tiết */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                padding: "12px 16px",
                textAlign: "left",
                fontSize: "12.5px",
                maxWidth: "340px",
                margin: "0 auto 14px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8" }}>Ngân hàng:</span>
                <strong style={{ color: "#ffffff" }}>Vietcombank (Ngoại thương)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8" }}>Số tài khoản:</span>
                <strong style={{ color: "#38bdf8", fontSize: "14px", letterSpacing: "0.5px" }}>1049761056</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8" }}>Chủ tài khoản:</span>
                <strong style={{ color: "#ffffff" }}>Chủ TK: 1049761056 (App ngân hàng tự nhận tên)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8" }}>Số tiền:</span>
                <strong style={{ color: "#4ade80", fontSize: "14px" }}>{amount.toLocaleString("vi-VN")} đ</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Nội dung CK:</span>
                <strong style={{ color: "#facc15" }}>{transactionCode}</strong>
              </div>
            </div>

            {/* Hộp trạng thái chờ hệ thống nhận tiền thực tế */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxWidth: "340px",
                margin: "0 auto 14px",
                padding: "14px 16px",
                borderRadius: "12px",
                background: "rgba(30, 58, 138, 0.25)",
                border: "1px dashed #3b82f6",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#60a5fa", fontSize: "13px", fontWeight: 700 }}>
                <span style={{ display: "inline-block", animation: "spin 2s linear infinite" }}>🔄</span>
                <span>Hệ thống đang chờ nhận chuyển khoản...</span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1", lineHeight: 1.45 }}>
                Vui lòng mở ứng dụng ngân hàng quét mã QR trên và giữ đúng <strong>Nội dung CK</strong>. Khi tiền vào tài khoản, hệ thống sẽ <strong>tự động duyệt & cộng tiền vào ví</strong>.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", maxWidth: "340px", margin: "0 auto 12px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đóng (Tự động cộng ngầm)
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setQrCodeUrl(null)
                  setTransactionCode(null)
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                ← Quay lại chọn số tiền khác
              </button>
            </div>
          </div>
        ) : (
          /* Form chọn số tiền & phương thức */
          <div>
            {debtTitle && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid #ef4444",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  marginBottom: "16px",
                  fontSize: "12px",
                  color: "#fca5a5",
                  lineHeight: 1.45,
                }}
              >
                <strong>⚠️ Thông báo nợ:</strong> {debtTitle}
              </div>
            )}

            {/* Chọn số tiền */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#cbd5e1" }}>
                {debtTitle ? "Chọn số tiền thanh toán nợ / nạp ví:" : "Chọn số tiền nạp:"}
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                {PRESET_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(val)}
                    style={{
                      padding: "10px",
                      borderRadius: "8px",
                      border: amount === val ? "2px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                      background: amount === val ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.05)",
                      color: amount === val ? "#38bdf8" : "#ffffff",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {val.toLocaleString("vi-VN")} đ
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                step="50000"
                min="50000"
                placeholder="Hoặc tự nhập số tiền..."
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Hình thức nạp */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "rgba(37, 99, 235, 0.12)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                marginBottom: "20px",
                fontSize: "12.5px",
                color: "#93c5fd",
              }}
            >
              <span style={{ fontSize: "16px" }}>🏦</span>
              <span>
                Hình thức: <strong>Chuyển khoản ngân hàng (Quét mã QR)</strong>
              </span>
            </div>

            {error && (
              <div style={{ padding: "8px 12px", background: "rgba(239, 68, 68, 0.2)", borderRadius: "8px", color: "#fca5a5", fontSize: "12px", marginBottom: "14px" }}>
                ⚠ {error}
              </div>
            )}

            {/* Nút hành động */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleStartTopup}
                disabled={loading || amount <= 0}
                style={{
                  flex: 2,
                  padding: "12px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #0284c7, #2563eb)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
                }}
              >
                {loading ? "ĐANG TẠO MÃ QR..." : `TẠO MÃ QR (${amount.toLocaleString("vi-VN")} Đ)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
