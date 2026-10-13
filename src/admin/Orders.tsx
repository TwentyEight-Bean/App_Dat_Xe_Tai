import { useEffect, useState, type ReactNode } from "react"

import { Icon, Status, Avatar } from "./ui"

import { orders, stamps, stepNames, vnd, type Order } from "./data"

export function Drawer({
  title,

  sub,

  onClose,

  children,

  footer,
}: {
  title: ReactNode

  sub?: ReactNode

  onClose: () => void

  children: ReactNode

  footer?: ReactNode
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose()

    window.addEventListener("keydown", h)

    return () => window.removeEventListener("keydown", h)
  }, [onClose])

  return (
    <aside className="drawer glass" role="dialog" aria-label="Chi tiết">
      <header className="drawer-head">
        <div>
          <div className="drawer-title">{title}</div>
          {sub && <div className="drawer-sub">{sub}</div>}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Đóng"
          onClick={onClose}
        >
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="drawer-body">{children}</div>
      {footer && <footer className="drawer-foot">{footer}</footer>}
    </aside>
  )
}

export function Steps({ o }: { o: Order }) {
  const st = stamps(o)

  const names = o.cancelled ? [stepNames[0], stepNames[1], "Đã hủy"] : stepNames

  return (
    <ol className="steps">
      {names.map((n, i) => {
        const done = i <= o.stage || (o.cancelled && i === 2)

        const cur = !o.cancelled && i === o.stage && o.stage < 4

        return (
          <li
            key={n}
            className={`${done ? "done" : ""} ${cur ? "cur" : ""} ${
              o.cancelled && i === 2 ? "bad" : ""
            }`}
          >
            <span className="step-dot">
              {done && !cur ? <Icon name="check" size={10} /> : null}
            </span>
            <strong>{n}</strong>
            <small>{o.cancelled && i === 2 ? st[1] : st[i]}</small>
          </li>
        )
      })}
    </ol>
  )
}

export function LightboxModal({
  src,
  title,
  onClose,
}: {
  src: string
  title: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(6px)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          maxWidth: "85vw",
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 18px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "#e2e8f0",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: 700,
              color: "#475569",
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#090d16",
          }}
        >
          <img
            src={src}
            alt={title}
            style={{
              maxWidth: "75vw",
              maxHeight: "70vh",
              objectFit: "contain",
              borderRadius: "8px",
            }}
          />
        </div>
        <div
          style={{
            padding: "10px 18px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          <span>Biên bản & Chứng từ điện tử (POD)</span>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            Mở ảnh gốc trong tab mới ↗
          </a>
        </div>
      </div>
    </div>
  )
}

