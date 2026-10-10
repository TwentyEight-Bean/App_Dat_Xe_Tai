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

export function OrderDrawer({
  o,
  onClose,
  onFull,
}: {
  o: Order
  onClose: () => void
  onFull: () => void
}) {
  const promo = o.value > 100000 ? 10000 : 0
  const surge = o.late ? 15000 : 0
  const fare = o.value + promo - surge
  return (
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
  const rows = orders.filter(
    (o) =>
      (status === statuses[0] || o.status === status) &&
      (vehicle === vehicles[0] || o.vehicle === vehicle) &&
      `${o.id} ${o.customer} ${o.driver}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  )
  const active = orders.find((o) => o.id === activeId)
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
            <span>{rows.length} / 248 đơn</span>
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
  const o = orders.find((x) => x.id === id) ?? orders[0]
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
        </div>
      </div>
    </div>
  )
}
