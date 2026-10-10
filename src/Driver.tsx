import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import "./driver.css"
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

/* ---------- icons ---------- */

type IconName = "home" | "route" | "wallet" | "user" | "bell" | "layers" | "target" | "check" | "chevron" | "chevron-up" | "chevron-down" | "back" | "phone" | "message" | "pin" | "flag" | "camera" | "upload" | "shield" | "box" | "clock" | "navigate" | "truck" | "plus"

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

const JOB = {
  customer: "Chị Lan Anh",
  receiver: "Anh Hải",
  pickup: "21 Nguyễn Đình Chiểu, Q.1",
  destination: "128 Hoàng Diệu, Q.4",
  pickupKm: "2,4 km",
  tripKm: "6,8 km",
  tripMin: "24 phút",
  vehicle: "Xe van",
  goods: "Thùng hàng · khoảng 40kg",
  earning: 95000,
  fee: 110000,
  platform: 15000,
}

type Entry = {
  id: number
  when: string
  route: string
  amount: number
  status: string
}

const seedHistory: Entry[] = [
  {
    id: 1,
    when: "Hôm nay, 11:20",
    route: "Q.3 → Phú Nhuận",
    amount: 113000,
    status: "Đã nhận",
  },
  {
    id: 2,
    when: "Hôm nay, 09:45",
    route: "Tân Bình → Q.10",
    amount: 102000,
    status: "Đã nhận",
  },
  {
    id: 3,
    when: "Hôm nay, 08:30",
    route: "Q.1 → Thủ Đức",
    amount: 118000,
    status: "Đã nhận",
  },
  {
    id: 4,
    when: "Hôm nay, 07:10",
    route: "Q.5 → Q.7",
    amount: 95000,
    status: "Chờ đối soát",
  },
  {
    id: 5,
    when: "Hôm qua, 17:40",
    route: "Gò Vấp → Q.1",
    amount: 126000,
    status: "Đã nhận",
  },
  {
    id: 6,
    when: "Hôm qua, 14:05",
    route: "Q.4 → Bình Thạnh",
    amount: 88000,
    status: "Đã nhận",
  },
]

/* ---------- shared bits ---------- */

function DriverMap({ job, online }: { job: Job online: boolean }) {
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

const driverNavItems: { id: Tab label: string icon: IconName }[] = [
  { id: "home", label: "Trang chủ", icon: "home" },
  { id: "trips", label: "Cuốc xe", icon: "route" },
  { id: "earnings", label: "Thu nhập", icon: "wallet" },
  { id: "account", label: "Tài khoản", icon: "user" },
]

function DriverNav({ tab, onChange }: { tab: Tab onChange: (t: Tab) => void }) {
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
}: {
  name: string
  role: string
  onMessage: () => void
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
        aria-label={`Nhắn tin cho ${name}`}
        className="d-round"
        onClick={onMessage}
        type="button"
      >
        <Icon name="message" size={24} />
        {unread > 0 && <span className="d-msg-dot" />}
      </button>
      <button aria-label={`Gọi ${name}`} className="d-round call" type="button">
        <Icon name="phone" size={24} />
      </button>
    </div>
  )
}

