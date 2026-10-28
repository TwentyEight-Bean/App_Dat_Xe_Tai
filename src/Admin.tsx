import { useEffect, useState } from "react"

import "./admin.css"

import { Icon, Avatar, type IconName } from "./admin/ui"

import { orders, pending, complaints0, type Complaint } from "./admin/data"

import Dashboard from "./admin/Dashboard"

import OrdersPage, { OrderDetail } from "./admin/Orders"

import Drivers, { type Decision } from "./admin/Drivers"

import Users from "./admin/Users"

import RatingsAndComplaints from "./admin/RatingsAndComplaints"

import Pricing from "./admin/Pricing"

import MobileAdmin from "./admin/Mobile"
import AdminLoginGate from "./AdminLoginGate"
import Accounting from "./admin/Accounting"
import Wallets from "./admin/Wallets"
import SystemCron from "./admin/SystemCron"
import B2B from "./admin/B2B"

type Section =
  | "dashboard"
  | "accounting"
  | "pricing"
  | "orders"
  | "drivers"
  | "wallets"
  | "b2b"
  | "users"
  | "ratings"
  | "complaints"
  | "cron"
  | "settings"

type View = Section | "order-detail"

const nav: { id: Section; label: string; icon: IconName }[] = [
  { id: "dashboard", label: "Tổng quan", icon: "grid" },
  { id: "accounting", label: "Kế toán", icon: "file" },
  { id: "pricing", label: "Bảng giá", icon: "wallet" },
  { id: "orders", label: "Đơn hàng", icon: "orders" },
  { id: "drivers", label: "Tài xế", icon: "drivers" },
  { id: "wallets", label: "Ví tài xế", icon: "wallet" },
  { id: "b2b", label: "Khách B2B", icon: "shield" },
  { id: "users", label: "Người dùng", icon: "users" },
  { id: "ratings", label: "Đánh giá", icon: "star" },
  { id: "cron", label: "Hệ thống", icon: "clock" },
]

const crumb: Record<Section, string> = {
  dashboard: "Tổng quan",
  accounting: "Kế toán & Doanh thu",
  pricing: "Bảng giá",
  orders: "Đơn hàng",
  drivers: "Tài xế",
  wallets: "Quản lý ví tài xế",
  b2b: "Khách hàng Doanh nghiệp B2B",
  users: "Người dùng",
  ratings: "Đánh giá & Khiếu nại",
  complaints: "Đánh giá & Khiếu nại",
  cron: "Tác vụ nền & CSDL",
  settings: "Cài đặt",
}

type Cmd = { label: string; hint: string; icon: IconName; fn: () => void }

