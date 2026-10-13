import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"

import AccountScreen, {
  syncUserProfileFromApi,
  syncAddressesFromApi,
  useAddresses,
  useProfile,
} from "./account"
import AuthOtpBottomSheet from "./AuthOtpBottomSheet"
import NotificationModal from "./NotificationModal"

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
import { subscribeRealtime, emitLocalRealtime } from "./lib/pusherClient"
import CallingModal from "./CallingModal"

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

  vehicleTypeId?: string

  rawBasePrice?: number
}

type SurchargeServiceItem = {
  code: string

  name: string

  description?: string

  price: number

  calculationType?: string

  isActive?: boolean
}

const defaultSurcharges: SurchargeServiceItem[] = [
  {
    code: "PORTER_1WAY",

    name: "Bốc xếp 1 đầu xe",

    description: "Tài xế phụ bốc xếp tại điểm đón",

    price: 50000,
  },

  {
    code: "PORTER_2WAY",

    name: "Bốc xếp 2 đầu xe",

    description: "Tài xế phụ bốc xếp tại cả 2 đầu",

    price: 100000,
  },

  {
    code: "PORTER_FLOOR",

    name: "Bốc xếp gác lầu",

    description: "Vận chuyển lên/xuống tầng bộ",

    price: 30000,
  },

  {
    code: "EXTRA_PORTER",

    name: "Thêm người bốc xếp",

    description: "Bố trí thêm phụ xe đi cùng",

    price: 100000,
  },
]

