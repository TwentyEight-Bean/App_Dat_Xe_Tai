import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { uploadImageWithFallback } from "./lib/cloudinaryClient"
import {
  registerDeviceTokenToServer,
  removeDeviceTokenFromServer,
} from "./lib/deviceTokenClient"
import TopUpModal from "./TopUpModal"
import useCustomerDialog from "./customerDialog"

/* ---------- tiny shared store ---------- */

function makeStore<T>(initial: T) {
  let value = initial

  const listeners = new Set<() => void>()

  return {
    use: () =>
      useSyncExternalStore(
        (l) => {
          listeners.add(l)

          return () => listeners.delete(l)
        },

        () => value,
      ),

    set: (next: T) => {
      value = next

      listeners.forEach((l) => l())
    },

    get: () => value,
  }
}

export type SavedAddress = {
  id: number

  realId?: string

  type: "home" | "work" | "other"

  name: string

  address: string

  isDefault?: boolean
}

const typeName = { home: "Nhà", work: "Công ty", other: "Khác" } as const

const labelOf = (a: SavedAddress) =>
  a.type === "other" && a.name.trim() ? a.name.trim() : typeName[a.type]

const addressStore = makeStore<SavedAddress[]>([])

export const useAddresses = addressStore.use

export const profileStore = makeStore({
  name: "Khách hàng",

  phone: "",

  email: "",

  photo: "",
})

export const useProfile = profileStore.use

export function clearCustomerData() {
  addressStore.set([])
  profileStore.set({ name: "Khách hàng", phone: "", email: "", photo: "" })
  payStore.set("cash")
}

// Đồng bộ thông tin người dùng từ Backend qua API GET /api/v1/auth/me (Sprint 1: Task 1.4)

export const syncUserProfileFromApi = async () => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null

  if (!token) return null

  try {
    const res = await fetch("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await res.json()
    if (localStorage.getItem("auth_token") !== token) return null

    if (res.ok && data.success && data.user) {
      const currentProfile = profileStore.get()

      profileStore.set({
        ...currentProfile,

        email: data.user.email || "",

        phone: data.user.phone || currentProfile.phone,

        name:
          data.user.fullName ||
          (data.user.phone
            ? `Khách hàng (${data.user.phone.slice(-4)})`
            : currentProfile.name),

        photo: data.user.avatarUrl || "",
      })

      return data.user
    } else if (res.status === 401) {
      // Token không hợp lệ hoặc đã hết hạn

      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token")

        localStorage.removeItem("user_phone")
        clearCustomerData()

        window.dispatchEvent(new Event("customer-auth-changed"))
      }

      return null
    }
  } catch (err) {
    console.warn("Could not sync user profile:", err)
  }

  return null
}

// Đồng bộ danh bạ sổ địa chỉ từ Backend qua API GET /api/v1/customer/addresses

export const syncAddressesFromApi = async () => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null

  if (!token) return

  try {
    const res = await fetch("/api/v1/customer/addresses", {
      headers: { Authorization: `Bearer ${token}` },
    })

    const data = await res.json()

    if (localStorage.getItem("auth_token") !== token) return
    if (res.ok && data.success && Array.isArray(data.data)) {
      addressStore.set(
        data.data.map((item: any, idx: number) => ({
          id: idx + 1,

          realId: item.id,

          type: item.title?.toLowerCase().includes("nhà")
            ? "home"
            : item.title?.toLowerCase().includes("công ty")
              ? "work"
              : "other",

          name: item.title || "",

          address: item.addressText,

          isDefault: Boolean(item.isDefault),
        })),
      )
    }
  } catch (err) {
    console.warn("Could not sync addresses:", err)
  }
}

const payStore = makeStore<"cash" | "wallet" | "vnpay" | "momo">("cash")
export const usePaymentPreference = payStore.use

const notifStore = makeStore({ orders: true, messages: true, promos: false })

const privacyStore = makeStore({ location: true, lock: false })

/* ---------- icons ---------- */

type AI = "back" | "chevron" | "user" | "pin" | "card" | "tag" | "help" | "phone" | "bell" | "shield" | "logout" | "pencil" | "home" | "building" | "plus" | "check" | "camera" | "mail" | "cash" | "wallet" | "box" | "chat"

function AIcon({
  name,

  size = 20,

  strokeWidth = 1.8,
}: {
  name: AI

  size?: number

  strokeWidth?: number
}) {
  const paths: Record<AI, ReactNode> = {
    back: <path d="m15 18-6-6 6-6" />,

    chevron: <path d="m9 18 6-6-6-6" />,

    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.8 21a7.2 7.2 0 0 1 14.4 0" />
      </>
    ),

    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),

    card: (
      <>
        <rect height="14" rx="2.5" width="19" x="2.5" y="5" />
        <path d="M2.5 10h19M6.5 15h4" />
      </>
    ),

    tag: (
      <>
        <path d="M3 12V4h8l10 10-8 8L3 12Z" />
        <circle cx="7.5" cy="8.5" r="1.2" />
      </>
    ),

    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 17h.01" />
      </>
    ),

    phone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    ),

    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),

    shield: (
      <path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6l-7-3Z" />
    ),

    logout: (
      <>
        <path d="M10 4H5v16h5" />
        <path d="M16 8l4 4-4 4M20 12H9" />
      </>
    ),

    pencil: <path d="M4 20h4L19 9l-4-4L4 16v4Zm9.500-13.500 4 4" />,

    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
      </>
    ),

    building: (
      <>
        <path d="M5 21V4h9v17M14 10h5v11M3 21h18" />
        <path d="M8.500 8h2M8.500 12h2M8.500 16h2" />
      </>
    ),

    plus: <path d="M12 5v14M5 12h14" />,

    check: <path d="m5 12 4 4L19 6" />,

    camera: (
      <>
        <path d="M4 8h3l1.500-2h7L17 8h3v11H4z" />
        <circle cx="12" cy="13" r="3.500" />
      </>
    ),

    mail: (
      <>
        <rect height="15" rx="2.500" width="19" x="2.500" y="4.500" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),

    cash: (
      <>
        <rect height="12" rx="2" width="19" x="2.500" y="6" />
        <circle cx="12" cy="12" r="2.500" />
      </>
    ),

    wallet: (
      <>
        <path d="M4 7a2 2 0 0 1 2-2h12v4" />
        <path d="M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2Z" />
        <circle cx="16.500" cy="14.500" r="1.200" />
      </>
    ),

    box: (
      <>
        <path d="m12 3 8 4.500v9L12 21l-8-4.500v-9L12 3Z" />
        <path d="m4 7.500 8 4.500 8-4.500M12 12v9" />
      </>
    ),

    chat: (
      <path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.8-4A8 8 0 1 1 21 12Z" />
    ),
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  )
}

/* ---------- small parts ---------- */

type Page = "home" | "profile" | "addresses" | "addressEdit" | "payment" | "notifications" | "offers" | "privacy" | "help" | "signedout" | "loginOtp"

type SubHeadProps = {
  title: string
  onBack: () => void
}

function SubHead({ title, onBack }: SubHeadProps) {
  return (
    <header className="orders-head">
      <button
        aria-label="Quay lại"
        className="icon-button back-button"
        onClick={onBack}
        type="button"
      >
        <AIcon name="back" size={20} />
      </button>
      <h1>{title}</h1>
      <span className="head-spacer" />
    </header>
  )
}

function Row({
  icon,

  label,

  value,

  onClick,
}: {
  icon: AI

  label: string

  value?: string

  onClick: () => void
}) {
  return (
    <li>
      <button className="acc-row" onClick={onClick} type="button">
        <span className="acc-row-icon">
          <AIcon name={icon} size={19} />
        </span>
        <span className="acc-row-label">{label}</span>
        {value && <span className="acc-row-value">{value}</span>}
        <AIcon name="chevron" size={16} />
      </button>
    </li>
  )
}

