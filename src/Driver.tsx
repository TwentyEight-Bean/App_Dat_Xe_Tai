import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react"

import "./driver.css"
import { uploadImageWithFallback } from "./lib/cloudinaryClient"
import DriverAuthGate from "./DriverAuthGate"
import { removeDeviceTokenFromServer } from "./lib/deviceTokenClient"

import {
  ChatScreen,
  CURRENT_CONV,
  setOrderStatus,
  simulateCustomerPing,
  startAmbient,
  useUnread,
} from "./chat"

import { runTabTransition, type TabDirection } from "./tabMotion"

import InteractiveMap from "./InteractiveMap"
import { subscribeRealtime, emitLocalRealtime } from "./lib/pusherClient"
import CallingModal from "./CallingModal"
import TopUpModal from "./TopUpModal"
import InsurancePolicyModal from "./InsurancePolicyModal"
import ComplaintModal from "./ComplaintModal"

/* ---------- icons ---------- */

type IconName = "home" | "route" | "wallet" | "user" | "bell" | "layers" | "target" | "check" | "chevron" | "chevron-up" | "chevron-down" | "back" | "phone" | "message" | "pin" | "flag" | "camera" | "upload" | "shield" | "box" | "clock" | "navigate" | "truck" | "plus" | "search"

function Icon({
  name,

  size = 22,

  strokeWidth = 2,
}: {
  name: IconName

  size?: number

  strokeWidth?: number
}) {
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
      </>
    ),

    route: (
      <>
        <circle cx="6" cy="18" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.500" />
      </>
    ),

    wallet: (
      <>
        <path d="M4 7a2 2 0 0 1 2-2h12v4" />
        <path d="M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2Z" />
        <circle cx="16.500" cy="14.500" r="1.200" />
      </>
    ),

    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.800 21a7.200 7.200 0 0 1 14.400 0" />
      </>
    ),

    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),

    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),

    target: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </>
    ),

    check: <path d="m5 12 4 4L19 6" />,

    chevron: <path d="m9 18 6-6-6-6" />,

    "chevron-up": <path d="m18 15-6-6-6 6" />,

    "chevron-down": <path d="m6 9 6 6 6-6" />,

    back: <path d="m15 18-6-6 6-6" />,

    phone: (
      <path d="M22 16.900v3a2 2 0 0 1-2.200 2 19.800 19.800 0 0 1-8.600-3.100 19.500 19.500 0 0 1-6-6A19.800 19.800 0 0 1 2.100 4.200 2 2 0 0 1 4.100 2h3a2 2 0 0 1 2 1.700c.1 1 .4 1.900.7 2.800a2 2 0 0 1-.5 2.100L8.100 9.900a16 16 0 0 0 6 6l1.300-1.300a2 2 0 0 1 2.100-.5c.9.3 1.800.6 2.800.7a2 2 0 0 1 1.700 2Z" />
    ),

    message: (
      <path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.800-4A8 8 0 1 1 21 12Z" />
    ),

    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.500" />
      </>
    ),

    flag: (
      <>
        <path d="M5 21V4" />
        <path d="M5 4h11l-2 4 2 4H5" />
      </>
    ),

    camera: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.500" />
      </>
    ),

    upload: (
      <>
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M4 16v4h16v-4" />
      </>
    ),

    shield: (
      <>
        <path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6l-7-3Z" />
        <path d="m9 12 2.200 2.200L15 10" />
      </>
    ),

    box: (
      <>
        <path d="m12 3 8 4.500v9L12 21l-8-4.500v-9L12 3Z" />
        <path d="m4 7.500 8 4.500 8-4.500M12 12v9" />
      </>
    ),

    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    navigate: <path d="M12 3 5 20l7-4 7 4-7-17Z" />,

    truck: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),

    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
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

const money = (n: number) => `${n.toLocaleString("vi-VN")}đ`

/* ---------- data ---------- */

type Job = "none" | "incoming" | "toPickup" | "atPickup" | "delivering" | "complete"

type Tab = "home" | "trips" | "earnings" | "account"

type Entry = {
  id: number

  when: string

  route: string

  amount: number

  status: string
}

const seedHistory: Entry[] = []

/* ---------- shared bits ---------- */

function DriverMap({ job, online }: { job: Job; online: boolean }) {
  const toPickup = job === "toPickup" || job === "atPickup"

  const delivering = job === "delivering"

  const path = toPickup
    ? "M28 148 C78 150 118 184 160 194 S192 198 205 198"
    : "M205 198 C226 190 246 176 258 158 S282 126 292 112"

  const me = toPickup
    ? job === "atPickup"
      ? { left: 205, top: 198 }
      : { left: 28, top: 148 }
    : { left: 205, top: 198 }

  return (
    <div
      className="map driver-map"
      role="img"
      aria-label="Bản đồ khu vực Thành phố Hồ Chí Minh"
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

      {online && job === "none" && (
        <>
          <span className="d-hot" style={{ left: 70, top: 150 }} />
          <span
            className="d-hot"
            style={{ left: 300, top: 210, width: 120, height: 120 }}
          />
          <span className="d-hot-label" style={{ left: 40, top: 186 }}>
            Nhu cầu cao
          </span>
        </>
      )}

      {(toPickup || delivering) && (
        <svg
          aria-hidden="true"
          className="route-svg"
          key={toPickup ? "a" : "b"}
          viewBox="0 0 390 844"
          preserveAspectRatio="xMinYMin meet"
        >
          <path className="route-casing" d={path} />
          <path
            className={`route-stroke ${delivering ? "delivery" : ""}`}
            d={path}
            pathLength={1}
          />
        </svg>
      )}

      {toPickup && (
        <span className="dest-marker" style={{ top: 198, left: 205 }}>
          <span className="dest-pin d-pickup-pin">
            <Icon name="box" size={16} />
          </span>
          <span className="dest-label">Điểm lấy</span>
        </span>
      )}
      {delivering && (
        <span className="dest-marker">
          <span className="dest-pin">
            <Icon name="flag" size={16} />
          </span>
          <span className="dest-label">Điểm giao</span>
        </span>
      )}

      {job === "none" ? (
        <span className={`map-pin ${online ? "" : "d-off"}`}>
          {online && <span className="search-ring" />}
          <span className="pin-pulse" />
          <span className="pin-core" />
        </span>
      ) : (
        <span className="d-me" style={{ left: me.left, top: me.top }}>
          <Icon name="navigate" size={18} strokeWidth={2.2} />
        </span>
      )}
    </div>
  )
}

function MapTools() {
  return (
    <div className="map-tools d-tools">
      <button
        aria-label="Lớp bản đồ"
        className="icon-button glass"
        type="button"
      >
        <Icon name="layers" />
      </button>
      <button
        aria-label="Vị trí của tôi"
        className="icon-button glass locate"
        type="button"
      >
        <Icon name="target" />
      </button>
    </div>
  )
}

const driverNavItems: { id: Tab; label: string; icon: IconName }[] = [
  { id: "home", label: "Trang chủ", icon: "home" },

  { id: "trips", label: "Cuốc xe", icon: "route" },

  { id: "earnings", label: "Thu nhập", icon: "wallet" },

  { id: "account", label: "Tài khoản", icon: "user" },
]

function DriverNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const index = driverNavItems.findIndex((i) => i.id === tab)

  const [flow, setFlow] = useState<TabDirection | null>(null)

  const flowTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (flowTimer.current) window.clearTimeout(flowTimer.current)
    },

    [],
  )

  const select = (nextTab: Tab, nextIndex: number) => {
    if (nextIndex === index) return

    setFlow(nextIndex > index ? "right" : "left")

    if (flowTimer.current) window.clearTimeout(flowTimer.current)

    flowTimer.current = window.setTimeout(() => setFlow(null), 600)

    onChange(nextTab)
  }

  return (
    <nav
      aria-label="Điều hướng tài xế"
      className={`bottom-nav glass glass-strong d-nav ${
        flow ? `nav-flow-${flow}` : ""
      }`}
      style={{ "--i": index } as CSSProperties}
    >
      <span className="nav-indicator" aria-hidden="true" />
      {driverNavItems.map((item, itemIndex) => (
        <button
          className={`nav-item ${tab === item.id ? "active" : ""}`}
          key={item.id}
          onClick={() => select(item.id, itemIndex)}
          type="button"
        >
          <span className="nav-icon">
            <Icon name={item.icon} size={24} />
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

function ConfirmButton({
  label,

  onConfirm,
}: {
  label: string

  onConfirm: () => void
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return

    const t = window.setTimeout(() => setArmed(false), 3500)

    return () => window.clearTimeout(t)
  }, [armed])

  return (
    <button
      className={`d-cta primary ${armed ? "armed" : ""}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      type="button"
    >
      <span>{armed ? "CHẠM LẦN NỮA ĐỂ XÁC NHẬN" : label}</span>
      {!armed && <Icon name="chevron" size={26} strokeWidth={2.6} />}
      {armed && <span className="d-armed-bar" />}
    </button>
  )
}

function ContactRow({
  name,
  role,
  onMessage,
  onCall,
}: {
  name: string
  role: string
  onMessage: () => void
  onCall?: () => void
}) {
  const unread = useUnread("driver")

  return (
    <div className="d-contact">
      <span className="d-avatar" aria-hidden="true">
        {name.split(" ").slice(-1)[0].slice(0, 1)}
        {name.split(" ")[0].slice(0, 1)}
      </span>
      <span className="d-contact-id">
        <strong>{name}</strong>
        <small>{role}</small>
      </span>
      <button
        id="driver-btn-chat"
        aria-label={`Nhắn tin cho ${name}`}
        className="d-round"
        onClick={(e) => {
          e.stopPropagation()
          onMessage()
        }}
        type="button"
      >
        <Icon name="message" size={24} />
        {unread > 0 && <span className="d-msg-dot" />}
      </button>
      <button
        aria-label={`Gọi ${name}`}
        className="d-round call"
        onClick={onCall}
        type="button"
      >
        <Icon name="phone" size={24} />
      </button>
    </div>
  )
}

function EntryList({
  entries,
  emptyMessage = "Chưa có cuốc xe nào trong khoảng thời gian này.",
}: {
  entries: Entry[]
  emptyMessage?: string
}) {
  if (!entries || entries.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "36px 20px",
          textAlign: "center",
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px dashed #cbd5e1",
          margin: "12px 0",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        }}
      >
        <span
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "rgba(20, 120, 212, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1478d4",
            marginBottom: "12px",
          }}
        >
          <Icon name="truck" size={26} />
        </span>
        <strong style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
          {emptyMessage}
        </strong>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0, maxWidth: "280px", lineHeight: 1.5 }}>
          Bật trực tuyến và sẵn sàng nhận cuốc xe gần nhất từ khách hàng.
        </p>
      </div>
    )
  }

  return (
    <ul className="d-entries">
      {entries.map((e) => (
        <li key={e.id}>
          <span className="d-entry-icon">
            <Icon name="box" size={20} />
          </span>
          <span className="d-entry-main">
            <strong>{e.route}</strong>
            <small>{e.when}</small>
          </span>
          <span className="d-entry-side">
            <strong>+{money(e.amount)}</strong>
            <em className={e.status === "Đã nhận" ? "ok" : "wait"}>
              {e.status === "Đã nhận" && (
                <Icon name="check" size={11} strokeWidth={3} />
              )}
              {e.status}
            </em>
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ---------- onboarding ---------- */

const steps = [
  "Thông tin cá nhân",

  "Xác minh danh tính",

  "Giấy phép lái xe",

  "Đăng ký xe",

  "Thông tin xe",

  "Xem lại & gửi",
]

function Upload({
  label,

  hint,

  file,

  done,

  onToggle,

  onUploaded,

  icon = "camera",
}: {
  label: string

  hint: string

  file?: string

  done: boolean

  onToggle?: () => void

  onUploaded?: (url: string, fileName: string) => void

  icon?: IconName
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return

    setIsUploading(true)
    setErrorMsg("")

    try {
      // Gọi API Cloudinary với cơ chế tự động: Direct Upload (signature) -> Server Upload (POST /api/v1/upload/server)
      const cloudUrl = await uploadImageWithFallback(f, "licenses")
      if (onUploaded) {
        onUploaded(cloudUrl, f.name)
      } else if (onToggle) {
        onToggle()
      }
    } catch (err: any) {
      console.error("Lỗi tải ảnh giấy tờ lên Cloudinary:", err)
      setErrorMsg(err.message || "Tải ảnh thất bại")
      // Vẫn hỗ trợ fallback nếu gặp lỗi mạng/môi trường demo
      if (onUploaded) {
        onUploaded(URL.createObjectURL(f), f.name)
      } else if (onToggle) {
        onToggle()
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleTriggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    } else if (onToggle) {
      onToggle()
    }
  }

  return (
    <>
      <input
        type="file"
        accept="image/*"
        hidden
        ref={fileInputRef}
        onChange={handleFilePicked}
      />
      <button
        className={`d-upload ${done ? "done" : ""}`}
        disabled={isUploading}
        onClick={handleTriggerUpload}
        type="button"
      >
        <span className="d-upload-icon">
          <Icon
            name={done ? "check" : icon}
            size={22}
            strokeWidth={done ? 2.8 : 2}
          />
        </span>
        <span className="d-upload-copy">
          <strong>{label}</strong>
          <small>
            {isUploading
              ? "Đang tải ảnh lên Cloud..."
              : errorMsg
                ? errorMsg
                : done
                  ? file
                  : hint}
          </small>
        </span>
        <span className="d-upload-action">
          {isUploading ? "Đang tải..." : done ? "Chụp lại" : "Tải lên"}
        </span>
      </button>
    </>
  )
}

function Field({
  label,

  value,

  onChange,

  placeholder,

  inputMode,
}: {
  label: string

  value: string

  onChange: (v: string) => void

  placeholder: string

  inputMode?: "numeric" | "tel" | "text"
}) {
  return (
    <label className="d-field">
      <span>{label}</span>
      <input
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  )
}

const vehicleChoices = [
  { id: "small", name: "Xe tải nhỏ", load: "Đến 100kg" },

  { id: "van", name: "Xe van", load: "Đến 500kg" },

  { id: "500", name: "Tải 500kg", load: "Thùng 2m" },

  { id: "1000", name: "Tải 1 tấn", load: "Thùng 3m" },
]

function Onboarding({
  onDone,
  onExit,
  onBackToCustomer,
  onLogout,
}: {
  onDone: () => void
  onExit?: () => void
  onBackToCustomer?: () => void
  onLogout?: () => void
}) {
  const [step, setStep] = useState(0)
  const [exitModalOpen, setExitModalOpen] = useState(false)

  const [submitted, setSubmitted] = useState(false)

  const [approved, setApproved] = useState(false)

  const [agree, setAgree] = useState(false)

  const [vehicleTypesList, setVehicleTypesList] = useState<
    Array<{ id: string; name: string; load: string }>
  >(vehicleChoices)

  const [f, setF] = useState({
    name: "",

    phone: "",

    birth: "",

    area: "",

    idNo: "",

    licenseNo: "",

    licenseClass: "B2",

    plate: "",

    vehicle: "van",

    vehicleTypeId: "",

    brand: "",
  })

  const [docs, setDocs] = useState<
    Record<string, { url: string; fileName: string }>
  >({})
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false)
  const [kycError, setKycError] = useState("")

  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }))

  const handleDocUploaded =
    (k: string) => (url: string, fileName: string) => {
      setDocs((d) => ({ ...d, [k]: { url, fileName } }))
    }

  useEffect(() => {
    fetch("/api/v1/driver/vehicle-types")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const mapped = data.data.map((vt: any) => ({
            id: vt.id,
            name: vt.name,
            load: vt.maxPayloadKg
              ? `Đến ${vt.maxPayloadKg}kg`
              : vt.description || "",
          }))
          setVehicleTypesList(mapped)
          setF((prev) => ({
            ...prev,
            vehicle:
              prev.vehicle && mapped.some((m: any) => m.id === prev.vehicle)
                ? prev.vehicle
                : mapped[0].id,
            vehicleTypeId:
              prev.vehicleTypeId ||
              (mapped.some((m: any) => m.id === prev.vehicle)
                ? prev.vehicle
                : mapped[0].id),
          }))
        }
      })
      .catch((err) =>
        console.warn("Could not load dynamic vehicle types:", err),
      )
  }, [])

  useEffect(() => {
    if (!submitted) return

    let cancelled = false
    const checkKycStatus = async () => {
      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("driver_auth_token") ||
              localStorage.getItem("auth_token")
            : null
        if (!token) return

        const res = await fetch("/api/v1/driver/kyc/status", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.success && data.data?.kycStatus === "APPROVED") {
          if (!cancelled) setApproved(true)
        }
      } catch (e) {
        // Fallback demo timer handled below
      }
    }

    const interval = window.setInterval(checkKycStatus, 3000)
    const t = window.setTimeout(() => {
      if (!cancelled) setApproved(true)
    }, 4500)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.clearTimeout(t)
    }
  }, [submitted])

  const valid = [
    f.name.trim() &&
      f.phone.trim().length >= 9 &&
      f.birth.trim() &&
      f.area.trim(),

    f.idNo.trim().length >= 9 && !!docs.idFront && !!docs.idBack && !!docs.selfie,

    f.licenseNo.trim() && !!docs.license,

    f.plate.trim() && !!docs.registration,

    f.brand.trim() && !!docs.vehiclePhoto,

    agree,
  ][step]

  if (submitted) {
    return (
      <section className="d-screen d-center">
        <div className={`d-approve-badge ${approved ? "ok" : ""}`}>
          <Icon
            name={approved ? "check" : "shield"}
            size={44}
            strokeWidth={approved ? 3 : 2}
          />
        </div>
        <h1>{approved ? "Hồ sơ đã được duyệt!" : "Đã nhận hồ sơ của bạn"}</h1>
        <p>
          {approved
            ? "Chào mừng bạn gia nhập đội ngũ tài xế. Bạn có thể bắt đầu nhận cuốc ngay."
            : "Chúng tôi đang kiểm tra giấy tờ. Thường chỉ mất vài phút."}
        </p>
        <ol className="d-timeline">
          <li className="done">
            <span>
              <Icon name="check" size={14} strokeWidth={3} />
            </span>
            Đã gửi hồ sơ
          </li>
          <li className={approved ? "done" : "now"}>
            <span>
              {approved && <Icon name="check" size={14} strokeWidth={3} />}
            </span>
            Kiểm tra giấy tờ
          </li>
          <li className={approved ? "done" : ""}>
            <span>
              {approved && <Icon name="check" size={14} strokeWidth={3} />}
            </span>
            Kích hoạt tài khoản
          </li>
        </ol>
        <button
          className="d-cta primary"
          disabled={!approved}
          onClick={onDone}
          type="button"
        >
          <span>{approved ? "VÀO TRANG CHỦ" : "ĐANG KIỂM TRA…"}</span>
          {approved && <Icon name="chevron" size={26} strokeWidth={2.6} />}
        </button>
        <button
          type="button"
          onClick={onDone}
          style={{
            marginTop: "14px",
            background: "none",
            border: "none",
            color: "var(--ink-500, #64748b)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          ← Vào Trang chủ Tài xế
        </button>
      </section>
    )
  }

  return (
    <section className="d-screen d-onboard">
      <header className="d-ob-head">
        {step > 0 ? (
          <button
            aria-label="Quay lại"
            className="d-round"
            onClick={() => setStep(step - 1)}
            type="button"
          >
            <Icon name="back" size={24} />
          </button>
        ) : (
          <button
            aria-label="Về trang chủ tài xế"
            className="d-round"
            onClick={() => {
              if (onExit) onExit()
              else onDone()
            }}
            type="button"
            title="Vào trang chủ Tài xế"
          >
            <Icon name="back" size={24} />
          </button>
        )}
        <span className="d-step-count">
          Bước {step + 1}/{steps.length}
        </span>
        <button
          aria-label="Bỏ qua vào trang chủ"
          type="button"
          onClick={() => setExitModalOpen(true)}
          style={{
            background: "rgba(0, 0, 0, 0.05)",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            borderRadius: "10px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--ink-700, #334155)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "all 0.15s ease",
          }}
        >
          <span>Bỏ qua</span>
          <span style={{ fontSize: "12px" }}>➔</span>
        </button>
      </header>
      <div
        className="d-progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={6}
        aria-valuenow={step + 1}
      >
        {steps.map((s, i) => (
          <span className={i <= step ? "on" : ""} key={s} />
        ))}
      </div>

      <div className="d-ob-body" key={step}>
        <h1>{steps[step]}</h1>
        {step === 0 && (
          <>
            <p>Chỉ mất vài phút. Thông tin của bạn được bảo mật.</p>
            <Field
              label="Họ và tên"
              onChange={set("name")}
              placeholder="Nguyễn Văn Minh"
              value={f.name}
            />
            <Field
              inputMode="tel"
              label="Số điện thoại"
              onChange={set("phone")}
              placeholder="09xx xxx xxx"
              value={f.phone}
            />
            <Field
              label="Ngày sinh"
              onChange={set("birth")}
              placeholder="dd/mm/yyyy"
              value={f.birth}
            />
            <Field
              label="Khu vực hoạt động"
              onChange={set("area")}
              placeholder="VD: TP. Hồ Chí Minh"
              value={f.area}
            />
          </>
        )}
        {step === 1 && (
          <>
            <p>Giúp khách hàng yên tâm khi bạn đến nhận hàng.</p>
            <Field
              inputMode="numeric"
              label="Số CCCD"
              onChange={set("idNo")}
              placeholder="12 chữ số"
              value={f.idNo}
            />
            <Upload
              done={!!docs.idFront}
              file={docs.idFront?.fileName || "cccd-mat-truoc.jpg"}
              hint="Chụp rõ 4 góc giấy tờ"
              label="CCCD mặt trước"
              onUploaded={handleDocUploaded("idFront")}
            />
            <Upload
              done={!!docs.idBack}
              file={docs.idBack?.fileName || "cccd-mat-sau.jpg"}
              hint="Chụp rõ 4 góc giấy tờ"
              label="CCCD mặt sau"
              onUploaded={handleDocUploaded("idBack")}
            />
            <Upload
              done={!!docs.selfie}
              file={docs.selfie?.fileName || "anh-xac-thuc.jpg"}
              hint="Chụp khuôn mặt, cầm CCCD cạnh mặt"
              icon="shield"
              label="Ảnh xác thực"
              onUploaded={handleDocUploaded("selfie")}
            />
          </>
        )}
        {step === 2 && (
          <>
            <p>Dùng giấy phép lái xe còn hiệu lực.</p>
            <Field
              inputMode="numeric"
              label="Số giấy phép lái xe"
              onChange={set("licenseNo")}
              placeholder="12 chữ số"
              value={f.licenseNo}
            />
            <div className="d-field">
              <span>Hạng bằng</span>
              <div className="d-chips">
                {["B2", "C", "D"].map((c) => (
                  <button
                    className={f.licenseClass === c ? "on" : ""}
                    key={c}
                    onClick={() => set("licenseClass")(c)}
                    type="button"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <Upload
              done={!!docs.license}
              file={docs.license?.fileName || "gplx-mat-truoc.jpg"}
              hint="Chụp mặt trước, không bị lóa"
              label="Giấy phép lái xe"
              onUploaded={handleDocUploaded("license")}
            />
          </>
        )}
        {step === 3 && (
          <>
            <p>Dùng để xác nhận xe thuộc quyền sử dụng của bạn.</p>
            <Field
              label="Biển số xe"
              onChange={set("plate")}
              placeholder="VD: 51D-482.15"
              value={f.plate}
            />
            <Upload
              done={!!docs.registration}
              file={docs.registration?.fileName || "cavet-xe.jpg"}
              hint="Chụp cà vẹt xe, đủ 4 góc"
              label="Giấy đăng ký xe"
              onUploaded={handleDocUploaded("registration")}
            />
          </>
        )}
        {step === 4 && (
          <>
            <p>Chọn loại xe bạn sẽ chạy.</p>
            <div className="d-vehicle-grid">
              {vehicleTypesList.map((v) => (
                <button
                  className={f.vehicle === v.id ? "on" : ""}
                  key={v.id}
                  onClick={() => {
                    set("vehicle")(v.id)
                    setF((prev) => ({ ...prev, vehicleTypeId: v.id }))
                  }}
                  type="button"
                >
                  <Icon name="truck" size={24} />
                  <strong>{v.name}</strong>
                  <small>{v.load}</small>
                </button>
              ))}
            </div>
            <Field
              label="Hãng xe và đời xe"
              onChange={set("brand")}
              placeholder="VD: Suzuki Blind Van 2021"
              value={f.brand}
            />
            <Upload
              done={!!docs.vehiclePhoto}
              file={docs.vehiclePhoto?.fileName || "anh-xe.jpg"}
              hint="Chụp toàn bộ xe, thấy rõ biển số"
              label="Ảnh xe thực tế"
              onUploaded={handleDocUploaded("vehiclePhoto")}
            />
          </>
        )}
        {step === 5 && (
          <>
            <p>Kiểm tra lại trước khi gửi. Bạn có thể quay lại để sửa.</p>
            <ul className="d-review">
              {[
                ["Họ và tên", f.name, 0],

                ["Số điện thoại", f.phone, 0],

                ["CCCD và ảnh xác thực", `${f.idNo} · 3 ảnh`, 1],

                [
                  "Giấy phép lái xe",

                  `Hạng ${f.licenseClass} · ${f.licenseNo}`,

                  2,
                ],

                [
                  "Xe",

                  `${vehicleTypesList.find((v) => v.id === f.vehicle)?.name || "Xe tải"} · ${f.plate}`,

                  3,
                ],
              ].map(([k, v, s]) => (
                <li key={k as string}>
                  <span className="d-review-tick">
                    <Icon name="check" size={14} strokeWidth={3} />
                  </span>
                  <span>
                    <small>{k}</small>
                    <strong>{v}</strong>
                  </span>
                  <button onClick={() => setStep(s as number)} type="button">
                    Sửa
                  </button>
                </li>
              ))}
            </ul>
            <label className="d-agree">
              <input
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                type="checkbox"
              />
              <span>
                Tôi xác nhận thông tin là chính xác và đồng ý với điều khoản
                dành cho tài xế.
              </span>
            </label>
          </>
        )}
      </div>

      <footer className="d-ob-foot">
        {kycError && (
          <div style={{ color: "#ef4444", fontSize: "12px", textAlign: "center", marginBottom: "8px" }}>
            {kycError}
          </div>
        )}
        <button
          className="d-cta primary"
          disabled={!valid || isSubmittingKyc}
          onClick={async () => {
            if (step === steps.length - 1) {
              setIsSubmittingKyc(true)
              setKycError("")
              try {
                const token =
                  typeof window !== "undefined"
                    ? localStorage.getItem("driver_auth_token") ||
                      localStorage.getItem("auth_token")
                    : null

                const documentsPayload = [
                  { docType: "CCCD_FRONT", fileUrl: docs.idFront?.url, docNumber: f.idNo },
                  { docType: "CCCD_BACK", fileUrl: docs.idBack?.url, docNumber: f.idNo },
                  { docType: "PORTRAIT", fileUrl: docs.selfie?.url },
                  { docType: "DRIVER_LICENSE", fileUrl: docs.license?.url, docNumber: f.licenseNo },
                  { docType: "VEHICLE_REGISTRATION", fileUrl: docs.registration?.url, docNumber: f.plate },
                ].filter((d) => !!d.fileUrl)

                if (token) {
                  const res = await fetch("/api/v1/driver/kyc/submit", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      licensePlate: f.plate,
                      driverLicenseNo: f.licenseNo,
                      vehicleTypeId:
                        f.vehicleTypeId ||
                        vehicleTypesList.find((v) => v.id === f.vehicle)?.id,
                      documents: documentsPayload,
                    }),
                  })
                  const data = await res.json()
                  if (!res.ok || !data.success) {
                    throw new Error(data.message || "Không thể gửi hồ sơ xét duyệt")
                  }
                }
                setSubmitted(true)
              } catch (err: any) {
                console.warn("Could not submit KYC to server:", err)
                setKycError(err.message || "Lỗi khi gửi hồ sơ xét duyệt")
              } finally {
                setIsSubmittingKyc(false)
              }
            } else {
              setStep(step + 1)
            }
          }}
          type="button"
        >
          <span>
            {isSubmittingKyc
              ? "ĐANG GỬI HỒ SƠ..."
              : step === steps.length - 1
              ? "GỬI HỒ SƠ"
              : "TIẾP TỤC"}
          </span>
          <Icon name="chevron" size={26} strokeWidth={2.6} />
        </button>
        {!valid && (
          <small className="d-foot-hint">
            Hoàn tất các mục trên để tiếp tục
          </small>
        )}
        <div style={{ textAlign: "center", marginTop: "10px" }}>
          <button
            type="button"
            onClick={() => {
              if (onExit) onExit()
              else onDone()
            }}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
              padding: "4px 8px",
            }}
          >
            ← Bỏ qua, vào thẳng Trang chủ Tài xế
          </button>
        </div>
      </footer>

      {exitModalOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 99,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setExitModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "360px",
              background: "#ffffff",
              borderRadius: "20px",
              padding: "20px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
              color: "#1e293b",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Tạm dừng thiết lập hồ sơ?
              </h3>
              <button
                type="button"
                onClick={() => setExitModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "18px",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b", lineHeight: 1.4 }}>
              Bạn có thể vào thẳng <strong>Trang chủ Tài xế</strong> để xem đơn hàng, bản đồ và bổ sung hồ sơ giấy tờ sau trong mục Tài khoản.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Nút 1: Vào trang chủ tài xế (Nổi bật) */}
              <button
                type="button"
                onClick={() => {
                  setExitModalOpen(false)
                  if (onExit) onExit()
                  else onDone()
                }}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  color: "#111827",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
                }}
              >
                <span>🚚</span>
                <span>Vào trang chủ Tài xế ngay</span>
              </button>

              {/* Nút 2: Chuyển sang khách hàng */}
              <button
                type="button"
                onClick={() => {
                  setExitModalOpen(false)
                  if (onBackToCustomer) onBackToCustomer()
                  else window.location.hash = ""
                }}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: "12px",
                  border: "1.5px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <span>🏠</span>
                <span>Chuyển sang giao diện Khách hàng</span>
              </button>

              {/* Nút 3: Đăng xuất */}
              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    setExitModalOpen(false)
                    onLogout()
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: "1px solid #fee2e2",
                    background: "#fff5f5",
                    color: "#dc2626",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <span>🚪</span>
                  <span>Đăng xuất tài xế</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setExitModalOpen(false)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "10px",
                  border: "none",
                  background: "none",
                  color: "#64748b",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Tiếp tục điền hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------- incoming order ---------- */

const EXPIRE = 20

function Incoming({
  offer,
  onAccept,
  onSkip,
  loading = false,
}: {
  offer?: any
  onAccept: () => void
  onSkip: () => void
  loading?: boolean
}) {
  const [left, setLeft] = useState(offer?.expiresInSeconds || EXPIRE)

  useEffect(() => {
    if (left <= 0) {
      onSkip()
      return
    }

    const t = window.setTimeout(() => setLeft((l: number) => l - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left, onSkip])

  const earning = offer?.driverEarning
    ? offer.driverEarning
    : offer?.totalPrice
    ? Math.round(Number(offer.totalPrice) * 0.8)
    : 0
  const pickup = offer?.originAddress || "Chưa xác định điểm đón"
  const destination = offer?.destinationAddress || "Chưa xác định điểm giao"
  const tripKm = offer?.distanceKm ? `${offer.distanceKm} km` : "Đang tính..."
  const vehicle = offer?.vehicleTypeName || "Xe tải"
  const estMin = offer?.distanceKm ? `${Math.max(10, Math.round(Number(offer.distanceKm) * 3))} phút` : "Dự kiến 20 phút"
  const pickupDist = offer?.pickupDistanceKm ? `${offer.pickupDistanceKm} km đến điểm lấy` : "Gần bạn · sẵn sàng đón"

  return (
    <section className="d-screen d-incoming" aria-live="assertive">
      <header className="d-inc-top">
        <span className="d-new-badge">
          <span className="d-ring-bell">
            <Icon name="bell" size={18} strokeWidth={2.4} />
          </span>
          Cuốc mới {offer?.bookingCode ? `#${offer.bookingCode}` : ""}
        </span>
        <span className="d-sound">Chuông và rung đang bật</span>
      </header>

      <div className={`d-countdown ${left <= 5 ? "low" : ""}`}>
        <span>
          Tự động bỏ qua sau <strong>{left} giây</strong>
        </span>
        <div>
          <i
            style={{
              width: `${(left / (offer?.expiresInSeconds || EXPIRE)) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="d-earn-hero">
        <small>Thu nhập thực nhận (80%)</small>
        <strong>{money(earning)}</strong>
        <span>
          {tripKm} · ~{estMin}
          {offer?.totalPrice ? ` · Cước khách: ${money(offer.totalPrice)}` : ""}
        </span>
      </div>

      <div className="d-inc-card">
        <div className="d-pickup-dist">
          <Icon name="navigate" size={20} />
          <strong>{pickupDist}</strong>
        </div>
        <div className="d-stops">
          <span className="d-stop-line" />
          <div>
            <span className="d-stop-dot pickup" />
            <span>
              <small>Điểm lấy hàng</small>
              <strong>{pickup}</strong>
            </span>
          </div>
          <div>
            <span className="d-stop-dot drop">
              <Icon name="flag" size={12} strokeWidth={2.6} />
            </span>
            <span>
              <small>Điểm giao hàng</small>
              <strong>{destination}</strong>
            </span>
          </div>
        </div>
        <div className="d-req">
          <span>
            <Icon name="truck" size={18} /> Yêu cầu: <strong>{vehicle}</strong>
          </span>
          <span>
            {offer?.paymentMethod === "CASH" ? "💵 Thu tiền mặt: " : "💳 Khách chuyển khoản: "}
            <strong>{money(offer?.totalPrice || (earning ? Math.round(earning / 0.8) : 0))}</strong>
          </span>
        </div>
      </div>

      <div className="d-inc-actions">
        <button
          className="d-cta ghost"
          disabled={loading}
          onClick={onSkip}
          type="button"
        >
          Bỏ qua
        </button>
        <button
          className="d-cta primary accept"
          disabled={loading}
          onClick={onAccept}
          type="button"
        >
          <span>{loading ? "ĐANG TIẾP NHẬN..." : "NHẬN CUỐC NGAY"}</span>
        </button>
      </div>
    </section>
  )
}

/* ---------- active job ---------- */

function ActiveJob({
  job,
  booking,
  onNext,
  onCancelTrip,
  onMessage,
  onCall,
  onOpenInsurance,
  onOpenComplaint,
  updating = false,
}: {
  job: "toPickup" | "atPickup" | "delivering"
  booking?: any
  onNext: (
    proofUrl?: string,
    otp?: string,
    coords?: { lat: number; lng: number },
    bypass?: boolean,
  ) => void
  onCancelTrip: () => void
  onMessage: () => void
  onCall?: () => void
  onOpenInsurance?: () => void
  onOpenComplaint?: () => void
  updating?: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const [pickupProofUrl, setPickupProofUrl] = useState<string>(booking?.pickupProofImage || "")
  const [deliveryProofUrl, setDeliveryProofUrl] = useState<string>(booking?.deliveryProofImage || "")
  const [deliveryOtpInput, setDeliveryOtpInput] = useState<string>("")
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [bypassGeofence, setBypassGeofence] = useState(false)
  const [uploadingPickupPhoto, setUploadingPickupPhoto] = useState(false)
  const [uploadingDeliveryPhoto, setUploadingDeliveryPhoto] = useState(false)
  const pickupPhotoInputRef = useRef<HTMLInputElement>(null)
  const deliveryPhotoInputRef = useRef<HTMLInputElement>(null)
  const [tripCallLogs, setTripCallLogs] = useState<any[]>([])

  // Đếm ngược 15 phút thời gian chờ bốc hàng miễn phí tại điểm đón
  const [waitingSeconds, setWaitingSeconds] = useState(900)
  useEffect(() => {
    if (job !== "atPickup") return
    const timer = window.setInterval(() => {
      setWaitingSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [job])

  // Lấy tọa độ GPS thực tế của tài xế khi giao hàng
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDriverCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          })
        },
        () => {
          const destLat = booking?.destination?.latitude || booking?.destLat
          const destLng = booking?.destination?.longitude || booking?.destLng
          if (destLat && destLng) {
            setDriverCoords({ lat: Number(destLat), lng: Number(destLng) })
          }
        },
        { enableHighAccuracy: true, timeout: 5000 },
      )
    }
  }, [booking?.destination, booking?.destLat, booking?.destLng])

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("driver_auth_token") || localStorage.getItem("auth_token")
        : null
    if (!token || !booking?.id) return
    fetch(`/api/v1/calls/trip/${booking.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setTripCallLogs(res.data)
        }
      })
      .catch(() => {})
  }, [booking?.id])

  const pickupAddr = booking?.originAddress || booking?.origin?.address || "Điểm đón hàng"
  const destAddr = booking?.destinationAddress || booking?.destination?.address || "Điểm giao hàng"
  const earning = booking?.driverEarning
    ? booking.driverEarning
    : booking?.totalPrice
    ? Math.round(Number(booking.totalPrice) * 0.8)
    : 0
  const customerName =
    booking?.customerName || booking?.customer?.fullName || booking?.customer?.name || "Khách hàng"
  const receiverName = booking?.receiverName || "Người nhận hàng"
  const tripKm = booking?.distanceKm ? `${booking.distanceKm} km` : "Đang tính..."
  const tripMin = booking?.distanceKm ? `${Math.max(10, Math.round(Number(booking.distanceKm) * 3))} phút` : "20 phút"

  const banner = {
    toPickup: {
      cls: "",
      title: "Đang đến điểm lấy",
      dist: booking?.pickupDistanceKm ? `${booking.pickupDistanceKm} km` : "1,5 km",
      eta: "5 phút",
      addr: pickupAddr,
    },
    atPickup: {
      cls: "ok",
      title: "Đã đến điểm lấy hàng",
      dist: "0 m",
      eta: "Có mặt",
      addr: pickupAddr,
    },
    delivering: {
      cls: "",
      title: "Đang vận chuyển giao hàng",
      dist: tripKm,
      eta: tripMin,
      addr: destAddr,
    },
  }[job]

  const stepText = {
    toPickup: "Bước 1/3 · Đến điểm lấy",
    atPickup: "Bước 2/3 · Bốc hàng lên xe",
    delivering: "Bước 3/3 · Giao hàng tại đích",
  }[job]

  const handlePickupPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPickupPhoto(true)
    try {
      const res = await uploadImageWithFallback(file)
      setPickupProofUrl((res as any)?.url || res)
    } catch (err) {
      console.warn("Upload pickup photo error:", err)
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") setPickupProofUrl(reader.result)
      }
      reader.readAsDataURL(file)
    } finally {
      setUploadingPickupPhoto(false)
    }
  }

  const handleDeliveryPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDeliveryPhoto(true)
    try {
      const res = await uploadImageWithFallback(file)
      setDeliveryProofUrl((res as any)?.url || res)
    } catch (err) {
      console.warn("Upload delivery photo error:", err)
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") setDeliveryProofUrl(reader.result)
      }
      reader.readAsDataURL(file)
    } finally {
      setUploadingDeliveryPhoto(false)
    }
  }

  return (
    <>
      <div className={`d-banner ${banner.cls}`} aria-live="polite">
        <span className="d-banner-icon">
          <Icon
            name={job === "atPickup" ? "check" : "navigate"}
            size={30}
            strokeWidth={job === "atPickup" ? 3 : 2.2}
          />
        </span>
        <span className="d-banner-copy">
          <small>{banner.title}</small>
          <strong>
            {banner.dist}
            {job !== "atPickup" && <> · {banner.eta}</>}
          </strong>
          <em>{banner.addr}</em>
        </span>
        <button
          aria-label="Hủy chuyến hoặc báo sự cố"
          className="d-banner-cancel-btn"
          onClick={onCancelTrip}
          title="Báo sự cố / Hủy chuyến xe"
          type="button"
        >
          ✕
        </button>
      </div>

      {!expanded ? (
        <div
          className="driver-peek-card glass-liquid active-peek"
          onClick={() => setExpanded(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setExpanded(true)}
        >
          <div className="sheet-handle" />
          <div className="driver-peek-content">
            <span
              className={`driver-peek-icon ${
                job === "atPickup" ? "online" : "working"
              }`}
            >
              <Icon
                name={job === "atPickup" ? "check" : "navigate"}
                size={22}
              />
            </span>
            <div className="driver-peek-text">
              <strong>{stepText}</strong>
              <small>{job === "delivering" ? destAddr : pickupAddr}</small>
            </div>
            <span
              className="d-earn-chip"
              style={{ fontSize: 13, padding: "5px 9px", margin: "0 4px" }}
            >
              +{money(earning)}
            </span>
            <button
              aria-label="Mở rộng chi tiết chuyến đi"
              className="driver-peek-btn"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(true)
              }}
              type="button"
            >
              <Icon name="chevron-up" size={20} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      ) : (
        <section className="d-sheet expanded">
          <div className="sheet-handle" onClick={() => setExpanded(false)} />
          <div className="d-sheet-head">
            <span className="d-status">
              <i />
              {stepText}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="d-earn-chip">+{money(earning)}</span>
              <button
                aria-label="Thu gọn bảng chuyến đi"
                className="sheet-collapse-btn"
                onClick={() => setExpanded(false)}
                type="button"
              >
                <Icon name="chevron-down" size={18} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {job === "delivering" ? (
            <div className="d-dest">
              <span className="d-stop-dot drop big">
                <Icon name="flag" size={16} strokeWidth={2.6} />
              </span>
              <span>
                <small>Điểm giao hàng</small>
                <strong>{destAddr}</strong>
              </span>
            </div>
          ) : (
            <div className="d-dest">
              <span className="d-stop-dot pickup big" />
              <span>
                <small>Điểm lấy hàng</small>
                <strong>{pickupAddr}</strong>
              </span>
            </div>
          )}

          {/* Đồng hồ đếm ngược thời gian chờ bốc hàng miễn phí (15 phút) */}
          {job === "atPickup" && (
            <div
              style={{
                margin: "6px 0 10px",
                padding: "10px 14px",
                borderRadius: "14px",
                background: waitingSeconds <= 0 ? "#fef2f2" : "#f0fdf4",
                border: waitingSeconds <= 0 ? "1.5px solid #fecaca" : "1.5px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>{waitingSeconds <= 0 ? "⚠️" : "⏱️"}</span>
                <div>
                  <div
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 800,
                      color: waitingSeconds <= 0 ? "#b91c1c" : "#166534",
                    }}
                  >
                    {waitingSeconds <= 0
                      ? "Đã hết 15 phút chờ hàng miễn phí!"
                      : `Thời gian chờ hàng miễn phí: ${Math.floor(waitingSeconds / 60)}:${(waitingSeconds % 60).toString().padStart(2, "0")}`}
                  </div>
                  <div style={{ fontSize: "11px", color: waitingSeconds <= 0 ? "#991b1b" : "#15803d", marginTop: "1px" }}>
                    {waitingSeconds <= 0
                      ? "Nếu khách không ra và không nghe máy, bạn có quyền báo vắng mặt nhận 30k"
                      : "Khách có tối đa 15 phút để chuẩn bị bốc hàng lên xe"}
                  </div>
                </div>
              </div>
              {waitingSeconds <= 0 && (
                <button
                  type="button"
                  onClick={onCancelTrip}
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Báo vắng mặt
                </button>
              )}
            </div>
          )}

          {job === "atPickup" && (
            <div
              style={{
                margin: "6px 0 10px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "#ffffff",
                border: "1.5px solid #0284c7",
                boxShadow: "0 2px 8px rgba(2, 132, 199, 0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong style={{ color: "#0369a1", fontSize: "13px", fontWeight: 800 }}>
                  📸 1. Ảnh kiện hàng lên xe <span style={{ color: "#dc2626" }}>* Bắt buộc</span>
                </strong>
                {pickupProofUrl && <span style={{ color: "#16a34a", fontSize: "12px", fontWeight: 800 }}>✓ Đã chụp</span>}
              </div>
              <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#475569", lineHeight: 1.4 }}>
                Gặp khách tại điểm lấy. Chụp ảnh kiện hàng đã sắp xếp an toàn trên thùng xe để làm căn cứ bảo vệ quyền lợi:
              </p>
              <input
                ref={pickupPhotoInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handlePickupPhotoSelect}
              />
              {pickupProofUrl ? (
                <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: "2px solid #0284c7", maxHeight: "130px" }}>
                  <img src={pickupProofUrl} alt="Ảnh bốc hàng" style={{ width: "100%", height: "130px", objectFit: "cover" }} />
                  <button
                    type="button"
                    onClick={() => pickupPhotoInputRef.current?.click()}
                    style={{
                      position: "absolute",
                      bottom: "6px",
                      right: "6px",
                      padding: "6px 12px",
                      background: "rgba(15, 23, 42, 0.88)",
                      color: "#ffffff",
                      borderRadius: "8px",
                      fontSize: "11.5px",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Đổi ảnh khác
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => pickupPhotoInputRef.current?.click()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1.5px dashed #0284c7",
                    background: "#f0f9ff",
                    color: "#0369a1",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Icon name="camera" size={18} strokeWidth={2.4} />
                  <span>{uploadingPickupPhoto ? "Đang tải ảnh..." : "+ Chụp/Đính kèm ảnh hàng lên xe"}</span>
                </button>
              )}
            </div>
          )}

          {job === "delivering" && (() => {
            const destLat = booking?.destination?.latitude || booking?.destLat
            const destLng = booking?.destination?.longitude || booking?.destLng
            let distanceMeters: number | null = null
            if (driverCoords && destLat && destLng) {
              const R = 6371000
              const radLat1 = (Number(destLat) * Math.PI) / 180
              const radLat2 = (driverCoords.lat * Math.PI) / 180
              const deltaLat = ((driverCoords.lat - Number(destLat)) * Math.PI) / 180
              const deltaLng = ((driverCoords.lng - Number(destLng)) * Math.PI) / 180
              const a =
                Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
              distanceMeters = Math.round(R * c)
            }
            const isGeofenceOk = distanceMeters !== null ? distanceMeters <= 500 || bypassGeofence : true

            return (
              <div style={{ margin: "6px 0 10px" }}>
                <div className="d-trip-stats">
                  <span>
                    <small>Cước thu khách</small>
                    <strong style={{ color: "#0284c7" }}>{money(booking?.totalPrice || earning)}</strong>
                  </span>
                  <span>
                    <small>Hình thức</small>
                    <strong style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>
                      {booking?.paymentMethod === "CASH" ? "💵 Tiền mặt" : "💳 Chuyển khoản"}
                    </strong>
                  </span>
                  <span>
                    <small>Thực nhận (80%)</small>
                    <strong style={{ color: "#166534" }}>+{money(earning)}</strong>
                  </span>
                </div>

                {/* [Lớp 1]: Định vị GPS Geofence */}
                <div
                  style={{
                    margin: "10px 0",
                    padding: "10px 14px",
                    borderRadius: "14px",
                    background: isGeofenceOk ? "#ecfdf5" : "#fffbeb",
                    border: isGeofenceOk ? "1.5px solid #a7f3d0" : "1.5px solid #fde68a",
                    boxShadow: isGeofenceOk ? "0 2px 8px rgba(16, 185, 129, 0.12)" : "0 2px 8px rgba(245, 158, 11, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>{isGeofenceOk ? "📍" : "⚠️"}</span>
                    <span
                      style={{
                        color: isGeofenceOk ? "#065f46" : "#92400e",
                        fontWeight: 700,
                        fontSize: "12.5px",
                        lineHeight: 1.3,
                      }}
                    >
                      {distanceMeters !== null
                        ? isGeofenceOk
                          ? `Đã đến vị trí giao (cách ${distanceMeters}m)`
                          : `Cách điểm giao ${distanceMeters >= 1000 ? (distanceMeters / 1000).toFixed(1) + "km" : distanceMeters + "m"} (yêu cầu ≤ 500m)`
                        : "Đang dò tọa độ GPS xe tải..."}
                    </span>
                  </div>
                  {!isGeofenceOk && distanceMeters !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Xác nhận bạn đã đến gần điểm giao (đỗ xe ngoài đường lớn / chung cư cấm xe tải vào trong)?")) {
                          setBypassGeofence(true)
                        }
                      }}
                      style={{
                        flexShrink: 0,
                        background: "#fef3c7",
                        border: "1px solid #f59e0b",
                        color: "#b45309",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "5px 10px",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      {bypassGeofence ? "✓ Đã mở" : "Báo đỗ xa"}
                    </button>
                  )}
                </div>

                {/* [Lớp Bảo Hiểm]: Nhắc nhở quy chế lộ trình & bảo hiểm hàng hóa cho tài xế */}
                <div
                  style={{
                    margin: "6px 0 10px",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    fontSize: "11.5px",
                    color: "#166534",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🛡️</span>
                    <span>
                      <strong>Bảo hiểm hàng hóa:</strong> Chỉ giao đúng điểm đến trên app để bảo vệ quyền lợi.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenInsurance}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#059669",
                      fontWeight: 700,
                      fontSize: "11px",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    Điều khoản
                  </button>
                </div>

                {/* [Lớp 2]: Bắt buộc ảnh POD */}
                <div
                  style={{
                    margin: "10px 0",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    background: "#ffffff",
                    border: "1.5px solid #e2e8f0",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong style={{ color: "#0f172a", fontSize: "13px", fontWeight: 800 }}>
                      📸 1. Ảnh bằng chứng giao hàng (POD) <span style={{ color: "#dc2626" }}>* Bắt buộc</span>
                    </strong>
                    {deliveryProofUrl && <span style={{ color: "#16a34a", fontSize: "12px", fontWeight: 800 }}>✓ Đã chụp</span>}
                  </div>
                  <input
                    ref={deliveryPhotoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleDeliveryPhotoSelect}
                  />
                  {deliveryProofUrl ? (
                    <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: "2px solid #16a34a", maxHeight: "130px" }}>
                      <img src={deliveryProofUrl} alt="POD" style={{ width: "100%", height: "130px", objectFit: "cover" }} />
                      <button
                        type="button"
                        onClick={() => deliveryPhotoInputRef.current?.click()}
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          right: "6px",
                          padding: "6px 12px",
                          background: "rgba(15, 23, 42, 0.88)",
                          color: "#ffffff",
                          borderRadius: "8px",
                          fontSize: "11.5px",
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Đổi ảnh khác
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => deliveryPhotoInputRef.current?.click()}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "11px 14px",
                        borderRadius: "10px",
                        border: "1.5px dashed #16a34a",
                        background: "#f0fdf4",
                        color: "#15803d",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <Icon name="camera" size={18} />
                      <span>{uploadingDeliveryPhoto ? "Đang xử lý ảnh POD..." : "+ Chụp ảnh kiện hàng giao khách"}</span>
                    </button>
                  )}
                </div>

                {/* [Lớp 3]: Mã OTP người nhận */}
                <div
                  style={{
                    margin: "10px 0 6px",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    background: "#ffffff",
                    border: "1.5px solid #e2e8f0",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <strong style={{ color: "#0f172a", fontSize: "13px", fontWeight: 800 }}>
                      🔐 2. Mã xác nhận nhận hàng (OTP) <span style={{ color: "#dc2626" }}>* Bắt buộc</span>
                    </strong>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#475569", lineHeight: 1.4 }}>
                    Hỏi người nhận hàng 4 chữ số bảo mật hiển thị trên ứng dụng của họ:
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="Nhập 4 số OTP"
                    value={deliveryOtpInput}
                    onChange={(e) => setDeliveryOtpInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "12px",
                      border: deliveryOtpInput.length === 4 ? "2px solid #16a34a" : "2px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#0f172a",
                      fontSize: "22px",
                      fontWeight: 800,
                      letterSpacing: "6px",
                      textAlign: "center",
                      outline: "none",
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  />
                </div>
              </div>
            )
          })()}

          <ContactRow
            onMessage={onMessage}
            onCall={onCall}
            name={job === "delivering" ? receiverName : customerName}
            role={job === "delivering" ? "Người nhận hàng" : "Khách hàng"}
          />

          {tripCallLogs.length > 0 && (
            <div
              style={{
                margin: "4px 0 10px",
                padding: "10px 12px",
                borderRadius: "12px",
                background: "#f1f5f9",
                border: "1.5px solid #cbd5e1",
                fontSize: "12px",
              }}
            >
              <div style={{ color: "#334155", marginBottom: "6px", fontWeight: 700 }}>
                📞 Đàm thoại giấu số cuốc này ({tripCallLogs.length}):
              </div>
              {tripCallLogs.map((c: any) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#0f172a",
                    fontWeight: 600,
                    padding: "3px 0",
                  }}
                >
                  <span>{c.caller_role === "DRIVER" ? "Bạn gọi" : "Khách gọi"}</span>
                  <span style={{ color: c.status === "ANSWERED" ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                    {c.status === "ANSWERED" ? `${c.duration_seconds || 0}s` : "Nhỡ"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {job === "toPickup" && (
              <button
                className="d-cta primary"
                disabled={updating}
                onClick={() => onNext()}
                type="button"
              >
                <span>{updating ? "ĐANG XỬ LÝ..." : "ĐÃ ĐẾN ĐIỂM LẤY"}</span>
                <Icon name="chevron" size={26} strokeWidth={2.6} />
              </button>
            )}
            {job === "atPickup" && (
              <ConfirmButton
                label={updating ? "ĐANG XỬ LÝ..." : "BẮT ĐẦU VẬN CHUYỂN"}
                onConfirm={() => {
                  if (!pickupProofUrl) {
                    alert("Vui lòng chụp hoặc đính kèm ảnh kiện hàng đã lên xe trước khi bắt đầu vận chuyển!")
                    pickupPhotoInputRef.current?.click()
                    return
                  }
                  onNext(pickupProofUrl)
                }}
              />
            )}
            {job === "delivering" && (
              <ConfirmButton
                label={updating ? "ĐANG XỬ LÝ..." : "HOÀN THÀNH GIAO HÀNG"}
                onConfirm={() => {
                  if (!deliveryProofUrl) {
                    alert("Vui lòng chụp hoặc đính kèm ảnh bằng chứng giao hàng (POD) trước khi hoàn tất cuốc xe!")
                    deliveryPhotoInputRef.current?.click()
                    return
                  }
                  if (deliveryOtpInput.trim().length !== 4) {
                    alert("Vui lòng nhập đủ 4 số mã OTP xác nhận từ người nhận hàng!")
                    return
                  }

                  const destLat = booking?.destination?.latitude || booking?.destLat
                  const destLng = booking?.destination?.longitude || booking?.destLng
                  let distM: number | null = null
                  if (driverCoords && destLat && destLng) {
                    const R = 6371000
                    const radLat1 = (Number(destLat) * Math.PI) / 180
                    const radLat2 = (driverCoords.lat * Math.PI) / 180
                    const deltaLat = ((driverCoords.lat - Number(destLat)) * Math.PI) / 180
                    const deltaLng = ((driverCoords.lng - Number(destLng)) * Math.PI) / 180
                    const a =
                      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                      Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
                    distM = Math.round(R * c)
                  }

                  if (distM !== null && distM > 500 && !bypassGeofence) {
                    const allow = confirm(
                      `Bạn đang cách điểm giao hàng ${
                        distM >= 1000 ? (distM / 1000).toFixed(1) + " km" : distM + " m"
                      }. Bạn có chắc chắn muốn xác nhận hoàn tất? (Hệ thống sẽ ghi nhận ngoại lệ đối soát)`
                    )
                    if (!allow) return
                    onNext(deliveryProofUrl, deliveryOtpInput.trim(), driverCoords || undefined, true)
                    return
                  }
                  onNext(deliveryProofUrl, deliveryOtpInput.trim(), driverCoords || undefined, bypassGeofence)
                }}
              />
            )}

            <button
              type="button"
              onClick={onCancelTrip}
              style={{
                background: "transparent",
                border: "none",
                color: "#dc2626",
                fontSize: "12.5px",
                fontWeight: 700,
                padding: "6px 0",
                cursor: "pointer",
                textAlign: "center",
                textDecoration: "underline",
              }}
            >
              Hủy nhận chuyến xe này
            </button>

            {/* Báo sự cố khẩn cấp dành cho tài xế */}
            <button
              type="button"
              onClick={onOpenComplaint}
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                color: "#b91c1c",
                fontSize: "12px",
                fontWeight: 700,
                padding: "8px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                marginTop: "2px",
              }}
            >
              <span>🚨</span>
              <span>Báo sự cố khẩn cấp (Tai nạn / Hàng hỏng / Sai lộ trình)</span>
            </button>
          </div>
        </section>
      )}
    </>
  )
}

function Complete({
  booking,
  wallet,
  onTopup,
  onContinue,
  onEarnings,
}: {
  booking?: any
  wallet?: any
  onTopup?: () => void
  onContinue: () => void
  onEarnings: () => void
}) {
  const [more, setMore] = useState(false)

  const currentBal = wallet ? Number(wallet.balance || 0) : 0
  const minLimit = wallet ? Number(wallet.minDepositLimit || 200000) : 200000
  const isQualified = wallet ? Boolean(wallet.isDepositQualified) : currentBal >= minLimit
  const shortfall = wallet ? Number(wallet.shortfall || 0) : Math.max(0, minLimit - currentBal)

  const earning = booking?.driverEarning
    ? booking.driverEarning
    : booking?.totalPrice
    ? Math.round(Number(booking.totalPrice) * 0.8)
    : 0
  const fee = booking?.totalPrice ? Number(booking.totalPrice) : 0
  const platform = Math.round(fee * 0.2)
  const tripKm = booking?.distanceKm ? `${booking.distanceKm} km` : "--"
  const tripMin = booking?.distanceKm
    ? `${Math.max(10, Math.round(Number(booking.distanceKm) * 3))} phút`
    : "20 phút"
  const pickup = booking?.originAddress || booking?.origin?.address || "Điểm lấy hàng"
  const destination = booking?.destinationAddress || booking?.destination?.address || "Điểm giao hàng"

  return (
    <section className="d-screen d-complete">
      <div className="d-done-badge">
        <Icon name="check" size={44} strokeWidth={3.2} />
      </div>
      <h1>Hoàn thành cuốc 🎉</h1>
      <div className="d-earn-hero small">
        <small>Thu nhập chuyến này</small>
        <strong>+{money(earning)}</strong>
      </div>
      <div className="d-done-stats">
        <span>
          <small>Quãng đường</small>
          <strong>{tripKm}</strong>
        </span>
        <span>
          <small>Thời gian</small>
          <strong>{tripMin}</strong>
        </span>
      </div>
      <div className="d-inc-card plain">
        <div className="d-stops">
          <span className="d-stop-line" />
          <div>
            <span className="d-stop-dot pickup" />
            <span>
              <small>Điểm lấy</small>
              <strong>{pickup}</strong>
            </span>
          </div>
          <div>
            <span className="d-stop-dot drop">
              <Icon name="flag" size={12} strokeWidth={2.6} />
            </span>
            <span>
              <small>Điểm giao</small>
              <strong>{destination}</strong>
            </span>
          </div>
        </div>
        {more && (
          <dl className="d-breakdown">
            <div>
              <dt>Cước chuyến</dt>
              <dd>{money(fee)}</dd>
            </div>
            <div>
              <dt>Phí nền tảng (20%)</dt>
              <dd>-{money(platform)}</dd>
            </div>
            <div className="t">
              <dt>Bạn nhận</dt>
              <dd>{money(earning)}</dd>
            </div>
          </dl>
        )}
      </div>

      {!isQualified && (
        <div
          style={{
            width: "100%",
            margin: "12px 0 14px",
            padding: "14px 16px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.08))",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "20px", lineHeight: 1 }}>⚠️</span>
            <div>
              <strong style={{ fontSize: "14px", color: "#b45309", display: "block" }}>
                Số dư ký quỹ sau cuốc: {money(currentBal)}
              </strong>
              <span style={{ fontSize: "12px", color: "#78350f", lineHeight: 1.4, display: "block", marginTop: "3px" }}>
                Hệ thống yêu cầu tối thiểu <strong>{money(minLimit)}</strong> để tiếp tục gửi đơn mới. Vui lòng nạp thêm <strong>{money(shortfall || (minLimit - currentBal))}</strong> ngay!
              </span>
            </div>
          </div>
          {onTopup && (
            <button
              type="button"
              onClick={onTopup}
              style={{
                width: "100%",
                padding: "11px 16px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "13px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow: "0 4px 12px rgba(245, 158, 11, 0.25)",
              }}
            >
              <span>⚡ Nạp tiền ký quỹ ngay (VietQR)</span>
            </button>
          )}
        </div>
      )}

      <div className="d-done-actions">
        <button className="d-cta primary" onClick={onContinue} type="button">
          <span>Tiếp tục nhận cuốc</span>
          <Icon name="chevron" size={26} strokeWidth={2.6} />
        </button>
        <button
          className="d-cta ghost"
          onClick={more ? onEarnings : () => setMore(true)}
          type="button"
        >
          {more ? "Xem thu nhập" : "Xem chi tiết"}
        </button>
      </div>
    </section>
  )
}

/* ---------- tabs ---------- */

function Earnings({
  entries,
  today,
  week,
  balance,
  trips,
  wallet,
  onOpenTopup,
  transactions = [],
  callLogs = [],
  onFilterChange,
}: {
  entries: Entry[]
  today: number
  week: number
  balance: number
  trips: number
  wallet?: any
  onOpenTopup?: () => void
  transactions?: any[]
  callLogs?: any[]
  onFilterChange?: (type: string) => void
}) {
  const [selectedFilter, setSelectedFilter] = useState("ALL")
  const currentBal = wallet ? Number(wallet.balance) : balance
  const isQualified = wallet ? Boolean(wallet.isDepositQualified) : true
  const minLimit = wallet ? Number(wallet.minDepositLimit) : 200000
  const shortfall = wallet ? Number(wallet.shortfall) : 0

  return (
    <section className="d-screen d-tab">
      <h1>Thu nhập & Ví Ký Quỹ</h1>
      <div className="d-balance" style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div>
            <small>Số dư ví ký quỹ</small>
            <strong>{money(currentBal)}</strong>
            <div style={{ marginTop: "6px", fontSize: "12px" }}>
              {isQualified ? (
                <span style={{ color: "#4ade80", fontWeight: 600 }}>✓ Đủ điều kiện ký quỹ ({money(minLimit)})</span>
              ) : (
                <span style={{ color: "#f87171", fontWeight: 600 }}>⚠ Thiếu ký quỹ: {money(shortfall)}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenTopup}
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "10px 14px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              whiteSpace: "nowrap",
            }}
          >
            <span>+</span>
            <span>Nạp ví</span>
          </button>
        </div>
      </div>
      <div className="d-three">
        <span>
          <small>Hôm nay</small>
          <strong>{money(today)}</strong>
        </span>
        <span>
          <small>Tuần này</small>
          <strong>{money(week)}</strong>
        </span>
        <span>
          <small>Số cuốc</small>
          <strong>{trips}</strong>
        </span>
      </div>

      <div style={{ marginTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h2 style={{ fontSize: "16px", margin: 0 }}>Biến động số dư ví ({transactions.length})</h2>
        </div>

        {/* Filter Chips cho loại giao dịch */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            paddingBottom: "6px",
            marginBottom: "10px",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {[
            { id: "ALL", label: "Tất cả" },
            { id: "COMMISSION_DEDUCTION", label: "Hoa hồng (20%)" },
            { id: "TRIP_INCOME", label: "Thu nhập (80%)" },
            { id: "TOPUP", label: "Nạp tiền" },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setSelectedFilter(chip.id)
                onFilterChange?.(chip.id)
              }}
              style={{
                padding: "4px 10px",
                borderRadius: "9999px",
                fontSize: "11px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                backgroundColor: selectedFilter === chip.id ? "#2563eb" : "#f1f5f9",
                color: selectedFilter === chip.id ? "#fff" : "#475569",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {transactions && transactions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {transactions.slice(0, 8).map((tx) => (
              <div
                key={tx.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(0, 0, 0, 0.06)",
                  boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                    {tx.type === "COMMISSION_DEDUCTION"
                      ? "Trừ hoa hồng cuốc xe"
                      : tx.type === "TRIP_INCOME"
                      ? "Thu nhập cuốc online"
                      : tx.type === "TOPUP"
                      ? "Nạp tiền ví ký quỹ"
                      : "Điều chỉnh số dư"}
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px" }}>
                    {tx.description || tx.reference_code || new Date(tx.created_at).toLocaleString("vi-VN")}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: Number(tx.amount) >= 0 ? "#16a34a" : "#dc2626",
                    whiteSpace: "nowrap",
                    marginLeft: "8px",
                  }}
                >
                  {Number(tx.amount) >= 0 ? `+${money(Number(tx.amount))}` : money(Number(tx.amount))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <h2>Lịch sử gần đây</h2>
            <EntryList entries={entries} />
          </div>
        )}
      </div>

      {callLogs && callLogs.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>Nhật ký cuộc gọi giấu số ({callLogs.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {callLogs.slice(0, 5).map((c: any) => {
              const m = Math.floor((c.durationSeconds || 0) / 60)
              const s = (c.durationSeconds || 0) % 60
              const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
              return (
                <div
                  key={c.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(0, 0, 0, 0.06)",
                    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
                    borderRadius: "12px",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
                      📞 {c.isCaller ? "Gọi khách hàng" : "Khách gọi đến"}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px" }}>
                      Đơn #{c.bookingCode || c.bookingId?.slice(0, 8)} · {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0284c7" }}>{timeStr}</div>
                    <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                      {c.callStatus === "ANSWERED" || c.callStatus === "COMPLETED" ? "Đã nghe" : "Nhỡ / Bận"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function Trips({
  entries,

  online,

  onGoHome,
}: {
  entries: Entry[]

  online: boolean

  onGoHome: () => void
}) {
  const todays = entries.filter(
    (e) => e.when.startsWith("Hôm nay") || e.when === "Vừa xong",
  )

  return (
    <section className="d-screen d-tab">
      <h1>Cuốc xe</h1>
      <div className={`d-trip-state ${online ? "on" : ""}`}>
        <strong>{online ? "Đang chờ cuốc mới" : "Bạn đang ngoại tuyến"}</strong>
        {!online && (
          <button
            className="d-cta primary small"
            onClick={onGoHome}
            type="button"
          >
            <span>Về trang chủ để bật nhận cuốc</span>
          </button>
        )}
      </div>
      <h2>Cuốc hôm nay</h2>
      <EntryList entries={todays} />
    </section>
  )
}

function Account({
  profile,
  onLogout,
  onReset,
}: {
  profile?: any
  onLogout: () => void
  onReset: () => void
}) {
  const driverName =
    profile?.fullName ||
    profile?.user?.fullName ||
    (typeof window !== "undefined" ? localStorage.getItem("driver_phone") : null) ||
    "Tài xế đối tác"
  const licensePlate = profile?.licensePlate || "Chưa cập nhật biển số"
  const vehicleName = profile?.vehicleTypeName || profile?.vehicleType?.name || "Xe tải"
  const rating = profile?.ratingAvg ? Number(profile.ratingAvg).toFixed(1) : "5.0"
  const kycStatus =
    profile?.kycStatus === "APPROVED"
      ? "Đã được duyệt"
      : profile?.kycStatus === "REJECTED"
        ? `Bị từ chối: ${profile?.rejectionReason || "Thiếu giấy tờ"}`
        : "Đang chờ duyệt"

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <section className="d-screen d-tab">
      <h1>Tài khoản</h1>
      <div className="d-profile">
        <span className="d-avatar big" aria-hidden="true">
          {getInitials(driverName)}
        </span>
        <span>
          <strong>{driverName}</strong>
          <small>{rating} sao · Đối tác xe tải</small>
        </span>
      </div>
      <ul className="d-review plain">
        <li>
          <span
            className="d-review-tick"
            style={
              profile?.kycStatus === "APPROVED"
                ? { background: "rgba(34, 197, 94, 0.2)", color: "#4ade80" }
                : profile?.kycStatus === "REJECTED"
                ? { background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }
                : { background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }
            }
          >
            <Icon name="shield" size={14} strokeWidth={2.6} />
          </span>
          <span>
            <small>Hồ sơ xét duyệt (KYC)</small>
            <strong
              style={
                profile?.kycStatus === "APPROVED"
                  ? { color: "#4ade80" }
                  : profile?.kycStatus === "REJECTED"
                  ? { color: "#f87171" }
                  : { color: "#fbbf24" }
              }
            >
              {kycStatus}
            </strong>
          </span>
        </li>
        <li>
          <span className="d-review-tick">
            <Icon name="truck" size={14} strokeWidth={2.6} />
          </span>
          <span>
            <small>Xe đang chạy</small>
            <strong>
              {vehicleName} · {licensePlate}
            </strong>
          </span>
        </li>
      </ul>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "24px" }}>
        <button className="d-cta ghost" onClick={onReset} type="button">
          Nộp lại hồ sơ KYC (bản demo)
        </button>
        <button
          className="d-cta danger"
          onClick={onLogout}
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            color: "#ef4444",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            fontWeight: 700,
          }}
          type="button"
        >
          Đăng xuất tài khoản đối tác
        </button>
      </div>
    </section>
  )
}

/* ---------- app ---------- */

export default function DriverApp() {
  const phoneRef = useRef<HTMLElement>(null)

  const [driverToken, setDriverToken] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("driver_auth_token")
      : null,
  )
  const [driverProfile, setDriverProfile] = useState<any>(null)

  const [registered, setRegistered] = useState(true)

  const [tab, setTab] = useState<Tab>("home")

  const [online, setOnline] = useState(false)

  const [job, setJob] = useState<Job>("none")

  const [history, setHistory] = useState<Entry[]>([])

  const [balance, setBalance] = useState(0)

  const [week, setWeek] = useState(0)
  const [todayIncome, setTodayIncome] = useState(0)
  const [todayTripsCount, setTodayTripsCount] = useState(0)

  const [notice, setNotice] = useState("")

  const [chatOpen, setChatOpen] = useState(false)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [callModalOpen, setCallModalOpen] = useState(false)
  const [topupModalOpen, setTopupModalOpen] = useState(false)
  const [driverWallet, setDriverWallet] = useState<any>(null)
  const [walletTxs, setWalletTxs] = useState<any[]>([])
  const [driverCallLogs, setDriverCallLogs] = useState<any[]>([])

  const loadDriverBookings = () => {
    if (!driverToken) return
    fetch("/api/v1/driver/bookings", {
      headers: { Authorization: `Bearer ${driverToken}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const formatted: Entry[] = res.data.map((b: any) => {
            const dt = new Date(b.createdAt)
            const isToday = dt.toDateString() === new Date().toDateString()
            const timeStr = dt.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })
            const when = isToday ? `Hôm nay, ${timeStr}` : dt.toLocaleDateString("vi-VN")
            const originShort = (b.originAddress || "").split(",")[0] || "Điểm đón"
            const destShort = (b.destinationAddress || "").split(",")[0] || "Điểm giao"

            let statusText = "Đã nhận"
            if (b.status === "COMPLETED") statusText = "Đã nhận"
            else if (b.status === "CANCELLED") statusText = "Đã hủy"
            else if (b.status === "IN_TRANSIT") statusText = "Đang giao"
            else if (b.status === "ARRIVED_AT_PICKUP") statusText = "Đã đến nơi nhận"
            else statusText = "Đang xử lý"

            return {
              id: b.id,
              when,
              route: `${originShort} → ${destShort}`,
              amount: b.driverEarning || Math.round((b.totalPrice || 0) * 0.8),
              status: statusText,
              bookingCode: b.bookingCode,
              distanceKm: b.distanceKm,
            }
          })
          setHistory(formatted)
          if (res.summary) {
            setTodayIncome(res.summary.todayEarnings || 0)
            setTodayTripsCount(res.summary.todayTrips || 0)
            setWeek(res.summary.weekEarnings || 0)
          }
        }
      })
      .catch((err) => console.warn("Could not load driver bookings:", err))
  }

  const loadDriverTxs = (type?: string) => {
    if (!driverToken) return
    const url =
      type && type !== "ALL"
        ? `/api/v1/driver/wallet/transactions?page=1&limit=20&type=${encodeURIComponent(type)}`
        : `/api/v1/driver/wallet/transactions?page=1&limit=20`
    fetch(url, {
      headers: { Authorization: `Bearer ${driverToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setWalletTxs(data.transactions || data.data || [])
        }
      })
      .catch((err) => console.warn("Could not load driver wallet transactions:", err))
  }

  const loadDriverWallet = () => {
    if (!driverToken) return
    fetch("/api/v1/driver/wallet", {
      headers: { Authorization: `Bearer ${driverToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setDriverWallet(data.data)
          setBalance(Number(data.data.balance || 0))
        }
      })
      .catch((err) => console.warn("Could not load driver wallet:", err))
  }

  useEffect(() => {
    if (!driverToken) return
    fetch("/api/v1/driver/profile", {
      headers: { Authorization: `Bearer ${driverToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setDriverProfile(data.data)
          if (typeof data.data.isOnline === "boolean") {
            setOnline(data.data.isOnline)
          }
        }
      })
      .catch((err) => console.warn("Could not load driver profile:", err))

    // Tải thông tin Ví Ký Quỹ thực tế từ DB
    loadDriverWallet()

    // Tải lịch sử cuốc xe thật từ DB
    loadDriverBookings()

    // Tải lịch sử biến động số dư ví
    loadDriverTxs()

    // Tải lịch sử cuộc gọi tổng quan
    fetch("/api/v1/calls/history", {
      headers: { Authorization: `Bearer ${driverToken}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setDriverCallLogs(res.data)
        }
      })
      .catch((err) => console.warn("Could not load driver call logs:", err))
  }, [driverToken])

  const handleLogout = async () => {
    await removeDeviceTokenFromServer()
    if (typeof window !== "undefined") {
      localStorage.removeItem("driver_auth_token")
      localStorage.removeItem("driver_phone")
    }
    setDriverToken(null)
    setDriverProfile(null)
    setHistory([])
    setBalance(0)
    setWeek(0)
    setTodayIncome(0)
    setTodayTripsCount(0)
    setOnline(false)
  }

  useEffect(() => {
    startAmbient()
  }, [])

  useEffect(() => {
    if (job === "toPickup") {
      setOrderStatus(CURRENT_CONV, "active")

      simulateCustomerPing()
    }

    if (job === "complete") setOrderStatus(CURRENT_CONV, "completed")

    if (job !== "toPickup" && job !== "atPickup" && job !== "delivering")
      setChatOpen(false)
  }, [job])

  const [activeOffer, setActiveOffer] = useState<any>(null)
  const [activeBooking, setActiveBooking] = useState<any>(null)
  const [lastCompletedBooking, setLastCompletedBooking] = useState<any>(null)
  const skippedBookingIdsRef = useRef<Set<string>>(new Set())
  const [isAcceptingOffer, setIsAcceptingOffer] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [driverInsuranceModalOpen, setDriverInsuranceModalOpen] = useState(false)
  const [driverComplaintModalOpen, setDriverComplaintModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("Xe gặp sự cố kỹ thuật")
  const [isCancelling, setIsCancelling] = useState(false)

  // Real-time Demand Hotspots (Dữ liệu động nhu cầu thật từ PostgreSQL)
  const [demandData, setDemandData] = useState<{
    isHighDemand: boolean
    badge: string
    text: string
    surgeBonusPercent: number
    hotspots: Array<{ district: string; count: number; lat: number; lng: number; radiusMeters: number }>
  }>({
    isHighDemand: false,
    badge: "🟢 Nhu cầu ổn định:",
    text: "Hệ thống đang quét đơn hàng phù hợp gần vị trí bạn",
    surgeBonusPercent: 0,
    hotspots: [],
  })

  const loadDemandZones = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/driver/demand-zones?lat=10.7769&lng=106.7009&radiusKm=25")
      const json = await res.json()
      if (json.success && json.data) {
        setDemandData(json.data)
      }
    } catch (err) {
      console.warn("Lỗi tải demand-zones:", err)
    }
  }, [])

  useEffect(() => {
    loadDemandZones()
    const timer = window.setInterval(loadDemandZones, 35000)
    return () => window.clearInterval(timer)
  }, [loadDemandZones, online])

  const today =
    todayIncome ||
    history
      .filter(
        (e) =>
          (e.when.startsWith("Hôm nay") || e.when === "Vừa xong") &&
          e.status !== "Đã hủy",
      )
      .reduce((s, e) => s + e.amount, 0)

  const trips =
    todayTripsCount ||
    history.filter(
      (e) =>
        (e.when.startsWith("Hôm nay") || e.when === "Vừa xong") &&
        e.status !== "Đã hủy",
    ).length

  // 1. Lắng nghe sự kiện Realtime (Nổ cuốc mới, Hủy cuốc)
  useEffect(() => {
    if (!driverProfile?.id && !driverProfile?.userId) return

    const driverId = driverProfile.id || driverProfile.userId
    const unsubOffer = subscribeRealtime(
      `driver-${driverId}`,
      "booking:new-offer",
      (data) => {
        if (data?.bookingId && skippedBookingIdsRef.current.has(data.bookingId)) return
        console.log("🔔 [Driver UI] Nổ cuốc mới:", data)
        setActiveOffer(data)
        setJob("incoming")
        setTab("home")
        setNotice(`Có cuốc xe mới #${data.bookingCode || ""}`)
      },
    )

    const unsubCancelled = subscribeRealtime(
      `driver-${driverId}`,
      "offer:cancelled",
      (data) => {
        console.log("⚠️ [Driver UI] Cuốc đã có người nhận:", data)
        setActiveOffer((current: any) => {
          if (current && current.bookingId === data.bookingId) {
            setJob("none")
            setNotice("Đơn hàng đã có tài xế khác nhanh tay tiếp nhận.")
            return null
          }
          return current
        })
      },
    )

    const unsubTripCancelled = subscribeRealtime(
      `driver-${driverId}`,
      "booking:cancelled",
      (data) => {
        console.log("🛑 [Driver UI] Khách hủy chuyến:", data)
        setActiveBooking((curr: any) => {
          if (curr && curr.id === data.bookingId) {
            setJob("none")
            setNotice(`Khách đã hủy chuyến: ${data.reason || "Đổi kế hoạch"}`)
            return null
          }
          return curr
        })
      },
    )

    return () => {
      unsubOffer()
      unsubCancelled()
      unsubTripCancelled()
    }
  }, [driverProfile?.id, driverProfile?.userId])

  // 2. Tự động khôi phục chuyến xe đang chạy khi mở app (GET /bookings/active)
  useEffect(() => {
    if (!driverToken) return
    fetch("/api/v1/driver/bookings/active", {
      headers: { Authorization: `Bearer ${driverToken}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          const b = res.data
          setActiveBooking(b)
          if (b.status === "ACCEPTED") setJob("toPickup")
          else if (b.status === "ARRIVED_AT_PICKUP") setJob("atPickup")
          else if (b.status === "IN_TRANSIT") setJob("delivering")
        }
      })
      .catch((err) => console.warn("Check active booking error:", err))
  }, [driverToken])

  // 2.1 Tự động quét và tìm cuốc xe thực tế đang chờ tài xế (SEARCHING)
  const checkAvailableBookings = useCallback(
    async (manual = false) => {
      if (!driverToken || !online || job !== "none") return
      try {
        const res = await fetch("/api/v1/driver/bookings/available", {
          headers: { Authorization: `Bearer ${driverToken}` },
        })
        const json = await res.json()
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          // Lọc bỏ những cuốc xe mà tài xế này đã bấm "Bỏ qua"
          const candidateOffers = json.data.filter(
            (b: any) => !skippedBookingIdsRef.current.has(b.bookingId || b.id),
          )

          if (candidateOffers.length > 0) {
            const nextOffer = candidateOffers[0]
            setActiveOffer(nextOffer)
            setJob("incoming")
            setTab("home")
            setNotice(`Có cuốc xe thực tế mới #${nextOffer.bookingCode}`)
            return
          } else if (manual) {
            setNotice("Các cuốc xe hiện có bạn đã bỏ qua. Đang chờ đơn hàng mới…")
            return
          }
        }
        if (manual) {
          setNotice("Hiện chưa có cuốc xe nào đang chờ tìm tài xế gần bạn.")
        }
      } catch (err) {
        if (manual) console.warn("Lỗi quét đơn khả dụng:", err)
      }
    },
    [driverToken, online, job],
  )

  useEffect(() => {
    if (!online || job !== "none" || !driverToken) return
    checkAvailableBookings(false)
    const timer = window.setInterval(() => {
      checkAvailableBookings(false)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [online, job, driverToken, checkAvailableBookings])

  // 3. GPS Background Location Worker tự động truyền tọa độ lên Server
  useEffect(() => {
    if (!online || !driverToken) return

    const sendGps = () => {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            fetch("/api/v1/driver/location", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${driverToken}`,
              },
              body: JSON.stringify({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed: pos.coords.speed || 0,
                heading: pos.coords.heading || 0,
              }),
            }).catch(() => {})
          },
          () => {
            // Fallback nếu quyền định vị bị chặn
            fetch("/api/v1/driver/location", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${driverToken}`,
              },
              body: JSON.stringify({
                lat: 10.7769,
                lng: 106.7009,
                speed: 25,
                heading: 90,
              }),
            }).catch(() => {})
          },
          { enableHighAccuracy: true, timeout: 5000 },
        )
      }
    }

    sendGps()
    const timer = setInterval(sendGps, 4000)
    return () => clearInterval(timer)
  }, [online, driverToken])

  const [isTogglingOnline, setIsTogglingOnline] = useState(false)

  const toggleOnline = async () => {
    setNotice("")
    const nextState = !online

    if (!driverToken) {
      setNotice("Vui lòng đăng nhập tài khoản tài xế trước.")
      return
    }

    setIsTogglingOnline(true)
    try {
      const res = await fetch("/api/v1/driver/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${driverToken}`,
        },
        body: JSON.stringify({ isOnline: nextState }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        const errorMsg =
          data.message || "Không thể cập nhật trạng thái trực tuyến."
        setNotice(errorMsg)
        if (errorMsg.includes("ký quỹ") || errorMsg.includes("deposit") || errorMsg.includes("hạn mức")) {
          setTopupModalOpen(true)
        }
        return
      }

      setOnline(nextState)
      if (nextState) {
        skippedBookingIdsRef.current.clear()
      }
      setNotice(
        nextState
          ? "Đã bật trực tuyến. Sẵn sàng nhận cuốc xe mới!"
          : "Đã chuyển sang ngoại tuyến (Tạm nghỉ nhận cuốc).",
      )
    } catch (err: any) {
      console.warn("Toggle online status error:", err)
      setNotice("Lỗi kết nối máy chủ khi cập nhật trạng thái trực tuyến.")
    } finally {
      setIsTogglingOnline(false)
    }
  }

  const skip = () => {
    const skippedId = activeOffer?.bookingId || activeOffer?.id
    if (skippedId) {
      skippedBookingIdsRef.current.add(skippedId)
    }
    setActiveOffer(null)
    setNotice("Bạn đã bỏ qua cuốc xe. Đang quét tìm đơn khác gần bạn…")
    setJob("none")
  }

  const handleAcceptOffer = async () => {
    if (!driverToken) return
    const bookingId = activeOffer?.bookingId || activeOffer?.id
    if (!bookingId) {
      alert("Không tìm thấy thông tin chuyến xe hợp lệ.")
      setJob("none")
      return
    }

    setIsAcceptingOffer(true)
    try {
      const res = await fetch(`/api/v1/driver/bookings/${bookingId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${driverToken}`,
        },
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(
          data.message || "Rất tiếc! Đã có tài xế khác nhanh tay tiếp nhận.",
        )
        setActiveOffer(null)
        setJob("none")
        return
      }

      const accepted = data.data?.booking || data.data || {
        ...activeOffer,
        id: bookingId,
        status: "ACCEPTED",
      }
      setActiveBooking(accepted)
      setActiveOffer(null)
      setJob("toPickup")
      emitLocalRealtime(`trip-${bookingId}`, "booking:accepted", {
        bookingId,
        driver: {
          id: driverProfile?.id,
          name: driverProfile?.fullName || driverProfile?.name || "Nguyễn Văn Hùng",
          phone: driverProfile?.phone || "0912345678",
          licensePlate: driverProfile?.licensePlate || "51D-892.41",
          avatarUrl: driverProfile?.avatarUrl,
          vehicleTypeName: driverProfile?.vehicleTypeName || "Xe tải 1.25 tấn",
          ratingAvg: driverProfile?.ratingAvg || "4.9",
        },
      })
    } catch (err: any) {
      alert("Lỗi kết nối khi nhận cuốc: " + err.message)
    } finally {
      setIsAcceptingOffer(false)
    }
  }

  const handleUpdateStatus = async (
    proofUrl?: string,
    otp?: string,
    coords?: { lat: number; lng: number },
    bypassGeofence = false,
  ) => {
    if (!driverToken || !activeBooking) {
      // Fallback cho demo nội bộ
      if (job === "toPickup") setJob("atPickup")
      else if (job === "atPickup") setJob("delivering")
      else complete()
      return
    }

    let nextStatus = ""
    if (job === "toPickup") nextStatus = "ARRIVED_AT_PICKUP"
    else if (job === "atPickup") nextStatus = "IN_TRANSIT"
    else if (job === "delivering") nextStatus = "COMPLETED"

    setIsUpdatingStatus(true)
    try {
      const res = await fetch(
        `/api/v1/driver/bookings/${activeBooking.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${driverToken}`,
          },
          body: JSON.stringify({
            status: nextStatus,
            proofImageUrl: proofUrl || undefined,
            deliveryOtp: otp || undefined,
            driverLat: coords?.lat,
            driverLng: coords?.lng,
            bypassGeofence,
          }),
        },
      )
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.message || "Không thể cập nhật trạng thái chuyến xe.")
        return
      }

      if (nextStatus === "ARRIVED_AT_PICKUP") setJob("atPickup")
      else if (nextStatus === "IN_TRANSIT") setJob("delivering")
      else if (nextStatus === "COMPLETED") {
        complete()
        setActiveBooking(null)
      }

      emitLocalRealtime(`trip-${activeBooking.id}`, "booking:status-change", {
        bookingId: activeBooking.id,
        status: nextStatus,
        pickupProofImage: nextStatus === "IN_TRANSIT" ? proofUrl : undefined,
        deliveryProofImage: nextStatus === "COMPLETED" ? proofUrl : undefined,
      })
    } catch (err: any) {
      alert("Lỗi khi cập nhật trạng thái: " + err.message)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleCancelTrip = async () => {
    if (!driverToken || !activeBooking) {
      setJob("none")
      setCancelModalOpen(false)
      return
    }

    setIsCancelling(true)
    try {
      const res = await fetch(
        `/api/v1/driver/bookings/${activeBooking.id}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${driverToken}`,
          },
          body: JSON.stringify({ reason: cancelReason }),
        },
      )
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.message || "Không thể hủy chuyến xe.")
        return
      }

      emitLocalRealtime(`trip-${activeBooking.id}`, "booking:cancelled", {
        bookingId: activeBooking.id,
        cancelledBy: "DRIVER",
        reason: cancelReason,
      })

      setNotice("Bạn đã hủy nhận chuyến xe.")
      setActiveBooking(null)
      setJob("none")
      setCancelModalOpen(false)
    } catch (err: any) {
      alert("Lỗi kết nối khi hủy chuyến: " + err.message)
    } finally {
      setIsCancelling(false)
    }
  }

  const complete = () => {
    if (activeBooking) {
      setLastCompletedBooking(activeBooking)
    }
    setJob("complete")

    const earnAmount = activeBooking?.driverEarning
      ? activeBooking.driverEarning
      : activeBooking?.totalPrice
      ? Math.round(Number(activeBooking.totalPrice) * 0.8)
      : 0

    const originShort = (activeBooking?.originAddress || "Điểm đón").split(",")[0]
    const destShort = (activeBooking?.destinationAddress || "Điểm giao").split(",")[0]

    setHistory((h) => [
      {
        id: Date.now(),
        when: "Vừa xong",
        route: `${originShort} → ${destShort}`,
        amount: earnAmount,
        status: "Đã nhận",
      },
      ...h,
    ])

    setWeek((w) => w + earnAmount)
    setBalance((b) => b + earnAmount)
    setTodayIncome((t) => t + earnAmount)
    setTodayTripsCount((c) => c + 1)
    setTimeout(() => {
      loadDriverBookings()
      loadDriverTxs()
      loadDriverWallet()
    }, 800)
  }

  const changeTab = (nextTab: Tab) => {
    const currentIndex = driverNavItems.findIndex((item) => item.id === tab)
    const nextIndex = driverNavItems.findIndex((item) => item.id === nextTab)
    if (currentIndex === nextIndex) return

    setSheetExpanded(false)
    runTabTransition(
      phoneRef.current,
      nextIndex > currentIndex ? "right" : "left",
      () => setTab(nextTab),
    )
  }

  if (!driverToken) {
    return (
      <main className="app-shell">
        <section className="phone-frame d-frame">
          <DriverAuthGate
            onSuccess={(token, user) => {
              setDriverToken(token)
              setDriverProfile(user)
            }}
            onBackToCustomer={() => {
              window.location.hash = ""
            }}
          />
        </section>
      </main>
    )
  }

  if (!registered) {
    return (
      <main className="app-shell">
        <section className="phone-frame d-frame">
          <Onboarding
            onDone={() => setRegistered(true)}
            onExit={() => setRegistered(true)}
            onBackToCustomer={() => {
              window.location.hash = ""
            }}
            onLogout={handleLogout}
          />
        </section>
      </main>
    )
  }

  const working =
    job === "toPickup" || job === "atPickup" || job === "delivering"

  const showNav = !working && job !== "incoming" && job !== "complete"

  const driverDisplayName =
    driverProfile?.fullName ||
    driverProfile?.user?.fullName ||
    (typeof window !== "undefined" ? localStorage.getItem("driver_phone") : null) ||
    "Bác tài"

  const getDriverInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <main className="app-shell">
      <section className="phone-frame d-frame" ref={phoneRef}>
        <div className="tab-content-surface">
          {tab === "home" && (
            <div className="tab-screen home-screen" key="home">
              <div className="map-area">
                <InteractiveMap
                  demandHotspots={demandData.hotspots}
                  destAddr={activeBooking?.destinationAddress || activeOffer?.destinationAddress || undefined}
                  driverName={driverDisplayName}
                  driverPlate={
                    driverProfile?.vehicle?.licensePlate ||
                    driverProfile?.licensePlate ||
                    (driverDisplayName.includes("Kiệt") ? "51D-638.19" : "51D-892.41")
                  }
                  jobState={job}
                  mode="driver"
                  online={online}
                  pickupAddr={activeBooking?.originAddress || activeOffer?.originAddress || undefined}
                />
                {!working && job !== "incoming" && job !== "complete" && (
                  <>
                    <header className="d-top">
                      <div className="d-top-row">
                        <span className="d-hello">
                          <span className="d-avatar" aria-hidden="true">
                            {getDriverInitials(driverDisplayName)}
                          </span>
                          <span>
                            <small>Chào buổi sáng,</small>
                            <strong>
                              {driverDisplayName}
                            </strong>
                          </span>
                        </span>
                        <button
                          aria-label="Thông báo"
                          className="icon-button glass"
                          type="button"
                        >
                          <Icon name="bell" />
                        </button>
                      </div>
                      <div className="d-today glass glass-strong">
                        <span>
                          <small>Thu nhập hôm nay</small>
                          <strong>{money(today)}</strong>
                        </span>
                        <span className="d-today-trips">
                          <strong>{trips} cuốc</strong>
                        </span>
                      </div>
                    </header>
                  </>
                )}
                {working && (
                  <ActiveJob
                    job={job}
                    key="active"
                    booking={activeBooking}
                    updating={isUpdatingStatus}
                    onMessage={() => setChatOpen(true)}
                    onCall={() => setCallModalOpen(true)}
                    onNext={handleUpdateStatus}
                    onCancelTrip={() => setCancelModalOpen(true)}
                    onOpenInsurance={() => setDriverInsuranceModalOpen(true)}
                    onOpenComplaint={() => setDriverComplaintModalOpen(true)}
                  />
                )}
              </div>

              {job === "none" && (
                <div
                  className={`driver-home-control glass-liquid ${
                    online ? "is-online" : "is-offline"
                  }`}
                >
                  <div className="d-control-header">
                    <div className="d-status-badge">
                      <span
                        className={`d-status-indicator ${
                          online ? "pulse-green" : "idle-gray"
                        }`}
                      />
                      <strong>
                        {online ? "Đang trực tuyến" : "Ngoại tuyến"}
                      </strong>
                      <span className="d-status-sub">
                        {online ? "· Sẵn sàng nhận đơn" : "· Tạm nghỉ"}
                      </span>
                    </div>

                    <button
                      aria-checked={online}
                      aria-label={online ? "Tắt nhận cuốc" : "Bật nhận cuốc"}
                      className={`d-power-toggle ${online ? "on" : ""}`}
                      onClick={toggleOnline}
                      role="switch"
                      type="button"
                    >
                      <span className="d-toggle-thumb">
                        <Icon
                          name={online ? "truck" : "target"}
                          size={18}
                          strokeWidth={2.4}
                        />
                      </span>
                      <span className="d-toggle-text">
                        {online ? "BẬT" : "TẮT"}
                      </span>
                    </button>
                  </div>

                  {driverWallet && !driverWallet.isDepositQualified && (
                    <div
                      style={{
                        margin: "10px 12px 6px",
                        padding: "11px 14px",
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.08))",
                        border: "1px solid rgba(245, 158, 11, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span style={{ fontSize: "18px" }}>🔔</span>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: "12.5px", color: "#b45309", display: "block" }}>
                            Ví ký quỹ chưa đủ 200.000đ (Hiện còn {money(driverWallet.balance || 0)})
                          </strong>
                          <span style={{ fontSize: "11px", color: "#78350f" }}>
                            Nạp thêm {money(driverWallet.shortfall || Math.max(0, 200000 - Number(driverWallet.balance || 0)))} để sẵn sàng nhận cuốc mới
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTopupModalOpen(true)}
                        style={{
                          flexShrink: 0,
                          padding: "7px 12px",
                          borderRadius: "10px",
                          background: "#d97706",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "11.5px",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Nạp ngay
                      </button>
                    </div>
                  )}

                  <div className="d-control-body">
                    {online ? (
                      <div className="d-online-bar">
                        <div className="d-radar-pulse">
                          <span className="radar-wave" />
                          <span className="radar-core">
                            <Icon name="navigate" size={14} strokeWidth={2.5} />
                          </span>
                        </div>
                        <div className="d-online-info">
                          <strong>
                            {notice || "Đang quét tìm cuốc gần bạn…"}
                          </strong>
                          <small>
                            Hệ thống tự động điều phối khi có cuốc mới
                          </small>
                        </div>
                        <button
                          className="d-test-order-btn"
                          onClick={() => {
                            setTab("home")
                            checkAvailableBookings(true)
                          }}
                          title="Quét tìm đơn thực tế từ khách hàng"
                          type="button"
                        >
                          <span>Quét tìm đơn</span>
                          <Icon name="search" size={14} strokeWidth={2.6} />
                        </button>
                      </div>
                    ) : (
                      <div className="d-offline-bar">
                        <div className="d-offline-info">
                          <strong
                            style={
                              notice ? { color: "#f87171" } : undefined
                            }
                          >
                            {notice || "Gạt công tắc để bắt đầu nhận cuốc"}
                          </strong>
                          <small>
                            {notice
                              ? "Kiểm tra số dư ký quỹ (>=200k) và duyệt KYC"
                              : "Nhận đơn hàng hóa, bốc xếp & chuyển phát nội thành"}
                          </small>
                        </div>
                        <button
                          className="d-go-online-btn"
                          disabled={isTogglingOnline}
                          onClick={toggleOnline}
                          type="button"
                        >
                          <span>
                            {isTogglingOnline
                              ? "ĐANG XỬ LÝ…"
                              : "BẬT NHẬN CUỐC"}
                          </span>
                          <Icon name="chevron" size={18} strokeWidth={2.6} />
                        </button>
                      </div>
                    )}
                  </div>

                  {online && (
                    <div className={`d-hot-mini ${demandData.isHighDemand ? "is-surge" : "is-stable"}`}>
                      <span className={`d-hot-badge ${demandData.isHighDemand ? "surge" : "stable"}`}>
                        {demandData.badge}
                      </span>
                      <span>
                        {demandData.text}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {job === "incoming" && (
                <Incoming
                  key="incoming"
                  offer={activeOffer}
                  loading={isAcceptingOffer}
                  onAccept={handleAcceptOffer}
                  onSkip={skip}
                />
              )}
              {job === "complete" && (
                <Complete
                  booking={lastCompletedBooking || activeBooking}
                  wallet={driverWallet}
                  onTopup={() => setTopupModalOpen(true)}
                  onContinue={() => {
                    setJob("none")
                    setLastCompletedBooking(null)
                  }}
                  onEarnings={() => {
                    setJob("none")
                    setLastCompletedBooking(null)
                    setTab("earnings")
                  }}
                />
              )}
            </div>
          )}

          {tab === "earnings" && (
            <div className="tab-screen" key="earnings">
              <Earnings
                balance={balance}
                entries={history}
                today={today}
                trips={trips}
                week={week}
                wallet={driverWallet}
                onOpenTopup={() => setTopupModalOpen(true)}
                transactions={walletTxs}
                callLogs={driverCallLogs}
                onFilterChange={loadDriverTxs}
              />
            </div>
          )}
          {tab === "trips" && (
            <div className="tab-screen" key="trips">
              <Trips
                entries={history}
                online={online}
                onGoHome={() => setTab("home")}
              />
            </div>
          )}
          {tab === "account" && (
            <div className="tab-screen" key="account">
              <Account
                profile={driverProfile}
                onLogout={handleLogout}
                onReset={() => {
                  setRegistered(false)
                  setOnline(false)
                  setJob("none")
                  setTab("home")
                }}
              />
            </div>
          )}
        </div>

        {working && chatOpen && (
          <ChatScreen
            convId={activeBooking?.id || CURRENT_CONV}
            bookingId={activeBooking?.id}
            moving={job !== "atPickup"}
            onBack={() => setChatOpen(false)}
            onOpenMap={() => setChatOpen(false)}
            onCall={() => setCallModalOpen(true)}
            side="driver"
            customerName={
              job === "delivering"
                ? (activeBooking?.receiverName || "Người nhận hàng")
                : (activeBooking?.customerName ||
                    activeBooking?.customer?.fullName ||
                    activeBooking?.customer?.name ||
                    "Khách hàng")
            }
            orderCode={activeBooking?.bookingCode || activeBooking?.code || "#DH1024"}
          />
        )}

        {cancelModalOpen && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.78)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 9999,
            }}
          >
            <div
              className="glass-liquid"
              style={{
                background: "#0f172a",
                borderRadius: "20px",
                padding: "22px",
                width: "100%",
                maxWidth: "340px",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#f8fafc",
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: "17px",
                  fontWeight: 800,
                  color: "#f87171",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>⚠️</span>
                <span>Báo sự cố & Hủy chuyến</span>
              </h3>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "#94a3b8",
                }}
              >
                Chọn lý do để hệ thống hủy chuyến và điều phối xe thay thế cho khách
                hàng:
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "18px",
                }}
              >
                {[
                  "Xe gặp sự cố kỹ thuật / hỏng hóc",
                  "Không liên hệ được người gửi/nhận",
                  "Kẹt xe nghiêm trọng không thể đến",
                  "Hàng hóa không đúng quy chuẩn tải trọng",
                  "Khách hàng yêu cầu hủy cuốc",
                ].map((reason) => (
                  <label
                    key={reason}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "13px",
                      cursor: "pointer",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      background:
                        cancelReason === reason
                          ? "rgba(248,113,113,0.16)"
                          : "rgba(255,255,255,0.04)",
                      border:
                        cancelReason === reason
                          ? "1px solid rgba(248,113,113,0.4)"
                          : "1px solid transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="driverCancelReason"
                      checked={cancelReason === reason}
                      onChange={() => setCancelReason(reason)}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="d-cta ghost"
                  onClick={() => setCancelModalOpen(false)}
                  disabled={isCancelling}
                  style={{ flex: 1, padding: "10px", fontSize: "13px" }}
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleCancelTrip}
                  disabled={isCancelling}
                  style={{
                    flex: 1.2,
                    padding: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    borderRadius: "10px",
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {isCancelling ? "ĐANG HỦY..." : "XÁC NHẬN HỦY"}
                </button>
              </div>
            </div>
          </div>
        )}

        <CallingModal
          isOpen={callModalOpen}
          onClose={() => setCallModalOpen(false)}
          bookingId={activeBooking?.id}
          partnerName={
            job === "delivering"
              ? (activeBooking?.receiverName || "Người nhận hàng")
              : (activeBooking?.customerName ||
                  activeBooking?.customer?.fullName ||
                  activeBooking?.customer?.name ||
                  "Khách hàng")
          }
          partnerRole="CUSTOMER"
          partnerPhone={
            activeBooking?.customer?.phone ||
            activeBooking?.customerPhone ||
            activeBooking?.receiverPhone ||
            activeBooking?.phone ||
            "0903124486"
          }
          authToken={driverToken || undefined}
        />

        <TopUpModal
          isOpen={topupModalOpen}
          onClose={() => setTopupModalOpen(false)}
          onSuccess={(added) => {
            setBalance((b) => b + added)
            setDriverWallet((prev: any) =>
              prev
                ? {
                    ...prev,
                    balance: Number(prev.balance || 0) + added,
                    isDepositQualified:
                      Number(prev.balance || 0) + added >= Number(prev.minDepositLimit || 200000),
                    shortfall: Math.max(
                      0,
                      Number(prev.minDepositLimit || 200000) -
                        (Number(prev.balance || 0) + added),
                    ),
                  }
                : prev,
            )
            setWalletTxs((prevTxs) => [
              {
                id: `topup_${Date.now()}`,
                type: "TOPUP",
                amount: added,
                description: `Nạp ${added.toLocaleString("vi-VN")} đ vào ví ký quỹ`,
                created_at: new Date().toISOString(),
              },
              ...(prevTxs || []),
            ])
            if (driverToken) {
              fetch("/api/v1/driver/wallet", {
                headers: { Authorization: `Bearer ${driverToken}` },
              })
                .then((r) => r.json())
                .then((d) => {
                  if (d.data) setDriverWallet(d.data)
                })
              loadDriverTxs()
            }
          }}
          userRole="DRIVER"
          authToken={driverToken || undefined}
        />

        <InsurancePolicyModal
          isOpen={driverInsuranceModalOpen}
          onClose={() => setDriverInsuranceModalOpen(false)}
        />

        <ComplaintModal
          isOpen={driverComplaintModalOpen}
          onClose={() => setDriverComplaintModalOpen(false)}
          bookingCode={activeBooking?.bookingCode || activeBooking?.code}
          bookingId={activeBooking?.id}
          driverName={driverProfile?.fullName || "Tài xế"}
        />

        {showNav && <DriverNav onChange={changeTab} tab={tab} />}
      </section>
    </main>
  )
}
