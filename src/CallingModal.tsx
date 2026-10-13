import { useEffect, useState, useRef } from "react"

export interface CallingModalProps {
  isOpen: boolean
  onClose: () => void
  bookingId?: string
  partnerName: string
  partnerRole: "CUSTOMER" | "DRIVER"
  licensePlate?: string
  vehicleType?: string
  authToken?: string
}

export default function CallingModal({
  isOpen,
  onClose,
  bookingId,
  partnerName,
  partnerRole,
  licensePlate,
  vehicleType,
  authToken,
}: CallingModalProps) {
  const [callStatus, setCallStatus] = useState<"CONNECTING" | "RINGING" | "IN_CALL" | "ENDED">("CONNECTING")
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaker, setIsSpeaker] = useState(true)
  const [hotline, setHotline] = useState("1900-8888")
  const [stringeeCallId, setStringeeCallId] = useState<string | null>(null)
  const [stringeeToken, setStringeeToken] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current)
      setCallStatus("CONNECTING")
      setDuration(0)
      return
    }

    const token =
      authToken ||
      (typeof window !== "undefined"
        ? localStorage.getItem("driver_auth_token") || localStorage.getItem("token")
        : "")

    // 1. Lấy Client Access Token Stringee SDK (GET /api/v1/calls/token)
    if (token) {
      fetch("/api/v1/calls/token", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((r) => r.json())
        .then((tokData) => {
          if (tokData.success && tokData.data?.clientToken) {
            setStringeeToken(tokData.data.clientToken)
            if (typeof window !== "undefined") {
              sessionStorage.setItem("stringee_client_token", tokData.data.clientToken)
            }
          }
        })
        .catch((err) => console.warn("Lỗi tải Stringee Token:", err))
    }

    // 2. Gọi API cấp phép cuộc gọi giấu số qua Stringee (POST /api/v1/calls/authorize)
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

    // 3. Mô phỏng vòng đời kết nối WebRTC / Stringee Call
    const ringTimeout = setTimeout(() => {
      setCallStatus("RINGING")
    }, 1500)

    const answerTimeout = setTimeout(() => {
      setCallStatus("IN_CALL")
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    }, 4000)

    return () => {
      clearTimeout(ringTimeout)
      clearTimeout(answerTimeout)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isOpen, bookingId, authToken])

  if (!isOpen) return null

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  const handleEndCall = () => {
    setCallStatus("ENDED")
    if (timerRef.current) clearInterval(timerRef.current)

    // Gửi sự kiện kết thúc cuộc gọi về backend để lưu thời lượng thực vào DB call_logs
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
    }, 600)
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
        padding: "48px 24px 40px",
        color: "#ffffff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Top Header: Hotline Bảo Mật */}
      <div style={{ textAlign: "center", width: "100%" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255, 255, 255, 0.1)",
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "12px",
            color: "#67e8f9",
            fontWeight: 600,
            border: "1px solid rgba(103, 232, 249, 0.3)",
          }}
        >
          <span>🔒 TỔNG ĐÀI BẢO MẬT GIẤU SỐ</span>
          <span>·</span>
          <span>Hotline: {hotline}</span>
        </div>
        {stringeeToken && (
          <div style={{ marginTop: "4px", fontSize: "10px", color: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
            <span>●</span> Stringee WebRTC Token: Active (Mã hóa bảo mật 24h)
          </div>
        )}
        <div style={{ marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.6)" }}>
            Số điện thoại thật của bạn và đối tác được giấu kín hoàn toàn
          </span>
          <a
            href={`tel:${hotline.replace(/[^0-9]/g, "") || "19008888"}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "rgba(255, 255, 255, 0.12)",
              color: "#67e8f9",
              fontSize: "11px",
              padding: "2px 10px",
              borderRadius: "12px",
              textDecoration: "none",
              fontWeight: 600,
              border: "1px solid rgba(103, 232, 249, 0.2)",
            }}
          >
            📞 Gọi qua SIM điện thoại
          </a>
        </div>
      </div>

      {/* Center: Avatar & Trạng Thái */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <div
          style={{
            width: "108px",
            height: "108px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "36px",
            fontWeight: 700,
            color: "#ffffff",
            boxShadow:
              callStatus === "IN_CALL"
                ? "0 0 0 10px rgba(37, 99, 235, 0.25), 0 0 30px rgba(37, 99, 235, 0.4)"
                : "0 0 0 6px rgba(255, 255, 255, 0.08)",
            transition: "all 0.3s ease",
          }}
        >
          {partnerName ? partnerName.charAt(0).toUpperCase() : "U"}
        </div>

        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>{partnerName}</h2>
          <p style={{ margin: "4px 0 0", fontSize: "14px", color: "rgba(255, 255, 255, 0.7)" }}>
            {partnerRole === "DRIVER" ? "Tài xế nhận chuyến" : "Khách hàng đặt xe"}
            {licensePlate && ` · ${licensePlate}`}
            {vehicleType && ` (${vehicleType})`}
          </p>
        </div>

        <div style={{ marginTop: "8px" }}>
          {callStatus === "CONNECTING" && (
            <span style={{ fontSize: "15px", color: "#93c5fd" }}>Đang kết nối tổng đài...</span>
          )}
          {callStatus === "RINGING" && (
            <span style={{ fontSize: "15px", color: "#fef08a" }}>Đang đổ chuông...</span>
          )}
          {callStatus === "IN_CALL" && (
            <span
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#4ade80",
                letterSpacing: "1px",
              }}
            >
              {formatTime(duration)}
            </span>
          )}
          {callStatus === "ENDED" && (
            <span style={{ fontSize: "15px", color: "#f87171" }}>Cuộc gọi đã kết thúc</span>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {/* Mute Button */}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              border: "none",
              background: isMuted ? "#ef4444" : "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 500,
              gap: "2px",
            }}
          >
            <span>{isMuted ? "🔇" : "🎤"}</span>
            <span style={{ fontSize: "9px" }}>{isMuted ? "Bật mic" : "Tắt mic"}</span>
          </button>

          {/* Speaker Button */}
          <button
            type="button"
            onClick={() => setIsSpeaker(!isSpeaker)}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              border: "none",
              background: isSpeaker ? "#2563eb" : "rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 500,
              gap: "2px",
            }}
          >
            <span>{isSpeaker ? "🔊" : "🔈"}</span>
            <span style={{ fontSize: "9px" }}>Loa ngoài</span>
          </button>
        </div>

        {/* End Call Button */}
        <button
          type="button"
          onClick={handleEndCall}
          style={{
            width: "100%",
            height: "52px",
            borderRadius: "26px",
            border: "none",
            background: "#dc2626",
            color: "#ffffff",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 4px 16px rgba(220, 38, 38, 0.4)",
          }}
        >
          <span>✕</span>
          <span>KẾT THÚC CUỘC GỌI</span>
        </button>
      </div>
    </div>
  )
}
