import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
  type ReactNode,
} from "react"
import "./interactiveMap.css"

export type MapMode = "customer" | "driver"
export type MapLayer = "standard" | "traffic" | "satellite"

export interface InteractiveMapProps {
  mode?: MapMode
  phase?: string // booking, searching, found, arriving, arrived, pickedup, delivering, delivered
  pickupAddr?: string
  destAddr?: string
  onPickupChange?: (addr: string) => void
  online?: boolean
  jobState?: string // none, incoming, toPickup, atPickup, delivering, complete
  children?: ReactNode
}

// Saigon landmarks and coordinates
const STREET_NAMES = [
  "21 Nguyễn Đình Chiểu, Đa Kao, Q.1",
  "145 Hai Bà Trưng, P.6, Q.3",
  "88 Điện Biên Phủ, P. Đa Kao, Q.1",
  "56 Nam Kỳ Khởi Nghĩa, Bến Nghé, Q.1",
  "128 Hoàng Diệu, P.12, Q.4",
  "34 Võ Thị Sáu, P. Tân Định, Q.1",
  "200 Nguyễn Thị Minh Khai, P.6, Q.3",
  "15 Lê Duẩn, Bến Nghé, Q.1",
  "92 Pasteur, Bến Nghé, Q.1",
  "40 Tôn Đức Thắng, Bến Nghé, Q.1",
  "12 Bến Vân Đồn, P.12, Q.4",
  "175 Cách Mạng Tháng 8, P.4, Q.3",
]

const ROUTE_PICKUP = { x: 194, y: 220 }
const ROUTE_DEST = { x: 290, y: 110 }
const ROUTE_DRIVER_START = { x: 45, y: 155 }

