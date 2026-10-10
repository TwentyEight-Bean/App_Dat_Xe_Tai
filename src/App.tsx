import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import AccountScreen, { useAddresses } from "./account"
import {
  ChatScreen,
  CURRENT_CONV,
  MessagesScreen,
  setOrderStatus,
  startAmbient,
  useUnread,
} from "./chat"
import { runTabTransition, type TabDirection } from "./tabMotion"
import InteractiveMap from "./InteractiveMap"

type IconName = "home" | "orders" | "message" | "user" | "bell" | "pin" | "arrow" | "target" | "layers" | "chevron" | "chevron-up" | "chevron-down" | "close" | "check" | "truck" | "phone" | "star"

type IconProps = {
  name: IconName
  size?: number
  strokeWidth?: number
}

function Icon({ name, size = 20, strokeWidth = 1.8 }: IconProps) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
      </>
    ),
    orders: (
      <>
        <path d="M7 3h10v4H7zM5 5H4v16h16V5h-1" />
        <path d="M8 12h8M8 16h5" />
      </>
    ),
    message: (
      <path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.8-4A8 8 0 1 1 21 12Z" />
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.8 21a7.2 7.2 0 0 1 14.4 0" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    arrow: (
      <>
        <path d="M12 19V5" />
        <path d="m7 10 5-5 5 5" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    "chevron-up": <path d="m18 15-6-6-6 6" />,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    phone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.700c.1 1 .4 1.9.7 2.800a2 2 0 0 1-.5 2.100L8.1 9.900a16 16 0 0 0 6 6l1.3-1.300a2 2 0 0 1 2.1-.5c.9.3 1.8.600 2.8.700a2 2 0 0 1 1.7 2Z" />
    ),
    star: (
      <path d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.200L12 17l-5.6 3 1.2-6.200L3 9.500l6.3-.8z" />
    ),
    truck: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      {paths[name]}
    </svg>
  )
}

type IconButtonProps = {
  label: string
  icon: IconName
  onClick?: () => void
  badge?: boolean
  className?: string
}

function IconButton({
  label,
  icon,
  onClick,
  badge,
  className = "",
}: IconButtonProps) {
  return (
    <button
      className={`icon-button glass ${className}`}
      aria-label={label}
      onClick={onClick}
      type="button"
    >
      <Icon name={icon} />
      {badge && <span className="notification-dot" />}
    </button>
  )
}

type LocationInputProps = {
  kind: "pickup" | "destination"
  value: string
  placeholder: string
  onChange: (value: string) => void
  error?: boolean
}

function LocationInput({
  kind,
  value,
  placeholder,
  onChange,
  error,
}: LocationInputProps) {
  const isPickup = kind === "pickup"
  return (
    <label className={`location-field ${error ? "invalid" : ""}`}>
      <span
        className={`location-marker ${isPickup ? "pickup" : "destination"}`}
      >
        {isPickup ? (
          <span className="marker-dot" />
        ) : (
          <Icon name="arrow" size={15} strokeWidth={2.4} />
        )}
      </span>
      <span className="field-copy">
        <span className="field-label">
          {isPickup ? "Điểm lấy hàng" : "Điểm giao hàng"}
        </span>
        <input
          aria-label={isPickup ? "Điểm lấy hàng" : "Điểm giao hàng"}
          aria-describedby={error ? "destination-error" : undefined}
          aria-invalid={error || undefined}
          list="saved-addresses"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
      </span>
      {value && !isPickup ? (
        <button
          className="clear-button"
          aria-label="Xóa điểm giao"
          onClick={() => onChange("")}
          type="button"
        >
          <Icon name="close" size={16} />
        </button>
      ) : (
        <Icon name="chevron" size={18} />
      )}
    </label>
  )
}

type Vehicle = {
  id: string
  name: string
  detail: string
  price: string
  type: "bike" | "van" | "truck-sm" | "truck-lg"
}

const vehicles: Vehicle[] = [
  {
    id: "small",
    name: "Xe tải nhỏ",
    detail: "Đến 100kg",
    price: "89.000đ",
    type: "bike",
  },
  {
    id: "van",
    name: "Xe van",
    detail: "Đến 500kg",
    price: "149.000đ",
    type: "van",
  },
  {
    id: "500",
    name: "Tải 500kg",
    detail: "Thùng 2m",
    price: "189.000đ",
    type: "truck-sm",
  },
  {
    id: "1000",
    name: "Tải 1 tấn",
    detail: "Thùng 3m",
    price: "259.000đ",
    type: "truck-lg",
  },
]

const vehicleShapes: Record<Vehicle["type"], {
  wheels: number[]
  art: ReactNode
}> = {
  bike: {
    wheels: [15, 45],
    art: (
      <>
        <rect className="v-box" x="6" y="16" width="27" height="12" rx="2.5" />
        <path className="v-cab" d="M35 28V15.5h9.5l6.5 7.5v5z" />
        <path className="v-glass" d="M38 18h5.3l3.4 4H38z" />
      </>
    ),
  },
  van: {
    wheels: [16, 47],
    art: (
      <>
        <path
          className="v-box"
          d="M5 28V12.5Q5 9 8.5 9H36q2.5 0 4.3 1.700L51 20q2 2 2 4.500V28z"
        />
        <path className="v-glass" d="M37 12h2q1 0 1.8.7L46 18H37z" />
        <path className="v-stripe" d="M5 23h48" />
      </>
    ),
  },
  "truck-sm": {
    wheels: [14, 48],
    art: (
      <>
        <rect className="v-box" x="4" y="9" width="33" height="19" rx="2.5" />
        <path className="v-cab" d="M39 28V13.500h10l8 8.500v6z" />
        <path className="v-glass" d="M42 16.500h5.500l4.7 5H42z" />
        <path className="v-stripe" d="M4 22h33" />
      </>
    ),
  },
  "truck-lg": {
    wheels: [11, 22, 52],
    art: (
      <>
        <rect className="v-box" x="2" y="5" width="39" height="23" rx="2.5" />
        <path className="v-cab" d="M43 28V12.500h9.500L61 21.500v6.500z" />
        <path className="v-glass" d="M46 15.500h5.500l5 5.500H46z" />
        <path className="v-stripe" d="M2 21h39" />
      </>
    ),
  },
}

