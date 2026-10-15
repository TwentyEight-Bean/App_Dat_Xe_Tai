import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react"

type Props = {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  title: string
  bookingCode?: string
  icon: ReactNode
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
  children,
}: Props) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const ignoreClick = useRef(false)
  const compactRef = useRef<HTMLButtonElement>(null)
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

  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    gesture.current = { id: event.pointerId, y: event.clientY }
    ignoreClick.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (gesture.current?.id !== event.pointerId) return
    const delta = event.clientY - gesture.current.y
    if (Math.abs(delta) > 5) {
      ignoreClick.current = true
      setDragging(true)
    }
    if (!collapsed) setOffset(Math.max(0, delta))
  }
  const end = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    if (gesture.current?.id !== event.pointerId) return
    const delta = event.clientY - gesture.current.y
    if (Math.abs(delta) > 5) ignoreClick.current = true
    gesture.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(false)
    setOffset(0)
    if (!cancelled && (collapsed ? -delta : delta) >= 56)
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
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => end(event),
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) =>
      end(event, true),
    onLostPointerCapture: () => {
      gesture.current = null
      setDragging(false)
      setOffset(0)
    },
  }

  return (
    <>
      <div
        hidden={collapsed}
        className={`customer-trip-sheet ${dragging ? "is-dragging" : ""}`}
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
            aria-label="Đóng bảng chuyến xe"
            onClick={() => onCollapsedChange(true)}
          >
            ×
          </button>
        </div>
        {children}
      </div>
      {collapsed && (
        <button
          ref={compactRef}
          className="searching-peek glass-liquid"
          type="button"
          aria-label="Mở lại bảng chuyến xe"
          aria-expanded={false}
          {...handlers}
          onClick={toggle}
        >
          <span className="search-badge">{icon}</span>
          <span className="searching-peek-copy">
            <strong aria-live="polite">{title}</strong>
            <small>
              Chạm hoặc kéo lên để xem chi tiết
              {bookingCode ? ` · #${bookingCode}` : ""}
            </small>
          </span>
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>
      )}
    </>
  )
}