export default function InteractiveMap({
  mode = "customer",
  phase = "booking",
  pickupAddr,
  destAddr,
  onPickupChange,
  online = true,
  jobState = "none",
  children,
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Map transform: pan offset (x, y) & zoom scale
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [layer, setLayer] = useState<MapLayer>("standard")
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)

  // Drag state
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [pinLifted, setPinLifted] = useState(false)

  // Pinch zoom state
  const touchDistance = useRef<number | null>(null)
  const zoomStart = useRef(1)

  // Driver animated progress (0 -> 1)
  const [driverProgress, setDriverProgress] = useState(0)

  // Determine active route state
  const isCustomerTracking = [
    "found",
    "arriving",
    "arrived",
    "pickedup",
    "delivering",
    "delivered",
  ].includes(phase)
  const isDriverWorking =
    jobState === "toPickup" ||
    jobState === "atPickup" ||
    jobState === "delivering"
  const isSearching = phase === "searching"
  const isBooking = phase === "booking" && jobState === "none"

  // Simulate smooth truck movement along the route
  useEffect(() => {
    if (
      phase === "arriving" ||
      phase === "delivering" ||
      jobState === "toPickup" ||
      jobState === "delivering"
    ) {
      const interval = window.setInterval(() => {
        setDriverProgress((p) => {
          if (p >= 1) return 0
          return p + 0.008
        })
      }, 50)
      return () => window.clearInterval(interval)
    } else if (phase === "arrived" || jobState === "atPickup") {
      setDriverProgress(1)
    } else {
      setDriverProgress(0.2)
    }
  }, [phase, jobState])

  // Recenter map smoothly to focal point
  const recenter = useCallback(() => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }, [])

  // Zoom handlers
  const handleZoomIn = () =>
    setZoom((z) => Math.min(2.4, Number((z + 0.25).toFixed(2))))
  const handleZoomOut = () =>
    setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))

  // Mouse Drag Events
  const onMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    panStart.current = { ...pan }
    setDragging(true)
    if (isBooking) setPinLifted(true)
  }

  const onMouseMove = (e: ReactMouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPan({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy,
    })
  }

  const onMouseUp = () => {
    if (!isDragging.current) return
    isDragging.current = false
    setDragging(false)
    if (isBooking) {
      setPinLifted(false)
      // Pick dynamic nearby address when dropped
      const randomIdx = Math.floor(
        Math.abs(pan.x + pan.y) % STREET_NAMES.length,
      )
      onPickupChange?.(STREET_NAMES[randomIdx])
    }
  }

  // Touch Drag & Pinch Events
  const onTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      panStart.current = { ...pan }
      setDragging(true)
      if (isBooking) setPinLifted(true)
    } else if (e.touches.length === 2) {
      // Pinch to zoom start
      isDragging.current = false
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchDistance.current = Math.hypot(dx, dy)
      zoomStart.current = zoom
    }
  }

  const onTouchMove = (e: ReactTouchEvent) => {
    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - dragStart.current.x
      const dy = e.touches[0].clientY - dragStart.current.y
      setPan({
        x: panStart.current.x + dx,
        y: panStart.current.y + dy,
      })
    } else if (e.touches.length === 2 && touchDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const ratio = dist / touchDistance.current
      setZoom(Math.min(2.5, Math.max(0.7, zoomStart.current * ratio)))
    }
  }

  const onTouchEnd = () => {
    if (isDragging.current) {
      isDragging.current = false
      setDragging(false)
      if (isBooking) {
        setPinLifted(false)
        const randomIdx = Math.floor(
          Math.abs(pan.x + pan.y) % STREET_NAMES.length,
        )
        onPickupChange?.(STREET_NAMES[randomIdx])
      }
    }
    touchDistance.current = null
  }

  // Wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * -0.0015
    setZoom((z) =>
      Math.min(2.4, Math.max(0.75, Number((z + delta).toFixed(2)))),
    )
  }

  // Compute animated driver coordinates along bezier path
  const calcDriverPos = (t: number) => {
    const isToPickup =
      phase === "arriving" || phase === "found" || jobState === "toPickup"
    const p0 = isToPickup ? ROUTE_DRIVER_START : ROUTE_PICKUP
    const p1 = isToPickup ? { x: 120, y: 180 } : { x: 240, y: 170 }
    const p2 = isToPickup ? ROUTE_PICKUP : ROUTE_DEST

    // Quadratic Bezier
    const u = 1 - t
    const tt = t * t
    const uu = u * u
    const x = uu * p0.x + 2 * u * t * p1.x + tt * p2.x
    const y = uu * p0.y + 2 * u * t * p1.y + tt * p2.y

    // Angle of heading
    const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x)
    const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI

    return { x, y, angle }
  }

  const driverPos = calcDriverPos(driverProgress)

  return (
    <div
      aria-label="Bản đồ tương tác khu vực TP. Hồ Chí Minh"
      className={`interactive-map-root layer-${layer} ${
        dragging ? "is-dragging" : ""
      }`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchCancel={onTouchEnd}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchStart={onTouchStart}
      onWheel={onWheel}
      ref={containerRef}
    >
      {/* Map Content Transform World */}
      <div
        className="map-world"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
        }}
      >
        {/* Vector City Base Map */}
        <div className="vector-map-bg">
          <div className="map-grid-mesh" />

          {/* Saigon River & Canals */}
          <svg
            aria-hidden="true"
            className="waterways-svg"
            viewBox="0 0 600 900"
          >
            <path
              className="saigon-river"
              d="M380,-50 C410,120 460,280 430,420 C400,560 480,720 540,950"
            />
            <path
              className="ben-nghe-canal"
              d="M430,420 C320,440 220,490 100,560 C40,600 -20,640 -60,680"
            />
            <path
              className="nhieu-loc-canal"
              d="M390,140 C280,110 180,130 90,180 C20,220 -40,250 -80,300"
            />
          </svg>

          {/* Green Parks */}
          <div
            className="park park-tao-dan"
            style={{ left: 110, top: 290, width: 110, height: 75 }}
          >
            <span>CV Tao Đàn</span>
          </div>
          <div
            className="park park-le-van-tam"
            style={{ left: 180, top: 140, width: 95, height: 65 }}
          >
            <span>CV Lê Văn Tám</span>
          </div>
          <div
            className="park park-zoo"
            style={{ left: 340, top: 190, width: 90, height: 70 }}
          >
            <span>Thảo Cầm Viên</span>
          </div>
          <div
            className="park park-23-9"
            style={{ left: 90, top: 400, width: 140, height: 45 }}
          >
            <span>CV 23 Tháng 9</span>
          </div>

          {/* Urban District Labels */}
          <span className="district-tag" style={{ left: 240, top: 280 }}>
            QUẬN 1
          </span>
          <span className="district-tag" style={{ left: 140, top: 180 }}>
            QUẬN 3
          </span>
          <span className="district-tag" style={{ left: 260, top: 510 }}>
            QUẬN 4
          </span>
          <span className="district-tag" style={{ left: 340, top: 90 }}>
            BÌNH THẠNH
          </span>

          {/* Main Road Network */}
          <svg aria-hidden="true" className="roads-svg" viewBox="0 0 600 900">
            {/* Primary Arteries */}
            <path className="road-artery" d="M-50,220 L550,200" />
            <path className="road-artery" d="M-50,320 L550,290" />
            <path className="road-artery" d="M120,-50 L260,850" />
            <path className="road-artery" d="M250,-50 L380,850" />
            <path className="road-artery" d="M-50,120 L450,750" />
            <path className="road-artery" d="M-50,450 L550,430" />

            {/* Secondary Local Roads */}
            <path className="road-local" d="M30,-50 L120,850" />
            <path className="road-local" d="M340,-50 L440,850" />
            <path className="road-local" d="M-50,260 L450,240" />
            <path className="road-local" d="M-50,380 L550,360" />
            <path className="road-local" d="M80,80 L480,480" />
          </svg>

          {/* Street Name Labels */}
          <span
            className="street-label"
            style={{ left: 120, top: 205, transform: "rotate(-2deg)" }}
          >
            Nguyễn Đình Chiểu
          </span>
          <span
            className="street-label"
            style={{ left: 160, top: 295, transform: "rotate(-3deg)" }}
          >
            Điện Biên Phủ
          </span>
          <span
            className="street-label"
            style={{ left: 200, top: 120, transform: "rotate(79deg)" }}
          >
            Hai Bà Trưng
          </span>
          <span
            className="street-label"
            style={{ left: 295, top: 240, transform: "rotate(78deg)" }}
          >
            Nam Kỳ Khởi Nghĩa
          </span>
          <span
            className="street-label"
            style={{ left: 240, top: 480, transform: "rotate(-2deg)" }}
          >
            Hoàng Diệu · Q.4
          </span>

          {/* Live Heat Zones when Traffic Layer is ON or in Driver Hot zone */}
          {(layer === "traffic" ||
            (mode === "driver" && online && jobState === "none")) && (
            <>
              <div
                className="hot-zone"
                style={{ left: 190, top: 220, width: 170, height: 130 }}
              />
              <div
                className="hot-zone"
                style={{ left: 280, top: 310, width: 140, height: 110 }}
              />
              <span className="hot-zone-tag" style={{ left: 180, top: 200 }}>
                🔥 Nhu cầu cao +15%
              </span>
            </>
          )}

          {/* Nearby Drivers when Searching */}
          {isSearching && (
            <>
              {[
                { x: 140, y: 180, delay: "0ms" },
                { x: 260, y: 240, delay: "200ms" },
                { x: 190, y: 290, delay: "400ms" },
              ].map((d, i) => (
                <div
                  className="nearby-truck-marker"
                  key={i}
                  style={{ left: d.x, top: d.y, animationDelay: d.delay }}
                >
                  <span className="truck-pulse" />
                  <span className="truck-icon">🚚</span>
                </div>
              ))}
            </>
          )}

          {/* Live Active Trip Navigation Route */}
          {(isCustomerTracking || isDriverWorking) && (
            <svg
              aria-hidden="true"
              className="trip-route-svg"
              viewBox="0 0 600 900"
            >
              <defs>
                <linearGradient
                  id="routeGlow"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#1478d4" />
                  <stop offset="100%" stopColor="#19a96b" />
                </linearGradient>
              </defs>
              {/* Route Casing Outline */}
              <path
                className="trip-route-casing"
                d={`M${ROUTE_PICKUP.x},${ROUTE_PICKUP.y} Q240,170 ${ROUTE_DEST.x},${ROUTE_DEST.y}`}
              />
              {/* Route Active Dash Stroke */}
              <path
                className="trip-route-core"
                d={`M${ROUTE_PICKUP.x},${ROUTE_PICKUP.y} Q240,170 ${ROUTE_DEST.x},${ROUTE_DEST.y}`}
              />
            </svg>
          )}

          {/* Destination Pin Marker */}
          {(isCustomerTracking || isDriverWorking) && (
            <div
              className="dest-point-marker"
              style={{ left: ROUTE_DEST.x, top: ROUTE_DEST.y }}
            >
              <span className="dest-pin-badge">
                <i>📍</i>
              </span>
              <span className="dest-pin-label">
                {destAddr ? destAddr.split(",")[0] : "Điểm giao"}
              </span>
            </div>
          )}

          {/* Live Animated Driver Truck */}
          {(isCustomerTracking || isDriverWorking) && (
            <div
              className="live-driver-truck"
              style={{
                left: driverPos.x,
                top: driverPos.y,
                transform: `translate(-50%, -50%) rotate(${driverPos.angle}deg)`,
              }}
            >
              <span className="truck-radar-wave" />
              <div className="truck-vehicle-body">
                <span className="truck-glyph">🚛</span>
              </div>
            </div>
          )}

          {/* Pickup Pin Marker (Interactive Lift-on-Drag) */}
          <div
            className={`interactive-center-pin ${pinLifted ? "is-lifted" : ""}`}
            style={{ left: ROUTE_PICKUP.x, top: ROUTE_PICKUP.y }}
          >
            {isSearching && (
              <>
                <span className="radar-radar-ring" />
                <span className="radar-radar-ring ring-delay" />
              </>
            )}
            <span className="pin-ground-shadow" />
            <div className="pin-head">
              <span className="pin-inner-dot" />
            </div>
            {isBooking && (
              <div className="pin-callout-bubble">
                <span className="pin-callout-text">
                  {pickupAddr ? pickupAddr.split(",")[0] : "Điểm lấy hàng"}
                </span>
                <small className="pin-callout-sub">
                  Kéo bản đồ để chỉnh vị trí
                </small>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Map Tools (Controls) */}
      <div className="floating-map-controls">
        {/* Layer Switcher Button */}
        <div className="layer-control-wrap">
          <button
            aria-label="Chọn lớp bản đồ"
            className={`icon-button glass ${layerMenuOpen ? "active" : ""}`}
            onClick={() => setLayerMenuOpen((o) => !o)}
            title="Đổi lớp bản đồ"
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height={22}
              viewBox="0 0 24 24"
              width={22}
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="m12 3 9 5-9 5-9-5 9-5Z" />
              <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
            </svg>
          </button>

          {layerMenuOpen && (
            <div className="layer-dropdown glass-strong">
              <button
                className={`layer-opt ${
                  layer === "standard" ? "selected" : ""
                }`}
                onClick={() => {
                  setLayer("standard")
                  setLayerMenuOpen(false)
                }}
                type="button"
              >
                <span>🌿 Đô thị chuẩn</span>
              </button>
              <button
                className={`layer-opt ${layer === "traffic" ? "selected" : ""}`}
                onClick={() => {
                  setLayer("traffic")
                  setLayerMenuOpen(false)
                }}
                type="button"
              >
                <span>🚗 Mật độ & Nhu cầu</span>
              </button>
              <button
                className={`layer-opt ${
                  layer === "satellite" ? "selected" : ""
                }`}
                onClick={() => {
                  setLayer("satellite")
                  setLayerMenuOpen(false)
                }}
                type="button"
              >
                <span>🌙 Chế độ đêm</span>
              </button>
            </div>
          )}
        </div>

        {/* Locate / Recenter Button */}
        <button
          aria-label="Định vị về vị trí của tôi"
          className="icon-button glass locate"
          onClick={recenter}
          title="Vị trí của tôi"
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height={22}
            viewBox="0 0 24 24"
            width={22}
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>

        {/* Zoom In & Out */}
        <div className="zoom-btn-group glass">
          <button
            aria-label="Phóng to"
            onClick={handleZoomIn}
            title="Phóng to"
            type="button"
          >
            +
          </button>
          <span className="zoom-divider" />
          <button
            aria-label="Thu nhỏ"
            onClick={handleZoomOut}
            title="Thu nhỏ"
            type="button"
          >
            −
          </button>
        </div>
      </div>

      {/* Floating Hint Pill */}
      {isBooking && (
        <div className="drag-hint-pill glass">
          <span className="hint-pulse-dot" />
          <span>Kéo & thả bản đồ để chọn điểm đón</span>
        </div>
      )}

      {children}
    </div>
  )
}