function Switch({
  on,

  onChange,

  label,

  hint,
}: {
  on: boolean

  onChange: (v: boolean) => void

  label: string

  hint: string
}) {
  return (
    <li>
      <button
        aria-checked={on}
        className="acc-row switch"
        onClick={() => onChange(!on)}
        role="switch"
        type="button"
      >
        <span className="acc-row-text">
          <strong>{label}</strong>
          <small>{hint}</small>
        </span>
        <span className={`acc-switch ${on ? "on" : ""}`}>
          <i />
        </span>
      </button>
    </li>
  )
}

function Toast({ text }: { text: string }) {
  return (
    <div className="acc-toast" role="status">
      <AIcon name="check" size={16} strokeWidth={2.6} />
      {text}
    </div>
  )
}

/* ---------- main ---------- */

export type OrderOption = {
  id: string
  label: string
}

export default function AccountScreen({
  supportOrder,

  orderOptions,

  canUseAddress,

  onUseAddress,

  onBackToOrder,

  onNavHidden,
}: {
  supportOrder: string | null

  orderOptions: OrderOption[]

  canUseAddress: boolean

  onUseAddress: (address: string) => void

  onBackToOrder: () => void

  onNavHidden: (hidden: boolean) => void
}) {
  const [page, setPage] = useState<Page>(supportOrder ? "help" : "home")

  const [editId, setEditId] = useState<number | null>(null)

  const [toast, setToast] = useState("")

  const [confirmOut, setConfirmOut] = useState(false)

  const logoutDialogRef = useCustomerDialog(confirmOut, () =>
    setConfirmOut(false),
  )

  const [deviceNotifEnabled, setDeviceNotifEnabled] = useState(() =>
    Boolean(
      typeof window !== "undefined" &&
        localStorage.getItem("device_notif_enabled") === "true",
    ),
  )

  const [isUpdatingDeviceToken, setIsUpdatingDeviceToken] = useState(false)

  useEffect(() => {
    const handleUpdate = () => {
      setDeviceNotifEnabled(
        localStorage.getItem("device_notif_enabled") === "true",
      )
    }

    window.addEventListener("device-token-updated", handleUpdate)

    return () =>
      window.removeEventListener("device-token-updated", handleUpdate)
  }, [])

  const [focusContact, setFocusContact] = useState(false)

  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(
      typeof window !== "undefined" && localStorage.getItem("auth_token"),
    ),
  )

  useEffect(() => {
    if (isLoggedIn) {
      syncAddressesFromApi()

      syncUserProfileFromApi().then((user) => {
        if (!user && !localStorage.getItem("auth_token")) {
          setIsLoggedIn(false)
        }
      })
    }
  }, [isLoggedIn])

  useEffect(() => {
    const syncAuth = () => {
      const loggedIn = Boolean(localStorage.getItem("auth_token"))
      setIsLoggedIn(loggedIn)
      if (!loggedIn) {
        clearCustomerData()
        setPage("home")
        setConfirmOut(false)
      }
    }
    window.addEventListener("customer-auth-changed", syncAuth)
    window.addEventListener("storage", syncAuth)
    return () => {
      window.removeEventListener("customer-auth-changed", syncAuth)
      window.removeEventListener("storage", syncAuth)
    }
  }, [])

  const profile = profileStore.use()

  const addresses = addressStore.use()

  const pay = payStore.use()

  const notif = notifStore.use()

  const privacy = privacyStore.use()

  useEffect(() => {
    onNavHidden(
      page === "profile" || page === "addressEdit" || page === "loginOtp",
    )

    return () => onNavHidden(false)
  }, [page])

  useEffect(() => {
    if (!toast) return

    const t = window.setTimeout(() => setToast(""), 2200)

    return () => window.clearTimeout(t)
  }, [toast])

  const go = (p: Page) =>
    setPage(
      !isLoggedIn &&
        ["profile", "addresses", "addressEdit", "payment"].includes(p)
        ? "loginOtp"
        : p,
    )

  const initials = profile.name

    .trim()

    .split(/\s+/)

    .map((w) => w[0])

    .join("")

    .slice(0, 2)

    .toUpperCase()

  const Avatar = ({ big }: { big?: boolean }) => (
    <span className={`acc-avatar ${big ? "big" : ""}`} aria-hidden="true">
      {profile.photo ? <img alt="" src={profile.photo} /> : initials}
    </span>
  )

  /* ----- home ----- */

  if (page === "home") {
    return (
      <section className="orders-screen account-screen">
        <header className="orders-head">
          <h1>Tài khoản</h1>
        </header>

        <div className="acc-profile">
          <Avatar />
          <span className="acc-profile-id">
            <strong>{isLoggedIn ? profile.name : "Khách hàng"}</strong>
            <small>
              {isLoggedIn ? profile.phone : "Đăng nhập để quản lý tài khoản"}
            </small>
          </span>
          <button
            className="text-button"
            onClick={() => go("profile")}
            type="button"
          >
            {isLoggedIn ? "Chỉnh sửa" : "Đăng nhập"}
          </button>
        </div>

        <h2 className="conv-section">Tài khoản</h2>
        <ul className="acc-list">
          <Row
            icon="user"
            label="Thông tin cá nhân"
            onClick={() => go("profile")}
          />
          <Row
            icon="pin"
            label="Địa chỉ đã lưu"
            onClick={() => go("addresses")}
            value={`${addresses.length}`}
          />
          <Row
            icon="card"
            label="Phương thức thanh toán"
            onClick={() => go("payment")}
            value={
              pay === "cash"
                ? "Tiền mặt"
                : pay === "vnpay"
                  ? "VNPay"
                  : pay === "momo"
                    ? "MoMo"
                    : "Ví điện tử"
            }
          />
        </ul>

        <h2 className="conv-section">Ưu đãi</h2>
        <ul className="acc-list">
          <Row
            icon="tag"
            label="Ưu đãi của tôi"
            onClick={() => go("offers")}
            value="2"
          />
        </ul>

        <h2 className="conv-section">Hỗ trợ</h2>
        <ul className="acc-list">
          <Row
            icon="help"
            label="Trung tâm trợ giúp"
            onClick={() => go("help")}
          />
          <Row
            icon="phone"
            label="Liên hệ hỗ trợ"
            onClick={() => {
              setFocusContact(true)

              go("help")
            }}
          />
        </ul>

        <h2 className="conv-section">Cài đặt</h2>
        <ul className="acc-list">
          <Row
            icon="bell"
            label="Thông báo"
            onClick={() => go("notifications")}
          />
          <Row
            icon="shield"
            label="Quyền riêng tư & bảo mật"
            onClick={() => go("privacy")}
          />
          <Row
            icon="building"
            label="Cổng Quản trị viên (FastDrop Control Center)"
            onClick={() => {
              window.location.hash = "admin"
            }}
          />
        </ul>

        <button
          className="acc-logout"
          onClick={() => (isLoggedIn ? setConfirmOut(true) : go("loginOtp"))}
          type="button"
        >
          <AIcon name="logout" size={18} />
          {isLoggedIn ? "Đăng xuất" : "Đăng nhập"}
        </button>
        <p className="acc-version">Phiên bản 1.0</p>
        {toast && <Toast text={toast} />}

        {confirmOut && (
          <div className="acc-scrim" onClick={() => setConfirmOut(false)}>
            <div
              aria-modal="true"
              ref={logoutDialogRef}
              tabIndex={-1}
              aria-label="Đăng xuất khỏi tài khoản"
              className="acc-dialog"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              <strong>Đăng xuất khỏi tài khoản?</strong>
              <p>Bạn có thể đăng nhập lại bất cứ lúc nào bằng số điện thoại.</p>
              <div>
                <button
                  className="secondary-button"
                  onClick={() => setConfirmOut(false)}
                  type="button"
                >
                  Hủy
                </button>
                <button
                  className="secondary-button"
                  onClick={async () => {
                    setConfirmOut(false)

                    // Gọi API DELETE /api/v1/auth/device-token để thu hồi token thiết bị (Sprint 1: Task 1.4)

                    await removeDeviceTokenFromServer()

                    if (typeof window !== "undefined") {
                      localStorage.removeItem("auth_token")

                      localStorage.removeItem("user_phone")
                      addressStore.set([])
                      profileStore.set({
                        name: "Khách hàng",
                        phone: "",
                        email: "",
                        photo: "",
                      })

                      window.dispatchEvent(new Event("customer-auth-changed"))
                    }

                    setIsLoggedIn(false)

                    go("signedout")
                  }}
                  type="button"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    )
  }

  if (page === "signedout") {
    return (
      <section className="orders-screen account-screen">
        <div className="acc-empty">
          <span className="acc-empty-icon">
            <AIcon name="user" size={28} />
          </span>
          <strong>Bạn đã đăng xuất</strong>
          <p>Đăng nhập lại bằng OTP để tiếp tục đặt xe và xem đơn hàng.</p>
          <button
            className="primary-button"
            onClick={() => go("loginOtp")}
            type="button"
          >
            <span>Đăng nhập bằng OTP</span>
          </button>
        </div>
      </section>
    )
  }

  if (page === "profile") {
    return (
      <ProfileForm
        Avatar={Avatar}
        onBack={() => go("home")}
        onSaved={() => {
          setToast("Đã lưu thay đổi")

          go("home")
        }}
        toast={toast}
      />
    )
  }

  if (page === "addresses") {
    return (
      <section className="orders-screen account-screen">
        <SubHead onBack={() => go("home")} title="Địa chỉ đã lưu" />
        <ul className="acc-list addr">
          {addresses.map((a) => (
            <li className="addr-item" key={a.id}>
              <span className={`addr-icon ${a.type}`}>
                <AIcon
                  name={
                    a.type === "home"
                      ? "home"
                      : a.type === "work"
                        ? "building"
                        : "pin"
                  }
                  size={19}
                />
              </span>
              <span className="addr-copy">
                <strong
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {labelOf(a)}
                  {a.isDefault && (
                    <span
                      style={{
                        fontSize: "11px",

                        background: "#dcfce7",

                        color: "#166534",

                        padding: "1px 6px",

                        borderRadius: "4px",

                        fontWeight: "600",
                      }}
                    >
                      Mặc định
                    </span>
                  )}
                </strong>
                <small>{a.address}</small>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "2px",
                    alignItems: "center",
                  }}
                >
                  {canUseAddress && (
                    <button
                      className="text-button"
                      onClick={() => onUseAddress(a.address)}
                      type="button"
                    >
                      Giao đến đây
                    </button>
                  )}
                  {!a.isDefault && (
                    <button
                      className="text-button"
                      style={{
                        fontSize: "12px",

                        color: "var(--brand-600, #2563eb)",

                        padding: 0,
                      }}
                      onClick={async () => {
                        const token =
                          typeof window !== "undefined"
                            ? localStorage.getItem("auth_token")
                            : null

                        if (!token || !a.realId) {
                          setToast("Vui lòng đăng nhập và tải lại địa chỉ")
                          return
                        }
                        if (token && a.realId) {
                          try {
                            const res = await fetch(
                              `/api/v1/customer/addresses/${a.realId}/default`,

                              {
                                method: "PATCH",

                                headers: { Authorization: `Bearer ${token}` },
                              },
                            )

                            const data = await res.json()

                            if (!res.ok || !data.success)
                              throw new Error(
                                data.message ||
                                  "Không thể đặt địa chỉ mặc định",
                              )

                            if (localStorage.getItem("auth_token") !== token)
                              return
                            if (data.success) {
                              addressStore.set(
                                addresses.map((item) => ({
                                  ...item,

                                  isDefault: item.id === a.id,
                                })),
                              )

                              setToast("Đã đặt làm địa chỉ mặc định")

                              return
                            }
                          } catch (err) {
                            setToast(
                              err instanceof Error
                                ? err.message
                                : "Không thể đặt địa chỉ mặc định",
                            )

                            return
                          }
                        }

                        addressStore.set(
                          addresses.map((item) => ({
                            ...item,

                            isDefault: item.id === a.id,
                          })),
                        )

                        setToast("Đã đặt làm địa chỉ mặc định")
                      }}
                      type="button"
                    >
                      Đặt làm mặc định
                    </button>
                  )}
                </div>
              </span>
              <button
                aria-label={`Sửa địa chỉ ${labelOf(a)}`}
                className="acc-edit"
                onClick={() => {
                  setEditId(a.id)

                  go("addressEdit")
                }}
                type="button"
              >
                <AIcon name="pencil" size={18} />
              </button>
            </li>
          ))}
        </ul>
        <button
          className="secondary-button acc-add"
          onClick={() => {
            setEditId(null)

            go("addressEdit")
          }}
          type="button"
        >
          <AIcon name="plus" size={18} strokeWidth={2.2} />
          Thêm địa chỉ
        </button>
        {toast && <Toast text={toast} />}
      </section>
    )
  }

  if (page === "addressEdit") {
    return (
      <AddressForm
        existing={addresses.find((a) => a.id === editId) ?? null}
        onBack={() => go("addresses")}
        onDone={(msg) => {
          setToast(msg)

          go("addresses")
        }}
      />
    )
  }

  if (page === "payment") {
    return (
      <PaymentPageWithHistory
        onBack={() => go("home")}
        onSelect={(selectedMethod) => {
          payStore.set(selectedMethod)

          setToast("Đã đổi phương thức thanh toán mặc định")
        }}
        pay={pay}
        toast={toast}
      />
    )
  }

  if (page === "notifications") {
    return (
      <section className="orders-screen account-screen">
        <SubHead onBack={() => go("home")} title="Thông báo" />
        <ul className="acc-list">
          <li
            style={{
              padding: "12px 14px",
              background: "var(--brand-50, #eaf5ff)",
              borderRadius: "14px",
              marginBottom: "12px",
              border: "1px solid var(--brand-200, #a9d2f7)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div style={{ flex: 1 }}>
                <strong
                  style={{
                    fontSize: "13px",
                    color: "var(--ink-900, #17212b)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>🔔</span> Thông báo đẩy thiết bị (FCM)
                </strong>
                <small
                  style={{
                    color: "var(--ink-500, #697580)",
                    display: "block",
                    marginTop: "2px",
                    fontSize: "11px",
                    lineHeight: 1.35,
                  }}
                >
                  {deviceNotifEnabled
                    ? "Đã bật: Nhận thông báo nổi màn hình khi tài xế tới"
                    : "Chưa bật: Cho phép gửi thông báo khi tài xế nhận chuyến"}
                </small>
              </div>
              <button
                type="button"
                disabled={isUpdatingDeviceToken}
                className={
                  deviceNotifEnabled
                    ? "secondary-button compact"
                    : "primary-button compact"
                }
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  borderRadius: "10px",
                  whiteSpace: "nowrap",
                }}
                onClick={async () => {
                  setIsUpdatingDeviceToken(true)

                  if (!deviceNotifEnabled) {
                    const res = await registerDeviceTokenToServer()

                    if (res.success) {
                      setDeviceNotifEnabled(true)

                      setToast("Đã kích hoạt thông báo đẩy trên thiết bị!")
                    } else {
                      setToast(res.message)
                    }
                  } else {
                    const res = await removeDeviceTokenFromServer()

                    setDeviceNotifEnabled(false)

                    setToast(res.message)
                  }

                  setIsUpdatingDeviceToken(false)
                }}
              >
                {isUpdatingDeviceToken
                  ? "Đang lưu..."
                  : deviceNotifEnabled
                    ? "Tắt"
                    : "Bật ngay"}
              </button>
            </div>
          </li>
          <Switch
            hint="Tài xế nhận đơn, đã lấy hàng, đã giao"
            label="Trạng thái đơn hàng"
            on={notif.orders}
            onChange={(v) => notifStore.set({ ...notif, orders: v })}
          />
          <Switch
            hint="Khi tài xế nhắn tin cho bạn"
            label="Tin nhắn từ tài xế"
            on={notif.messages}
            onChange={(v) => notifStore.set({ ...notif, messages: v })}
          />
          <Switch
            hint="Mã giảm giá và tin tức mới"
            label="Ưu đãi & thông báo"
            on={notif.promos}
            onChange={(v) => notifStore.set({ ...notif, promos: v })}
          />
        </ul>
        {toast && <Toast text={toast} />}
      </section>
    )
  }

  if (page === "privacy") {
    return (
      <section className="orders-screen account-screen">
        <SubHead onBack={() => go("home")} title="Quyền riêng tư & bảo mật" />
        <ul className="acc-list">
          <Switch
            hint="Cho phép dùng vị trí để gợi ý điểm lấy hàng"
            label="Chia sẻ vị trí"
            on={privacy.location}
            onChange={(v) => privacyStore.set({ ...privacy, location: v })}
          />
          <Switch
            hint="Dùng vân tay hoặc khuôn mặt để mở ứng dụng"
            label="Khóa ứng dụng"
            on={privacy.lock}
            onChange={(v) => privacyStore.set({ ...privacy, lock: v })}
          />
        </ul>
      </section>
    )
  }

  if (page === "offers") {
    return (
      <section className="orders-screen account-screen">
        <SubHead onBack={() => go("home")} title="Ưu đãi của tôi" />
        <ul className="acc-list">
          {[
            {
              code: "GIAO30",

              text: "Giảm 30.000đ cho đơn từ 150.000đ",

              exp: "Hết hạn 30/10",
            },

            {
              code: "VANMOI",

              text: "Giảm 15% cuốc Xe van đầu tháng",

              exp: "Hết hạn 05/11",
            },
          ].map((o) => (
            <li className="offer-item" key={o.code}>
              <span className="acc-row-icon">
                <AIcon name="tag" size={19} />
              </span>
              <span className="acc-row-text">
                <strong>{o.code}</strong>
                <small>{o.text}</small>
                <small className="exp">{o.exp}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (page === "loginOtp") {
    return (
      <LoginOtpPage
        onBack={() => go("home")}
        onSuccess={(phone, token) => {
          setIsLoggedIn(true)

          profileStore.set({
            ...profile,

            phone: phone,

            name:
              profile.name && profile.name !== "Minh Anh"
                ? profile.name
                : `Khách hàng (${phone.slice(-4)})`,
          })

          setToast("Đăng nhập OTP thành công!")

          go("home")
        }}
      />
    )
  }

  return (
    <HelpPage
      focusContact={focusContact}
      onBack={supportOrder ? onBackToOrder : () => go("home")}
      orderOptions={orderOptions}
      supportOrder={supportOrder}
    />
  )
}

/* ---------- login otp form ---------- */

function LoginOtpPage({
  onBack,

  onSuccess,
}: {
  onBack: () => void

  onSuccess: (phone: string, token: string) => void
}) {
  const pending = useRef(false)
  const requestRef = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      requestRef.current?.abort()
    },
    [],
  )
  const [mode, setMode] = useState<"login" | "register">("login")
  const [phone, setPhone] = useState("0988888888")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("123456")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [infoMsg, setInfoMsg] = useState("")

  const handleLogin = async () => {
    if (pending.current) return

    const cleanPhone = phone.trim().replace(/\s+/g, "")
    if (!cleanPhone || cleanPhone.length < 9) {
      setError("Vui lòng nhập số điện thoại hợp lệ (tối thiểu 9 số)")
      return
    }

    if (!password || password.trim().length < 6) {
      setError("Vui lòng nhập mật khẩu hoặc mã PIN (tối thiểu 6 ký tự)")
      return
    }

    setError("")
    setLoading(true)
    pending.current = true
    const request = new AbortController()
    requestRef.current = request

    try {
      const res = await fetch("/api/v1/auth/login", {
        signal: request.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          password: password.trim(),
          role: "CUSTOMER",
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success || !data.token || !data.user?.phone) {
        if (res.status === 404) {
          setError("Số điện thoại chưa đăng ký. Hãy chuyển sang tab Đăng ký để tạo tài khoản mới.")
        } else {
          setError(data.message || "Đăng nhập không thành công. Kiểm tra lại mật khẩu.")
        }
        return
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token)
        localStorage.setItem("user_phone", data.user.phone)
        window.dispatchEvent(new Event("customer-auth-changed"))
      }

      onSuccess(data.user.phone, data.token)
    } catch (err: any) {
      if (request.signal.aborted) return
      setError(err.message || "Không thể kết nối đến máy chủ đăng nhập")
    } finally {
      pending.current = false
      if (!request.signal.aborted) setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (pending.current) return

    const cleanPhone = phone.trim().replace(/\s+/g, "")
    if (!cleanPhone || cleanPhone.length < 9) {
      setError("Vui lòng nhập số điện thoại hợp lệ (tối thiểu 9 số)")
      return
    }

    if (!password || password.trim().length < 6) {
      setError("Vui lòng tạo mật khẩu hoặc mã PIN tối thiểu 6 ký tự")
      return
    }

    setError("")
    setLoading(true)
    pending.current = true
    const request = new AbortController()
    requestRef.current = request

    try {
      const res = await fetch("/api/v1/auth/register", {
        signal: request.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          fullName: fullName.trim() || undefined,
          password: password.trim(),
          role: "CUSTOMER",
        }),
      })

      const data = await res.json()
      if (request.signal.aborted) return

      if (!res.ok || !data.success || !data.token || !data.user?.phone) {
        if (res.status === 409) {
          setError("Số điện thoại đã tồn tại. Vui lòng chuyển sang tab Đăng nhập.")
        } else {
          setError(data.message || "Đăng ký tài khoản không thành công")
        }
        return
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("auth_token", data.token)
        localStorage.setItem("user_phone", data.user.phone)
        window.dispatchEvent(new Event("customer-auth-changed"))
      }

      onSuccess(data.user.phone, data.token)
    } catch (err: any) {
      if (request.signal.aborted) return
      setError(err.message || "Không thể kết nối đến máy chủ đăng ký")
    } finally {
      pending.current = false
      if (!request.signal.aborted) setLoading(false)
    }
  }

  return (
    <section className="orders-screen account-screen form">
      <SubHead onBack={onBack} title={mode === "login" ? "Đăng nhập tài khoản" : "Đăng ký tài khoản"} />
      <div style={{ padding: "20px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "28px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <AIcon name="shield" size={28} />
          </div>
          <h2
            style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 6px" }}
          >
            {mode === "login" ? "Chào mừng bạn trở lại!" : "Tạo tài khoản mới (0 VNĐ)"}
          </h2>
          <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
            {mode === "login"
              ? "Đăng nhập bằng số điện thoại và mật khẩu hoặc mã PIN của bạn"
              : "Đăng ký tài khoản khách hàng để theo dõi đơn và nhận ưu đãi"}
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#f1f5f9",
            padding: "4px",
            borderRadius: "12px",
            marginBottom: "18px",
            gap: "4px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login")
              setError("")
              setInfoMsg("")
            }}
            style={{
              padding: "9px 12px",
              borderRadius: "10px",
              border: "none",
              background: mode === "login" ? "#ffffff" : "transparent",
              color: mode === "login" ? "#0f172a" : "#64748b",
              fontWeight: mode === "login" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: mode === "login" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register")
              setError("")
              setInfoMsg("")
            }}
            style={{
              padding: "9px 12px",
              borderRadius: "10px",
              border: "none",
              background: mode === "register" ? "#ffffff" : "transparent",
              color: mode === "register" ? "#0f172a" : "#64748b",
              fontWeight: mode === "register" ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: mode === "register" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Đăng ký mới
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {infoMsg && (
          <div
            style={{
              background: "#f0fdf4",
              color: "#15803d",
              border: "1px solid #bbf7d0",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            💡 {infoMsg}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (mode === "login") handleLogin()
            else handleRegister()
          }}
        >
          {mode === "register" && (
            <label className="acc-field" style={{ marginBottom: "14px", display: "block" }}>
              <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Họ và tên
              </span>
              <input
                type="text"
                disabled={loading}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn An"
                style={{
                  width: "100%",
                  height: "44px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  padding: "0 14px",
                  fontSize: "14px",
                }}
              />
            </label>
          )}

          <label className="acc-field" style={{ marginBottom: "14px", display: "block" }}>
            <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Số điện thoại
            </span>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              disabled={loading}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ví dụ: 0988888888"
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                padding: "0 14px",
                fontSize: "14px",
              }}
            />
          </label>

          <label className="acc-field" style={{ marginBottom: "16px", display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                {mode === "login" ? "Mật khẩu / Mã PIN" : "Tạo Mật khẩu / Mã PIN (tối thiểu 6 ký tự)"}
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập tối thiểu 6 ký tự"
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                padding: "0 14px",
                fontSize: "14px",
              }}
            />
          </label>

          {mode === "login" && (
            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px" }}>
              💡 Mật khẩu thử nghiệm mẫu: <strong>123456</strong>
            </p>
          )}

          <button
            className="primary-button"
            style={{ width: "100%", height: "48px", borderRadius: "12px", fontSize: "14px", fontWeight: 700 }}
            disabled={loading || !phone.trim() || !password.trim()}
            type="submit"
          >
            <span>
              {loading
                ? "Đang xử lý..."
                : mode === "login"
                ? "Đăng nhập ngay"
                : "Tạo tài khoản (0 VNĐ)"}
            </span>
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login")
              setError("")
              setInfoMsg("")
            }}
            style={{ fontSize: "13px", color: "#2563eb" }}
          >
            {mode === "login"
              ? "Chưa có tài khoản? Bấm vào đây để đăng ký"
              : "Đã có tài khoản? Quay lại Đăng nhập"}
          </button>
        </div>
      </div>
    </section>
  )
}

/* ---------- profile form ---------- */

function ProfileForm({
  Avatar,

  onBack,

  onSaved,

  toast,
}: {
  Avatar: (p: { big?: boolean }) => ReactNode

  onBack: () => void

  onSaved: () => void

  toast: string
}) {
  const p = profileStore.get()

  const [name, setName] = useState(p.name)

  const [email, setEmail] = useState(p.email)

  const [photo, setPhoto] = useState(p.photo)

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  const [uploadError, setUploadError] = useState("")

  const [isSaving, setIsSaving] = useState(false)

  const [saveError, setSaveError] = useState("")

  const fileRef = useRef<HTMLInputElement>(null)

  const emailOk = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim())

  const dirty = name !== p.name || email !== p.email || photo !== p.photo

  const valid = name.trim().length > 1 && emailOk

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]

    if (!f) return

    e.target.value = ""

    if (!f.type.startsWith("image/") || f.size > 10 * 1024 * 1024) {
      setUploadError("Vui lòng chọn ảnh nhỏ hơn 10 MB")

      return
    }

    // 1. Xem trước ảnh ngay lập tức

    const previewUrl = URL.createObjectURL(f)

    setPhoto(previewUrl)

    setIsUploadingPhoto(true)

    setUploadError("")

    try {
      // 2. Upload với cơ chế tự động: Thử Direct Upload (signature), nếu lỗi mạng/CORS thì tự động chuyển sang Server Upload (POST /api/v1/upload/server)

      const cloudUrl = await uploadImageWithFallback(f, "avatars")

      setPhoto(cloudUrl)
    } catch (err: any) {
      console.error("Lỗi tải ảnh đại diện:", err)

      setPhoto(p.photo)

      setUploadError(err.message || "Tải ảnh lên máy chủ thất bại")
    } finally {
      URL.revokeObjectURL(previewUrl)

      setIsUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    if (!dirty || !valid || isUploadingPhoto || isSaving) return

    setIsSaving(true)

    setSaveError("")

    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null

    try {
      if (token) {
        const res = await fetch("/api/v1/auth/me", {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            fullName: name.trim(),

            email: email.trim(),

            avatarUrl: photo,
          }),
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(
            data.message || "Không thể cập nhật hồ sơ trên máy chủ",
          )
        }
      }

      if (!token || localStorage.getItem("auth_token") !== token)
        throw new Error("Vui lòng đăng nhập lại")
      profileStore.set({
        ...p,

        name: name.trim(),

        email: email.trim(),

        photo,
      })

      onSaved()
    } catch (err: any) {
      console.error("Lỗi cập nhật hồ sơ:", err)

      setSaveError(err.message || "Lỗi lưu thông tin hồ sơ")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="orders-screen account-screen form">
      <SubHead onBack={onBack} title="Thông tin cá nhân" />
      <div className="acc-photo">
        <span className="acc-avatar big" aria-hidden="true">
          {photo ? (
            <img alt="" src={photo} />
          ) : (
            name

              .trim()

              .split(/\s+/)

              .map((w) => w[0])

              .join("")

              .slice(0, 2)

              .toUpperCase()
          )}
        </span>
        <span>
          <strong>Ảnh đại diện</strong>
          <button
            className="text-button"
            disabled={isUploadingPhoto || isSaving}
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            {isUploadingPhoto ? "Đang tải ảnh lên Cloud..." : "Đổi ảnh"}
          </button>
          {uploadError && (
            <small
              style={{
                color: "#ef4444",
                display: "block",
                fontSize: "11px",
                marginTop: "2px",
              }}
            >
              {uploadError}
            </small>
          )}
        </span>
        <input
          accept="image/*"
          hidden
          onChange={handleAvatarChange}
          ref={fileRef}
          type="file"
        />
      </div>

      <label className="acc-field">
        <span>Họ và tên</span>
        <input
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
      </label>
      <label className="acc-field readonly">
        <span>Số điện thoại</span>
        <input readOnly value={p.phone} />
        <small>Đã xác minh · Liên hệ hỗ trợ nếu cần đổi số</small>
      </label>
      <label className={`acc-field ${email && !emailOk ? "invalid" : ""}`}>
        <span>Email</span>
        <input
          autoComplete="email"
          inputMode="email"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
        />
        {email && !emailOk && <small className="err">Email chưa hợp lệ</small>}
      </label>

      {saveError && (
        <div
          style={{
            color: "#ef4444",
            fontSize: "12px",
            textAlign: "center",
            marginBottom: "8px",
          }}
        >
          {saveError}
        </div>
      )}

      <button
        className="primary-button acc-save"
        disabled={!dirty || !valid || isUploadingPhoto || isSaving}
        onClick={handleSave}
        type="button"
      >
        <span>
          {isSaving
            ? "Đang lưu vào máy chủ..."
            : isUploadingPhoto
              ? "Đang tải ảnh..."
              : "Lưu thay đổi"}
        </span>
      </button>
      {toast && <Toast text={toast} />}
    </section>
  )
}