function VehicleGlyph({ type }: { type: Vehicle["type"] }) {
  const shape = vehicleShapes[type]
  return (
    <svg aria-hidden="true" className="vehicle-glyph" viewBox="0 0 64 38">
      <ellipse cx="32" cy="34.5" rx="27" ry="2" fill="rgba(32,50,100,0.14)" />
      {shape.art}
      <circle className="v-light" cx="59" cy="25" r="1.4" />
      {shape.wheels.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="29.5" r="4.4" className="v-tire" />
          <circle cx={cx} cy="29.5" r="1.7" className="v-hub" />
        </g>
      ))}
    </svg>
  )
}

function VehicleSelector({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (vehicle: Vehicle) => void
}) {
  return (
    <div className="vehicle-list" role="radiogroup" aria-label="Chọn loại xe">
      {vehicles.map((vehicle) => {
        const active = vehicle.id === selected
        return (
          <button
            aria-checked={active}
            className={`vehicle-option ${active ? "selected" : ""}`}
            key={vehicle.id}
            onClick={() => onSelect(vehicle)}
            role="radio"
            type="button"
          >
            <VehicleGlyph type={vehicle.type} />
            <span className="vehicle-name">{vehicle.name}</span>
            <span className="vehicle-detail">{vehicle.detail}</span>
            {active && (
              <span className="selected-check">
                <Icon name="check" size={13} strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const navItems: { label: string icon: IconName }[] = [
  { label: "Trang chủ", icon: "home" },
  { label: "Đơn hàng", icon: "orders" },
  { label: "Tin nhắn", icon: "message" },
  { label: "Tài khoản", icon: "user" },
]

function BottomNavigation({
  active,
  onChange,
}: {
  active: string
  onChange: (label: string) => void
}) {
  const index = navItems.findIndex((item) => item.label === active)
  const unread = useUnread("customer")
  const [flow, setFlow] = useState<TabDirection | null>(null)
  const flowTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (flowTimer.current) window.clearTimeout(flowTimer.current)
    },
    [],
  )

  const select = (label: string, nextIndex: number) => {
    if (nextIndex === index) return
    setFlow(nextIndex > index ? "right" : "left")
    if (flowTimer.current) window.clearTimeout(flowTimer.current)
    flowTimer.current = window.setTimeout(() => setFlow(null), 600)
    onChange(label)
  }

  return (
    <nav
      className={`bottom-nav glass glass-strong ${
        flow ? `nav-flow-${flow}` : ""
      }`}
      aria-label="Điều hướng chính"
      style={{ "--i": index } as CSSProperties}
    >
      <span className="nav-indicator" aria-hidden="true" />
      {navItems.map((item, itemIndex) => (
        <button
          className={`nav-item ${active === item.label ? "active" : ""}`}
          key={item.label}
          onClick={() => select(item.label, itemIndex)}
          type="button"
        >
          <span className="nav-icon">
            <Icon name={item.icon} size={21} />
            {item.label === "Tin nhắn" && unread > 0 && (
              <span className="message-dot" />
            )}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

type TrackPhase = "arriving" | "arrived" | "pickedup" | "delivering" | "delivered"
type Phase = "booking" | "searching" | "found" | TrackPhase

const PHASE_ORDER: Phase[] = [
  "booking",
  "searching",
  "found",
  "arriving",
  "arrived",
  "pickedup",
  "delivering",
  "delivered",
]

const PHASE_DELAY: Partial<Record<Phase, number>> = {
  searching: 5200,
  found: 4500,
  arriving: 7000,
  arrived: 4000,
  pickedup: 3500,
}

const DRIVER_PROGRESS: Partial<Record<Phase, { to: number ms: number }>> = {
  found: { to: 0.3, ms: 4500 },
  arriving: { to: 0.92, ms: 7000 },
  arrived: { to: 1, ms: 1200 },
  pickedup: { to: 0, ms: 0 },
  delivering: { to: 0.93, ms: 9000 },
  delivered: { to: 1, ms: 900 },
}

const nearbyDrivers = [
  { left: 66, top: 126 },
  { left: 282, top: 100 },
  { left: 122, top: 172 },
  { left: 300, top: 238 },
  { left: 236, top: 128 },
]

const ROUTE_PATH = "M28 148 C78 150 118 184 160 194 S192 198 205 198"
const ROUTE_B = "M205 198 C226 190 246 176 258 158 S282 126 292 112"

function DriverMarker({
  path,
  to,
  ms,
  hidden,
}: {
  path: string
  to: number
  ms: number
  hidden?: boolean
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(to))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [to])
  return (
    <span
      className="driver-marker"
      style={{
        offsetPath: `path("${path}")`,
        offsetDistance: `${shown * 100}%`,
        opacity: hidden ? 0 : 1,
        transition: `offset-distance ${ms}ms linear, opacity 400ms ease ${
          hidden ? 700 : 0
        }ms`,
      }}
    >
      <Icon name="truck" size={15} strokeWidth={2} />
    </span>
  )
}

function MapCanvas({ phase }: { phase: Phase }) {
  const onPickupRoute =
    phase === "found" || phase === "arriving" || phase === "arrived"
  const onDeliveryRoute =
    phase === "pickedup" || phase === "delivering" || phase === "delivered"
  const progress = DRIVER_PROGRESS[phase]
  const delivered = phase === "delivered"

  return (
    <div
      className="map"
      aria-label="Bản đồ khu vực Thành phố Hồ Chí Minh"
      role="img"
    >
      <div className="map-grid" />
      <span className="park park-one">Công viên</span>
      <span className="park park-two" />
      <span className="water" />
      <span className="park park-three" />
      <span className="park park-four" />
      <span className="water water-two" />
      <span className="road road-five" />
      <span className="road road-six" />
      <span className="road road-one" />
      <span className="road road-two" />
      <span className="road road-three" />
      <span className="road road-four" />
      <span className="road-label label-one">Nguyễn Đình Chiểu</span>
      <span className="road-label label-two">Hai Bà Trưng</span>
      <span className="district">QUẬN 3</span>

      {(onPickupRoute || onDeliveryRoute) && (
        <svg
          aria-hidden="true"
          className="route-svg"
          key={onPickupRoute ? "a" : "b"}
          viewBox="0 0 390 844"
          preserveAspectRatio="xMinYMin meet"
        >
          <path
            className="route-casing"
            d={onPickupRoute ? ROUTE_PATH : ROUTE_B}
          />
          <path
            className={`route-stroke ${onDeliveryRoute ? "delivery" : ""}`}
            d={onPickupRoute ? ROUTE_PATH : ROUTE_B}
            pathLength={1}
          />
        </svg>
      )}

      {onDeliveryRoute && (
        <span className={`dest-marker ${delivered ? "done" : ""}`}>
          <span className="dest-pin">
            <Icon
              name={delivered ? "check" : "arrow"}
              size={15}
              strokeWidth={delivered ? 3 : 2.4}
            />
          </span>
          <span className="dest-label">
            {delivered ? "Đã giao" : "Điểm giao"}
          </span>
        </span>
      )}

      {progress && (onPickupRoute || onDeliveryRoute) && (
        <DriverMarker
          hidden={delivered}
          key={onPickupRoute ? "a" : "b"}
          ms={progress.ms}
          path={onPickupRoute ? ROUTE_PATH : ROUTE_B}
          to={progress.to}
        />
      )}

      {phase === "searching" &&
        nearbyDrivers.map((d, i) => (
          <span
            className="nearby-driver"
            key={i}
            style={{
              left: d.left,
              top: d.top,
              animationDelay: `${i * 160}ms, ${i * 420}ms`,
            }}
          >
            <Icon name="truck" size={13} strokeWidth={2.1} />
          </span>
        ))}

      <span className={`map-pin ${onDeliveryRoute ? "done" : ""}`}>
        {phase === "searching" && (
          <>
            <span className="search-ring" />
            <span className="search-ring ring-two" />
          </>
        )}
        {phase === "arrived" && <span className="search-ring calm-ring" />}
        <span className="pin-pulse" />
        <span className="pin-core" />
      </span>
    </div>
  )
}

function SheetHandle({ onAdvance }: { onAdvance?: () => void }) {
  if (!onAdvance) return <div className="sheet-handle" />
  return (
    <button
      aria-label="Chuyển sang bước tiếp theo (demo)"
      className="sheet-handle-btn"
      onClick={onAdvance}
      type="button"
    >
      <span className="sheet-handle" />
    </button>
  )
}

function RouteSummary({
  pickup,
  destination,
}: {
  pickup: string
  destination: string
}) {
  return (
    <div className="route-summary">
      <span className="route-summary-line" />
      <div className="route-row">
        <span className="location-marker pickup">
          <span className="marker-dot" />
        </span>
        <span>{pickup}</span>
      </div>
      <div className="route-row">
        <span className="location-marker destination">
          <Icon name="arrow" size={15} strokeWidth={2.4} />
        </span>
        <span>{destination}</span>
      </div>
    </div>
  )
}

function SearchingSheet({
  pickup,
  destination,
  vehicle,
  onCancel,
}: {
  pickup: string
  destination: string
  vehicle: Vehicle
  onCancel: () => void
}) {
  return (
    <section className="booking-sheet phase-sheet" aria-live="polite">
      <div className="sheet-handle" />
      <div className="phase-heading">
        <span className="search-badge">
          <Icon name="truck" size={22} />
        </span>
        <div>
          <h1>Tìm tài xế gần bạn</h1>
          <p className="phase-sub">
            Đang kết nối với tài xế phù hợp
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </p>
        </div>
      </div>

      <div className="summary-card">
        <RouteSummary destination={destination} pickup={pickup} />
        <div className="summary-vehicle">
          <VehicleGlyph type={vehicle.type} />
          <span className="summary-vehicle-copy">
            <strong>{vehicle.name}</strong>
            <small>{vehicle.detail}</small>
          </span>
          <span className="summary-price">
            <small>Giá ước tính</small>
            <strong>{vehicle.price}</strong>
          </span>
        </div>
      </div>

      <button className="secondary-button" onClick={onCancel} type="button">
        Hủy tìm tài xế
      </button>
    </section>
  )
}

function FoundSheet({
  pickup,
  destination,
  vehicle,
  onCancel,
  onAdvance,
  onMessage,
}: {
  pickup: string
  destination: string
  vehicle: Vehicle
  onCancel: () => void
  onAdvance: () => void
  onMessage: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="booking-sheet phase-sheet" aria-live="polite">
      <SheetHandle onAdvance={onAdvance} />
      <span className="status-chip found-chip">
        <span className="found-check">
          <Icon name="check" size={10} strokeWidth={3.4} />
        </span>
        Đã tìm thấy tài xế
      </span>
      <h1>Anh Minh đang đến chỗ bạn</h1>
      <p className="phase-sub eta-line">
        Khoảng <strong>4 phút</strong> nữa
      </p>

      <div className="driver-card">
        <div className="driver-top">
          <span className="driver-avatar" aria-hidden="true">
            NM
            <span className="driver-online" />
          </span>
          <span className="driver-id">
            <strong>Nguyễn Văn Minh</strong>
            <span className="driver-rating">
              <span className="star">
                <Icon name="star" size={12} strokeWidth={1.6} />
              </span>
              4,9 <i>· 1.284 chuyến</i>
            </span>
          </span>
          <span className="eta-badge">
            <strong>4</strong>
            <small>phút</small>
          </span>
        </div>
        <div className="driver-vehicle">
          <VehicleGlyph type={vehicle.type} />
          <span className="summary-vehicle-copy">
            <strong>{vehicle.name}</strong>
            <small>Trắng · Đã xác minh</small>
          </span>
          <span className="plate">51D-482.15</span>
        </div>
        <div className="driver-actions">
          <button className="primary-button compact" type="button">
            <Icon name="phone" size={18} />
            <span>Gọi</span>
          </button>
          <button
            className="secondary-button compact"
            onClick={onMessage}
            type="button"
          >
            <Icon name="message" size={18} />
            <span>Nhắn tin</span>
          </button>
        </div>
      </div>

      <div className={`details-panel ${open ? "open" : ""}`}>
        <button
          aria-expanded={open}
          className="details-toggle"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          <span>
            <strong>Chi tiết đơn hàng</strong>
            <small>
              {vehicle.name} · {vehicle.price}
            </small>
          </span>
          <span className="details-chevron">
            <Icon name="chevron" size={18} />
          </span>
        </button>
        {open && (
          <div className="details-body">
            <RouteSummary destination={destination} pickup={pickup} />
            <button
              className="text-button cancel-link"
              onClick={onCancel}
              type="button"
            >
              Hủy chuyến
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

const trackInfo: Record<TrackPhase, {
  title: string
  message: string
  eta?: string
  icon: IconName
  calm?: boolean
}> = {
  arriving: {
    title: "Tài xế đang đến",
    message: "Anh Minh cách bạn khoảng 1,2 km",
    eta: "3",
    icon: "truck",
  },
  arrived: {
    title: "Tài xế đã đến",
    message: "Tài xế đang chờ tại điểm lấy hàng",
    icon: "pin",
    calm: true,
  },
  pickedup: {
    title: "Đã nhận hàng",
    message: "Đơn hàng đang được vận chuyển",
    eta: "15",
    icon: "check",
  },
  delivering: {
    title: "Đang giao hàng",
    message: "Cách điểm giao 2,4 km · dự kiến 10:42",
    eta: "8",
    icon: "truck",
  },
  delivered: {
    title: "Giao hàng thành công",
    message: "Đơn hàng đã đến điểm giao",
    icon: "check",
    calm: true,
  },
}

const stepLabels = [
  "Đã đặt",
  "Tài xế nhận",
  "Đã lấy hàng",
  "Đang giao",
  "Đã giao",
]

function OrderProgress({ current }: { current: number }) {
  return (
    <ol className="stepper" aria-label="Tiến trình đơn hàng">
      {stepLabels.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo"
        return (
          <li
            aria-current={state === "current" ? "step" : undefined}
            className={state}
            key={label}
          >
            <span className="step-dot">
              {state === "done" && (
                <Icon name="check" size={10} strokeWidth={3.4} />
              )}
              {state === "current" && <span className="step-core" />}
            </span>
            <span className="step-label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function TrackingSheet({
  phase,
  pickup,
  destination,
  vehicle,
  onAdvance,
  onHome,
  onViewOrders,
  onMessage,
}: {
  phase: TrackPhase
  pickup: string
  destination: string
  vehicle: Vehicle
  onAdvance: () => void
  onHome: () => void
  onViewOrders: () => void
  onMessage: () => void
}) {
  const info = trackInfo[phase]
  const delivered = phase === "delivered"
  const toPickup = phase === "arriving" || phase === "arrived"
  const currentStep = delivered ? 5 : toPickup ? 2 : 3
  const [rating, setRating] = useState(0)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <section
      className="booking-sheet phase-sheet tracking-sheet"
      aria-live="polite"
    >
      <SheetHandle onAdvance={onAdvance} />

      <div className={`status-head ${info.calm ? "calm" : ""}`} key={phase}>
        <span className="status-badge">
          <Icon
            name={info.icon}
            size={22}
            strokeWidth={info.icon === "check" ? 2.6 : 1.8}
          />
        </span>
        <div className="status-copy">
          <h1>{info.title}</h1>
          <p className="phase-sub">{info.message}</p>
        </div>
        {info.eta && (
          <span className="eta-badge">
            <strong>{info.eta}</strong>
            <small>phút</small>
          </span>
        )}
      </div>

      <OrderProgress current={currentStep} />

      {!delivered && (
        <>
          <div className="track-driver">
            <span className="driver-avatar small" aria-hidden="true">
              NM
              <span className="driver-online" />
            </span>
            <span className="driver-id">
              <strong>Anh Minh</strong>
              <span className="driver-rating">
                <span className="star">
                  <Icon name="star" size={12} strokeWidth={1.6} />
                </span>
                4,9 <i>· 51D-482.15</i>
              </span>
            </span>
            <button
              aria-label="Nhắn tin cho tài xế"
              className="round-action"
              onClick={onMessage}
              type="button"
            >
              <Icon name="message" size={19} />
            </button>
            <button
              aria-label="Gọi tài xế"
              className="round-action call"
              type="button"
            >
              <Icon name="phone" size={19} />
            </button>
          </div>

          <div className="where-row" key={toPickup ? "pickup" : "dest"}>
            <span
              className={`location-marker ${
                toPickup ? "pickup" : "destination"
              }`}
            >
              {toPickup ? (
                <span className="marker-dot" />
              ) : (
                <Icon name="arrow" size={15} strokeWidth={2.4} />
              )}
            </span>
            <span className="where-copy">
              <small>{toPickup ? "Điểm lấy hàng" : "Điểm giao hàng"}</small>
              <strong>{toPickup ? pickup : destination}</strong>
            </span>
          </div>

          {phase === "delivering" && (
            <button
              className="primary-button delivery-complete-action"
              onClick={() => setConfirmOpen(true)}
              type="button"
            >
              <Icon name="check" size={19} strokeWidth={2.6} />
              <span>XÁC NHẬN ĐÃ GIAO</span>
            </button>
          )}
        </>
      )}

      {delivered && (
        <>
          <div className="summary-card delivered-card">
            <RouteSummary destination={destination} pickup={pickup} />
            <div className="summary-vehicle">
              <VehicleGlyph type={vehicle.type} />
              <span className="summary-vehicle-copy">
                <strong>{vehicle.name}</strong>
                <small>Anh Minh · 51D-482.15</small>
              </span>
              <span className="summary-price">
                <small>Thành tiền</small>
                <strong>{vehicle.price}</strong>
              </span>
            </div>
            <div className="trip-stats">
              <span>
                <small>Hoàn thành</small>
                <strong>10:46</strong>
              </span>
              <span>
                <small>Thời gian</small>
                <strong>24 phút</strong>
              </span>
              <span>
                <small>Quãng đường</small>
                <strong>6,8 km</strong>
              </span>
            </div>
          </div>

          {ratingOpen && !rating ? (
            <div className="rate-panel">
              <strong>Bạn thấy chuyến đi thế nào?</strong>
              <div
                className="rate-stars"
                role="radiogroup"
                aria-label="Đánh giá tài xế"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    aria-checked={rating === n}
                    aria-label={`${n} sao`}
                    className={n <= rating ? "on" : ""}
                    key={n}
                    onClick={() => setRating(n)}
                    role="radio"
                    type="button"
                  >
                    <span className="star">
                      <Icon name="star" size={28} strokeWidth={1.6} />
                    </span>
                  </button>
                ))}
              </div>
              <button
                className="secondary-button"
                onClick={onHome}
                type="button"
              >
                Về trang chủ
              </button>
            </div>
          ) : rating ? (
            <div className="delivered-actions">
              <div className="rating-thanks">
                <Icon name="check" size={18} strokeWidth={2.8} />
                <strong>Cảm ơn bạn đã đánh giá!</strong>
              </div>
              <button className="primary-button" onClick={onHome} type="button">
                VỀ TRANG CHỦ
              </button>
              <button
                className="secondary-button"
                onClick={onViewOrders}
                type="button"
              >
                Xem chi tiết đơn
              </button>
            </div>
          ) : (
            <div className="delivered-actions">
              <button
                className="primary-button"
                onClick={() => setRatingOpen(true)}
                type="button"
              >
                <Icon name="star" size={18} />
                <span>Đánh giá tài xế</span>
              </button>
              <button
                className="secondary-button"
                onClick={onHome}
                type="button"
              >
                Về trang chủ
              </button>
            </div>
          )}
        </>
      )}

      {confirmOpen && (
        <div className="delivery-confirm-layer" role="presentation">
          <div
            aria-describedby="delivery-confirm-description"
            aria-labelledby="delivery-confirm-title"
            aria-modal="true"
            className="delivery-confirm"
            role="dialog"
          >
            <span className="delivery-confirm-icon">
              <Icon name="check" size={22} strokeWidth={2.6} />
            </span>
            <div>
              <h2 id="delivery-confirm-title">Xác nhận đã giao hàng?</h2>
              <p id="delivery-confirm-description">
                Đơn hàng sẽ được đánh dấu là hoàn thành.
              </p>
            </div>
            <div className="delivery-confirm-actions">
              <button
                className="secondary-button compact"
                onClick={() => setConfirmOpen(false)}
                type="button"
              >
                Chưa
              </button>
              <button
                className="primary-button compact"
                onClick={() => {
                  setConfirmOpen(false)
                  onAdvance()
                }}
                type="button"
              >
                Đã giao
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const trackPhases: Phase[] = [
  "arriving",
  "arrived",
  "pickedup",
  "delivering",
  "delivered",
]

type OrderStatus = "active" | "completed" | "cancelled"
type Order = {
  id: string
  status: OrderStatus
  created: string
  finished?: string
  pickup: string
  destination: string
  vehicleId: string
  transport: number
  service: number
  distance: string
  duration: string
  driver?: { name: string initials: string rating: string plate: string }
  rated?: number
}

const orders: Order[] = [
  {
    id: "#FD240918",
    status: "active",
    created: "Hôm nay, 10:12",
    pickup: "21 Nguyễn Đình Chiểu, Q.1",
    destination: "128 Hoàng Diệu, Q.4",
    vehicleId: "van",
    transport: 134000,
    service: 15000,
    distance: "6,4 km",
    duration: "28 phút",
    driver: {
      name: "Anh Minh",
      initials: "NM",
      rating: "4,9",
      plate: "51D-482.15",
    },
  },
  {
    id: "#FD240917",
    status: "completed",
    created: "Hôm qua, 15:30",
    finished: "Hôm qua, 16:12",
    pickup: "Kho Tân Bình, 45 Cộng Hòa",
    destination: "88 Lê Văn Việt, TP. Thủ Đức",
    vehicleId: "1000",
    transport: 238000,
    service: 21000,
    distance: "14,2 km",
    duration: "42 phút",
    driver: {
      name: "Chú Hùng",
      initials: "TH",
      rating: "4,8",
      plate: "51C-905.37",
    },
  },
  {
    id: "#FD240915",
    status: "completed",
    created: "12/09, 09:05",
    finished: "12/09, 09:41",
    pickup: "12 Lý Tự Trọng, Q.1",
    destination: "56 Phan Xích Long, Phú Nhuận",
    vehicleId: "small",
    transport: 76000,
    service: 13000,
    distance: "5,1 km",
    duration: "36 phút",
    driver: {
      name: "Anh Tuấn",
      initials: "LT",
      rating: "4,9",
      plate: "59C-217.64",
    },
    rated: 5,
  },
  {
    id: "#FD240912",
    status: "cancelled",
    created: "08/09, 18:20",
    pickup: "99 Võ Văn Tần, Q.3",
    destination: "34 Nguyễn Thị Minh Khai, Q.1",
    vehicleId: "500",
    transport: 0,
    service: 0,
    distance: "2,8 km",
    duration: "—",
  },
  {
    id: "#FD240907",
    status: "completed",
    created: "03/09, 13:48",
    finished: "03/09, 14:35",
    pickup: "Chợ Bến Thành, Q.1",
    destination: "210 Quang Trung, Gò Vấp",
    vehicleId: "500",
    transport: 168000,
    service: 21000,
    distance: "9,7 km",
    duration: "47 phút",
    driver: {
      name: "Anh Khoa",
      initials: "ĐK",
      rating: "4,7",
      plate: "51D-338.90",
    },
  },
]

const statusMeta: Record<OrderStatus, { label: string tone: string }> = {
  active: { label: "Đang giao", tone: "active" },
  completed: { label: "Hoàn thành", tone: "completed" },
  cancelled: { label: "Đã hủy", tone: "cancelled" },
}

const money = (n: number) => `${n.toLocaleString("vi-VN")}đ`
const orderVehicle = (o: Order) =>
  vehicles.find((v) => v.id === o.vehicleId) ?? vehicles[1]
const orderTotal = (o: Order) => money(o.transport + o.service)

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`order-status ${statusMeta[status].tone}`}>
      <span />
      {statusMeta[status].label}
    </span>
  )
}

function OrderRoute({ order }: { order: Order }) {
  return <RouteSummary destination={order.destination} pickup={order.pickup} />
}

const filters = ["Tất cả", "Đang giao", "Hoàn thành", "Đã hủy"] as const
const filterStatus: Record<string, OrderStatus | undefined> = {
  "Đang giao": "active",
  "Hoàn thành": "completed",
  "Đã hủy": "cancelled",
}

function OrderHistory({
  onOpen,
  onTrack,
  onReorder,
}: {
  onOpen: (o: Order) => void
  onTrack: (o: Order) => void
  onReorder: (o: Order) => void
}) {
  const [filter, setFilter] = useState<string>("Tất cả")
  const list = orders.filter(
    (o) => !filterStatus[filter] || o.status === filterStatus[filter],
  )
  return (
    <section className="orders-screen">
      <header className="orders-head">
        <h1>Đơn hàng của bạn</h1>
        <IconButton badge icon="bell" label="Thông báo" />
      </header>
      <div className="filter-tabs" role="tablist">
        {filters.map((f) => (
          <button
            aria-selected={filter === f}
            className={filter === f ? "on" : ""}
            key={f}
            onClick={() => setFilter(f)}
            role="tab"
            type="button"
          >
            {f}
          </button>
        ))}
      </div>
      <div className="order-list" key={filter}>
        {list.length === 0 && (
          <p className="orders-empty">Chưa có đơn hàng nào.</p>
        )}
        {list.map((o) => {
          const v = orderVehicle(o)
          return (
            <article className="order-card" key={o.id}>
              <button
                className="order-main"
                onClick={() => onOpen(o)}
                type="button"
              >
                <span className="order-top">
                  <OrderStatusBadge status={o.status} />
                  <small>{o.created}</small>
                </span>
                <OrderRoute order={o} />
                <span className="order-foot">
                  <span className="order-vehicle">
                    <VehicleGlyph type={v.type} />
                    <span>{v.name}</span>
                  </span>
                  <strong>{orderTotal(o)}</strong>
                </span>
              </button>
              {o.status === "active" && (
                <button
                  className="order-action primary"
                  onClick={() => onTrack(o)}
                  type="button"
                >
                  Xem hành trình
                  <Icon name="chevron" size={16} />
                </button>
              )}
              {o.status === "completed" && (
                <button
                  className="order-action"
                  onClick={() => onReorder(o)}
                  type="button"
                >
                  Đặt lại
                </button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function OrderDetail({
  order,
  rating,
  onBack,
  onTrack,
  onReorder,
  onRate,
  onSupport,
}: {
  order: Order
  rating?: number
  onBack: () => void
  onTrack: (o: Order) => void
  onReorder: (o: Order) => void
  onRate: (value: number) => void
  onSupport: (o: Order) => void
}) {
  const v = orderVehicle(order)
  const [rateOpen, setRateOpen] = useState(false)
  const [draft, setDraft] = useState(0)
  const total = order.transport + order.service
  return (
    <section className="orders-screen detail">
      <header className="orders-head">
        <button
          aria-label="Quay lại"
          className="icon-button back-button"
          onClick={onBack}
          type="button"
        >
          <span style={{ display: "grid", transform: "rotate(180deg)" }}>
            <Icon name="chevron" size={20} />
          </span>
        </button>
        <h1>Chi tiết đơn</h1>
        <span className="head-spacer" />
      </header>

      <div className="detail-card detail-hero">
        <span className="order-top">
          <OrderStatusBadge status={order.status} />
          <strong>{order.id}</strong>
        </span>
        <dl className="detail-times">
          <div>
            <dt>Tạo lúc</dt>
            <dd>{order.created}</dd>
          </div>
          <div>
            <dt>
              {order.status === "cancelled" ? "Trạng thái" : "Hoàn thành"}
            </dt>
            <dd>
              {order.status === "completed"
                ? order.finished
                : order.status === "active"
                  ? "Đang thực hiện"
                  : "Đã hủy"}
            </dd>
          </div>
        </dl>
      </div>

      <h2>Lộ trình</h2>
      <div className="detail-card">
        <OrderRoute order={order} />
        <div className="summary-vehicle detail-vehicle">
          <VehicleGlyph type={v.type} />
          <span className="summary-vehicle-copy">
            <strong>{v.name}</strong>
            <small>{v.detail}</small>
          </span>
        </div>
      </div>

      {order.driver && (
        <>
          <h2>Tài xế</h2>
          <div className="detail-card driver-row">
            <span className="driver-avatar small" aria-hidden="true">
              {order.driver.initials}
            </span>
            <span className="driver-id">
              <strong>{order.driver.name}</strong>
              <span className="driver-rating">
                <span className="star">
                  <Icon name="star" size={12} strokeWidth={1.6} />
                </span>
                {order.driver.rating} <i>· {v.name}</i>
              </span>
            </span>
            <span className="plate">{order.driver.plate}</span>
          </div>
        </>
      )}

      <h2>Chuyến đi</h2>
      <div className="detail-card trip-stats two">
        <span>
          <small>Quãng đường</small>
          <strong>{order.distance}</strong>
        </span>
        <span>
          <small>Thời gian</small>
          <strong>{order.duration}</strong>
        </span>
      </div>

      <h2>Thanh toán</h2>
      <div className="detail-card pay-card">
        {order.status === "cancelled" ? (
          <div className="pay-row">
            <span>Phí hủy</span>
            <strong>0đ</strong>
          </div>
        ) : (
          <>
            <div className="pay-row">
              <span>Cước vận chuyển</span>
              <span>{money(order.transport)}</span>
            </div>
            <div className="pay-row">
              <span>Phí dịch vụ</span>
              <span>{money(order.service)}</span>
            </div>
            <div className="pay-row total">
              <span>Tổng cộng</span>
              <strong>{money(total)}</strong>
            </div>
          </>
        )}
      </div>

      <div className="detail-actions">
        {order.status === "active" && (
          <button
            className="primary-button"
            onClick={() => onTrack(order)}
            type="button"
          >
            <span>Xem hành trình</span>
            <span className="button-icon">
              <Icon name="chevron" size={20} />
            </span>
          </button>
        )}
        {order.status === "completed" && (
          <>
            {rating ? (
              <div className="detail-card rated-card">
                <span>Đánh giá của bạn</span>
                <span
                  className="rate-stars static"
                  aria-label={`${rating} sao`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      className={`star ${n <= rating ? "on" : "off"}`}
                      key={n}
                    >
                      <Icon name="star" size={18} strokeWidth={1.6} />
                    </span>
                  ))}
                </span>
              </div>
            ) : rateOpen ? (
              <div className="detail-card rated-card open">
                <span>Bạn thấy {order.driver?.name} thế nào?</span>
                <span className="rate-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      aria-label={`${n} sao`}
                      className={n <= draft ? "on" : ""}
                      key={n}
                      onClick={() => {
                        setDraft(n)
                        onRate(n)
                      }}
                      type="button"
                    >
                      <span className="star">
                        <Icon name="star" size={24} strokeWidth={1.6} />
                      </span>
                    </button>
                  ))}
                </span>
              </div>
            ) : null}
            <button
              className="primary-button"
              onClick={() => onReorder(order)}
              type="button"
            >
              <span>Đặt lại chuyến này</span>
              <span className="button-icon">
                <Icon name="chevron" size={20} />
              </span>
            </button>
            {!rating && !rateOpen && (
              <button
                className="secondary-button"
                onClick={() => setRateOpen(true)}
                type="button"
              >
                Đánh giá tài xế
              </button>
            )}
          </>
        )}
        {order.status === "cancelled" && (
          <button
            className="primary-button"
            onClick={() => onReorder(order)}
            type="button"
          >
            <span>Đặt lại chuyến này</span>
            <span className="button-icon">
              <Icon name="chevron" size={20} />
            </span>
          </button>
        )}
        <button
          className="text-button support-link"
          onClick={() => onSupport(order)}
          type="button"
        >
          Cần hỗ trợ về đơn này?
        </button>
      </div>
    </section>
  )
}

export default function App() {
  const phoneRef = useRef<HTMLElement>(null)
  const [pickup, setPickup] = useState("Vị trí hiện tại · 21 Nguyễn Đình Chiểu")
  const [destination, setDestination] = useState("")
  const [selected, setSelected] = useState("van")
  const [price, setPrice] = useState("149.000đ")
  const [phase, setPhase] = useState<Phase>("booking")
  const [destinationError, setDestinationError] = useState(false)
  const [tab, setTab] = useState("Trang chủ")
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [openOrder, setOpenOrder] = useState<Order | null>(null)
  const [ratings, setRatings] = useState<Record<string, number>>({
    "#FD240915": 5,
  })

  const [chatId, setChatId] = useState<string | null>(null)

  const [supportOrder, setSupportOrder] = useState<string | null>(null)
  const [navHidden, setNavHidden] = useState(false)
  const savedAddresses = useAddresses()

  const openSupport = (o: Order) => {
    setOpenOrder(null)
    setSupportOrder(o.id)
    setTab("Tài khoản")
  }
  const backToOrder = () => {
    const o = orders.find((x) => x.id === supportOrder) ?? null
    setSupportOrder(null)
    setTab("Đơn hàng")
    setOpenOrder(o)
  }
  const useAddress = (address: string) => {
    setDestination(address)
    setDestinationError(false)
    setSheetExpanded(true)
    changeTab("Trang chủ")
  }

  const changeTab = (label: string) => {
    setTab(label)
    setSupportOrder(null)
    setOpenOrder(null)
  }
  const navigateTab = (label: string) => {
    const currentIndex = navItems.findIndex((item) => item.label === tab)
    const nextIndex = navItems.findIndex((item) => item.label === label)
    const update = () => {
      setTab(label)
      setSupportOrder(null)
      setOpenOrder(null)
    }
    if (currentIndex < 0 || nextIndex < 0 || currentIndex === nextIndex) {
      update()
      return
    }
    runTabTransition(
      phoneRef.current,
      nextIndex > currentIndex ? "right" : "left",
      update,
    )
  }
  const trackActive = (o: Order) => {
    setPickup(o.pickup)
    setDestination(o.destination)
    setSelected(o.vehicleId)
    setPhase("delivering")
    changeTab("Trang chủ")
  }
  const reorder = (o: Order) => {
    setPickup(o.pickup)
    setDestination(o.destination)
    setSelected(o.vehicleId)
    setPrice(orderVehicle(o).price)
    setDestinationError(false)
    setPhase("booking")
    setSheetExpanded(true)
    changeTab("Trang chủ")
  }

  const viewTrip = () => {
    setChatId(null)
    if (!trackPhases.includes(phase)) {
      setPickup("21 Nguyễn Đình Chiểu, Q.1")
      setDestination("128 Hoàng Diệu, Q.4")
      setSelected("van")
      setPhase("delivering")
    }
    changeTab("Trang chủ")
  }

  useEffect(() => {
    startAmbient()
  }, [])

  useEffect(() => {
    if (phase === "delivered") setOrderStatus(CURRENT_CONV, "completed")
  }, [phase])

  const advance = () =>
    setPhase(
      (current) =>
        PHASE_ORDER[(PHASE_ORDER.indexOf(current) + 1) % PHASE_ORDER.length],
    )

  useEffect(() => {
    const delay = PHASE_DELAY[phase]
    if (!delay) return
    const timer = window.setTimeout(advance, delay)
    return () => window.clearTimeout(timer)
  }, [phase])

  const vehicle = vehicles.find((v) => v.id === selected) ?? vehicles[1]

  const handleVehicleSelect = (v: Vehicle) => {
    setSelected(v.id)
    setPrice(v.price)
  }

  const handleBook = () => {
    if (!destination.trim()) {
      setDestinationError(true)
      document
        .querySelector<HTMLInputElement>('[aria-label="Điểm giao hàng"]')
        ?.focus()
      return
    }
    setPhase("searching")
  }

  const handleCancel = () => {
    setPhase("booking")
    setSheetExpanded(false)
  }
  const returnHome = () => {
    setPhase("booking")
    setSheetExpanded(false)
    changeTab("Trang chủ")
  }
  const viewCompletedOrder = () => {
    changeTab("Đơn hàng")
    setOpenOrder({
      ...orders[0],
      status: "completed",
      finished: "Hôm nay, 10:46",
    })
  }

  const pillCopy: { text: string badge: string } = {
    booking: { text: "Tài xế đang hoạt động gần bạn", badge: "18" },
    searching: { text: "Đang tìm quanh bạn", badge: "18 xe" },
    found: { text: "Anh Minh đang di chuyển", badge: "4 phút" },
    arriving: { text: "Tài xế đang đến", badge: "3 phút" },
    arrived: { text: "Tài xế đã đến", badge: "Tại điểm lấy" },
    pickedup: { text: "Đã nhận hàng", badge: "15 phút" },
    delivering: { text: "Đang giao hàng", badge: "8 phút" },
    delivered: { text: "Giao hàng thành công", badge: "10:46" },
  }[phase]

  const summaryDestination = destination.trim()

  return (
    <main className="app-shell">
      <section className="phone-frame" ref={phoneRef}>
        <div className="tab-content-surface">
          {tab === "Trang chủ" && (
            <div className="tab-screen home-screen" key="home">
              <div className="map-area">
                <InteractiveMap
                  destAddr={destination}
                  mode="customer"
                  onPickupChange={(addr) => setPickup(addr)}
                  phase={phase}
                  pickupAddr={pickup}
                />
                <header className="top-bar">
                  <div
                    className="greeting"
                    onClick={() => navigateTab("Tài khoản")}
                    style={{ cursor: "pointer" }}
                    title="Xem tài khoản & Đăng nhập OTP"
                  >
                    <span className="avatar" aria-hidden="true">
                      MA
                    </span>
                    <span>
                      <span className="eyebrow">Chào buổi sáng,</span>
                      <strong>Minh Anh</strong>
                    </span>
                  </div>
                  <IconButton badge icon="bell" label="Thông báo" />
                </header>

                <div className="location-pill glass" key={phase}>
                  <span className="active-pulse" />
                  <span>{pillCopy.text}</span>
                  <strong>{pillCopy.badge}</strong>
                </div>
              </div>

              {phase === "booking" &&
                (!sheetExpanded ? (
                  <div
                    className="booking-peek-card glass-liquid"
                    onClick={() => setSheetExpanded(true)}
                    role="button"
                    tabIndex={0}
                    aria-label="Kéo lên để đặt xe"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setSheetExpanded(true)
                      }
                    }}
                  >
                    <div className="sheet-handle" />
                    <div className="peek-content">
                      <div className="peek-icon-wrap">
                        <Icon name="truck" size={22} />
                      </div>
                      <div className="peek-text">
                        <strong>
                          {destination.trim()
                            ? destination
                            : "Bạn muốn giao hàng đi đâu?"}
                        </strong>
                        <small>
                          Chạm hoặc kéo lên để chọn loại xe & đặt chuyến
                        </small>
                      </div>
                      <button
                        className="peek-expand-btn glass"
                        type="button"
                        aria-label="Mở bảng đặt xe"
                      >
                        <Icon name="chevron-up" size={18} strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <section
                    className="booking-sheet phase-sheet glass-liquid expanded"
                    key="booking"
                  >
                    <div
                      className="sheet-handle"
                      onClick={() => setSheetExpanded(false)}
                      role="button"
                      tabIndex={0}
                      aria-label="Thu gọn bảng đặt xe"
                    />
                    <div className="booking-heading">
                      <div>
                        <span className="status-chip">
                          <span />
                          Giao nhanh trong ngày
                        </span>
                        <h1>Bạn muốn giao hàng đi đâu?</h1>
                      </div>
                      <button
                        className="sheet-collapse-btn glass"
                        onClick={() => setSheetExpanded(false)}
                        type="button"
                        aria-label="Thu gọn bản đồ"
                      >
                        <Icon name="chevron-down" size={18} strokeWidth={2.4} />
                      </button>
                    </div>

                    <div className="location-card">
                      <span className="route-line" />
                      <LocationInput
                        kind="pickup"
                        onChange={setPickup}
                        placeholder="Chọn điểm lấy hàng"
                        value={pickup}
                      />
                      <div className="field-divider" />
                      <LocationInput
                        error={destinationError}
                        kind="destination"
                        onChange={(value) => {
                          setDestination(value)
                          if (value.trim()) setDestinationError(false)
                        }}
                        placeholder="Nhập địa chỉ giao hàng"
                        value={destination}
                      />
                    </div>
                    {destinationError && (
                      <p
                        className="field-error"
                        id="destination-error"
                        role="alert"
                      >
                        Vui lòng nhập điểm giao hàng
                      </p>
                    )}

                    <div className="section-title-row">
                      <h2>Chọn loại xe</h2>
                      <button className="text-button" type="button">
                        Xem chi tiết
                      </button>
                    </div>
                    <VehicleSelector
                      onSelect={handleVehicleSelect}
                      selected={selected}
                    />

                    <div className="price-row">
                      <span>
                        <small>Giá ước tính</small>
                        <strong key={price}>{price}</strong>
                      </span>
                      <span className="price-note">Đã gồm phí dịch vụ</span>
                    </div>

                    <button
                      className="primary-button"
                      onClick={handleBook}
                      type="button"
                    >
                      <span>Tìm tài xế</span>
                      <span className="button-icon">
                        <Icon name="chevron" size={20} />
                      </span>
                    </button>
                  </section>
                ))}

              {phase === "searching" && (
                <SearchingSheet
                  destination={summaryDestination}
                  key="searching"
                  onCancel={handleCancel}
                  pickup={pickup}
                  vehicle={vehicle}
                />
              )}

              {phase === "found" && (
                <FoundSheet
                  destination={summaryDestination}
                  key="found"
                  onAdvance={advance}
                  onCancel={handleCancel}
                  onMessage={() => setChatId(CURRENT_CONV)}
                  pickup={pickup}
                  vehicle={vehicle}
                />
              )}

              {trackPhases.includes(phase) && (
                <TrackingSheet
                  destination={summaryDestination}
                  key="tracking"
                  onAdvance={advance}
                  onHome={returnHome}
                  onMessage={() => setChatId(CURRENT_CONV)}
                  onViewOrders={viewCompletedOrder}
                  phase={phase as TrackPhase}
                  pickup={pickup}
                  vehicle={vehicle}
                />
              )}
            </div>
          )}

          {tab === "Đơn hàng" && (
            <div className="tab-screen" key="orders">
              {openOrder ? (
                <OrderDetail
                  key={openOrder.id}
                  onBack={() => setOpenOrder(null)}
                  onRate={(n) =>
                    setRatings((r) => ({ ...r, [openOrder.id]: n }))
                  }
                  onSupport={openSupport}
                  onReorder={reorder}
                  onTrack={trackActive}
                  order={openOrder}
                  rating={ratings[openOrder.id]}
                />
              ) : (
                <OrderHistory
                  onOpen={setOpenOrder}
                  onReorder={reorder}
                  onTrack={trackActive}
                />
              )}
            </div>
          )}

          {tab === "Tin nhắn" && (
            <div className="tab-screen" key="messages">
              <MessagesScreen onOpen={setChatId} />
            </div>
          )}

          {tab === "Tài khoản" && (
            <div className="tab-screen" key="account">
              <AccountScreen
                canUseAddress={phase === "booking"}
                key={supportOrder ?? "account"}
                onBackToOrder={backToOrder}
                onNavHidden={setNavHidden}
                onUseAddress={useAddress}
                orderOptions={orders.map((o) => ({
                  id: o.id,
                  label: `${o.id} · ${o.created}`,
                }))}
                supportOrder={supportOrder}
              />
            </div>
          )}
        </div>

        <datalist id="saved-addresses">
          {savedAddresses.map((a) => (
            <option key={a.id} value={a.address} />
          ))}
        </datalist>

        {!(tab === "Tài khoản" && navHidden) && (
          <BottomNavigation active={tab} onChange={navigateTab} />
        )}

        {chatId && (
          <ChatScreen
            convId={chatId}
            key={chatId}
            onBack={() => setChatId(null)}
            onOpenMap={viewTrip}
            onTrip={viewTrip}
            side="customer"
          />
        )}
      </section>
    </main>
  )
}