export function ProofOfDeliverySection({
  pickupImage,
  deliveryImage,
  onOpenLightbox,
}: {
  pickupImage?: string | null
  deliveryImage?: string | null
  onOpenLightbox: (src: string, title: string) => void
}) {
  return (
    <section className="dsec">
      <div className="dsec-label">Biên bản & Chứng từ giao nhận (POD)</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginTop: "6px",
        }}
      >
        {/* Điểm nhận hàng */}
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "10px",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}
            >
              📸 Ảnh lấy hàng
            </span>
            {pickupImage ? (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  background: "#dcfce7",
                  color: "#166534",
                  fontWeight: 600,
                }}
              >
                Đã xác nhận
              </span>
            ) : (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  background: "#f1f5f9",
                  color: "#64748b",
                }}
              >
                Chưa có
              </span>
            )}
          </div>
          {pickupImage ? (
            <div
              onClick={() =>
                onOpenLightbox(
                  pickupImage,
                  "Biên bản / Ảnh chụp nhận hàng (Pickup Proof)",
                )
              }
              style={{
                position: "relative",
                height: "90px",
                borderRadius: "6px",
                overflow: "hidden",
                cursor: "pointer",
                border: "1px solid #cbd5e1",
              }}
            >
              <img
                src={pickupImage}
                alt="Ảnh lấy hàng"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(15, 23, 42, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                🔍 Phóng to
              </div>
            </div>
          ) : (
            <div
              style={{
                height: "90px",
                borderRadius: "6px",
                border: "1px dashed #cbd5e1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                fontSize: "11px",
              }}
            >
              Chưa tải ảnh
            </div>
          )}
        </div>

        {/* Điểm giao hàng */}
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "10px",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}
            >
              📦 Ảnh giao & ký nhận
            </span>
            {deliveryImage ? (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  background: "#dcfce7",
                  color: "#166534",
                  fontWeight: 600,
                }}
              >
                Đã giao
              </span>
            ) : (
              <span
                style={{
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  background: "#f1f5f9",
                  color: "#64748b",
                }}
              >
                Chưa có
              </span>
            )}
          </div>
          {deliveryImage ? (
            <div
              onClick={() =>
                onOpenLightbox(
                  deliveryImage,
                  "Biên bản / Ảnh chụp giao hàng (Delivery Proof)",
                )
              }
              style={{
                position: "relative",
                height: "90px",
                borderRadius: "6px",
                overflow: "hidden",
                cursor: "pointer",
                border: "1px solid #cbd5e1",
              }}
            >
              <img
                src={deliveryImage}
                alt="Ảnh giao hàng"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(15, 23, 42, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                🔍 Phóng to
              </div>
            </div>
          ) : (
            <div
              style={{
                height: "90px",
                borderRadius: "6px",
                border: "1px dashed #cbd5e1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
                fontSize: "11px",
              }}
            >
              Chưa tải ảnh
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function OrderDrawer({
  o,

  onClose,

  onFull,
}: {
  o: Order

  onClose: () => void

  onFull: () => void
}) {
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(
    null,
  )
  const promo = o.value > 100000 ? 10000 : 0

  const surge = o.late ? 15000 : 0

  const fare = o.value + promo - surge

  return (
    <>
      <Drawer
        title={
          <>
            <b className="code">#{o.id}</b>
            <Status tone={o.tone}>{o.status}</Status>
          </>
        }
        sub={`Tạo lúc ${o.time} · ${o.vehicle}${
          o.late ? ` · chậm ${o.late} phút` : ""
        }`}
        onClose={onClose}
        footer={
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onFull}
          >
            Xem toàn bộ chi tiết
            <Icon name="arrow" size={14} />
          </button>
        }
      >
        <section className="dsec">
          <div className="dsec-label">Khách hàng</div>
          <div className="person">
            <Avatar
              initials={o.customer

                .split(" ")

                .slice(-2)

                .map((w) => w[0])

                .join("")}
            />
            <span>
              <strong>{o.customer}</strong>
              <small>{o.phone}</small>
            </span>
            <button
              type="button"
              className="icon-btn tint"
              aria-label="Gọi khách"
            >
              <Icon name="phone" size={14} />
            </button>
          </div>
          <div className="dsec-label mt">Tài xế</div>
          {o.driver === "—" ? (
            <div className="person muted-box">
              <Icon name="clock" size={16} />
              Đang tìm tài xế phù hợp…
            </div>
          ) : (
            <div className="person">
              <Avatar
                initials={o.driver.split(" ").pop()!.slice(0, 2).toUpperCase()}
                tone="green"
              />
              <span>
                <strong>{o.driver}</strong>
                <small>
                  {o.vehicle} · {o.driverPhone}
                </small>
              </span>
              <button
                type="button"
                className="icon-btn tint"
                aria-label="Gọi tài xế"
              >
                <Icon name="phone" size={14} />
              </button>
            </div>
          )}
        </section>
        <section className="dsec">
          <div className="dsec-label">Lộ trình</div>
          <div className="addr">
            <span className="dotg" />
            <div>
              <small>Điểm lấy</small>
              <strong>{o.fromAddr}</strong>
            </div>
          </div>
          <div className="addr">
            <span className="dotb">
              <Icon name="pin" size={11} />
            </span>
            <div>
              <small>Điểm giao</small>
              <strong>{o.toAddr}</strong>
            </div>
          </div>
          <div className="trip-stats">
            <div>
              <small>Quãng đường</small>
              <b>{o.km} km</b>
            </div>
            <div>
              <small>Loại xe</small>
              <b>{o.vehicle}</b>
            </div>
            <div>
              <small>{o.eta ? "Còn lại" : "Dự kiến"}</small>
              <b>{o.eta ? `${o.eta} phút` : `${Math.round(o.km * 3.4)} phút`}</b>
            </div>
          </div>
        </section>
        <section className="dsec">
          <div className="dsec-label">Tiến trình</div>
          <Steps o={o} />
        </section>

        {o.cancelled && o.cancellationReason && (
          <section className="dsec">
            <div className="dsec-label">Thông tin hủy chuyến</div>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: "13px",
              }}
            >
              <strong>Lý do:</strong> {o.cancellationReason}
              {o.cancelledBy && (
                <div
                  style={{
                    fontSize: "11px",
                    marginTop: "4px",
                    color: "#b91c1c",
                  }}
                >
                  Hủy bởi: {o.cancelledBy}
                </div>
              )}
            </div>
          </section>
        )}

        <ProofOfDeliverySection
          pickupImage={o.pickupProofImage}
          deliveryImage={o.deliveryProofImage}
          onOpenLightbox={(src, title) => setLightbox({ src, title })}
        />

        <section className="dsec">
          <div className="dsec-label">Thanh toán</div>
          <div className="price">
            <span>Cước vận chuyển</span>
            <b>{vnd(fare)}</b>
          </div>
          {surge > 0 && (
            <div className="price">
              <span>Phụ phí giờ cao điểm</span>
              <b>{vnd(surge)}</b>
            </div>
          )}
          {promo > 0 && (
            <div className="price">
              <span>Khuyến mãi</span>
              <b className="pos">−{vnd(promo)}</b>
            </div>
          )}
          <div className="price total">
            <span>Tổng cộng · Tiền mặt</span>
            <b>{vnd(o.value)}</b>
          </div>
        </section>
      </Drawer>
      {lightbox && (
        <LightboxModal
          src={lightbox.src}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}

const statuses = [
  "Tất cả trạng thái",

  "Chờ tài xế",

  "Đã nhận",

  "Đang giao",

  "Hoàn thành",

  "Đã hủy",
]

const vehicles = [
  "Tất cả loại xe",

  "Xe máy",

  "Xe van",

  "Xe bán tải",

  "Xe tải 500kg",
]

export default function OrdersPage({
  activeId,

  setActiveId,

  openFull,
}: {
  activeId: string | null

  setActiveId: (id: string | null) => void

  openFull: (id: string) => void
}) {
  const [q, setQ] = useState("")

  const [status, setStatus] = useState(statuses[0])

  const [vehicle, setVehicle] = useState(vehicles[0])

  const [date, setDate] = useState("Hôm nay")

  const [checked, setChecked] = useState<string[]>([])

  const [dbOrders, setDbOrders] = useState<Order[]>(orders)
  const [totalDb, setTotalDb] = useState(0)

  useEffect(() => {
    const token = localStorage.getItem("admin_auth_token") || "DEV_ADMIN_TOKEN"
    fetch("/api/v1/admin/bookings?page=1&limit=50", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: Order[] = res.data.map((b: any) => {
            let tone: "green" | "amber" | "blue" | "sky" | "red" = "blue"
            let statusText = "Chờ tài xế"
            let stage = 0
            let cancelled = false

            if (b.status === "PENDING" || b.status === "SEARCHING") {
              tone = "amber"
              statusText = "Chờ tài xế"
              stage = 0
            } else if (b.status === "ACCEPTED") {
              tone = "blue"
              statusText = "Đã nhận"
              stage = 1
            } else if (b.status === "ARRIVED_AT_PICKUP" || b.status === "IN_TRANSIT") {
              tone = "sky"
              statusText = "Đang giao"
              stage = 2
            } else if (b.status === "COMPLETED") {
              tone = "green"
              statusText = "Hoàn thành"
              stage = 4
            } else if (b.status === "CANCELLED") {
              tone = "red"
              statusText = "Đã hủy"
              stage = 2
              cancelled = true
            }

            const d = new Date(b.createdAt || Date.now())
            const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

            const fromShort = b.originAddress?.split(",")[0] || "Điểm nhận"
            const toShort = b.destinationAddress?.split(",")[0] || "Điểm giao"

            return {
              id: b.bookingCode || b.id?.slice(0, 8) || "DH0000",
              customer: b.customerName || "Khách hàng FastDrop",
              phone: b.customerPhone || "0900000000",
              driver: b.driverId ? "Tài xế nhận chuyến" : "—",
              driverPhone: "1900-8888",
              from: fromShort,
              to: toShort,
              fromAddr: b.originAddress || "",
              toAddr: b.destinationAddress || "",
              vehicle: b.vehicleName || "Xe tải",
              status: statusText,
              tone,
              value: Number(b.totalPrice || 0),
              time: timeStr,
              t: d.getTime(),
              p: [10.7769, 106.7009],
              d: [10.7769, 106.7009],
              km: Number(b.distanceKm || 5),
              stage,
              cancelled,
              pickupProofImage: b.pickupProofImage || null,
              deliveryProofImage: b.deliveryProofImage || null,
              cancellationReason: b.cancellationReason || null,
              cancelledBy: b.cancelledBy || null,
            } as Order
          })
          setDbOrders(mapped)
          if (res.pagination) setTotalDb(res.pagination.total)
        }
      })
      .catch((err) => console.warn("Lỗi tải đơn hàng DB trong admin:", err))
  }, [])

  const rows = dbOrders.filter(
    (o) =>
      (status === statuses[0] || o.status === status) &&
      (vehicle === vehicles[0] || o.vehicle === vehicle) &&
      `${o.id} ${o.customer} ${o.driver}`

        .toLowerCase()

        .includes(q.toLowerCase()),
  )

  const active = dbOrders.find((o) => o.id === activeId) || orders.find((o) => o.id === activeId)

  const all = rows.length > 0 && rows.every((r) => checked.includes(r.id))

  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  return (
    <div className={`page split ${active ? "drawer-open" : ""}`}>
      <div className="page-head">
        <div>
          <h1>Đơn hàng</h1>
          <p>Theo dõi và kiểm tra đơn mà không rời khỏi danh sách</p>
        </div>
      </div>
      <div className="toolbar">
        <label className="field search">
          <Icon name="search" size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mã đơn, khách hàng, tài xế…"
          />
        </label>
        <label className="field select">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Trạng thái"
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Icon name="chevron" size={14} />
        </label>
        <label className="field select">
          <Icon name="calendar" size={15} />
          <select
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Thời gian"
          >
            {["Hôm nay", "Hôm qua", "7 ngày qua", "30 ngày qua"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Icon name="chevron" size={14} />
        </label>
        <label className="field select">
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            aria-label="Loại xe"
          >
            {vehicles.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Icon name="chevron" size={14} />
        </label>
        <div className="toolbar-end">
          {checked.length > 0 ? (
            <>
              <b>{checked.length} đã chọn</b>
              <button
                type="button"
                className="link-btn"
                onClick={() => setChecked([])}
              >
                Bỏ chọn
              </button>
            </>
          ) : (
            <span>{rows.length} / {totalDb || rows.length} đơn</span>
          )}
        </div>
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table className="dtable roomy">
            <thead>
              <tr>
                <th className="cb">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    checked={all}
                    onChange={() =>
                      setChecked(all ? [] : rows.map((r) => r.id))
                    }
                  />
                </th>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Tài xế</th>
                <th>Tuyến đường</th>
                <th>Loại xe</th>
                <th>Trạng thái</th>
                <th className="num">Giá trị</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  className={`${activeId === o.id ? "is-sel" : ""} ${
                    checked.includes(o.id) ? "is-chk" : ""
                  }`}
                  onClick={() => setActiveId(o.id)}
                >
                  <td className="cb" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${o.id}`}
                      checked={checked.includes(o.id)}
                      onChange={() => toggle(o.id)}
                    />
                  </td>
                  <td>
                    <b className="code">#{o.id}</b>
                  </td>
                  <td>{o.customer}</td>
                  <td className={o.driver === "—" ? "muted" : ""}>
                    {o.driver}
                  </td>
                  <td>
                    <span className="route-cell">
                      {o.from}
                      <Icon name="arrow" size={11} />
                      {o.to}
                    </span>
                  </td>
                  <td>{o.vehicle}</td>
                  <td>
                    <div className="st-cell">
                      <Status tone={o.tone}>{o.status}</Status>
                      {o.late && <small className="late">+{o.late}′</small>}
                    </div>
                  </td>
                  <td className="num">
                    <b>{vnd(o.value)}</b>
                  </td>
                  <td className="muted">{o.time}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-row">
                    Không có đơn phù hợp bộ lọc
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>Hiển thị 1–{rows.length} trong 248 đơn hàng</span>
          <div className="pager">
            <button type="button" disabled>
              Trước
            </button>
            <button type="button" className="on">
              1
            </button>
            <button type="button">2</button>
            <button type="button">3</button>
            <button type="button">Sau</button>
          </div>
        </div>
      </section>
      {active && (
        <OrderDrawer
          key={active.id}
          o={active}
          onClose={() => setActiveId(null)}
          onFull={() => openFull(active.id)}
        />
      )}
    </div>
  )
}

export function OrderDetail({ id, back }: { id: string back: () => void }) {
  const [dbOrder, setDbOrder] = useState<Order | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(
    null,
  )

  useEffect(() => {
    const mock = orders.find((x) => x.id === id)
    if (mock) {
      setDbOrder(mock)
      return
    }
    const token = localStorage.getItem("admin_auth_token") || "DEV_ADMIN_TOKEN"
    fetch(`/api/v1/admin/bookings?search=${encodeURIComponent(id)}&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const b = res.data[0]
          const d = new Date(b.createdAt || Date.now())
          const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
          setDbOrder({
            id: b.bookingCode || b.id?.slice(0, 8) || "DH0000",
            customer: b.customerName || "Khách hàng FastDrop",
            phone: b.customerPhone || "0900000000",
            driver: b.driverId ? "Tài xế nhận chuyến" : "—",
            driverPhone: "1900-8888",
            from: b.originAddress?.split(",")[0] || "Điểm nhận",
            to: b.destinationAddress?.split(",")[0] || "Điểm giao",
            fromAddr: b.originAddress || "",
            toAddr: b.destinationAddress || "",
            vehicle: b.vehicleName || "Xe tải",
            status:
              b.status === "COMPLETED"
                ? "Hoàn thành"
                : b.status === "CANCELLED"
                  ? "Đã hủy"
                  : "Đang xử lý",
            tone:
              b.status === "COMPLETED"
                ? "green"
                : b.status === "CANCELLED"
                  ? "red"
                  : "blue",
            value: Number(b.totalPrice || 0),
            time: timeStr,
            t: d.getTime(),
            p: [10.7769, 106.7009],
            d: [10.7769, 106.7009],
            km: Number(b.distanceKm || 5),
            stage: b.status === "COMPLETED" ? 4 : 2,
            cancelled: b.status === "CANCELLED",
            pickupProofImage: b.pickupProofImage || null,
            deliveryProofImage: b.deliveryProofImage || null,
            cancellationReason: b.cancellationReason || null,
            cancelledBy: b.cancelledBy || null,
          } as Order)
        }
      })
      .catch(() => {})
  }, [id])

  const o = dbOrder || (orders.find((x) => x.id === id) ?? orders[0])

  const promo = o.value > 100000 ? 10000 : 0

  const surge = o.late ? 15000 : 0

  return (
    <div className="page">
      <button type="button" className="back-link" onClick={back}>
        <Icon name="arrow" size={13} />
        Quay lại danh sách đơn hàng
      </button>
      <div className="page-head">
        <div>
          <h1 className="h-row">
            Đơn hàng <span className="code">#{o.id}</span>
            <Status tone={o.tone}>{o.status}</Status>
            {o.late && <Status tone="red">Chậm {o.late} phút</Status>}
          </h1>
          <p>
            Tạo lúc {o.time}, hôm nay · {o.vehicle} · {o.km} km
          </p>
        </div>
      </div>
      <div className="detail-grid">
        <div className="stack">
          <section className="panel pad">
            <div className="dsec-label">Hành trình</div>
            <div className="mini-map">
              <svg
                viewBox="0 0 100 60"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect width="100" height="60" fill="#ebeee8" />
                <path
                  d="M0 40 C25 30 45 46 100 20 L100 32 C45 58 25 42 0 52Z"
                  fill="#cfe2ea"
                />
                <g
                  fill="none"
                  stroke="#fffdf8"
                  strokeWidth="1.4"
                  vectorEffect="non-scaling-stroke"
                >
                  <path d="M0 18 L100 24" />
                  <path d="M30 0 L38 60" />
                  <path d="M68 0 L62 60" />
                </g>
                <path
                  d="M18 44 Q50 4 84 16"
                  fill="none"
                  stroke="#1478d4"
                  strokeWidth="3"
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <span className="mk-pin from" style={{ left: "18%", top: "73%" }}>
                <i />
              </span>
              <span className="mk-pin to" style={{ left: "84%", top: "27%" }}>
                <Icon name="pin" size={13} />
              </span>
              {o.stage >= 2 && o.stage < 4 && (
                <span
                  className="mk mk-veh is-sel"
                  style={{ left: "50%", top: "32%" }}
                >
                  <Icon name="truck" size={14} />
                </span>
              )}
            </div>
            <div className="addr-2">
              <div className="addr">
                <span className="dotg" />
                <div>
                  <small>Điểm lấy</small>
                  <strong>{o.fromAddr}</strong>
                  <em>
                    {o.customer} · {o.phone}
                  </em>
                </div>
              </div>
              <div className="addr">
                <span className="dotb">
                  <Icon name="pin" size={11} />
                </span>
                <div>
                  <small>Điểm giao</small>
                  <strong>{o.toAddr}</strong>
                  <em>Người nhận tại điểm giao</em>
                </div>
              </div>
            </div>
          </section>
          <section className="panel pad">
            <div className="dsec-label">Tiến trình đơn hàng</div>
            <Steps o={o} />
          </section>

          {o.cancelled && o.cancellationReason && (
            <section
              className="panel pad"
              style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
            >
              <div className="dsec-label" style={{ color: "#991b1b" }}>
                Thông tin hủy chuyến
              </div>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "13px",
                  color: "#991b1b",
                }}
              >
                <strong>Lý do hủy:</strong> {o.cancellationReason}
                {o.cancelledBy && <span> (Bởi: {o.cancelledBy})</span>}
              </p>
            </section>
          )}

          <section className="panel pad">
            <ProofOfDeliverySection
              pickupImage={o.pickupProofImage}
              deliveryImage={o.deliveryProofImage}
              onOpenLightbox={(src, title) => setLightbox({ src, title })}
            />
          </section>
        </div>
        <div className="stack">
          <section className="panel pad">
            <div className="dsec-label">Khách hàng</div>
            <div className="person">
              <Avatar
                initials={o.customer

                  .split(" ")

                  .slice(-2)

                  .map((w) => w[0])

                  .join("")}
              />
              <span>
                <strong>{o.customer}</strong>
                <small>{o.phone}</small>
              </span>
            </div>
            <div className="dsec-label mt">Tài xế</div>
            {o.driver === "—" ? (
              <div className="person muted-box">
                <Icon name="clock" size={16} />
                Chưa có tài xế nhận đơn
              </div>
            ) : (
              <div className="person">
                <Avatar
                  initials={o.driver

                    .split(" ")

                    .pop()!

                    .slice(0, 2)

                    .toUpperCase()}
                  tone="green"
                />
                <span>
                  <strong>{o.driver}</strong>
                  <small>
                    {o.vehicle} · {o.driverPhone}
                  </small>
                </span>
              </div>
            )}
          </section>
          <section className="panel pad">
            <div className="dsec-label">Thanh toán</div>
            <div className="price">
              <span>Cước vận chuyển</span>
              <b>{vnd(o.value + promo - surge)}</b>
            </div>
            {surge > 0 && (
              <div className="price">
                <span>Phụ phí giờ cao điểm</span>
                <b>{vnd(surge)}</b>
              </div>
            )}
            {promo > 0 && (
              <div className="price">
                <span>Khuyến mãi</span>
                <b className="pos">−{vnd(promo)}</b>
              </div>
            )}
            <div className="price total">
              <span>Tổng cộng · Tiền mặt</span>
              <b>{vnd(o.value)}</b>
            </div>
          </section>
          <section className="panel pad">
            <div className="dsec-label">Ghi chú hàng hóa</div>
            <p className="note-text">
              4 thùng hàng gia dụng, khoảng 120kg. Vui lòng giữ thùng đứng khi
              vận chuyển.
            </p>
          </section>
          <section className="panel pad">
            <div className="dsec-label">Nhật ký liên lạc Hotline 1900-8888</div>
            <CallLogsSection bookingId={o.id} />
          </section>
        </div>
      </div>
      {lightbox && (
        <LightboxModal
          src={lightbox.src}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

function CallLogsSection({ bookingId }: { bookingId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/calls/trip/${bookingId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("admin_auth_token") || "DEV_ADMIN_TOKEN"}`,
      },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setLogs(res.data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [bookingId])

  if (loading) {
    return (
      <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
        Đang tải nhật ký cuộc gọi...
      </p>
    )
  }

  if (logs.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
        Chưa có cuộc gọi nào phát sinh qua Hotline 1900-8888 trong chuyến xe này.
      </p>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: "#111827" }}>
              📞 {log.callerName || log.callerRole} ➔ {log.calleeName || log.calleeRole}
            </div>
            <small style={{ color: "#6b7280" }}>
              {new Date(log.createdAt).toLocaleString("vi-VN")} · Hotline {log.hotline || "1900-8888"}
            </small>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontWeight: 600,
                color: log.status === "ANSWERED" ? "#059669" : "#dc2626",
              }}
            >
              {log.status === "ANSWERED"
                ? `${log.durationSeconds || 0} giây`
                : log.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