function EntryList({ entries }: { entries: Entry[] }) {
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
  icon = "camera",
}: {
  label: string
  hint: string
  file: string
  done: boolean
  onToggle: () => void
  icon?: IconName
}) {
  return (
    <button
      className={`d-upload ${done ? "done" : ""}`}
      onClick={onToggle}
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
        <small>{done ? file : hint}</small>
      </span>
      <span className="d-upload-action">{done ? "Chụp lại" : "Tải lên"}</span>
    </button>
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

function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [approved, setApproved] = useState(false)
  const [agree, setAgree] = useState(false)
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
    brand: "",
  })
  const [docs, setDocs] = useState<Record<string, boolean>>({})
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }))
  const toggle = (k: string) => setDocs((d) => ({ ...d, [k]: !d[k] }))

  useEffect(() => {
    if (!submitted) return
    const t = window.setTimeout(() => setApproved(true), 2800)
    return () => window.clearTimeout(t)
  }, [submitted])

  const valid = [
    f.name.trim() &&
      f.phone.trim().length >= 9 &&
      f.birth.trim() &&
      f.area.trim(),
    f.idNo.trim().length >= 9 && docs.idFront && docs.idBack && docs.selfie,
    f.licenseNo.trim() && docs.license,
    f.plate.trim() && docs.registration,
    f.brand.trim() && docs.vehiclePhoto,
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
          <span className="d-round-spacer" />
        )}
        <span className="d-step-count">
          Bước {step + 1}/{steps.length}
        </span>
        <span className="d-round-spacer" />
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
              file="cccd-mat-truoc.jpg"
              hint="Chụp rõ 4 góc giấy tờ"
              label="CCCD mặt trước"
              onToggle={() => toggle("idFront")}
            />
            <Upload
              done={!!docs.idBack}
              file="cccd-mat-sau.jpg"
              hint="Chụp rõ 4 góc giấy tờ"
              label="CCCD mặt sau"
              onToggle={() => toggle("idBack")}
            />
            <Upload
              done={!!docs.selfie}
              file="anh-xac-thuc.jpg"
              hint="Chụp khuôn mặt, cầm CCCD cạnh mặt"
              icon="shield"
              label="Ảnh xác thực"
              onToggle={() => toggle("selfie")}
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
              file="gplx-mat-truoc.jpg"
              hint="Chụp mặt trước, không bị lóa"
              label="Giấy phép lái xe"
              onToggle={() => toggle("license")}
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
              file="cavet-xe.jpg"
              hint="Chụp cà vẹt xe, đủ 4 góc"
              label="Giấy đăng ký xe"
              onToggle={() => toggle("registration")}
            />
          </>
        )}
        {step === 4 && (
          <>
            <p>Chọn loại xe bạn sẽ chạy.</p>
            <div className="d-vehicle-grid">
              {vehicleChoices.map((v) => (
                <button
                  className={f.vehicle === v.id ? "on" : ""}
                  key={v.id}
                  onClick={() => set("vehicle")(v.id)}
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
              file="anh-xe.jpg"
              hint="Chụp toàn bộ xe, thấy rõ biển số"
              label="Ảnh xe thực tế"
              onToggle={() => toggle("vehiclePhoto")}
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
                  `${vehicleChoices.find((v) => v.id === f.vehicle)?.name} · ${f.plate}`,
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
        <button
          className="d-cta primary"
          disabled={!valid}
          onClick={() =>
            step === steps.length - 1 ? setSubmitted(true) : setStep(step + 1)
          }
          type="button"
        >
          <span>{step === steps.length - 1 ? "GỬI HỒ SƠ" : "TIẾP TỤC"}</span>
          <Icon name="chevron" size={26} strokeWidth={2.6} />
        </button>
        {!valid && (
          <small className="d-foot-hint">
            Hoàn tất các mục trên để tiếp tục
          </small>
        )}
      </footer>
    </section>
  )
}

/* ---------- incoming order ---------- */

const EXPIRE = 20

function Incoming({
  onAccept,
  onSkip,
}: {
  onAccept: () => void
  onSkip: () => void
}) {
  const [left, setLeft] = useState(EXPIRE)
  useEffect(() => {
    if (left <= 0) {
      onSkip()
      return
    }
    const t = window.setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left])
  return (
    <section className="d-screen d-incoming" aria-live="assertive">
      <header className="d-inc-top">
        <span className="d-new-badge">
          <span className="d-ring-bell">
            <Icon name="bell" size={18} strokeWidth={2.4} />
          </span>
          Cuốc mới
        </span>
        <span className="d-sound">Chuông và rung đang bật</span>
      </header>

      <div className={`d-countdown ${left <= 5 ? "low" : ""}`}>
        <span>
          Tự động bỏ qua sau <strong>{left} giây</strong>
        </span>
        <div>
          <i style={{ width: `${(left / EXPIRE) * 100}%` }} />
        </div>
      </div>

      <div className="d-earn-hero">
        <small>Bạn nhận được</small>
        <strong>{money(JOB.earning)}</strong>
        <span>
          {JOB.tripKm} · {JOB.tripMin}
        </span>
      </div>

      <div className="d-inc-card">
        <div className="d-pickup-dist">
          <Icon name="navigate" size={20} />
          <strong>{JOB.pickupKm} đến điểm lấy</strong>
        </div>
        <div className="d-stops">
          <span className="d-stop-line" />
          <div>
            <span className="d-stop-dot pickup" />
            <span>
              <small>Điểm lấy hàng</small>
              <strong>{JOB.pickup}</strong>
            </span>
          </div>
          <div>
            <span className="d-stop-dot drop">
              <Icon name="flag" size={12} strokeWidth={2.6} />
            </span>
            <span>
              <small>Điểm giao hàng</small>
              <strong>{JOB.destination}</strong>
            </span>
          </div>
        </div>
        <div className="d-req">
          <span>
            <Icon name="truck" size={18} /> Yêu cầu:{" "}
            <strong>{JOB.vehicle}</strong>
          </span>
          <span>
            <Icon name="box" size={18} /> {JOB.goods}
          </span>
        </div>
      </div>

      <div className="d-inc-actions">
        <button className="d-cta ghost" onClick={onSkip} type="button">
          Bỏ qua
        </button>
        <button
          className="d-cta primary accept"
          onClick={onAccept}
          type="button"
        >
          <span>NHẬN CUỐC</span>
        </button>
      </div>
    </section>
  )
}

/* ---------- active job ---------- */

function ActiveJob({
  job,
  onNext,
  onMessage,
}: {
  job: "toPickup" | "atPickup" | "delivering"
  onNext: () => void
  onMessage: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const banner = {
    toPickup: {
      cls: "",
      title: "Đang đến điểm lấy",
      dist: "2,4 km",
      eta: "9 phút",
      addr: JOB.pickup,
    },
    atPickup: {
      cls: "ok",
      title: "Đã đến điểm lấy",
      dist: "0 m",
      eta: "Có mặt",
      addr: JOB.pickup,
    },
    delivering: {
      cls: "",
      title: "Đang giao hàng",
      dist: "6,8 km",
      eta: "24 phút",
      addr: JOB.destination,
    },
  }[job]

  const stepText = {
    toPickup: "Bước 1/3 · Đến điểm lấy",
    atPickup: "Bước 2/3 · Nhận hàng",
    delivering: "Bước 3/3 · Giao hàng",
  }[job]

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
      </div>
      <MapTools />

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
              <small>
                {job === "delivering" ? JOB.destination : JOB.pickup}
              </small>
            </div>
            <span
              className="d-earn-chip"
              style={{ fontSize: 13, padding: "5px 9px", margin: "0 4px" }}
            >
              +{money(JOB.earning)}
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
        <section className="d-sheet glass-liquid expanded">
          <div className="sheet-handle" onClick={() => setExpanded(false)} />
          <div className="d-sheet-head">
            <span className="d-status">
              <i />
              {stepText}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="d-earn-chip">+{money(JOB.earning)}</span>
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
                <strong>{JOB.destination}</strong>
              </span>
            </div>
          ) : (
            <div className="d-dest">
              <span className="d-stop-dot pickup big" />
              <span>
                <small>Điểm lấy hàng</small>
                <strong>{JOB.pickup}</strong>
              </span>
            </div>
          )}

          {job === "atPickup" && (
            <p className="d-note">
              Gặp khách tại cổng. Kiểm tra hàng rồi xác nhận đã nhận.
            </p>
          )}
          {job === "delivering" && (
            <div className="d-trip-stats">
              <span>
                <small>Còn lại</small>
                <strong>6,8 km</strong>
              </span>
              <span>
                <small>Dự kiến đến</small>
                <strong>11:14</strong>
              </span>
              <span>
                <small>Thu nhập</small>
                <strong className="g">+{money(JOB.earning)}</strong>
              </span>
            </div>
          )}

          <ContactRow
            onMessage={onMessage}
            name={job === "delivering" ? JOB.receiver : JOB.customer}
            role={job === "delivering" ? "Người nhận hàng" : "Khách hàng"}
          />

          {job === "toPickup" && (
            <button className="d-cta primary" onClick={onNext} type="button">
              <span>ĐÃ ĐẾN ĐIỂM LẤY</span>
              <Icon name="chevron" size={26} strokeWidth={2.6} />
            </button>
          )}
          {job === "atPickup" && (
            <ConfirmButton label="ĐÃ NHẬN HÀNG" onConfirm={onNext} />
          )}
          {job === "delivering" && (
            <ConfirmButton label="ĐÃ GIAO HÀNG" onConfirm={onNext} />
          )}
        </section>
      )}
    </>
  )
}

