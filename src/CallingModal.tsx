import { useEffect, useState, useRef } from "react"

export interface CallingModalProps {
  isOpen: boolean
  onClose: () => void
  bookingId?: string
  partnerName: string
  partnerRole: "CUSTOMER" | "DRIVER"
  partnerAvatar?: string
  partnerPhone?: string
  licensePlate?: string
  vehicleType?: string
  authToken?: string
}

function formatDisplayPhone(p: string) {
  const clean = p.replace(/\D/g, "")
  if (clean.length === 10) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`
  }
  return p
}

export default function CallingModal({
  isOpen,
  onClose,
  partnerName,
  partnerRole,
  partnerAvatar,
  partnerPhone,
  licensePlate,
  vehicleType,
}: CallingModalProps) {
  const [duration, setDuration] = useState(0)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)
  const autoDialedRef = useRef(false)

  const activePhone = partnerPhone || (partnerRole === "DRIVER" ? "0903124486" : "0903888999")
  const cleanPhone = activePhone.replace(/\D/g, "")

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current)
      setDuration(0)
      autoDialedRef.current = false
      return
    }

    // Tự động mở trình quay số điện thoại SIM ngay lần đầu mở modal
    if (!autoDialedRef.current && cleanPhone) {
      autoDialedRef.current = true
      try {
        window.location.href = `tel:${cleanPhone}`
      } catch (e) {
        console.warn("Auto dial error:", e)
      }
    }

    // Đếm thời gian cuộc gọi
    timerRef.current = window.setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen, cleanPhone])

  if (!isOpen) return null

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  const handleEndCall = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    onClose()
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 15, 29, 0.94)",
        backdropFilter: "blur(16px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "40px 20px 32px",
        color: "#ffffff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Top Header */}
      <div style={{ textAlign: "center", width: "100%", maxWidth: "380px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(34, 197, 94, 0.15)",
            padding: "8px 16px",
            borderRadius: "20px",
            fontSize: "12.5px",
            color: "#4ade80",
            fontWeight: 700,
            border: "1.5px solid rgba(74, 222, 128, 0.4)",
          }}
        >
          <span>📶 CUỘC GỌI SIM DI ĐỘNG TRỰC TIẾP</span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "rgba(255, 255, 255, 0.7)" }}>
          Đã kích hoạt ứng dụng gọi điện trên máy tới số điện thoại đối tác
        </p>
      </div>

      {/* Center: Avatar, Partner info & Phone badge */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "14px",
          width: "100%",
          maxWidth: "360px",
        }}
      >
        <div
          style={{
            width: "96px",
            height: "96px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "34px",
            fontWeight: 700,
            color: "#ffffff",
            overflow: "hidden",
            boxShadow: "0 0 0 8px rgba(34, 197, 94, 0.25), 0 0 30px rgba(34, 197, 94, 0.4)",
            transition: "all 0.3s ease",
          }}
        >
          {partnerAvatar ? (
            <img
              src={partnerAvatar}
              alt={partnerName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : partnerName ? (
            partnerName.charAt(0).toUpperCase()
          ) : (
            "U"
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#ffffff" }}>
            {partnerName}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "14px", color: "rgba(255, 255, 255, 0.75)" }}>
            {partnerRole === "DRIVER" ? "Tài xế nhận chuyến" : "Khách hàng đặt xe"}
            {licensePlate && ` · ${licensePlate}`}
            {vehicleType && ` (${vehicleType})`}
          </p>
        </div>

        {/* Big Phone Number Chip */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            border: "1.5px solid rgba(255, 255, 255, 0.18)",
            borderRadius: "16px",
            padding: "12px 18px",
            textAlign: "center",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span
            style={{
              fontSize: "11.5px",
              color: "#94a3b8",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Số điện thoại {partnerRole === "DRIVER" ? "tài xế" : "khách hàng"}
          </span>
          <span style={{ fontSize: "25px", fontWeight: 900, color: "#38bdf8", letterSpacing: "1px" }}>
            {formatDisplayPhone(activePhone)}
          </span>
        </div>

        {/* Call Duration */}
        <div>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#4ade80",
              letterSpacing: "1px",
            }}
          >
            Đang gọi: {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          width: "100%",
          maxWidth: "340px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Nút bấm gọi qua SIM */}
        <a
          href={`tel:${cleanPhone}`}
          style={{
            width: "100%",
            height: "54px",
            borderRadius: "27px",
            background: "linear-gradient(135deg, #16a34a, #15803d)",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            textDecoration: "none",
            boxShadow: "0 6px 20px rgba(22, 163, 74, 0.45)",
          }}
        >
          <span style={{ fontSize: "20px" }}>📞</span>
          <span>BẤM GỌI: {formatDisplayPhone(activePhone)}</span>
        </a>

        {/* Nút sao chép số */}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(cleanPhone)
            setCopied(true)
            setTimeout(() => setCopied(false), 2200)
          }}
          style={{
            width: "100%",
            height: "44px",
            borderRadius: "22px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: copied ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.1)",
            color: copied ? "#4ade80" : "#ffffff",
            fontSize: "13.5px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span>{copied ? "✓" : "📋"}</span>
          <span>{copied ? "Đã sao chép số điện thoại!" : "Sao chép số điện thoại"}</span>
        </button>

        {/* Đóng / Kết thúc */}
        <button
          type="button"
          onClick={handleEndCall}
          style={{
            width: "100%",
            height: "46px",
            borderRadius: "23px",
            border: "none",
            background: "#dc2626",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)",
            marginTop: "4px",
          }}
        >
          <span>✕</span>
          <span>ĐÓNG / KẾT THÚC</span>
        </button>
      </div>
    </div>
  )
}
