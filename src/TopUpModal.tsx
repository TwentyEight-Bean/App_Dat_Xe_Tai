import { useState, useEffect } from "react"

export interface TopUpModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newBalance: number) => void
  userRole?: "DRIVER" | "CUSTOMER"
  authToken?: string
}

const PRESET_AMOUNTS = [100000, 200000, 500000, 1000000]

export default function TopUpModal({
  isOpen,
  onClose,
  onSuccess,
  userRole = "DRIVER",
  authToken,
}: TopUpModalProps) {
  const [amount, setAmount] = useState<number>(200000)
  const [gateway, setGateway] = useState<"VNPAY" | "MOMO" | "CASH">("VNPAY")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
  const [transactionCode, setTransactionCode] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  // Reset khi mở lại modal
  useEffect(() => {
    if (isOpen) {
      setAmount(200000)
      setGateway("VNPAY")
      setLoading(false)
      setError(null)
      setQrCodeUrl(null)
      setPaymentUrl(null)
      setTransactionCode(null)
      setIsSuccess(false)
    }
  }, [isOpen])

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

  const token =
    authToken ||
    (typeof window !== "undefined"
      ? localStorage.getItem("driver_auth_token") || localStorage.getItem("token")
      : "")

  const handleStartTopup = async () => {
    setLoading(true)
    setError(null)

    try {
      if (gateway === "CASH") {
        // Nạp tiền mặt trực tiếp
        const endpoint =
          userRole === "DRIVER" ? "/api/v1/driver/wallet/topup" : "/api/v1/customer/wallet/topup"

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount,
            description: `${userRole === "DRIVER" ? "Tài xế" : "Khách hàng"} nạp ${amount.toLocaleString("vi-VN")} đ tiền mặt tại quầy`,
          }),
        })

        const data = await res.json()
        if (!data.success) {
          throw new Error(data.message || "Nạp tiền không thành công")
        }

        setIsSuccess(true)
        setTimeout(() => {
          onSuccess(amount)
          onClose()
        }, 1200)
      } else {
        // Nạp qua VNPay hoặc MoMo
        const res = await fetch("/api/v1/payments/create-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount,
            gateway,
            purpose: "TOPUP_WALLET",
            description: `Nạp ${amount.toLocaleString("vi-VN")} đ vào ví ký quỹ qua ${gateway}`,
          }),
        })

        const data = await res.json()
        if (!data.success) {
          throw new Error(data.message || `Lỗi tạo link thanh toán ${gateway}`)
        }

        setTransactionCode(data.data.transactionCode)
        setQrCodeUrl(data.data.qrCodeUrl || null)
        setPaymentUrl(data.data.paymentUrl || null)
      }
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi nạp tiền")
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
              {userRole === "DRIVER" ? "Nạp Tiền Ví Ký Quỹ" : "Nạp Tiền Ví Điện Tử"}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              Nạp tiền để duy trì nhận chuyến và giao dịch an toàn
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
          /* Màn hình hiển thị QR Code cổng thanh toán */
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: "13px", color: "#cbd5e1", margin: "0 0 12px" }}>
              Mở App ngân hàng hoặc {gateway} quét mã QR bên dưới để nạp tiền:
            </p>
            <div
              style={{
                background: "#ffffff",
                padding: "16px",
                borderRadius: "12px",
                display: "inline-block",
                marginBottom: "12px",
              }}
            >
              <img src={qrCodeUrl} alt="Mã QR thanh toán" style={{ width: "200px", height: "200px", display: "block" }} />
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#38bdf8", marginBottom: "8px" }}>
              Số tiền: {amount.toLocaleString("vi-VN")} đ
            </div>
            <p style={{ fontSize: "11px", color: "#94a3b8", margin: "0 0 16px" }}>
              Mã giao dịch: {transactionCode} · Hệ thống sẽ tự động cập nhật số dư sau khi bạn quét mã
            </p>
            {paymentUrl && (
              <a
                href={paymentUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  fontSize: "12px",
                  fontWeight: 600,
                  textDecoration: "none",
                  marginBottom: "12px",
                }}
              >
                Mở link thanh toán trực tiếp →
              </a>
            )}
            <div>
              <button
                type="button"
                onClick={() => setQrCodeUrl(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "13px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Chọn phương thức khác
              </button>
            </div>
          </div>
        ) : (
          /* Form chọn số tiền & phương thức */
          <div>
            {/* Chọn số tiền */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#cbd5e1" }}>
                Chọn số tiền nạp:
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

            {/* Chọn cổng thanh toán */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#cbd5e1" }}>
                Phương thức nạp:
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: gateway === "VNPAY" ? "rgba(37, 99, 235, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: gateway === "VNPAY" ? "1px solid #3b82f6" : "1px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="gateway"
                    checked={gateway === "VNPAY"}
                    onChange={() => setGateway("VNPAY")}
                  />
                  <span>🏦 <strong>Cổng VNPay</strong> (VNPAY-QR / Thẻ ATM nội địa)</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: gateway === "MOMO" ? "rgba(217, 70, 239, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: gateway === "MOMO" ? "1px solid #d946ef" : "1px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="gateway"
                    checked={gateway === "MOMO"}
                    onChange={() => setGateway("MOMO")}
                  />
                  <span>👛 <strong>Ví MoMo</strong> (Quét mã MoMo QR)</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: gateway === "CASH" ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.04)",
                    border: gateway === "CASH" ? "1px solid #22c55e" : "1px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="gateway"
                    checked={gateway === "CASH"}
                    onChange={() => setGateway("CASH")}
                  />
                  <span>💵 <strong>Nộp tiền mặt</strong> (Trực tiếp tại văn phòng sàn)</span>
                </label>
              </div>
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
                {loading ? "ĐANG XỬ LÝ..." : `NẠP ${amount.toLocaleString("vi-VN")} Đ`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
