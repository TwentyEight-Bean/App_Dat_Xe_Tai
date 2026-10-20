import { useEffect, useState } from "react"
import useCustomerDialog from "./customerDialog"
import {
  getNotificationPermissionStatus,
  registerDeviceTokenToServer,
  removeDeviceTokenFromServer,
} from "./lib/deviceTokenClient"

type NotificationItem = {
  id: string

  title: string

  message: string

  time: string

  type: "order" | "chat" | "promo"

  unread: boolean
}

const mockNotifications: NotificationItem[] = [
  {
    id: "notif-1",

    title: "Tài xế đang di chuyển tới điểm lấy",

    message:
      "Tài xế Anh Minh (51D-482.15) đang tới 21 Nguyễn Đình Chiểu. Dự kiến đến trong 4 phút.",

    time: "Vừa xong",

    type: "order",

    unread: true,
  },

  {
    id: "notif-2",

    title: "Tin nhắn mới từ tài xế",

    message: '"Tôi đang ở đầu đường, khoảng 3 phút nữa xe tới trước cổng nhé!"',

    time: "5 phút trước",

    type: "chat",

    unread: true,
  },

  {
    id: "notif-3",

    title: "Ưu đãi cuốc xe tải đầu tuần",

    message:
      "Mã GIAO30 giảm 30.000đ cho đơn đặt xe tiếp theo đã sẵn sàng trong tài khoản.",

    time: "Hôm nay",

    type: "promo",

    unread: false,
  },
]

type NotificationModalProps = {
  isOpen: boolean

  onClose: () => void
}

