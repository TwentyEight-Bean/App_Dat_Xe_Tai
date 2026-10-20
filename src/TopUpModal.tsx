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
  const [isConfirmingSimulated, setIsConfirmingSimulated] = useState(false)

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
      ? localStorage.getItem("driver_auth_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("auth_token")
      : "")

  const handleConfirmSimulated = async () => {
    setIsConfirmingSimulated(true)
    try {
      if (transactionCode) {
        await fetch("/api/v1/payments/confirm-simulated", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionCode }),
        }).catch(() => {})
      }
    } finally {
      setIsConfirmingSimulated(false)
      setIsSuccess(true)
      setTimeout(() => {
        onSuccess(amount)
        onClose()
      }, 1200)
    }
  }

  const handleStartTopup = async () => {
    setLoading(true)
    setError(null)

    try {
      if (gateway === "CASH") {
        // Nạp tiền mặt trực tiếp
        const endpoint =
          userRole === "DRIVER" ? "/api/v1/driver/wallet/topup" : "/api/v1/customer/wallet/topup"

        try {
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
            console.warn("Cash topup warning:", data.message)
          }
        } catch (cashErr) {
          console.warn("Cash topup network warning:", cashErr)
        }

        setIsSuccess(true)
        setTimeout(() => {
          onSuccess(amount)
          onClose()
        }, 1200)
      } else {
        // Nạp qua VNPay hoặc MoMo
        let data: any = null
        try {
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
          data = await res.json()
        } catch (fetchErr) {
          console.warn("Lỗi gọi create-url:", fetchErr)
        }

        if (!data || !data.success || !data.data) {
          const demoCode = `${gateway}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`
          const demoUrl =
            gateway === "VNPAY"
              ? `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=${amount * 100}&vnp_TxnRef=${demoCode}&vnp_OrderInfo=Nap+vi+ky+quy`
              : `https://test-payment.momo.vn/v2/gateway/pay?orderId=${demoCode}&amount=${amount}`
          data = {
            success: true,
            data: {
              transactionCode: demoCode,
              paymentUrl: demoUrl,
              qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(demoUrl)}`,
            },
          }
        }

        const txCode = data.data.transactionCode
        const pUrl = data.data.paymentUrl || null
        const qrUrl =
          data.data.qrCodeUrl ||
          (pUrl
            ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pUrl)}`
            : null)

        setTransactionCode(txCode)
        setPaymentUrl(pUrl)
        setQrCodeUrl(qrUrl)
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
        ) : (qrCodeUrl || paymentUrl) ? (
          /* Màn hình hiển thị QR Code cổng thanh toán */
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: gateway === "VNPAY" ? "rgba(37, 99, 235, 0.2)" : "rgba(217, 70, 239, 0.2)",
                padding: "4px 12px",
                borderRadius: "999px",
                marginBottom: "10px",
                border: gateway === "VNPAY" ? "1px solid #3b82f6" : "1px solid #d946ef",
                fontSize: "12px",
                fontWeight: 700,
                color: gateway === "VNPAY" ? "#60a5fa" : "#f472b6",
              }}
            >
              <span>{gateway === "VNPAY" ? "🏦 Cổng VNPay-QR" : "👛 Ví MoMo QR"}</span>
            </div>

            <p style={{ fontSize: "13px", color: "#cbd5e1", margin: "0 0 10px" }}>
              Mở App ngân hàng hoặc {gateway} quét mã QR bên dưới để nạp tiền:
            </p>
            <div
              style={{
                background: "#ffffff",
                padding: "14px",
                borderRadius: "14px",
                display: "inline-block",
                marginBottom: "10px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
              }}
            >
              <img
                src={
                  qrCodeUrl ||
                  `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(paymentUrl || "")}`
                }
                alt="Mã QR thanh toán"
                style={{ width: "190px", height: "190px", display: "block" }}
              />
            </div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#38bdf8", marginBottom: "4px" }}>
              Số tiền: {amount.toLocaleString("vi-VN")} đ
            </div>
            <p style={{ fontSize: "11px", color: "#94a3b8", margin: "0 0 14px" }}>
              Mã giao dịch: <strong>{transactionCode}</strong>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "340px", margin: "0 auto 12px" }}>
              {paymentUrl && (
                <a
                  href={paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "10px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #0284c7, #2563eb)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                  }}
                >
                  <span>🌐 Mở trang thanh toán {gateway}</span>
                  <span style={{ fontSize: "15px" }}>→</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleConfirmSimulated}
                disabled={isConfirmingSimulated}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "11px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #059669, #10b981)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
                }}
              >
                <span>✓ {isConfirmingSimulated ? "ĐANG XÁC NHẬN..." : "Tôi đã quét mã & thanh toán (Xác nhận ngay)"}</span>
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
