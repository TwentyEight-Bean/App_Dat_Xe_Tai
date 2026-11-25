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
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [transactionCode, setTransactionCode] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isWaitingAdmin, setIsWaitingAdmin] = useState(false)
  const [copiedPhone, setCopiedPhone] = useState(false)
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)

  // Reset khi mở lại modal
  useEffect(() => {
    if (isOpen) {
      setAmount(initialAmount && initialAmount > 0 ? initialAmount : 200000)
      setLoading(false)
      setError(null)
      setQrCodeUrl(null)
      setPaymentUrl(null)
      setTransactionCode(null)
      setIsSuccess(false)
      setIsWaitingAdmin(false)
      setCopiedPhone(false)
      setIsSubmittingReport(false)
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
          setIsWaitingAdmin(false)
          clearInterval(interval)
          setTimeout(() => {
            onSuccess(amount)
            onClose()
          }, 1500)
        } else if (data.success && data.data?.status === "FAILED") {
          setIsWaitingAdmin(false)
          setError(data.data?.description || "Yêu cầu nạp tiền không được xác nhận hoặc đã bị từ chối.")
          clearInterval(interval)
        }
      } catch (err) {
        console.warn("Lỗi kiểm tra trạng thái thanh toán:", err)
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [transactionCode, isSuccess, amount, onSuccess, onClose])

  if (!isOpen) return null

  const handleConfirmTransferred = async () => {
    setIsSubmittingReport(true)
    try {
      if (transactionCode) {
        await fetch("/api/v1/payments/report-transferred", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionCode }),
        })
      }
    } catch (e) {
      console.warn("Lỗi gửi thông báo chuyển khoản:", e)
    } finally {
      setIsSubmittingReport(false)
      setIsWaitingAdmin(true)
    }
  }

  const handleStartTopup = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = authToken || localStorage.getItem("auth_token")
      if (!token) {
        setError("Vui lòng đăng nhập để nạp tiền")
        setLoading(false)
        return
      }

      const res = await fetch("/api/v1/payments/create-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amount,
          gateway: "VIETQR",
          purpose: "TOPUP_WALLET",
        }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.error || data.message || "Không thể tạo giao dịch nạp tiền")
        setLoading(false)
        return
      }

      setTransactionCode(data.data.transactionCode)
      setQrCodeUrl(data.data.qrCodeUrl)
      // Also store the payment URL for redirect option
      if (data.data.paymentUrl) {
        setPaymentUrl(data.data.paymentUrl)
      }
    } catch (err) {
      setError("Lỗi kết nối. Vui lòng thử lại.")
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
        ) : isWaitingAdmin ? (
          /* Màn hình: ĐANG ĐỢI ADMIN XÁC MINH CHUYỂN KHOẢN */
          <div style={{ textAlign: "center", padding: "10px 4px 4px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "rgba(245, 158, 11, 0.15)",
                border: "2px solid rgba(245, 158, 11, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
                boxShadow: "0 0 24px rgba(245, 158, 11, 0.25)",
              }}
            >
              <span style={{ fontSize: "30px" }}>⏳</span>
            </div>

            <h4 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 800, color: "#fbbf24" }}>
              Đang đợi admin xác minh chuyển khoản
            </h4>

            <p style={{ margin: "0 auto 14px", fontSize: "12.5px", color: "#cbd5e1", lineHeight: 1.5, maxWidth: "340px" }}>
              Hệ thống đã ghi nhận thông báo chuyển khoản của bạn. Admin đang kiểm tra sao kê ngân hàng và sẽ duyệt cộng tiền vào ví ngay.
            </p>

            {/* Khối thông tin đối soát */}
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
                <span style={{ color: "#94a3b8" }}>Số tiền:</span>
                <strong style={{ color: "#4ade80", fontSize: "14px" }}>{amount.toLocaleString("vi-VN")} đ</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8" }}>Nội dung CK:</span>
                <strong style={{ color: "#facc15" }}>{transactionCode || "VIETQR"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8" }}>Ngân hàng nhận:</span>
                <span style={{ color: "#ffffff", fontWeight: 600 }}>Vietcombank - TRAN VU HUNG</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8" }}>Trạng thái:</span>
                <span style={{ color: "#fbbf24", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <span>●</span> Chờ xác minh
                </span>
              </div>
            </div>

            {/* BẢNG THÔNG BÁO THEO YÊU CẦU: LIÊN HỆ ADMIN NẾU ĐỢI LÂU */}
            <div
              style={{
                background: "rgba(234, 179, 8, 0.12)",
                border: "1.5px solid rgba(234, 179, 8, 0.4)",
                borderRadius: "12px",
                padding: "12px 16px",
                maxWidth: "340px",
                margin: "0 auto 16px",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", color: "#facc15", fontWeight: 700, fontSize: "12.5px" }}>
                <span>ℹ️</span>
                <span>THÔNG BÁO:</span>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: "12.5px", color: "#fef08a", lineHeight: 1.5 }}>
                Nếu bạn đợi lâu xin vui lòng liên hệ admin qua số <strong>0363469767</strong> để hỏi thêm thông tin.
              </p>

              <div style={{ display: "flex", gap: "8px" }}>
                <a
                  href="tel:0363469767"
                  style={{
                    flex: 1,
                    height: "36px",
                    background: "linear-gradient(135deg, #16a34a, #15803d)",
                    borderRadius: "8px",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    textDecoration: "none",
                    boxShadow: "0 2px 8px rgba(22, 163, 74, 0.3)",
                  }}
                >
                  <span>📞</span>
                  <span>Gọi 0363469767</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("0363469767")
                    setCopiedPhone(true)
                    setTimeout(() => setCopiedPhone(false), 2000)
                  }}
                  style={{
                    height: "36px",
                    padding: "0 12px",
                    background: copiedPhone ? "rgba(34, 197, 94, 0.25)" : "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "8px",
                    color: copiedPhone ? "#4ade80" : "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>{copiedPhone ? "✓" : "📋"}</span>
                  <span>{copiedPhone ? "Đã chép" : "Sao chép"}</span>
                </button>
              </div>
            </div>

            {/* Các nút hành động */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "340px", margin: "0 auto" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Tôi đã hiểu, đóng cửa sổ
              </button>

              <button
                type="button"
                onClick={() => setIsWaitingAdmin(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "4px",
                }}
              >
                ← Xem lại mã QR chuyển khoản
              </button>
            </div>
          </div>
        ) : qrCodeUrl ? (
          /* Màn hình hiển thị QR Code Chuyển khoản ngân hàng */
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(16, 185, 129, 0.2)",
                padding: "4px 14px",
                borderRadius: "999px",
                marginBottom: "10px",
                border: "1px solid #10b981",
                fontSize: "12px",
                fontWeight: 700,
                color: "#34d399",
              }}
            >
              <span>🏦 Chuyển khoản VietQR (Miễn phí 24/7)</span>
            </div>

            <p style={{ fontSize: "13px", color: "#cbd5e1", margin: "0 0 10px" }}>
              Mở App Ngân hàng bất kỳ (VCB, MB, Techcombank, Momo...) quét mã để chuyển:
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
                alt="Mã QR Chuyển khoản VietQR"
                style={{ width: "240px", height: "auto", display: "block", borderRadius: "8px" }}
              />
            </div>

            {/* Khối thông tin tài khoản ngân hàng thụ hưởng */}
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
                <strong style={{ color: "#ffffff" }}>Vietcombank (VCB)</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8" }}>Số tài khoản:</span>
                <strong style={{ color: "#38bdf8", fontSize: "14px", letterSpacing: "0.5px" }}>1049761056</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: "#94a3b8" }}>Chủ tài khoản:</span>
                <strong style={{ color: "#ffffff" }}>TRAN VU HUNG</strong>
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
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px dashed #10b981",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#34d399", fontSize: "13px", fontWeight: 700 }}>
                <span style={{ display: "inline-block", animation: "spin 2s linear infinite" }}>🔄</span>
                <span>Hệ thống sẵn sàng ghi nhận thanh toán</span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1", lineHeight: 1.45 }}>
                Quét mã QR bằng ứng dụng ngân hàng. Tiền sẽ được chuyển thẳng tới tài khoản thụ hưởng <strong>TRAN VU HUNG</strong>.
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", maxWidth: "340px", margin: "0 auto 12px" }}>
              <button
                type="button"
                disabled={isSubmittingReport}
                onClick={handleConfirmTransferred}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "13.5px",
                  fontWeight: 700,
                  cursor: isSubmittingReport ? "wait" : "pointer",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span>{isSubmittingReport ? "⏳" : "✓"}</span>
                <span>{isSubmittingReport ? "Đang gửi thông báo..." : "✓ Tôi đã chuyển khoản xong"}</span>
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setQrCodeUrl(null)
                  setPaymentUrl(null)
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
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                marginBottom: "20px",
                fontSize: "12.5px",
                color: "#6ee7b7",
              }}
            >
              <span style={{ fontSize: "16px" }}>🏦</span>
              <span>
                Hình thức: <strong>Chuyển khoản VietQR (Vietcombank - TRAN VU HUNG)</strong>
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
