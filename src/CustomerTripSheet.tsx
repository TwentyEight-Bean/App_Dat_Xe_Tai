import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react"

export type DriverSummary = {
  id?: string
  name?: string
  phone?: string
  licensePlate?: string
  avatarUrl?: string
  vehicleTypeName?: string
  ratingAvg?: string
}

type Props = {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  title: string
  bookingCode?: string
  icon: ReactNode
  driver?: DriverSummary | null
  etaMinutes?: string | number
  onCall?: () => void
  onMessage?: () => void
  phase?: string
  pickup?: string
  destination?: string
  vehicleName?: string
  price?: string | number
  children: ReactNode
}

type Gesture = {
  id: number
  y: number
}

export default function CustomerTripSheet({
  collapsed,
  onCollapsedChange,
  title,
  bookingCode,
  icon,
  driver,
  etaMinutes,
  onCall,
  onMessage,
  phase,
  children,
}: Props) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const ignoreClick = useRef(false)
  const compactRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)
  const previousCollapsed = useRef(collapsed)

  useEffect(() => {
    if (previousCollapsed.current !== collapsed) {
      ;(collapsed ? compactRef.current : handleRef.current)?.focus({
        preventScroll: true,
      })
    }
    previousCollapsed.current = collapsed
    setOffset(0)
    setDragging(false)
  }, [collapsed])

  const start = (event: PointerEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (event.button !== 0) return
    gesture.current = { id: event.pointerId, y: event.clientY }
    ignoreClick.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (gesture.current?.id !== event.pointerId) return
    const delta = event.clientY - gesture.current.y
    if (Math.abs(delta) > 5) {
      ignoreClick.current = true
      setDragging(true)
    }
    if (!collapsed) setOffset(Math.max(0, delta))
  }
  const end = (
    event: PointerEvent<HTMLButtonElement | HTMLDivElement>,
    cancelled = false,
  ) => {
    if (gesture.current?.id !== event.pointerId) return
    const delta = event.clientY - gesture.current.y
    if (Math.abs(delta) > 5) ignoreClick.current = true
    gesture.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(false)
    setOffset(0)
    if (!cancelled && (collapsed ? -delta : delta) >= 50)
      onCollapsedChange(!collapsed)
  }
  const toggle = () => {
    if (ignoreClick.current) {
      ignoreClick.current = false
      return
    }
    onCollapsedChange(!collapsed)
  }
  const handlers = {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: (event: PointerEvent<HTMLButtonElement | HTMLDivElement>) =>
      end(event),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement | HTMLDivElement>) =>
      end(event, true),
    onLostPointerCapture: () => {
      gesture.current = null
      setDragging(false)
      setOffset(0)
    },
  }

  const driverName = driver?.name || "Tài xế FastDrop"
  const driverInitials = driverName
    .split(" ")
    .slice(-2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase() || "TX"

  return (
    <>
      <div
        hidden={collapsed}
        className={`customer-trip-sheet ${phase ? `phase-${phase}` : ""} ${dragging ? "is-dragging" : ""}`}
        style={{
          transform: offset > 0 ? `translateY(${offset}px)` : undefined,
        }}
      >
        <div className="trip-sheet-toolbar">
          <button
            ref={handleRef}
            type="button"
            className="trip-sheet-drag"
            aria-label="Kéo xuống hoặc bấm để thu gọn bảng chuyến xe"
            aria-expanded={!collapsed}
            {...handlers}
            onClick={toggle}
          >
            <span />
          </button>
          <button
            type="button"
            className="trip-sheet-close"
            aria-label="Thu gọn bảng chuyến xe để xem bản đồ"
            title="Thu gọn để xem bản đồ"
            onClick={() => onCollapsedChange(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
        {children}
      </div>

      {collapsed && (
        <div
          ref={compactRef}
          className="customer-collapsed-bar"
          role="button"
          tabIndex={0}
          aria-label="Mở chi tiết chuyến xe"
          aria-expanded={false}
          {...handlers}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              toggle()
            }
          }}
        >
          {/* Top handle bar for touch affordance */}
          <div className="collapsed-drag-handle">
            <span />
          </div>

          <div className="collapsed-inner">
            {phase === "searching" ? (
              /* Phase searching peek */
              <div className="collapsed-searching-row">
                <div className="collapsed-pulse-circle">
                  <span className="pulse-wave" />
                  <span className="pulse-icon">{icon}</span>
                </div>
                <div className="collapsed-info-col">
                  <div className="collapsed-title-row">
                    <span className="status-badge-live">Đang tìm xe tải</span>
                    {bookingCode && (
                      <span className="booking-code-chip">
                        #{bookingCode.replace("BK-", "")}
                      </span>
                    )}
                  </div>
                  <div className="collapsed-subtext">
                    Đang quét tài xế gần bạn nhất · Chạm để xem
                  </div>
                </div>
                <button
                  type="button"
                  className="collapsed-action-btn expand"
                  onClick={toggle}
                  aria-label="Mở rộng chi tiết"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Phase Driver Found / Arriving / Delivering: Full Driver Peek Card */
              <div className="collapsed-driver-row">
                {/* Driver Avatar */}
                <div className="collapsed-driver-avatar-wrapper">
                  {driver?.avatarUrl ? (
                    <img
                      src={driver.avatarUrl}
                      alt={driverName}
                      className="collapsed-driver-img"
                    />
                  ) : (
                    <div className="collapsed-driver-initials">
                      {driverInitials}
                    </div>
                  )}
                  <span className="collapsed-online-dot" />
                </div>

                {/* Driver Info & Status */}
                <div className="collapsed-info-col">
                  <div className="collapsed-driver-headline">
                    <strong className="collapsed-driver-name">{driverName}</strong>
                    <span className="collapsed-rating-badge">
                      ★ {driver?.ratingAvg || "4.9"}
                    </span>
                  </div>

                  <div className="collapsed-status-row">
                    <span className="collapsed-plate-badge">
                      {driver?.licensePlate || "51D-892.41"}
                    </span>
                    <span className="collapsed-eta-chip">
                      {etaMinutes ? `~${etaMinutes} phút` : title}
                    </span>
                  </div>
                </div>

                {/* Quick Actions (Call, Message, Expand) */}
                <div className="collapsed-actions-group">
                  {onCall && (
                    <button
                      type="button"
                      className="collapsed-action-btn call"
                      title="Gọi tài xế"
                      aria-label="Gọi tài xế"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCall()
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                      </svg>
                    </button>
                  )}
                  {onMessage && (
                    <button
                      type="button"
                      className="collapsed-action-btn chat"
                      title="Nhắn tin với tài xế"
                      aria-label="Nhắn tin với tài xế"
                      onClick={(e) => {
                        e.stopPropagation()
                        onMessage()
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    className="collapsed-action-btn expand"
                    title="Mở rộng chi tiết chuyến xe"
                    aria-label="Mở rộng chi tiết chuyến xe"
                    onClick={toggle}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