function Complete({
  onContinue,
  onEarnings,
}: {
  onContinue: () => void
  onEarnings: () => void
}) {
  const [more, setMore] = useState(false)
  return (
    <section className="d-screen d-complete">
      <div className="d-done-badge">
        <Icon name="check" size={44} strokeWidth={3.2} />
      </div>
      <h1>Hoàn thành cuốc 🎉</h1>
      <div className="d-earn-hero small">
        <small>Thu nhập chuyến này</small>
        <strong>+{money(JOB.earning)}</strong>
      </div>
      <div className="d-done-stats">
        <span>
          <small>Quãng đường</small>
          <strong>{JOB.tripKm}</strong>
        </span>
        <span>
          <small>Thời gian</small>
          <strong>{JOB.tripMin}</strong>
        </span>
      </div>
      <div className="d-inc-card plain">
        <div className="d-stops">
          <span className="d-stop-line" />
          <div>
            <span className="d-stop-dot pickup" />
            <span>
              <small>Điểm lấy</small>
              <strong>{JOB.pickup}</strong>
            </span>
          </div>
          <div>
            <span className="d-stop-dot drop">
              <Icon name="flag" size={12} strokeWidth={2.6} />
            </span>
            <span>
              <small>Điểm giao</small>
              <strong>{JOB.destination}</strong>
            </span>
          </div>
        </div>
        {more && (
          <dl className="d-breakdown">
            <div>
              <dt>Cước chuyến</dt>
              <dd>{money(JOB.fee)}</dd>
            </div>
            <div>
              <dt>Phí nền tảng</dt>
              <dd>-{money(JOB.platform)}</dd>
            </div>
            <div className="t">
              <dt>Bạn nhận</dt>
              <dd>{money(JOB.earning)}</dd>
            </div>
          </dl>
        )}
      </div>
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
}: {
  entries: Entry[]
  today: number
  week: number
  balance: number
  trips: number
}) {
  return (
    <section className="d-screen d-tab">
      <h1>Thu nhập</h1>
      <div className="d-balance">
        <small>Số dư hiện tại</small>
        <strong>{money(balance)}</strong>
        <span>Rút về ví ngân hàng mỗi thứ Hai</span>
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
      <h2>Lịch sử gần đây</h2>
      <EntryList entries={entries} />
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

function Account({ onReset }: { onReset: () => void }) {
  return (
    <section className="d-screen d-tab">
      <h1>Tài khoản</h1>
      <div className="d-profile">
        <span className="d-avatar big" aria-hidden="true">
          NM
        </span>
        <span>
          <strong>Nguyễn Văn Minh</strong>
          <small>4,9 sao · 1.284 chuyến</small>
        </span>
      </div>
      <ul className="d-review plain">
        <li>
          <span className="d-review-tick">
            <Icon name="shield" size={14} strokeWidth={2.6} />
          </span>
          <span>
            <small>Hồ sơ</small>
            <strong>Đã được duyệt</strong>
          </span>
        </li>
        <li>
          <span className="d-review-tick">
            <Icon name="truck" size={14} strokeWidth={2.6} />
          </span>
          <span>
            <small>Xe đang chạy</small>
            <strong>Xe van · 51D-482.15</strong>
          </span>
        </li>
      </ul>
      <button className="d-cta ghost" onClick={onReset} type="button">
        Đăng ký lại (bản demo)
      </button>
    </section>
  )
}

/* ---------- app ---------- */

export default function DriverApp() {
  const phoneRef = useRef<HTMLElement>(null)
  const [registered, setRegistered] = useState(true)
  const [tab, setTab] = useState<Tab>("home")
  const [online, setOnline] = useState(false)
  const [job, setJob] = useState<Job>("none")
  const [history, setHistory] = useState<Entry[]>(seedHistory)
  const [balance, setBalance] = useState(1254000)
  const [week, setWeek] = useState(2364000)
  const [notice, setNotice] = useState("")
  const [chatOpen, setChatOpen] = useState(false)
  const [sheetExpanded, setSheetExpanded] = useState(false)

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

  const today = history
    .filter((e) => e.when.startsWith("Hôm nay") || e.when === "Vừa xong")
    .reduce((s, e) => s + e.amount, 0)
  const trips = history.filter(
    (e) => e.when.startsWith("Hôm nay") || e.when === "Vừa xong",
  ).length

  useEffect(() => {
    if (!online || job !== "none") return
    const t = window.setTimeout(
      () => {
        setTab("home")
        setJob("incoming")
      },
      notice ? 7000 : 3200,
    )
    return () => window.clearTimeout(t)
  }, [online, job, notice])

  const toggleOnline = () => {
    setNotice("")
    setOnline((o) => !o)
  }
  const skip = () => {
    setNotice("Bạn đã bỏ qua một cuốc. Đang tìm cuốc khác…")
    setJob("none")
  }
  const complete = () => {
    setJob("complete")
    setHistory((h) => [
      {
        id: Date.now(),
        when: "Vừa xong",
        route: "Q.1 → Q.4",
        amount: JOB.earning,
        status: "Chờ đối soát",
      },
      ...h,
    ])
    setWeek((w) => w + JOB.earning)
    setBalance((b) => b + JOB.earning)
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

  if (!registered) {
    return (
      <main className="app-shell">
        <section className="phone-frame d-frame">
          <Onboarding onDone={() => setRegistered(true)} />
        </section>
      </main>
    )
  }

  const working =
    job === "toPickup" || job === "atPickup" || job === "delivering"
  const showNav = !working && job !== "incoming" && job !== "complete"

  return (
    <main className="app-shell">
      <section className="phone-frame d-frame" ref={phoneRef}>
        <div className="tab-content-surface">
          {tab === "home" && (
            <div className="tab-screen home-screen" key="home">
              <div className="map-area">
                <InteractiveMap
                  destAddr={JOB.destination}
                  jobState={job}
                  mode="driver"
                  online={online}
                  pickupAddr={JOB.pickup}
                />
                {!working && job !== "incoming" && job !== "complete" && (
                  <>
                    <header className="d-top">
                      <div className="d-top-row">
                        <span className="d-hello">
                          <span className="d-avatar" aria-hidden="true">
                            NM
                          </span>
                          <span>
                            <small>Chào buổi sáng,</small>
                            <strong>Minh</strong>
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
                    onMessage={() => setChatOpen(true)}
                    onNext={() => {
                      if (job === "toPickup") setJob("atPickup")
                      else if (job === "atPickup") setJob("delivering")
                      else complete()
                    }}
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
                            setJob("incoming")
                          }}
                          title="Thử nghiệm nhận cuốc ngay lập tức"
                          type="button"
                        >
                          <span>Nhận cuốc ngay</span>
                          <Icon name="plus" size={14} strokeWidth={2.6} />
                        </button>
                      </div>
                    ) : (
                      <div className="d-offline-bar">
                        <div className="d-offline-info">
                          <strong>Gạt công tắc để bắt đầu nhận cuốc</strong>
                          <small>
                            Nhận đơn hàng hóa, bốc xếp & chuyển phát nội thành
                          </small>
                        </div>
                        <button
                          className="d-go-online-btn"
                          onClick={toggleOnline}
                          type="button"
                        >
                          <span>BẬT NHẬN CUỐC</span>
                          <Icon name="chevron" size={18} strokeWidth={2.6} />
                        </button>
                      </div>
                    )}
                  </div>

                  {online && (
                    <div className="d-hot-mini">
                      <span className="d-hot-badge">🔥 Nhu cầu cao:</span>
                      <span>
                        Q.1 & Q.3 đang có nhiều đơn đặt xe (+15% cước)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {job === "incoming" && (
                <Incoming
                  key="incoming"
                  onAccept={() => setJob("toPickup")}
                  onSkip={skip}
                />
              )}
              {job === "complete" && (
                <Complete
                  onContinue={() => setJob("none")}
                  onEarnings={() => {
                    setJob("none")
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
            convId={CURRENT_CONV}
            moving={job !== "atPickup"}
            onBack={() => setChatOpen(false)}
            onOpenMap={() => setChatOpen(false)}
            side="driver"
          />
        )}

        {showNav && <DriverNav onChange={changeTab} tab={tab} />}
      </section>
    </main>
  )
}