/* ---------- address form ---------- */

function AddressForm({
  existing,

  onBack,

  onDone,
}: {
  existing: SavedAddress | null

  onBack: () => void

  onDone: (msg: string) => void
}) {
  const [type, setType] = useState<SavedAddress["type"]>(
    existing?.type ?? "home",
  )

  const [name, setName] = useState(existing?.name ?? "")

  const [address, setAddress] = useState(existing?.address ?? "")

  const list = addressStore.get()

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const pending = useRef(false)

  const save = async () => {
    if (!address.trim() || pending.current) return

    pending.current = true

    setSaving(true)

    setError("")

    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null

    if (!token) {
      setError("Vui lòng đăng nhập lại")
      setSaving(false)
      pending.current = false
      return
    }
    let serverId = existing?.realId

    if (token) {
      try {
        if (existing?.realId) {
          const res = await fetch(
            `/api/v1/customer/addresses/${existing.realId}`,
            {
              method: "PUT",

              headers: {
                "Content-Type": "application/json",

                Authorization: `Bearer ${token}`,
              },

              body: JSON.stringify({
                title:
                  type === "other" ? name.trim() || "Khác" : typeName[type],

                addressText: address.trim(),
                latitude: null,
                longitude: null,
              }),
            },
          )

          const data = await res.json()

          if (!res.ok || !data.success)
            throw new Error(data.message || "Không thể cập nhật địa chỉ")
        } else {
          const res = await fetch("/api/v1/customer/addresses", {
            method: "POST",

            headers: {
              "Content-Type": "application/json",

              Authorization: `Bearer ${token}`,
            },

            body: JSON.stringify({
              title: type === "other" ? name.trim() || "Khác" : typeName[type],

              addressText: address.trim(),

              latitude: null,

              longitude: null,
            }),
          })

          const data = await res.json()

          if (!res.ok || !data.success)
            throw new Error(data.message || "Không thể thêm địa chỉ")

          if (!data.data?.id) throw new Error("Phản hồi thiếu mã địa chỉ")
          serverId = data.data.id
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể lưu địa chỉ")

        setSaving(false)

        pending.current = false

        return
      }
    }

    if (localStorage.getItem("auth_token") !== token) {
      setSaving(false)
      pending.current = false
      return
    }
    const next: SavedAddress = {
      id: existing?.id ?? Date.now(),

      realId: serverId,

      type,

      name: type === "other" ? name : "",

      address: address.trim(),
    }

    addressStore.set(
      existing
        ? list.map((a) => (a.id === existing.id ? next : a))
        : [...list, next],
    )

    onDone(existing ? "Đã cập nhật địa chỉ" : "Đã thêm địa chỉ")

    pending.current = false

    setSaving(false)
  }

  return (
    <section className="orders-screen account-screen form">
      <SubHead
        onBack={onBack}
        title={existing ? "Sửa địa chỉ" : "Thêm địa chỉ"}
      />
      <div
        className="filter-tabs acc-types"
        role="group"
        aria-label="Loại địa chỉ"
      >
        {(["home", "work", "other"] as const).map((t) => (
          <button
            aria-pressed={type === t}
            className={type === t ? "on" : ""}
            key={t}
            onClick={() => setType(t)}
            type="button"
          >
            {typeName[t]}
          </button>
        ))}
      </div>
      {type === "other" && (
        <label className="acc-field">
          <span>Tên gợi nhớ</span>
          <input
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Kho hàng"
            value={name}
          />
        </label>
      )}
      <label className="acc-field">
        <span>Địa chỉ đầy đủ</span>
        <input
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Số nhà, đường, quận"
          value={address}
        />
      </label>
      <button
        className="primary-button acc-save"
        disabled={!address.trim() || saving}
        onClick={save}
        type="button"
      >
        <span>{saving ? "Đang xử lý..." : "Lưu địa chỉ"}</span>
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {existing && (
        <button
          className="acc-danger"
          disabled={saving}
          onClick={async () => {
            if (pending.current) return

            pending.current = true

            setSaving(true)

            setError("")

            const token =
              typeof window !== "undefined"
                ? localStorage.getItem("auth_token")
                : null

            if (token && existing.realId) {
              try {
                const res = await fetch(
                  `/api/v1/customer/addresses/${existing.realId}`,
                  {
                    method: "DELETE",

                    headers: { Authorization: `Bearer ${token}` },
                  },
                )

                const data = await res.json()

                if (!res.ok || !data.success)
                  throw new Error(data.message || "Không thể xóa địa chỉ")
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Không thể xóa địa chỉ",
                )

                setSaving(false)

                pending.current = false

                return
              }
            }

            if (
              !token ||
              !existing.realId ||
              localStorage.getItem("auth_token") !== token
            ) {
              setError("Vui lòng đăng nhập và tải lại địa chỉ")
              setSaving(false)
              pending.current = false
              return
            }
            addressStore.set(list.filter((a) => a.id !== existing.id))

            onDone("Đã xóa địa chỉ")

            pending.current = false

            setSaving(false)
          }}
          type="button"
        >
          Xóa địa chỉ
        </button>
      )}
    </section>
  )
}