export default function NotificationModal({
  isOpen,

  onClose,
}: NotificationModalProps) {
  const [items, setItems] = useState<NotificationItem[]>(mockNotifications)

  const [isDeviceEnabled, setIsDeviceEnabled] = useState(false)

  const [loading, setLoading] = useState(false)

  const [toastMsg, setToastMsg] = useState("")

  const dialogRef = useCustomerDialog(isOpen, () => {
    if (!loading) onClose()
  })

  useEffect(() => {
    if (!isOpen) return

    const isEnabled =
      typeof window !== "undefined" &&
      localStorage.getItem("device_notif_enabled") === "true"

    setIsDeviceEnabled(isEnabled)
  }, [isOpen])

  if (!isOpen) return null

  const handleToggleDeviceToken = async () => {
    if (loading) return

    setLoading(true)

    setToastMsg("")

    try {
      if (!isDeviceEnabled) {
        const res = await registerDeviceTokenToServer()

        if (res.success) {
          setIsDeviceEnabled(true)

          setToastMsg("Đã kích hoạt thông báo đẩy trên thiết bị!")
        } else {
          setToastMsg(res.message)
        }
      } else {
        const res = await removeDeviceTokenFromServer()

        setIsDeviceEnabled(false)

        setToastMsg(res.message)
      }
    } catch (error) {
      setToastMsg(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật thông báo. Vui lòng thử lại.",
      )
    } finally {
      setLoading(false)
    }
  }

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })))

    setToastMsg("Đã đánh dấu tất cả là đã đọc")
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="customer-modal fixed inset-0 flex flex-col justify-end"
      style={{
        background: "rgba(15, 23, 42, 0.48)",

        backdropFilter: "blur(8px)",

        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Trung tâm thông báo"
    >
      <div
        className="w-full max-w-[420px] mx-auto overflow-hidden animate-slide-up"
        style={{
          maxHeight: "85dvh",

          display: "flex",

          flexDirection: "column",

          borderRadius: "26px 26px 0 0",

          background:
            "radial-gradient(120% 60% at 15% -10%, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.92) 60%), linear-gradient(180deg, #fffdfa 0%, #f7f4ec 100%)",

          border: "1px solid rgba(255, 255, 255, 0.85)",

          boxShadow: "0 -16px 40px -10px rgba(15, 23, 42, 0.35)",

          padding: "16px 20px 24px",
        }}
      >
        {/* Grab Handle */}
        <div
          style={{
            width: "38px",

            height: "4px",

            borderRadius: "2px",

            background: "#d5cfc2",

            margin: "0 auto 12px",
          }}
        />

        {/* Modal Header */}
        <div
          style={{
            display: "flex",

            alignItems: "center",

            justifyContent: "space-between",

            marginBottom: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>🔔</span>
            <h2
              style={{
                fontSize: "18px",

                fontWeight: 700,

                color: "#17212b",

                margin: 0,
              }}
            >
              Thông báo
            </h2>
            <span
              style={{
                padding: "2px 8px",

                borderRadius: "10px",

                background: "var(--brand-50, #eaf5ff)",

                color: "var(--brand-600, #1478d4)",

                fontSize: "11px",

                fontWeight: 700,
              }}
            >
              {items.filter((i) => i.unread).length} mới
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              width: "32px",

              height: "32px",

              borderRadius: "50%",

              border: "none",

              background: "rgba(0, 0, 0, 0.06)",

              color: "#3e4a56",

              cursor: "pointer",

              display: "grid",

              placeItems: "center",

              fontSize: "15px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Device Token Banner (Sprint 1: Task 1.4 API Integration) */}
        <div
          style={{
            padding: "12px 14px",

            borderRadius: "16px",

            background: isDeviceEnabled
              ? "linear-gradient(135deg, #e8f7f0 0%, #d1f2e2 100%)"
              : "linear-gradient(135deg, #eaf5ff 0%, #d8edff 100%)",

            border: isDeviceEnabled ? "1px solid #a3e6cb" : "1px solid #b8dcfa",

            marginBottom: "14px",

            display: "flex",

            alignItems: "center",

            justifyContent: "space-between",

            gap: "10px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",

                alignItems: "center",

                gap: "6px",

                fontWeight: 700,

                fontSize: "13px",

                color: isDeviceEnabled ? "#157a4a" : "#0f62ae",
              }}
            >
              <span>{isDeviceEnabled ? "✅" : "📱"}</span>
              <span>
                {isDeviceEnabled
                  ? "Thông báo thiết bị đã bật"
                  : "Bật thông báo đẩy thiết bị"}
              </span>
            </div>
            <p
              style={{
                fontSize: "11px",

                color: isDeviceEnabled ? "#276749" : "#4a6b82",

                margin: "2px 0 0",

                lineHeight: 1.35,
              }}
            >
              {isDeviceEnabled
                ? "Thiết bị này đã liên kết POST /auth/device-token để nhận tin tức chuyến xe."
                : "Cho phép gửi thông báo khi tài xế nhận chuyến hoặc đến nơi lấy hàng."}
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleToggleDeviceToken}
            style={{
              padding: "7px 14px",

              borderRadius: "12px",

              border: "none",

              fontSize: "12px",

              fontWeight: 700,

              cursor: loading ? "not-allowed" : "pointer",

              background: isDeviceEnabled
                ? "#fff"
                : "var(--brand-500, #1687e8)",

              color: isDeviceEnabled ? "#2d3748" : "#fff",

              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",

              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Đang xử lý..." : isDeviceEnabled ? "Tắt" : "Bật ngay"}
          </button>
        </div>

        {/* Toast Feedback */}
        {toastMsg && (
          <div
            style={{
              padding: "8px 12px",

              borderRadius: "10px",

              background: "#1e293b",

              color: "#fff",

              fontSize: "11px",

              fontWeight: 600,

              marginBottom: "10px",

              textAlign: "center",
            }}
          >
            {toastMsg}
          </div>
        )}

        {/* Notifications Scroll List */}
        <div
          style={{
            flex: 1,

            overflowY: "auto",

            display: "flex",

            flexDirection: "column",

            gap: "8px",

            paddingRight: "2px",
          }}
        >
          {items.map((item) => {
            const icon =
              item.type === "order" ? "🚚" : item.type === "chat" ? "💬" : "🎁"

            const badgeBg =
              item.type === "order"
                ? "#e8f7f0"
                : item.type === "chat"
                  ? "#eaf5ff"
                  : "#fdf3dc"

            return (
              <div
                key={item.id}
                style={{
                  display: "flex",

                  gap: "12px",

                  padding: "11px 12px",

                  borderRadius: "14px",

                  background: item.unread
                    ? "#fff"
                    : "rgba(255, 255, 255, 0.55)",

                  border: item.unread
                    ? "1px solid #e5e0d5"
                    : "1px solid rgba(220, 215, 205, 0.4)",

                  boxShadow: item.unread
                    ? "0 2px 6px rgba(0, 0, 0, 0.04)"
                    : "none",
                }}
              >
                <span
                  style={{
                    width: "36px",

                    height: "36px",

                    borderRadius: "10px",

                    background: badgeBg,

                    display: "grid",

                    placeItems: "center",

                    fontSize: "17px",

                    flexShrink: 0,
                  }}
                >
                  {icon}
                </span>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",

                      justifyContent: "space-between",

                      alignItems: "flex-start",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "13px",

                        color: "#17212b",

                        fontWeight: item.unread ? 700 : 600,
                      }}
                    >
                      {item.title}
                    </strong>
                    <span
                      style={{
                        fontSize: "10px",

                        color: "#94a0aa",

                        whiteSpace: "nowrap",

                        marginLeft: "6px",
                      }}
                    >
                      {item.time}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: "12px",

                      color: "#4a5568",

                      margin: "3px 0 0",

                      lineHeight: 1.35,
                    }}
                  >
                    {item.message}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            marginTop: "14px",

            display: "flex",

            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={markAllRead}
            style={{
              background: "none",

              border: "none",

              color: "var(--brand-600, #1478d4)",

              fontSize: "12px",

              fontWeight: 600,

              cursor: "pointer",

              padding: "4px 8px",
            }}
          >
            Đánh dấu tất cả là đã đọc
          </button>
        </div>
      </div>
    </div>
  )
}