const defaultVehicles: Vehicle[] = [
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

const vehicles = defaultVehicles

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
  vehicleList = defaultVehicles,
  selected,
  onSelect,
}: {
  vehicleList?: Vehicle[]
  selected: string
  onSelect: (vehicle: Vehicle) => void
}) {
  return (
    <div className="vehicle-list" role="radiogroup" aria-label="Chọn loại xe">
      {vehicleList.map((vehicle) => {
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
            <span
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: active
                  ? "var(--brand-900)"
                  : "var(--brand-600, #2563eb)",
                marginTop: "3px",
              }}
            >
              {vehicle.price}
            </span>
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

function SurchargeServicesSelector({
  services,
  selectedServices,
  onToggleService,
}: {
  services: SurchargeServiceItem[]
  selectedServices: Record<string, number>
  onToggleService: (code: string, delta: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isNight = (() => {
    const vnHour = (new Date().getUTCHours() + 7) % 24
    return vnHour >= 22 || vnHour < 6
  })()

  const selectedCount = Object.values(selectedServices).filter((v) => v > 0).length

  return (
    <div
      style={{
        margin: "12px 0",
        padding: "10px 14px",
        background: "rgba(255, 255, 255, 0.75)",
        border: "1px solid rgba(226, 232, 240, 0.9)",
        borderRadius: "14px",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>📦</span>
          <span
            style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}
          >
            Dịch vụ bốc xếp & Phụ phí
          </span>
          {selectedCount > 0 && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                background: "var(--brand-500, #3b82f6)",
                color: "#fff",
                borderRadius: "10px",
                padding: "1px 7px",
              }}
            >
              {selectedCount}
            </span>
          )}
        </div>
        <button
          className="text-button"
          style={{
            fontSize: "12px",
            color: "var(--brand-600, #2563eb)",
            padding: 0,
          }}
          type="button"
        >
          {expanded ? "Thu gọn ▲" : "Chọn thêm ▼"}
        </button>
      </div>

      {isNight && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(254, 243, 199, 0.8)",
            border: "1px solid #fde68a",
            padding: "5px 10px",
            borderRadius: "8px",
            fontSize: "11px",
            color: "#92400e",
            marginTop: "8px",
          }}
        >
          <span>🌙</span>
          <span>
            Đang trong khung giờ đêm (22h - 6h): Phụ phí ban đêm tự động áp dụng
          </span>
        </div>
      )}

      {expanded && (
        <div
          style={{
            marginTop: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {services.map((srv) => {
            const qty = selectedServices[srv.code] || 0
            const active = qty > 0

            return (
              <div
                key={srv.code}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  background: active
                    ? "rgba(239, 246, 255, 0.9)"
                    : "rgba(248, 250, 252, 0.7)",
                  border: active ? "1px solid #bfdbfe" : "1px solid #f1f5f9",
                  transition: "all 0.2s ease",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#334155",
                    }}
                  >
                    {srv.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    +{srv.price.toLocaleString("vi-VN")}đ
                    {srv.description ? ` · ${srv.description}` : ""}
                  </div>
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {active ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <button
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                        }}
                        onClick={() => onToggleService(srv.code, -1)}
                        type="button"
                      >
                        -
                      </button>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: "700",
                          minWidth: "14px",
                          textAlign: "center",
                        }}
                      >
                        {qty}
                      </span>
                      <button
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                        }}
                        onClick={() => onToggleService(srv.code, 1)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      style={{
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: "600",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#334155",
                        cursor: "pointer",
                      }}
                      onClick={() => onToggleService(srv.code, 1)}
                      type="button"
                    >
                      + Thêm
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
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

  const [liveNearby, setLiveNearby] = useState<
    Array<{
      left: number
      top: number
      driverId?: string
      name?: string
      licensePlate?: string
    }>
  >(nearbyDrivers)

  useEffect(() => {
    let isMounted = true
    // Quét tài xế lân cận thực tế từ PostGIS Backend
    fetch("/api/v1/driver/nearby?lat=10.7769&lng=106.7009&radiusKm=5&limit=8")
      .then((r) => r.json())
      .then((json) => {
        if (!isMounted) return
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map((d: any, idx: number) => {
            const lngDiff = ((Number(d.lng || 106.7) - 106.69) * 3200) % 240
            const latDiff = ((10.785 - Number(d.lat || 10.77)) * 3200) % 180
            const left = Math.min(
              310,
              Math.max(50, 160 + (idx % 2 === 0 ? lngDiff : -lngDiff)),
            )
            const top = Math.min(
              240,
              Math.max(60, 130 + (idx % 2 === 0 ? latDiff : -latDiff)),
            )
            return {
              left: Math.round(left),
              top: Math.round(top),
              driverId: d.driverId,
              name: d.name,
              licensePlate: d.licensePlate,
            }
          })
          setLiveNearby(mapped)
        }
      })
      .catch((err) => console.warn("Lỗi tải radar tài xế:", err))

    return () => {
      isMounted = false
    }
  }, [phase])

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
        liveNearby.map((d, i) => (
          <span
            className="nearby-driver"
            key={d.driverId || i}
            title={
              d.name
                ? `${d.name} (${d.licensePlate || "Xe tải"}) - Đang trực tuyến`
                : "Tài xế đang trực tuyến"
            }
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
  bookingCode,
  escalated,
  isEscalating,
  onEscalate,
  onCancel,
}: {
  pickup: string
  destination: string
  vehicle: Vehicle
  bookingCode?: string
  escalated?: boolean
  isEscalating?: boolean
  onEscalate?: () => void
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
          <h1>Tìm tài xế gần bạn {bookingCode ? `#${bookingCode}` : ""}</h1>
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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginTop: "12px",
        }}
      >
        {onEscalate && (
          <button
            type="button"
            onClick={onEscalate}
            disabled={escalated || isEscalating}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "11px 16px",
              borderRadius: "14px",
              background: escalated
                ? "rgba(34, 197, 94, 0.12)"
                : "linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(147, 51, 234, 0.12))",
              border: escalated
                ? "1px solid rgba(34, 197, 94, 0.4)"
                : "1px solid rgba(147, 51, 234, 0.35)",
              color: escalated ? "#16a34a" : "#4338ca",
              fontSize: "13px",
              fontWeight: 700,
              cursor: escalated ? "default" : "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <span>📡</span>
            <span>
              {isEscalating
                ? "Đang quét xe vòng 2..."
                : escalated
                ? "✓ Đã mở rộng quét bán kính 8km"
                : "Mở rộng bán kính tìm xe (8km)"}
            </span>
          </button>
        )}

        <button className="secondary-button" onClick={onCancel} type="button">
          Hủy tìm tài xế
        </button>
      </div>
    </section>
  )
}

function FoundSheet({
  pickup,
  destination,
  vehicle,
  driver,
  onCancel,
  onAdvance,
  onMessage,
  onCall,
}: {
  pickup: string
  destination: string
  vehicle: Vehicle
  driver?: any
  onCancel: () => void
  onAdvance: () => void
  onMessage: () => void
  onCall?: () => void
}) {
  const [open, setOpen] = useState(false)
  const driverName = driver?.name || "Nguyễn Văn Minh"
  const driverPlate = driver?.licensePlate || "51D-482.15"
  const driverRating = driver?.ratingAvg || "4,9"
  const driverInitials = driverName
    .split(" ")
    .slice(-2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()

  return (
    <section className="booking-sheet phase-sheet" aria-live="polite">
      <SheetHandle onAdvance={onAdvance} />
      <span className="status-chip found-chip">
        <span className="found-check">
          <Icon name="check" size={10} strokeWidth={3.4} />
        </span>
        Đã tìm thấy tài xế
      </span>
      <h1>{driverName} đang đến chỗ bạn</h1>
      <p className="phase-sub eta-line">
        Khoảng <strong>4 phút</strong> nữa
      </p>

      <div className="driver-card">
        <div className="driver-top">
          <span className="driver-avatar" aria-hidden="true">
            {driverInitials}
            <span className="driver-online" />
          </span>
          <span className="driver-id">
            <strong>{driverName}</strong>
            <span className="driver-rating">
              <span className="star">
                <Icon name="star" size={12} strokeWidth={1.6} />
              </span>
              {driverRating} <i>· {driverPlate}</i>
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
            <small>Đã xác minh</small>
          </span>
          <span className="plate">{driverPlate}</span>
        </div>
        <div className="driver-actions">
          <button className="primary-button compact" onClick={onCall} type="button">
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
  driver,
  onAdvance,
  onHome,
  onViewOrders,
  onMessage,
  onCall,
  onCancelTrip,
  bookingId,
  onRate,
}: {
  phase: TrackPhase
  pickup: string
  destination: string
  vehicle: Vehicle
  driver?: any
  bookingId?: string | null
  onAdvance: () => void
  onHome: () => void
  onViewOrders: () => void
  onMessage: () => void
  onCall?: () => void
  onCancelTrip?: () => void
  onRate?: (rating: number, comment?: string, tags?: string[]) => void | Promise<void>
}) {
  const info = trackInfo[phase]
  const delivered = phase === "delivered"
  const toPickup = phase === "arriving" || phase === "arrived"
  const currentStep = delivered ? 5 : toPickup ? 2 : 3

  const driverName = driver?.name || "Anh Minh"
  const driverPlate = driver?.licensePlate || "51D-482.15"
  const driverRating = driver?.ratingAvg || "4,9"
  const driverInitials = driverName
    .split(" ")
    .slice(-2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()

  const [rating, setRating] = useState(0)
  const [ratingStars, setRatingStars] = useState(5)
  const [ratingComment, setRatingComment] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([
    "Lái xe an toàn",
    "Nhiệt tình",
  ])
  const [isSubmittingRate, setIsSubmittingRate] = useState(false)
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
              {driverInitials}
              <span className="driver-online" />
            </span>
            <span className="driver-id">
              <strong>{driverName}</strong>
              <span className="driver-rating">
                <span className="star">
                  <Icon name="star" size={12} strokeWidth={1.6} />
                </span>
                {driverRating} <i>· {driverPlate}</i>
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
              onClick={onCall}
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

          {bookingId && (
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/?trackBooking=${bookingId}`
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareUrl)
                    alert("Đã sao chép liên kết theo dõi hành trình vào bộ nhớ tạm!")
                  } else {
                    prompt("Sao chép liên kết theo dõi hành trình:", shareUrl)
                  }
                }}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "20px",
                  padding: "5px 14px",
                  color: "#334155",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>🔗 Chia sẻ hành trình</span>
              </button>
            </div>
          )}

          {onCancelTrip && (
            <div style={{ textAlign: "center", marginTop: "10px" }}>
              <button
                type="button"
                onClick={onCancelTrip}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Hủy chuyến xe này
              </button>
            </div>
          )}

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
            <div
              className="rate-panel"
              style={{
                padding: "16px",
                borderRadius: "16px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <strong
                style={{
                  fontSize: "15px",
                  display: "block",
                  marginBottom: "8px",
                  textAlign: "center",
                  color: "#0f172a",
                }}
              >
                Bạn đánh giá chuyến đi thế nào?
              </strong>
              <div
                className="rate-stars"
                role="radiogroup"
                aria-label="Đánh giá tài xế"
                style={{ justifyContent: "center", marginBottom: "12px", display: "flex", gap: "8px" }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    aria-checked={ratingStars === n}
                    aria-label={`${n} sao`}
                    className={n <= ratingStars ? "on" : ""}
                    key={n}
                    onClick={() => setRatingStars(n)}
                    role="radio"
                    type="button"
                    style={{
                      transform: n <= ratingStars ? "scale(1.15)" : "scale(1)",
                      transition: "transform 0.15s ease",
                      cursor: "pointer",
                      background: "transparent",
                      border: "none",
                    }}
                  >
                    <span className="star" style={{ color: n <= ratingStars ? "#f59e0b" : "#cbd5e1" }}>
                      <Icon name="star" size={28} strokeWidth={1.6} />
                    </span>
                  </button>
                ))}
              </div>

              {/* Gợi ý đánh giá nhanh */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "12px",
                  justifyContent: "center",
                }}
              >
                {[
                  "Lái xe an toàn",
                  "Nhiệt tình, chu đáo",
                  "Đúng giờ",
                  "Hàng hóa cẩn thận",
                  "Xe sạch đẹp",
                ].map((tag) => {
                  const active = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setSelectedTags((prev) =>
                          active ? prev.filter((t) => t !== tag) : [...prev, tag],
                        )
                      }
                      style={{
                        padding: "5px 10px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
                        background: active ? "#eff6ff" : "#fff",
                        color: active ? "#1d4ed8" : "#475569",
                        cursor: "pointer",
                        fontWeight: active ? 600 : 400,
                        transition: "all 0.15s",
                      }}
                    >
                      {active ? "✓ " : "+ "}
                      {tag}
                    </button>
                  )
                })}
              </div>

              {/* Nhận xét văn bản */}
              <textarea
                placeholder="Gửi lời nhắn hoặc góp ý cho bác tài (tuỳ chọn)..."
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  marginBottom: "12px",
                  outline: "none",
                  resize: "none",
                  boxSizing: "border-box",
                }}
              />

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="secondary-button"
                  onClick={onHome}
                  type="button"
                  style={{ flex: 1 }}
                >
                  Để sau
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={isSubmittingRate}
                  onClick={async () => {
                    setIsSubmittingRate(true)
                    try {
                      if (onRate) {
                        await onRate(ratingStars, ratingComment, selectedTags)
                      }
                      setRating(ratingStars)
                    } catch (e) {
                      console.error(e)
                    } finally {
                      setIsSubmittingRate(false)
                    }
                  }}
                  style={{ flex: 1.5 }}
                >
                  {isSubmittingRate ? "Đang gửi..." : "GỬI ĐÁNH GIÁ"}
                </button>
              </div>
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
  rawBookingId?: string
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
  const [serverOrders, setServerOrders] = useState<Order[]>([])

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    if (!token) return
    fetch("/api/v1/bookings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: Order[] = res.data.map((b: any) => {
            const st: OrderStatus =
              b.status === "COMPLETED"
                ? "completed"
                : b.status === "CANCELLED"
                ? "cancelled"
                : "active"
            return {
              id: `#${b.bookingCode || b.id.slice(0, 8)}`,
              rawBookingId: b.id,
              status: st,
              created: new Date(b.createdAt).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }),
              pickup: b.originAddress,
              destination: b.destinationAddress,
              vehicleId: "van",
              transport: Math.round(Number(b.totalPrice) * 0.9),
              service: Math.round(Number(b.totalPrice) * 0.1),
              distance: `${b.distanceKm || "—"} km`,
              duration: "—",
              driver: b.driver
                ? {
                    name: b.driver.name || "Tài xế",
                    initials: "TX",
                    plate: b.driver.licensePlate || "",
                    rating: "4.9",
                  }
                : undefined,
            }
          })
          setServerOrders(mapped)
        }
      })
      .catch((err) => console.warn("Load bookings error:", err))
  }, [])

  const combinedOrders = serverOrders.length > 0 ? serverOrders : orders
  const list = combinedOrders.filter(
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

  onRate: (value: number, comment?: string, tags?: string[]) => void | Promise<void>

  onSupport: (o: Order) => void
}) {
  const v = orderVehicle(order)

  const [rateOpen, setRateOpen] = useState(false)

  const [draft, setDraft] = useState(5)
  const [orderTags, setOrderTags] = useState<string[]>([
    "Lái xe an toàn",
    "Nhiệt tình",
  ])
  const [orderComment, setOrderComment] = useState("")
  const [isSubmittingOrderRate, setIsSubmittingOrderRate] = useState(false)
  const [tripCalls, setTripCalls] = useState<any[]>([])

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") || localStorage.getItem("token") : null
    if (!token || !order.rawBookingId) return
    fetch(`/api/v1/calls/trip/${order.rawBookingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setTripCalls(res.data)
        }
      })
      .catch(() => {})
  }, [order.rawBookingId])

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
      <h2>Liên lạc Hotline 1900-8888 {tripCalls.length > 0 ? `(${tripCalls.length})` : ""}</h2>
      <div className="detail-card">
        {tripCalls.length === 0 ? (
          <div style={{ fontSize: "13px", color: "#64748b", padding: "6px 0", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>📞</span>
            <span>Chưa ghi nhận cuộc gọi tổng đài nào trong chuyến này.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {tripCalls.map((c: any) => {
              const durM = Math.floor((c.duration_seconds || 0) / 60)
              const durS = (c.duration_seconds || 0) % 60
              const durStr = `${String(durM).padStart(2, "0")}:${String(durS).padStart(2, "0")}`
              const isAnswered = c.status === "ANSWERED" || c.status === "COMPLETED"
              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px dashed #e2e8f0",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                      {c.caller_role === "DRIVER" ? "Tài xế liên hệ bạn" : "Bạn gọi tài xế"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                      {new Date(c.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · Tổng đài bảo mật số
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: isAnswered ? "#16a34a" : "#dc2626" }}>
                      {isAnswered ? durStr : "Nhỡ / Không nghe"}
                    </div>
                    <span style={{ fontSize: "10px", color: "#64748b" }}>
                      {isAnswered ? "Đã đàm thoại" : "Chưa kết nối"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
              <div
                className="detail-card rated-card open"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "14px",
                }}
              >
                <span style={{ fontWeight: 600, color: "#1e293b" }}>
                  Bạn thấy {order.driver?.name} phục vụ thế nào?
                </span>
                <span className="rate-stars" style={{ display: "flex", gap: "8px" }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      aria-label={`${n} sao`}
                      className={n <= draft ? "on" : ""}
                      key={n}
                      onClick={() => setDraft(n)}
                      type="button"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        transform: n <= draft ? "scale(1.15)" : "scale(1)",
                        transition: "all 0.15s",
                      }}
                    >
                      <span className="star" style={{ color: n <= draft ? "#f59e0b" : "#cbd5e1" }}>
                        <Icon name="star" size={24} strokeWidth={1.6} />
                      </span>
                    </button>
                  ))}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {[
                    "Lái xe an toàn",
                    "Nhiệt tình",
                    "Đúng giờ",
                    "Cẩn thận hàng hóa",
                  ].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setOrderTags((prev) =>
                          prev.includes(t)
                            ? prev.filter((x) => x !== t)
                            : [...prev, t],
                        )
                      }
                      style={{
                        padding: "3px 8px",
                        fontSize: "11px",
                        borderRadius: "12px",
                        border: orderTags.includes(t)
                          ? "1px solid #2563eb"
                          : "1px solid #cbd5e1",
                        background: orderTags.includes(t) ? "#eff6ff" : "#fff",
                        color: orderTags.includes(t) ? "#1d4ed8" : "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      {orderTags.includes(t) ? "✓ " : "+ "}
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Thêm lời khen ngợi cho tài xế (tuỳ chọn)..."
                  value={orderComment}
                  onChange={(e) => setOrderComment(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  className="primary-button compact"
                  disabled={draft === 0 || isSubmittingOrderRate}
                  onClick={async () => {
                    if (draft === 0) return
                    setIsSubmittingOrderRate(true)
                    try {
                      await onRate(draft, orderComment, orderTags)
                    } finally {
                      setIsSubmittingOrderRate(false)
                    }
                  }}
                  style={{ alignSelf: "flex-end" }}
                >
                  {isSubmittingOrderRate ? "Đang gửi..." : "Gửi đánh giá"}
                </button>
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
  const [callModalOpen, setCallModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "VNPAY" | "MOMO" | "WALLET">("CASH")
  const [paymentQrOpen, setPaymentQrOpen] = useState(false)
  const [paymentQrData, setPaymentQrData] = useState<any>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentChecking, setPaymentChecking] = useState(false)

  // Tự động kiểm tra trạng thái thanh toán trực tuyến (Polling + Socket Pusher)
  useEffect(() => {
    if (!paymentQrOpen || !paymentQrData?.transactionCode || paymentSuccess) return

    const txnCode = paymentQrData.transactionCode
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/v1/payments/status/${txnCode}`)
        const data = await res.json()
        if (data.success && data.data?.isSuccess) {
          setPaymentSuccess(true)
          setTimeout(() => {
            setPaymentQrOpen(false)
            setPaymentSuccess(false)
          }, 2000)
        }
      } catch (err) {
        console.warn("Lỗi kiểm tra thanh toán:", err)
      }
    }

    const interval = setInterval(checkStatus, 2500)
    const unsubscribe = subscribeRealtime(`payment-${txnCode}`, "payment-completed", () => {
      setPaymentSuccess(true)
      setTimeout(() => {
        setPaymentQrOpen(false)
        setPaymentSuccess(false)
      }, 2000)
    })

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [paymentQrOpen, paymentQrData, paymentSuccess])

  const checkPaymentManual = async () => {
    if (!paymentQrData?.transactionCode) return
    setPaymentChecking(true)
    try {
      const res = await fetch(`/api/v1/payments/status/${paymentQrData.transactionCode}`)
      const data = await res.json()
      if (data.success && data.data?.isSuccess) {
        setPaymentSuccess(true)
        setTimeout(() => {
          setPaymentQrOpen(false)
          setPaymentSuccess(false)
        }, 1800)
      } else {
        alert("Hệ thống chưa nhận được tiền từ cổng. Vui lòng hoàn tất quét mã trước.")
      }
    } catch (err) {
      alert("Lỗi kiểm tra: " + String(err))
    } finally {
      setPaymentChecking(false)
    }
  }

  const [supportOrder, setSupportOrder] = useState<string | null>(null)

  const [navHidden, setNavHidden] = useState(false)

  const [vehicleList, setVehicleList] = useState<Vehicle[]>(defaultVehicles)
  const [surchargeServices, setSurchargeServices] =
    useState<SurchargeServiceItem[]>(defaultSurcharges)
  const [selectedServices, setSelectedServices] = useState<
    Record<string, number>
  >({})
  const [estimateData, setEstimateData] = useState<{
    distanceKm: number
    durationMinutes: number
    totalPrice: number
    surchargesTotal: number
    breakdown?: any[]
  } | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)

  const savedAddresses = useAddresses()
  const profile = useProfile()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null,
  )

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("auth_token")) {
      syncUserProfileFromApi()
      syncAddressesFromApi()
    }

    // 1. Tải bảng giá loại xe thực tế từ DB
    fetch("/api/v1/pricing/rules")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const mapped = data.data.map((r: any) => {
            const nameLower = (r.vehicleName || "").toLowerCase()
            const type: Vehicle["type"] = nameLower.includes("van")
              ? "van"
              : nameLower.includes("1 tấn") || nameLower.includes("1000")
                ? "truck-lg"
                : nameLower.includes("500")
                  ? "truck-sm"
                  : "bike"

            return {
              id: r.vehicleTypeId || r.id,
              vehicleTypeId: r.vehicleTypeId,
              name: r.vehicleName || "Xe tải",
              detail: `Mở cửa ${r.baseDistanceKm || 2}km`,
              price: `${(r.basePrice || 100000).toLocaleString("vi-VN")}đ`,
              rawBasePrice: r.basePrice || 100000,
              type,
            }
          })
          setVehicleList(mapped)
          if (
            mapped.length > 0 &&
            !mapped.some((v: any) => v.id === selected)
          ) {
            setSelected(mapped[0].id)
            setPrice(mapped[0].price)
          }
        }
      })
      .catch((err) => console.warn("Could not load pricing rules:", err))

    // 2. Tải danh mục phụ phí từ DB
    fetch("/api/v1/pricing/services")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setSurchargeServices(data.data)
        }
      })
      .catch((err) =>
        console.warn("Could not load surcharge services:", err),
      )
  }, [])

  const handleToggleService = (code: string, delta: number) => {
    setSelectedServices((prev) => {
      const current = prev[code] || 0
      const next = Math.max(0, current + delta)
      const copy = { ...prev }
      if (next === 0) {
        delete copy[code]
      } else {
        copy[code] = next
      }
      return copy
    })
  }

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

    const targetBookingId =
      o.rawBookingId || (o.id?.startsWith("BK-") ? o.id : null)

    if (targetBookingId) {
      setCurrentBookingId(targetBookingId)
      fetch(`/api/v1/bookings/${targetBookingId}/track`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            if (res.data.driver) setActiveDriver(res.data.driver)
            if (res.data.status === "ARRIVED_AT_PICKUP") setPhase("arrived")
            else if (res.data.status === "IN_TRANSIT") setPhase("delivering")
            else if (res.data.status === "COMPLETED") setPhase("delivered")
            else setPhase("arriving")
          }
        })
        .catch(() => {})
    } else {
      setPhase("delivering")
    }

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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const trackId = params.get("trackBooking")
      if (trackId) {
        fetch(`/api/v1/bookings/${trackId}/track`)
          .then((r) => r.json())
          .then((res) => {
            if (res.success && res.data) {
              setCurrentBookingId(res.data.bookingId)
              setCurrentBookingCode(res.data.bookingCode || "")
              if (res.data.origin?.address) setPickup(res.data.origin.address)
              if (res.data.destination?.address)
                setDestination(res.data.destination.address)
              if (res.data.driver) setActiveDriver(res.data.driver)
              if (res.data.status === "ARRIVED_AT_PICKUP") setPhase("arrived")
              else if (res.data.status === "IN_TRANSIT") setPhase("delivering")
              else if (res.data.status === "COMPLETED") setPhase("delivered")
              else setPhase("arriving")
            }
          })
          .catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    if (phase === "delivered") setOrderStatus(CURRENT_CONV, "completed")
  }, [phase])

  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null)
  const [currentBookingCode, setCurrentBookingCode] = useState<string>("")
  const [activeDriver, setActiveDriver] = useState<any>(null)
  const [isBookingLoading, setIsBookingLoading] = useState(false)
  const [isEscalating, setIsEscalating] = useState(false)
  const [hasEscalated, setHasEscalated] = useState(false)
  const [showCustomerCancelModal, setShowCustomerCancelModal] = useState(false)
  const [customerCancelReason, setCustomerCancelReason] = useState(
    "Đổi kế hoạch di chuyển",
  )
  const [isCancellingCustomer, setIsCancellingCustomer] = useState(false)

  // Lắng nghe sự kiện Realtime trên kênh chuyến đi của khách (trip-{bookingId})
  useEffect(() => {
    if (!currentBookingId) return

    const unsubAccepted = subscribeRealtime(
      `trip-${currentBookingId}`,
      "booking:accepted",
      (data) => {
        console.log("🎉 [Customer UI] Tài xế đã nhận cuốc:", data)
        if (data.driver) {
          setActiveDriver(data.driver)
        }
        setPhase("found")
      },
    )

    const unsubStatus = subscribeRealtime(
      `trip-${currentBookingId}`,
      "booking:status-change",
      (data) => {
        console.log("📍 [Customer UI] Cập nhật chặng:", data)
        if (data.status === "ARRIVED_AT_PICKUP") setPhase("arrived")
        else if (data.status === "IN_TRANSIT") setPhase("delivering")
        else if (data.status === "COMPLETED") setPhase("delivered")
      },
    )

    const unsubCancelled = subscribeRealtime(
      `trip-${currentBookingId}`,
      "booking:cancelled",
      (data) => {
        console.log("🛑 [Customer UI] Chuyến xe bị hủy:", data)
        alert(`Chuyến xe đã bị hủy (${data.reason || "Bởi tài xế"})`)
        setPhase("booking")
        setCurrentBookingId(null)
        setActiveDriver(null)
      },
    )

    return () => {
      unsubAccepted()
      unsubStatus()
      unsubCancelled()
    }
  }, [currentBookingId])

  // Fallback Polling: Định kỳ đồng bộ vị trí xe và trạng thái qua GET /api/v1/bookings/:id/track
  useEffect(() => {
    if (!currentBookingId) return
    if (phase === "booking" || phase === "delivered") return

    const fetchTripTrack = async () => {
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("auth_token") || localStorage.getItem("token")
            : null
        const res = await fetch(`/api/v1/bookings/${currentBookingId}/track`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const json = await res.json()
        if (json.success && json.data) {
          const trackData = json.data
          if (trackData.status === "ARRIVED_AT_PICKUP" && phase !== "arrived") {
            setPhase("arrived")
          } else if (
            trackData.status === "IN_TRANSIT" &&
            phase !== "delivering"
          ) {
            setPhase("delivering")
          } else if (
            trackData.status === "COMPLETED" &&
            phase !== "delivered"
          ) {
            setPhase("delivered")
          }
          if (trackData.driver) {
            setActiveDriver((prev: any) => ({
              ...prev,
              ...trackData.driver,
              currentLocation:
                trackData.driver.currentLocation || prev?.currentLocation,
            }))
          }
        }
      } catch (err) {
        console.warn("Lỗi đồng bộ /track:", err)
      }
    }

    fetchTripTrack()
    const timer = setInterval(fetchTripTrack, 6000)
    return () => clearInterval(timer)
  }, [currentBookingId, phase])

  const advance = () =>
    setPhase(
      (current) =>
        PHASE_ORDER[(PHASE_ORDER.indexOf(current) + 1) % PHASE_ORDER.length],
    )

  useEffect(() => {
    // Nếu đang có cuốc xe thật trên server, không nhảy phase bằng timer
    if (currentBookingId) return

    const delay = PHASE_DELAY[phase]
    if (!delay) return
    const timer = window.setTimeout(advance, delay)
    return () => window.clearTimeout(timer)
  }, [phase, currentBookingId])

  const vehicle =
    vehicleList.find((v) => v.id === selected) ??
    vehicleList[1] ??
    defaultVehicles[1]

  const handleVehicleSelect = (v: Vehicle) => {
    setSelected(v.id)
    if (!destination.trim()) {
      setPrice(v.price)
    }
  }

  useEffect(() => {
    if (!destination.trim()) {
      setEstimateData(null)
      const currentV = vehicleList.find((v) => v.id === selected)
      if (currentV) {
        setPrice(currentV.price)
      }
      return
    }

    const timer = setTimeout(() => {
      const currentV = vehicleList.find((v) => v.id === selected)
      const servicesPayload = Object.entries(selectedServices)
        .filter(([_, qty]) => qty > 0)
        .map(([code, quantity]) => ({ code, quantity }))

      setIsEstimating(true)
      fetch("/api/v1/bookings/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupAddress: pickup,
          dropoffAddress: destination,
          vehicleTypeId: currentV?.vehicleTypeId || currentV?.id,
          services: servicesPayload,
        }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setEstimateData(res.data)
            setPrice(`${res.data.totalPrice.toLocaleString("vi-VN")}đ`)
          }
        })
        .catch(() => {
          // Fallback dự phòng sang /api/v1/pricing/estimate
          fetch("/api/v1/pricing/estimate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pickupAddress: pickup,
              dropoffAddress: destination,
              vehicleTypeId: currentV?.vehicleTypeId || currentV?.id,
              services: servicesPayload,
            }),
          })
            .then((r) => r.json())
            .then((res) => {
              if (res.success && res.data) {
                setEstimateData(res.data)
                setPrice(`${res.data.totalPrice.toLocaleString("vi-VN")}đ`)
              }
            })
            .catch((err) => console.warn("Lỗi tính giá dự tính:", err))
        })
        .finally(() => setIsEstimating(false))
    }, 400)

    return () => clearTimeout(timer)
  }, [pickup, destination, selected, selectedServices, vehicleList])

  const handleBook = async () => {
    if (!destination.trim()) {
      setDestinationError(true)
      document
        .querySelector<HTMLInputElement>('[aria-label="Điểm giao hàng"]')
        ?.focus()
      return
    }

    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    if (!token) {
      setShowAuthModal(true)
      return
    }

    const currentV = vehicleList.find((v) => v.id === selected)
    const servicesPayload = Object.entries(selectedServices)
      .filter(([_, qty]) => qty > 0)
      .map(([code, quantity]) => ({ code, quantity }))

    setIsBookingLoading(true)
    try {
      const res = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          originAddress: pickup,
          originLat: estimateData?.originLat || 10.7828,
          originLng: estimateData?.originLng || 106.6958,
          destinationAddress: destination,
          destLat: estimateData?.destLat || 10.7601,
          destLng: estimateData?.destLng || 106.7042,
          vehicleTypeId: currentV?.vehicleTypeId || currentV?.id,
          paymentMethod: paymentMethod,
          services: servicesPayload,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.message || "Không thể tạo đơn đặt xe.")
        return
      }

      const bId = data.data.bookingId
      setCurrentBookingId(bId)
      setCurrentBookingCode(data.data.bookingCode || "")
      setHasEscalated(false)

      // Nếu khách chọn thanh toán online qua VNPay hoặc MoMo, tạo link thanh toán & mã QR
      if (paymentMethod === "VNPAY" || paymentMethod === "MOMO") {
        try {
          const payRes = await fetch("/api/v1/payments/create-url", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              bookingId: bId,
              gateway: paymentMethod,
              amount: estimateData?.totalPrice || 250000,
              purpose: "BOOKING_PAYMENT",
            }),
          })
          const payData = await payRes.json()
          if (payData.success && payData.data) {
            setPaymentQrData(payData.data)
            setPaymentQrOpen(true)
          }
        } catch (payErr) {
          console.warn("Lỗi tạo mã thanh toán trực tuyến:", payErr)
        }
      }

      setPhase("searching")
    } catch (err: any) {
      console.warn("Error creating booking:", err)
      // Fallback
      setPhase("searching")
    } finally {
      setIsBookingLoading(false)
    }
  }

  const handleEscalateDispatch = async () => {
    if (!currentBookingId) {
      setHasEscalated(true)
      return
    }

    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    setIsEscalating(true)
    try {
      const res = await fetch(
        `/api/v1/bookings/${currentBookingId}/escalate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const data = await res.json()
      if (res.ok && data.success) {
        setHasEscalated(true)
      } else {
        alert(data.message || "Không thể mở rộng bán kính tìm xe.")
      }
    } catch (err: any) {
      alert("Lỗi kết nối: " + err.message)
    } finally {
      setIsEscalating(false)
    }
  }

  const handleCancelBooking = async () => {
    if (!currentBookingId) {
      setPhase("booking")
      setShowCustomerCancelModal(false)
      return
    }

    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
    setIsCancellingCustomer(true)
    try {
      const res = await fetch(
        `/api/v1/bookings/${currentBookingId}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: customerCancelReason }),
        },
      )
      const data = await res.json()
      if (res.ok && data.success) {
        if (data.data?.cancellationFee > 0) {
          alert(
            `Chuyến xe đã hủy. Do tài xế đã đến điểm đón, áp dụng phí bồi thường: ${data.data.cancellationFee.toLocaleString(
              "vi-VN",
            )}đ.`,
          )
        } else {
          alert("Bạn đã hủy chuyến xe thành công.")
        }
        setPhase("booking")
        setCurrentBookingId(null)
        setActiveDriver(null)
        setShowCustomerCancelModal(false)
      } else {
        alert(data.message || "Không thể hủy chuyến xe.")
      }
    } catch (err: any) {
      alert("Lỗi khi hủy chuyến: " + err.message)
    } finally {
      setIsCancellingCustomer(false)
    }
  }

  const handleRateBooking = async (
    bId: string,
    ratingValue: number,
    comment?: string,
    tags?: string[],
  ) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("auth_token") || localStorage.getItem("token")
        : null
    if (!bId || !token) return
    try {
      const res = await fetch(`/api/v1/bookings/${bId}/rate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rating: ratingValue, comment, tags }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        console.log("⭐ Đánh giá chuyến xe thành công:", data)
      } else {
        console.warn("Lỗi đánh giá:", data.message)
      }
    } catch (e) {
      console.error("Lỗi gửi đánh giá chuyến đi:", e)
    }
  }

  const handleAuthSuccess = (token: string) => {
    setAuthToken(token)
    setShowAuthModal(false)
    handleBook()
  }

  const handleCancel = () => {
    setShowCustomerCancelModal(true)
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

  const pillMap: Record<string, { text: string badge: string }> = {
    booking: { text: "Tài xế đang hoạt động gần bạn", badge: "18" },

    searching: { text: "Đang tìm quanh bạn", badge: "18 xe" },

    found: { text: "Anh Minh đang di chuyển", badge: "4 phút" },

    arriving: { text: "Tài xế đang đến", badge: "3 phút" },

    arrived: { text: "Tài xế đã đến", badge: "Tại điểm lấy" },

    pickedup: { text: "Đã nhận hàng", badge: "15 phút" },

    delivering: { text: "Đang giao hàng", badge: "8 phút" },

    delivered: { text: "Giao hàng thành công", badge: "10:46" },
  }

  const pillCopy = pillMap[phase] || {
    text: "Đang xử lý chuyến xe",

    badge: "Sẵn sàng",
  }

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
                    <span className="avatar" aria-hidden="true" style={{ overflow: "hidden" }}>
                      {profile.photo ? (
                        <img
                          src={profile.photo}
                          alt={profile.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        (profile.name || "KH").slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <span>
                      <span className="eyebrow">
                        {authToken ? "Chào buổi sáng," : "Khách hàng,"}
                      </span>
                      <strong>{authToken ? profile.name : "Chạm để đăng nhập"}</strong>
                    </span>
                  </div>
                  <IconButton
                    badge
                    icon="bell"
                    label="Thông báo"
                    onClick={() => setShowNotifications(true)}
                  />
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

                    {savedAddresses.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          overflowX: "auto",
                          padding: "6px 2px 10px",
                          margin: "2px 0 6px",
                          scrollbarWidth: "none",
                        }}
                      >
                        {savedAddresses.map((sa) => {
                          const isSel = destination === sa.address
                          return (
                            <button
                              key={sa.id}
                              type="button"
                              onClick={() => {
                                setDestination(sa.address)
                                setDestinationError(false)
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 12px",
                                borderRadius: "16px",
                                border: isSel
                                  ? "1px solid #2563eb"
                                  : "1px solid rgba(0,0,0,0.1)",
                                background: isSel
                                  ? "rgba(37,99,235,0.12)"
                                  : "rgba(255,255,255,0.9)",
                                color: isSel ? "#2563eb" : "#374151",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                boxShadow: isSel
                                  ? "0 2px 8px rgba(37,99,235,0.2)"
                                  : "0 1px 3px rgba(0,0,0,0.05)",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <span>
                                {sa.type === "home"
                                  ? "🏠"
                                  : sa.type === "work"
                                    ? "🏢"
                                    : "📍"}
                              </span>
                              <span>
                                {sa.name ||
                                  (sa.type === "home"
                                    ? "Nhà"
                                    : sa.type === "work"
                                      ? "Công ty"
                                      : "Kho hàng")}
                              </span>
                            </button>
                          )
                        })}
                      </div>
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
                      vehicleList={vehicleList}
                    />

                    <SurchargeServicesSelector
                      onToggleService={handleToggleService}
                      selectedServices={selectedServices}
                      services={surchargeServices}
                    />

                    <div className="price-row">
                      <span>
                        <small>
                          {isEstimating
                            ? "Đang tính giá Goong…"
                            : estimateData
                              ? `${estimateData.distanceKm} km · ~${estimateData.durationMinutes} phút`
                              : "Giá ước tính"}
                        </small>
                        <strong key={price}>{price}</strong>
                      </span>
                      <span className="price-note">
                        {estimateData?.surchargesTotal
                          ? `Đã gồm phụ phí +${estimateData.surchargesTotal.toLocaleString("vi-VN")}đ`
                          : "Đã gồm phí dịch vụ"}
                      </span>
                    </div>

                    <div style={{ margin: "14px 0 10px" }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: 6,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Phương thức thanh toán</span>
                        <span style={{ color: "#2563eb", fontWeight: 700 }}>
                          {paymentMethod === "CASH"
                            ? "💵 Tiền mặt"
                            : paymentMethod === "VNPAY"
                              ? "💳 Cổng VNPay"
                              : paymentMethod === "MOMO"
                                ? "👛 Ví MoMo"
                                : "💼 Ví FAST"}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 6,
                        }}
                      >
                        {(
                          [
                            { id: "CASH", label: "Tiền mặt", icon: "💵" },
                            { id: "VNPAY", label: "VNPay-QR", icon: "💳" },
                            { id: "MOMO", label: "Ví MoMo", icon: "👛" },
                            { id: "WALLET", label: "Ví FAST", icon: "💼" },
                          ] as const
                        ).map((pm) => (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => setPaymentMethod(pm.id)}
                            style={{
                              padding: "6px 2px",
                              borderRadius: 8,
                              border:
                                paymentMethod === pm.id
                                  ? "1.5px solid #2563eb"
                                  : "1px solid #e2e8f0",
                              backgroundColor:
                                paymentMethod === pm.id ? "#eff6ff" : "#fff",
                              color:
                                paymentMethod === pm.id ? "#1d4ed8" : "#475569",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <span>{pm.icon}</span>
                            <span>{pm.label}</span>
                          </button>
                        ))}
                      </div>
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
                  bookingCode={currentBookingCode}
                  escalated={hasEscalated}
                  isEscalating={isEscalating}
                  onEscalate={handleEscalateDispatch}
                  onCancel={handleCancel}
                  pickup={pickup}
                  vehicle={vehicle}
                />
              )}

              {phase === "found" && (
                <FoundSheet
                  destination={summaryDestination}
                  key="found"
                  driver={activeDriver}
                  onAdvance={advance}
                  onCancel={handleCancel}
                  onMessage={() => setChatId(CURRENT_CONV)}
                  onCall={() => setCallModalOpen(true)}
                  pickup={pickup}
                  vehicle={vehicle}
                />
              )}

              {trackPhases.includes(phase) && (
                <TrackingSheet
                  destination={summaryDestination}
                  key="tracking"
                  driver={activeDriver}
                  bookingId={currentBookingId}
                  onAdvance={advance}
                  onHome={returnHome}
                  onMessage={() => setChatId(CURRENT_CONV)}
                  onCall={() => setCallModalOpen(true)}
                  onViewOrders={viewCompletedOrder}
                  onCancelTrip={handleCancel}
                  onRate={async (stars, comment, tags) => {
                    if (currentBookingId) {
                      await handleRateBooking(
                        currentBookingId,
                        stars,
                        comment,
                        tags,
                      )
                      setRatings((r) => ({ ...r, [currentBookingId]: stars }))
                    }
                  }}
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
                  onRate={async (n, comment, tags) => {
                    setRatings((r) => ({ ...r, [openOrder.id]: n }))
                    const targetBookingId =
                      openOrder.rawBookingId ||
                      (openOrder.id?.startsWith("BK-") ? openOrder.id : null)
                    if (targetBookingId) {
                      await handleRateBooking(targetBookingId, n, comment, tags)
                    }
                  }}
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
            onCall={() => setCallModalOpen(true)}
            side="customer"
          />
        )}

        {showCustomerCancelModal && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "20px",
                padding: "22px",
                width: "100%",
                maxWidth: "340px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#1e293b",
                }}
              >
                Xác nhận hủy chuyến xe
              </h3>
              <p
                style={{
                  margin: "0 0 14px",
                  fontSize: "13px",
                  color: "#64748b",
                  lineHeight: 1.4,
                }}
              >
                {phase === "arrived"
                  ? "⚠️ Tài xế đã có mặt tại điểm đón. Nếu hủy bây giờ, hệ thống sẽ áp dụng phí bồi thường 30.000đ cho tài xế."
                  : "Vui lòng chọn lý do bạn muốn hủy đơn hàng này:"}
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                {[
                  "Đổi kế hoạch đi lại / gửi hàng",
                  "Đặt nhầm loại xe / địa chỉ",
                  "Chờ tìm tài xế quá lâu",
                  "Lý do cá nhân khác",
                ].map((reason) => (
                  <label
                    key={reason}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      color: "#334155",
                      cursor: "pointer",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      background:
                        customerCancelReason === reason
                          ? "#eff6ff"
                          : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="customerCancelReason"
                      checked={customerCancelReason === reason}
                      onChange={() => setCustomerCancelReason(reason)}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCustomerCancelModal(false)}
                  disabled={isCancellingCustomer}
                  style={{ flex: 1 }}
                >
                  Giữ chuyến
                </button>
                <button
                  type="button"
                  onClick={handleCancelBooking}
                  disabled={isCancellingCustomer}
                  style={{
                    flex: 1.2,
                    padding: "10px",
                    borderRadius: "12px",
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isCancellingCustomer ? "Đang hủy..." : "Hủy chuyến"}
                </button>
              </div>
            </div>
          </div>
        )}

        <AuthOtpBottomSheet
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />

        <NotificationModal
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />

        <CallingModal
          isOpen={callModalOpen}
          onClose={() => setCallModalOpen(false)}
          bookingId={currentBookingId || undefined}
          partnerName={activeDriver?.name || "Anh Minh (Tài xế)"}
          partnerRole="Tài xế"
          partnerAvatar={activeDriver?.avatarUrl}
          licensePlate={activeDriver?.licensePlate || "51D-482.15"}
        />

        {paymentQrOpen && paymentQrData && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 99999,
              padding: 16,
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 20,
                width: "100%",
                maxWidth: 380,
                padding: 24,
                textAlign: "center",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 9999,
                    backgroundColor:
                      paymentQrData.gateway === "VNPAY" ? "#eff6ff" : "#fdf2f8",
                    color:
                      paymentQrData.gateway === "VNPAY" ? "#2563eb" : "#d946ef",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {paymentQrData.gateway === "VNPAY"
                    ? "CỔNG VNPAY-QR"
                    : "VÍ ĐIỆN TỬ MOMO"}
                </span>
                <button
                  type="button"
                  onClick={() => setPaymentQrOpen(false)}
                  style={{
                    border: "none",
                    background: "none",
                    fontSize: 18,
                    cursor: "pointer",
                    color: "#64748b",
                  }}
                >
                  ✕
                </button>
              </div>

              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  margin: "0 0 6px",
                  color: "#0f172a",
                }}
              >
                Quét Mã Thanh Toán Cước Xe
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  margin: "0 0 16px",
                }}
              >
                Mã đơn hàng:{" "}
                <strong style={{ color: "#2563eb" }}>
                  #{currentBookingCode || paymentQrData.transactionCode}
                </strong>
              </p>

              {paymentSuccess ? (
                <div style={{ padding: "24px 16px", textAlign: "center" }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      backgroundColor: "#ecfdf5",
                      color: "#059669",
                      fontSize: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                      boxShadow: "0 4px 12px rgba(5, 150, 105, 0.2)",
                    }}
                  >
                    ✓
                  </div>
                  <h4 style={{ fontSize: 18, fontWeight: 700, color: "#059669", margin: "0 0 6px" }}>
                    Thanh Toán Thành Công!
                  </h4>
                  <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                    Đã xác nhận giao dịch qua {paymentQrData.gateway || "cổng điện tử"}. Đang điều phối tài xế...
                  </p>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      width: 200,
                      height: 200,
                      margin: "0 auto 16px",
                      borderRadius: 14,
                      border: "2px solid #e2e8f0",
                      padding: 8,
                      backgroundColor: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={paymentQrData.qrCodeUrl}
                      alt="QR Code"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#0f172a",
                      marginBottom: 10,
                    }}
                  >
                    {Number(paymentQrData.amount || 0).toLocaleString("vi-VN")} đ
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#059669",
                      backgroundColor: "#ecfdf5",
                      padding: "6px 12px",
                      borderRadius: 8,
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontWeight: 500,
                    }}
                  >
                    <span>⏳</span>
                    <span>Đang chờ bạn quét mã (Tự động nhận diện khi xong)</span>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setPaymentQrOpen(false)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#fff",
                        color: "#334155",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={checkPaymentManual}
                      disabled={paymentChecking}
                      style={{
                        flex: 1.2,
                        padding: "10px",
                        borderRadius: 10,
                        border: "1px solid #93c5fd",
                        backgroundColor: "#eff6ff",
                        color: "#2563eb",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: paymentChecking ? "not-allowed" : "pointer",
                      }}
                    >
                      {paymentChecking ? "Đang kiểm..." : "Kiểm tra ngay"}
                    </button>
                    <a
                      href={paymentQrData.paymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1.5,
                        padding: "10px",
                        borderRadius: 10,
                        border: "none",
                        backgroundColor:
                          paymentQrData.gateway === "VNPAY" ? "#2563eb" : "#d946ef",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      Mở App thanh toán
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