function PaletteInner({
  onClose,

  q,

  setQ,

  idx,

  setIdx,

  cmds,
}: {
  onClose: () => void

  q: string

  setQ: (s: string) => void

  idx: number

  setIdx: (n: number) => void

  cmds: Cmd[]
}) {
  const list = cmds

    .filter((c) =>
      `${c.label} ${c.hint}`.toLowerCase().includes(q.toLowerCase()),
    )

    .slice(0, 8)

  const go = (c?: Cmd) => {
    if (c) {
      onClose()

      c.fn()
    }
  }

  return (
    <div className="scrim top" role="presentation" onMouseDown={onClose}>
      <div
        className="palette glass"
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm nhanh"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <label className="palette-in">
          <Icon name="search" size={17} />
          <input
            autoFocus
            value={q}
            placeholder="Tìm đơn hàng, tài xế, trang…"
            onChange={(e) => {
              setQ(e.target.value)

              setIdx(0)
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose()

              if (e.key === "ArrowDown") {
                e.preventDefault()

                setIdx(Math.min(idx + 1, list.length - 1))
              }

              if (e.key === "ArrowUp") {
                e.preventDefault()

                setIdx(Math.max(idx - 1, 0))
              }

              if (e.key === "Enter") go(list[idx])
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <ul>
          {list.map((c, i) => (
            <li key={c.label + c.hint}>
              <button
                type="button"
                className={i === idx ? "on" : ""}
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(c)}
              >
                <Icon name={c.icon} size={16} />
                <span>{c.label}</span>
                <small>{c.hint}</small>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="empty-row">Không có kết quả</li>}
        </ul>
      </div>
    </div>
  )
}

function useIsMobile() {
  const q = "(max-width: 760px)"

  const [m, setM] = useState(() => window.matchMedia(q).matches)

  useEffect(() => {
    const mq = window.matchMedia(q)

    const h = () => setM(mq.matches)

    mq.addEventListener("change", h)

    return () => mq.removeEventListener("change", h)
  }, [])

  return m
}

export default function Admin() {
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    const t = localStorage.getItem("admin_auth_token")
    if (!t) return null
    try {
      const parts = t.split(".")
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem("admin_auth_token")
          localStorage.removeItem("admin_user_info")
          return null
        }
      }
    } catch {
      localStorage.removeItem("admin_auth_token")
      localStorage.removeItem("admin_user_info")
      return null
    }
    return t
  })

  const [adminUser, setAdminUser] = useState<any>(() => {
    try {
      const raw = localStorage.getItem("admin_user_info")
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const handleExpired = () => {
      localStorage.removeItem("admin_auth_token")
      localStorage.removeItem("admin_user_info")
      setAdminToken(null)
      setAdminUser(null)
    }
    window.addEventListener("admin_session_expired", handleExpired)
    return () => window.removeEventListener("admin_session_expired", handleExpired)
  }, [])

  const handleLogout = () => {
    if (
      window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi Cổng Quản trị viên?")
    ) {
      localStorage.removeItem("admin_auth_token")
      localStorage.removeItem("admin_user_info")
      setAdminToken(null)
      setAdminUser(null)
    }
  }

  const mobile = useIsMobile()

  const [view, setView] = useState<View>("dashboard")

  const [sel, setSel] = useState<string | null>("DH1024")

  const [orderDrawer, setOrderDrawer] = useState<string | null>(null)

  const [detailId, setDetailId] = useState("DH1024")

  const [decided, setDecided] = useState<Record<string, Decision>>({})

  const [driverTab, setDriverTab] = useState<"review" | "all">("review")

  const [driverFocus, setDriverFocus] = useState<string | undefined>()

  const [cs, setCs] = useState<Complaint[]>(complaints0)

  const [csFocus, setCsFocus] = useState<string | undefined>()

  const [ratingsTab, setRatingsTab] = useState<"ratings" | "complaints">("ratings")

  const [palette, setPalette] = useState(false)

  const [q, setQ] = useState("")

  const [pIdx, setPIdx] = useState(0)

  const [tick, setTick] = useState(0)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()

        setPalette(true)
      }
    }

    window.addEventListener("keydown", h)

    return () => window.removeEventListener("keydown", h)
  }, [])

  if (!adminToken) {
    return (
      <main className="app-shell">
        <section
          className="phone-frame"
          style={{
            background: "#030712",
            color: "#f8fafc",
            overflow: "hidden",
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.45)",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <AdminLoginGate
            onSuccess={(token, user) => {
              setAdminToken(token)
              setAdminUser(user)
            }}
            onBackToCustomer={() => {
              window.location.hash = ""
            }}
          />
        </section>
      </main>
    )
  }

  const section: Section = view === "order-detail" ? "orders" : view

  const pendingLeft = pending.filter((p) => !decided[p.id]).length

  const newCs = cs.filter((c) => c.status === "Mới").length

  const badge: Partial<Record<Section, number>> = {
    drivers: pendingLeft,

    ratings: newCs,

    complaints: newCs,
  }

  const idx = nav.findIndex((n) => n.id === section)

  const go = (s: Section) => {
    if (s === "ratings") {
      setRatingsTab("ratings")
    }

    setView(s)

    setDriverFocus(undefined)

    setCsFocus(undefined)
  }

  const openFull = (id: string) => {
    setDetailId(id)

    setView("order-detail")
  }

  const goDrivers = (id?: string, tab: "review" | "all" = "review") => {
    setDriverFocus(id)

    setDriverTab(tab)

    setTick((t) => t + 1)

    setView("drivers")
  }

  const goComplaints = (id?: string) => {
    setCsFocus(id)

    setRatingsTab("complaints")

    setTick((t) => t + 1)

    setView("ratings")
  }

  const cmds: Cmd[] = [
    ...nav.map(
      (n): Cmd => ({
        label: n.label,

        hint: "Trang",

        icon: n.icon,

        fn: () => go(n.id),
      }),
    ),

    ...orders.map(
      (o): Cmd => ({
        label: `#${o.id} · ${o.customer}`,

        hint: o.status,

        icon: "orders",

        fn: () => openFull(o.id),
      }),
    ),

    ...pending.map(
      (p): Cmd => ({
        label: p.name,

        hint: "Hồ sơ chờ duyệt",

        icon: "drivers",

        fn: () => goDrivers(p.id),
      }),
    ),
  ]

  if (mobile)
    return (
      <div className="admin-app is-mobile">
        <MobileAdmin
          decided={decided}
          setDecided={setDecided}
          cs={cs}
          setCs={setCs}
          onLogout={handleLogout}
          adminUser={adminUser}
        />
      </div>
    )

  return (
    <div className="admin-app">
      <aside className="a-side">
        <div className="a-brand">
          <span className="brand-mark">
            <Icon name="route" size={18} />
          </span>
          <span className="brand-txt">
            <strong>Vận Chuyển</strong>
            <small>Điều hành</small>
          </span>
        </div>
        <nav className="a-nav" aria-label="Điều hướng quản trị">
          {idx >= 0 && (
            <span
              className="nav-ind"
              style={{ transform: `translateY(${idx * 42}px)` }}
            />
          )}
          {nav.map((n) => (
            <button
              type="button"
              key={n.id}
              className={section === n.id ? "active" : ""}
              onClick={() => go(n.id)}
              aria-current={section === n.id ? "page" : undefined}
            >
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
              {!!badge[n.id] && <b>{badge[n.id]}</b>}
            </button>
          ))}
        </nav>
        <div className="a-side-bottom">
          <button
            type="button"
            className={`side-settings ${
              section === "settings" ? "active" : ""
            }`}
            onClick={() => go("settings")}
          >
            <Icon name="settings" size={18} />
            <span>Cài đặt</span>
          </button>
          <div
            className="a-me"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <Avatar
              initials={
                adminUser?.fullName
                  ? adminUser.fullName.substring(0, 2).toUpperCase()
                  : "AD"
              }
              size={30}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "block",
                }}
              >
                {adminUser?.fullName || "Minh Anh"}
              </strong>
              <small
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "block",
                }}
              >
                {adminUser?.email || "Quản trị viên"}
              </small>
            </span>
            <button
              type="button"
              title="Đăng xuất quản trị"
              onClick={handleLogout}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#ef4444"
                e.currentTarget.style.backgroundColor =
                  "rgba(239, 68, 68, 0.12)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#94a3b8"
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              <svg
                style={{ width: 16, height: 16 }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="a-work">
        <header className="a-top">
          <div className="crumb">
            <span>TP. Hồ Chí Minh</span>
            <Icon name="arrow" size={12} />
            <b>
              {view === "order-detail" ? `Đơn #${detailId}` : crumb[section]}
            </b>
          </div>
          <button
            type="button"
            className="cmd glass-sm"
            onClick={() => setPalette(true)}
          >
            <Icon name="search" size={15} />
            <span>Tìm đơn, tài xế, khách hàng…</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="top-end">
            <span className="live">
              <i />
              Trực tiếp
            </span>
            <button
              type="button"
              className="icon-btn bell"
              aria-label="Thông báo"
              onClick={() => go("dashboard")}
            >
              <Icon name="bell" size={17} />
              {pendingLeft + newCs > 0 && <span />}
            </button>
          </div>
        </header>
        <main className="a-main">
          {view === "dashboard" && (
            <Dashboard
              sel={sel}
              setSel={setSel}
              openOrder={openFull}
              goDrivers={goDrivers}
              goComplaints={goComplaints}
              pendingLeft={pendingLeft}
              newComplaints={newCs}
            />
          )}
          {view === "pricing" && <Pricing />}
          {view === "accounting" && <Accounting />}
          {view === "orders" && (
            <OrdersPage
              activeId={orderDrawer}
              setActiveId={setOrderDrawer}
              openFull={openFull}
            />
          )}
          {view === "order-detail" && (
            <OrderDetail id={detailId} back={() => setView("orders")} />
          )}
          {view === "drivers" && (
            <Drivers
              key={tick}
              decided={decided}
              setDecided={setDecided}
              focus={driverFocus}
              tab={driverTab}
              setTab={setDriverTab}
            />
          )}
          {view === "wallets" && <Wallets />}
          {view === "b2b" && <B2B />}
          {view === "users" && <Users openOrder={openFull} />}
          {(view === "ratings" || view === "complaints") && (
            <RatingsAndComplaints
              key={tick}
              complaints={cs}
              setComplaints={setCs}
              complaintsFocus={csFocus}
              openOrder={openFull}
              initialTab={ratingsTab}
            />
          )}
          {view === "cron" && <SystemCron />}
          {view === "settings" && (
            <div className="page">
              <div className="page-head">
                <div>
                  <h1>Cài đặt</h1>
                  <p>Thiết lập vận hành và quyền truy cập hệ thống</p>
                </div>
              </div>
              <section className="panel pad settings-stub">
                <Icon name="settings" size={22} />
                <div>
                  <strong>6 nhóm thiết lập</strong>
                  <small>
                    Khu vực hoạt động, bảng giá, thông báo, phân quyền, tích hợp
                    và bảo mật.
                  </small>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
      {palette && (
        <PaletteInner
          onClose={() => {
            setPalette(false)

            setQ("")

            setPIdx(0)
          }}
          q={q}
          setQ={setQ}
          idx={pIdx}
          setIdx={setPIdx}
          cmds={cmds}
        />
      )}
    </div>
  )
}