/* ---------- help ---------- */

const faqs = [
  {
    q: "Cách tính giá cước như thế nào?",

    a: "Giá dựa trên quãng đường, loại xe và phí dịch vụ. Bạn luôn thấy giá ước tính trước khi đặt.",
  },

  {
    q: "Tôi có thể hủy đơn không?",

    a: "Bạn có thể hủy miễn phí trước khi tài xế đến điểm lấy hàng.",
  },

  {
    q: "Hàng hóa nào không được vận chuyển?",

    a: "Hàng cấm, chất dễ cháy nổ và động vật sống không được nhận vận chuyển.",
  },

  {
    q: "Khi nào tôi thanh toán?",

    a: "Với tiền mặt, bạn trả cho tài xế sau khi hàng được giao thành công.",
  },
]

const issues = [
  "Tài xế đến trễ",

  "Hàng bị hư hỏng hoặc thất lạc",

  "Tính sai cước phí",

  "Vấn đề khác",
]

function HelpPage({
  supportOrder,

  orderOptions,

  focusContact,

  onBack,
}: {
  supportOrder: string | null

  orderOptions: OrderOption[]

  focusContact: boolean

  onBack: () => void
}) {
  const [open, setOpen] = useState<number | null>(null)

  const [issue, setIssue] = useState<string | null>(null)

  const [orderId, setOrderId] = useState(supportOrder ?? "")

  const [sent, setSent] = useState("")

  const contactRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusContact) contactRef.current?.scrollIntoView({ block: "start" })
  }, [focusContact])

  return (
    <section className="orders-screen account-screen">
      <SubHead onBack={onBack} title="Trung tâm trợ giúp" />

      {supportOrder && (
        <div className="acc-context">
          <AIcon name="box" size={18} />
          <span>
            Bạn đang hỏi về đơn <strong>{supportOrder}</strong>
          </span>
        </div>
      )}

      <h2 className="conv-section">Câu hỏi thường gặp</h2>
      <ul className="acc-list">
        {faqs.map((f, i) => (
          <li key={f.q}>
            <button
              aria-expanded={open === i}
              className="acc-row faq"
              onClick={() => setOpen(open === i ? null : i)}
              type="button"
            >
              <span className="acc-row-label">{f.q}</span>
              <span className={`acc-chev ${open === i ? "open" : ""}`}>
                <AIcon name="chevron" size={16} />
              </span>
            </button>
            {open === i && <p className="faq-answer">{f.a}</p>}
          </li>
        ))}
      </ul>

      <h2 className="conv-section">Vấn đề với đơn hàng</h2>
      {sent ? (
        <div className="acc-sent" role="alert">
          <span className="acc-empty-icon">
            <AIcon name="phone" size={22} strokeWidth={2.6} />
          </span>
          <strong>Chưa gửi được yêu cầu</strong>
          <p>
            Kênh tiếp nhận trong ứng dụng chưa sẵn sàng. Vui lòng gọi hoặc gửi
            email cho bộ phận hỗ trợ bên dưới về đơn {sent}.
          </p>
          <button
            className="text-button"
            onClick={() => {
              setSent("")
            }}
            type="button"
          >
            Quay lại yêu cầu
          </button>
        </div>
      ) : (
        <>
          {!supportOrder && (
            <label className="acc-field select">
              <span>Chọn đơn hàng</span>
              <select
                onChange={(e) => setOrderId(e.target.value)}
                value={orderId}
              >
                <option value="">Chọn đơn cần hỗ trợ</option>
                {orderOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ul className="acc-list">
            {issues.map((s) => (
              <li key={s}>
                <button
                  aria-pressed={issue === s}
                  className="acc-row"
                  onClick={() => setIssue(s)}
                  type="button"
                >
                  <span className="acc-row-label">{s}</span>
                  <span className={`acc-radio ${issue === s ? "on" : ""}`}>
                    <i />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            className="primary-button acc-save"
            disabled={!issue || !orderId}
            onClick={() => setSent(orderId)}
            type="button"
          >
            <span>Gửi yêu cầu</span>
          </button>
        </>
      )}

      <h2 className="conv-section" ref={contactRef}>
        Liên hệ hỗ trợ
      </h2>
      <ul className="acc-list">
        <li>
          <a className="acc-row" href="tel:19001234">
            <span className="acc-row-icon">
              <AIcon name="phone" size={19} />
            </span>
            <span className="acc-row-text">
              <strong>Gọi 1900 1234</strong>
              <small>Mỗi ngày, 6:00 – 22:00</small>
            </span>
            <AIcon name="chevron" size={16} />
          </a>
        </li>
        <li>
          <a className="acc-row" href="mailto:hotro@fastdrop.vn">
            <span className="acc-row-icon">
              <AIcon name="mail" size={19} />
            </span>
            <span className="acc-row-text">
              <strong>hotro@fastdrop.vn</strong>
              <small>Phản hồi trong 24 giờ</small>
            </span>
            <AIcon name="chevron" size={16} />
          </a>
        </li>
      </ul>
    </section>
  )
}

/* ---------- payment methods & gateway history ---------- */

function PaymentPageWithHistory({
  pay,

  onSelect,

  onBack,

  toast,
}: {
  pay: "cash" | "wallet" | "vnpay" | "momo"

  onSelect: (m: "cash" | "wallet" | "vnpay" | "momo") => void

  onBack: () => void

  toast: string
}) {
  const [history, setHistory] = useState<any[]>([])

  const [walletData, setWalletData] = useState<any>(null)

  const [walletTxs, setWalletTxs] = useState<any[]>([])

  const [calls, setCalls] = useState<any[]>([])

  const [walletFilter, setWalletFilter] = useState("ALL")

  const [activeTab, setActiveTab] = useState<"wallet" | "online" | "calls">(
    "wallet",
  )

  const [showTopUp, setShowTopUp] = useState(false)

  const [loading, setLoading] = useState(false)

  const [loadError, setLoadError] = useState("")

  const txRequest = useRef<AbortController | null>(null)

  const walletRequest = useRef<AbortController | null>(null)

  const loadCustomerTxs = async (type?: string) => {
    const token = localStorage.getItem("auth_token")

    if (!token) return

    txRequest.current?.abort()

    const controller = new AbortController()

    txRequest.current = controller

    setWalletTxs([])

    const url =
      type && type !== "ALL"
        ? `/api/v1/customer/wallet/transactions?limit=20&type=${encodeURIComponent(type)}`
        : `/api/v1/customer/wallet/transactions?limit=20`

    return fetch(url, {
      signal: controller.signal,

      headers: { Authorization: `Bearer ${token}` },
    })

      .then((r) => r.json())

      .then((res) => {
        if (!res.success)
          throw new Error(res.message || "Không thể tải giao dịch ví")

        if (controller.signal.aborted) return
        if (!Array.isArray(res.transactions))
          throw new Error("Phản hồi giao dịch ví không hợp lệ")
        if (res.success && Array.isArray(res.transactions))
          setWalletTxs(res.transactions)
      })

      .catch((err) => {
        if (!controller.signal.aborted)
          setLoadError(err.message || "Không thể tải giao dịch ví")
      })
  }

  const loadAll = async () => {
    const token = localStorage.getItem("auth_token")

    if (!token) return

    walletRequest.current?.abort()

    const controller = new AbortController()

    walletRequest.current = controller

    setLoading(true)

    setLoadError("")

    const load = async (url: string, update: (data: any) => void) => {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok || !data.success)
        throw new Error(data.message || "Không thể tải dữ liệu thanh toán")

      if (!controller.signal.aborted) update(data.data)
    }

    const results = await Promise.allSettled([
      load("/api/v1/customer/wallet", setWalletData),

      loadCustomerTxs(walletFilter),

      load("/api/v1/payments/history?limit=20", (data) =>
        setHistory(Array.isArray(data) ? data : []),
      ),

      load("/api/v1/calls/history", (data) =>
        setCalls(Array.isArray(data) ? data : []),
      ),
    ])

    if (controller.signal.aborted) return

    if (results.some((result) => result.status === "rejected"))
      setLoadError(
        "Không thể tải đầy đủ thông tin thanh toán. Vui lòng thử lại.",
      )

    setLoading(false)
  }

  useEffect(() => {
    loadAll()

    return () => {
      txRequest.current?.abort()
      walletRequest.current?.abort()
    }
  }, [])

  const methods = [
    {
      id: "cash" as const,

      icon: "cash" as AI,

      name: "Tiền mặt (CASH)",

      hint: "Thanh toán trực tiếp cho tài xế",
    },

    {
      id: "vnpay" as const,

      icon: "card" as AI,

      name: "Cổng VNPay (VNPAY-QR)",

      hint: "Quét mã VNPAY-QR, Thẻ ATM & Mobile Banking",
    },

    {
      id: "momo" as const,

      icon: "card" as AI,

      name: "Ví điện tử MoMo",

      hint: "Thanh toán qua ứng dụng MoMo",
    },

    {
      id: "wallet" as const,

      icon: "wallet" as AI,

      name: "Ví tài khoản FastDrop",

      hint: "Khấu trừ từ số dư tài khoản",
    },
  ]

  return (
    <section className="orders-screen account-screen">
      <SubHead onBack={onBack} title="Thanh toán & Ví FastDrop" />
      {loadError && (
        <div role="alert">
          <p className="field-error">{loadError}</p>
          <button
            type="button"
            className="secondary-button"
            disabled={loading}
            onClick={loadAll}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Thẻ Ví Khách Hàng FastDrop */}
      <div
        style={{
          margin: "12px 16px 20px",

          padding: "20px",

          borderRadius: "16px",

          background: "linear-gradient(135deg, #0f172a, #1e293b)",

          color: "#fff",

          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",

          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                fontWeight: 600,
              }}
            >
              Ví điện tử FastDrop
            </div>
            <div
              style={{
                fontSize: "26px",
                fontWeight: 800,
                margin: "6px 0 2px",
                color: "#f8fafc",
              }}
            >
              {walletData
                ? Number(walletData.balance || 0).toLocaleString("vi-VN")
                : "0"}{" "}
              đ
            </div>
            <div
              style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 500 }}
            >
              ✓ Sẵn sàng thanh toán mọi chuyến xe
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTopUp(true)}
            style={{
              padding: "8px 16px",

              borderRadius: "10px",

              border: "none",

              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",

              color: "#fff",

              fontWeight: 700,

              fontSize: "13px",

              cursor: "pointer",

              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
            }}
          >
            + Nạp ví
          </button>
        </div>
      </div>

      <h2 className="conv-section">Chọn phương thức mặc định</h2>
      <ul className="acc-list">
        {methods.map((m) => (
          <li key={m.id}>
            <button
              aria-pressed={pay === m.id}
              className="acc-row"
              onClick={() => onSelect(m.id)}
              type="button"
            >
              <span className="acc-row-icon">
                <AIcon name={m.icon} size={19} />
              </span>
              <span className="acc-row-text">
                <strong>
                  {m.name}
                  {pay === m.id && <em className="acc-default">Mặc định</em>}
                </strong>
                <small>{m.hint}</small>
              </span>
              <span className={`acc-radio ${pay === m.id ? "on" : ""}`}>
                <i />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Tabs Lịch Sử */}
      <div
        style={{
          margin: "24px 16px 12px",
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "8px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("wallet")}
          style={{
            padding: "6px 12px",

            fontSize: "12px",

            fontWeight: 700,

            borderRadius: "6px",

            border: "none",

            backgroundColor: activeTab === "wallet" ? "#2563eb" : "transparent",

            color: activeTab === "wallet" ? "#fff" : "#64748b",

            cursor: "pointer",
          }}
        >
          Biến động ví ({walletTxs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("online")}
          style={{
            padding: "6px 12px",

            fontSize: "12px",

            fontWeight: 700,

            borderRadius: "6px",

            border: "none",

            backgroundColor: activeTab === "online" ? "#2563eb" : "transparent",

            color: activeTab === "online" ? "#fff" : "#64748b",

            cursor: "pointer",
          }}
        >
          Cổng Online ({history.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("calls")}
          style={{
            padding: "6px 12px",

            fontSize: "12px",

            fontWeight: 700,

            borderRadius: "6px",

            border: "none",

            backgroundColor: activeTab === "calls" ? "#2563eb" : "transparent",

            color: activeTab === "calls" ? "#fff" : "#64748b",

            cursor: "pointer",
          }}
        >
          Cuộc gọi ({calls.length})
        </button>
      </div>

      {/* Nội dung Tab 1: Biến Động Ví FastDrop */}
      {activeTab === "wallet" && (
        <>
          <div
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              padding: "0 16px 8px",
              marginBottom: "4px",
            }}
          >
            {[
              { id: "ALL", label: "Tất cả" },

              { id: "TOPUP", label: "Nạp tiền ví" },

              { id: "BOOKING_HOLD", label: "Tạm giữ cước" },

              { id: "BOOKING_PAYMENT", label: "Trừ cước xe" },

              { id: "REFUND", label: "Hoàn tiền" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setWalletFilter(f.id)

                  loadCustomerTxs(f.id)
                }}
                style={{
                  padding: "4px 10px",

                  borderRadius: "9999px",

                  fontSize: "11px",

                  fontWeight: 600,

                  border:
                    walletFilter === f.id
                      ? "1px solid #2563eb"
                      : "1px solid #e2e8f0",

                  backgroundColor: walletFilter === f.id ? "#eff6ff" : "#fff",

                  color: walletFilter === f.id ? "#1d4ed8" : "#64748b",

                  cursor: "pointer",

                  whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {loading ? (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "13px",
              }}
            >
              Đang tải lịch sử ví...
            </div>
          ) : walletTxs.length === 0 ? (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: "13px",
              }}
            >
              Chưa có giao dịch biến động ví FastDrop nào
            </div>
          ) : (
            <ul
              className="acc-list"
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {walletTxs.map((tx: any) => {
                const isPlus = tx.amount > 0

                return (
                  <li
                    key={tx.id}
                    style={{
                      padding: "12px 14px",

                      borderRadius: "12px",

                      backgroundColor: "#fff",

                      border: "1px solid #e5e7eb",

                      display: "flex",

                      justifyContent: "space-between",

                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {tx.description ||
                          (isPlus ? "Nạp tiền ví" : "Thanh toán cuốc xe")}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          marginTop: "2px",
                        }}
                      >
                        {new Date(tx.createdAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 800,
                          color: isPlus ? "#059669" : "#dc2626",
                        }}
                      >
                        {isPlus ? "+" : ""}
                        {Number(tx.amount).toLocaleString("vi-VN")} đ
                      </div>
                      {tx.balanceAfter !== null && (
                        <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                          Dư: {Number(tx.balanceAfter).toLocaleString("vi-VN")}{" "}
                          đ
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {/* Nội dung Tab 2: Lịch Sử Cổng Thanh Toán */}
      {activeTab === "online" && (
        <>
          {loading ? (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "13px",
              }}
            >
              Đang tải lịch sử thanh toán...
            </div>
          ) : history.length === 0 ? (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: "13px",
              }}
            >
              Chưa có giao dịch thanh toán trực tuyến nào
            </div>
          ) : (
            <ul
              className="acc-list"
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {history.map((tx: any) => {
                const isSuccess = tx.status === "SUCCESS"

                const isPending = tx.status === "PENDING"

                return (
                  <li
                    key={tx.id || tx.transactionCode}
                    style={{
                      padding: "12px 14px",

                      borderRadius: "12px",

                      backgroundColor: "#fff",

                      border: "1px solid #e5e7eb",

                      display: "flex",

                      justifyContent: "space-between",

                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "3px",
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 6px",

                            borderRadius: "4px",

                            fontSize: "10px",

                            fontWeight: 700,

                            backgroundColor:
                              tx.gateway === "VNPAY" ? "#eff6ff" : "#fdf2f8",

                            color:
                              tx.gateway === "VNPAY" ? "#2563eb" : "#d946ef",
                          }}
                        >
                          {tx.gateway}
                        </span>
                        <strong style={{ fontSize: "13px", color: "#111827" }}>
                          {tx.purpose === "TOPUP_WALLET"
                            ? "Nạp ví"
                            : "Thanh toán cuốc xe"}
                        </strong>
                      </div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>
                        #{tx.transactionCode} ·{" "}
                        {new Date(tx.createdAt).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {Number(tx.amount).toLocaleString("vi-VN")} đ
                      </div>
                      <span
                        style={{
                          fontSize: "11px",

                          fontWeight: 600,

                          color: isSuccess
                            ? "#059669"
                            : isPending
                              ? "#d97706"
                              : "#dc2626",
                        }}
                      >
                        {isSuccess
                          ? "✓ Thành công"
                          : isPending
                            ? "Đang chờ"
                            : "Thất bại"}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {/* Nội dung Tab 3: Nhật Ký Cuộc Gọi Giấu Số */}
      {activeTab === "calls" && (
        <>
          {loading ? (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "13px",
              }}
            >
              Đang tải nhật ký cuộc gọi...
            </div>
          ) : calls.length === 0 ? (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: "13px",
              }}
            >
              Chưa có cuộc gọi nào phát sinh qua Hotline 1900-8888
            </div>
          ) : (
            <ul
              className="acc-list"
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {calls.map((c: any) => {
                const durationM = Math.floor((c.durationSeconds || 0) / 60)

                const durationS = (c.durationSeconds || 0) % 60

                const durationStr = `${String(durationM).padStart(2, "0")}:${String(durationS).padStart(2, "0")}`

                return (
                  <li
                    key={c.id}
                    style={{
                      padding: "12px 14px",

                      borderRadius: "12px",

                      backgroundColor: "#fff",

                      border: "1px solid #e5e7eb",

                      display: "flex",

                      justifyContent: "space-between",

                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginBottom: "3px",
                        }}
                      >
                        <span style={{ fontSize: "14px" }}>📞</span>
                        <strong style={{ fontSize: "13px", color: "#111827" }}>
                          {c.isCaller ? "Gọi cho đối tác" : "Đối tác gọi tới"}
                        </strong>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#2563eb",
                            fontWeight: 600,
                          }}
                        >
                          (Hotline 1900-8888)
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>
                        Đơn #{c.bookingCode || c.bookingId?.slice(0, 8)} ·{" "}
                        {new Date(c.createdAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "#059669",
                        }}
                      >
                        {durationStr}
                      </div>
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>
                        {c.callStatus === "ANSWERED" ||
                        c.callStatus === "COMPLETED"
                          ? "Đã đàm thoại"
                          : "Nhỡ / Bận máy"}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {toast && <Toast text={toast} />}

      {/* Modal Nạp Tiền Khách Hàng */}
      <TopUpModal
        isOpen={showTopUp}
        authToken={localStorage.getItem("auth_token") || undefined}
        onClose={() => setShowTopUp(false)}
        onSuccess={() => {
          loadAll()
        }}
        userRole="CUSTOMER"
      />
    </section>
  )
}
