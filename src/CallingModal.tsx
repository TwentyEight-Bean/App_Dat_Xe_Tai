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
  bookingId,
  partnerName,
  partnerRole,
  partnerAvatar,
  partnerPhone,
  licensePlate,
  vehicleType,
  authToken,
}: CallingModalProps) {
  const [callStatus, setCallStatus] = useState<"CONNECTING" | "RINGING" | "IN_CALL" | "ENDED">("CONNECTING")
  const [duration, setDuration] = useState(0)
  const [hotline, setHotline] = useState("1900-8888")
  const [realPhone, setRealPhone] = useState(partnerPhone || "")
  const [copied, setCopied] = useState(false)
  const [stringeeCallId, setStringeeCallId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const autoDialedRef = useRef(false)

  const activePhone = realPhone || partnerPhone || "0903124486"
  const cleanPhone = activePhone.replace(/\D/g, "")

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current)
      setCallStatus("CONNECTING")
      setDuration(0)
      autoDialedRef.current = false
      return
    }

    const token =
      authToken ||
      (typeof window !== "undefined"
        ? localStorage.getItem("driver_auth_token") || localStorage.getItem("token")
        : "")

    // 1. Cấp phép cuộc gọi và lấy số điện thoại thật của đối tác
    if (bookingId && token) {
      fetch("/api/v1/calls/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            if (data.data.callee?.phone) {
              setRealPhone(data.data.callee.phone)
            }
            if (data.data.callee?.maskedDisplayNumber) {
              setHotline(data.data.callee.maskedDisplayNumber)
            }
            if (data.data.stringeeCallId) {
              setStringeeCallId(data.data.stringeeCallId)
            }
          }
        })
        .catch((err) => console.warn("Lỗi gọi API authorize call:", err))
    }

    // 2. Tự động mở trình quay số điện thoại SIM ngay lần đầu mở
    if (!autoDialedRef.current && cleanPhone) {
      autoDialedRef.current = true
      try {
        window.location.href = `tel:${cleanPhone}`
      } catch (e) {
        console.warn("Auto dial error:", e)
      }
    }

    // 3. Đếm thời gian đàm thoại
    const ringTimeout = setTimeout(() => {
      setCallStatus("RINGING")
    }, 1200)

    const answerTimeout = setTimeout(() => {
      setCallStatus("IN_CALL")
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    }, 3500)

    return () => {
      clearTimeout(ringTimeout)
      clearTimeout(answerTimeout)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen, bookingId, authToken, cleanPhone])

  if (!isOpen) return null

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  const handleEndCall = () => {
    setCallStatus("ENDED")
    if (timerRef.current) clearInterval(timerRef.current)

    if (stringeeCallId || bookingId) {
      fetch("/api/v1/calls/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: stringeeCallId,
          event: "ended",
          duration: duration,
        }),
      }).catch((err) => console.warn("Lỗi ghi nhận kết thúc cuộc gọi:", err))
    }

    setTimeout(() => {
      onClose()
    }, 400)
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
          <span>📶 CUỘC GỌI SIM DI ĐỘNG THỰC TẾ</span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "rgba(255, 255, 255, 0.7)" }}>
          Đã kích hoạt trình gọi điện của máy tới số điện thoại đối tác
        </p>
      </div>

      {/* Center: Avatar, Partner info & Phone badge */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", width: "100%", maxWidth: "360px" }}>
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
            boxShadow:
              callStatus === "IN_CALL"
                ? "0 0 0 10px rgba(34, 197, 94, 0.25), 0 0 30px rgba(34, 197, 94, 0.4)"
                : "0 0 0 6px rgba(255, 255, 255, 0.1)",
            transition: "all 0.3s ease",
          }}
        >
          {partnerAvatar ? (
            <img src={partnerAvatar} alt={partnerName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : partnerName ? (
            partnerName.charAt(0).toUpperCase()
          ) : (
            "U"
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#ffffff" }}>{partnerName}</h2>
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
            padding: "10px 18px",
            textAlign: "center",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span style={{ fontSize: "11.5px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Số điện thoại đối tác
          </span>
          <span style={{ fontSize: "24px", fontWeight: 900, color: "#38bdf8", letterSpacing: "1px" }}>
            {formatDisplayPhone(activePhone)}
          </span>
        </div>

        {/* Status duration */}
        <div>
          {callStatus === "CONNECTING" && (
            <span style={{ fontSize: "14px", color: "#93c5fd" }}>Đang khởi tạo cuộc gọi...</span>
          )}
          {callStatus === "RINGING" && (
            <span style={{ fontSize: "14px", color: "#fef08a" }}>Đang đổ chuông máy đối tác...</span>
          )}
          {callStatus === "IN_CALL" && (
            <span
              style={{
                fontSize: "17px",
                fontWeight: 700,
                color: "#4ade80",
                letterSpacing: "1px",
              }}
            >
              {formatTime(duration)}
            </span>
          )}
          {callStatus === "ENDED" && (
            <span style={{ fontSize: "14px", color: "#f87171" }}>Cuộc gọi đã kết thúc</span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ width: "100%", maxWidth: "340px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Nút gọi lại qua SIM ngay lập tức */}
        <a
          href={`tel:${cleanPhone}`}
          style={{
            width: "100%",
            height: "54px",
            borderRadius: "27px",
            background: "linear-gradient(135deg, #16a34a, #15803d)",
            color: "#ffffff",
            fontSize: "16px",
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
          <span>BẤM GỌI SIM: {formatDisplayPhone(activePhone)}</span>
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
