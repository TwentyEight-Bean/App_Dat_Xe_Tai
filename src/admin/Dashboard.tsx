import { useState } from "react";
import { Icon, Status } from "./ui";
import { orders, idleDrivers, vnd, type Order, type Pt } from "./data";

const ctrl = (p: Pt, d: Pt): Pt => [(p[0] + d[0]) / 2 + (d[1] - p[1]) * 0.18, (p[1] + d[1]) / 2 - (d[0] - p[0]) * 0.18];
const bez = (p: Pt, d: Pt, t: number): Pt => {
  const c = ctrl(p, d);
  const u = 1 - t;
  return [u * u * p[0] + 2 * u * t * c[0] + t * t * d[0], u * u * p[1] + 2 * u * t * c[1] + t * t * d[1]];
};
const routeD = (p: Pt, d: Pt) => {
  const c = ctrl(p, d);
  return `M${p[0]} ${p[1]} Q${c[0]} ${c[1]} ${d[0]} ${d[1]}`;
};

const districts: { n: string; x: number; y: number }[] = [
  { n: "Gò Vấp", x: 30, y: 7 }, { n: "Thủ Đức", x: 78, y: 10 }, { n: "Bình Thạnh", x: 54, y: 22 }, { n: "Tân Bình", x: 17, y: 36 },
  { n: "Quận 1", x: 46, y: 47 }, { n: "Quận 5", x: 30, y: 72 }, { n: "Quận 7", x: 64, y: 90 }, { n: "Bình Chánh", x: 8, y: 86 },
];

export function OpsMap({ sel, setSel, hover, onOpen, mobile }: { sel: string | null; setSel: (id: string | null) => void; hover: string | null; onOpen: (id: string) => void; mobile?: boolean }) {
  const [layer, setLayer] = useState<"all" | "problem">("all");
  const active = orders.filter((o) => o.tone === "blue" || o.tone === "sky");
  const waiting = orders.filter((o) => o.tone === "amber");
  const late = orders.filter((o) => o.late);
  const focus = orders.find((o) => o.id === (hover ?? sel));
  const selected = orders.find((o) => o.id === sel);
  const dim = (o: Order) => layer === "problem" && !o.late;

  return (
    <div className="ops-map" onClick={() => setSel(null)}>
      <svg className="map-base" viewBox="0 0 900 460" preserveAspectRatio="none" aria-hidden="true">
        <rect width="900" height="460" fill="#ebeee8" />
        <path d="M-10 300 C140 270 190 330 330 300 S520 200 600 220 S760 130 920 90 L920 150 C780 190 700 280 600 290 S380 390 330 370 C200 400 140 350 -10 360Z" fill="#cfe2ea" />
        <g fill="#dde8d6"><rect x="60" y="40" width="90" height="56" rx="10" /><rect x="640" y="330" width="120" height="70" rx="12" /><rect x="380" y="60" width="70" height="44" rx="10" /></g>
        <g fill="none" stroke="#fffdf8" strokeLinecap="round" vectorEffect="non-scaling-stroke">
          <path d="M0 120 L900 150" strokeWidth="7" /><path d="M0 230 C200 210 420 250 900 220" strokeWidth="9" /><path d="M120 0 L170 460" strokeWidth="7" />
          <path d="M470 0 C450 150 500 300 470 460" strokeWidth="9" /><path d="M700 0 C720 150 680 300 720 460" strokeWidth="6" />
          <path d="M0 380 L900 410" strokeWidth="6" /><path d="M300 0 L330 460" strokeWidth="4" /><path d="M0 60 L900 40" strokeWidth="4" /><path d="M0 310 L300 330" strokeWidth="4" /><path d="M560 0 L620 460" strokeWidth="4" /><path d="M840 0 L800 460" strokeWidth="4" />
        </g>
        <g fill="none" stroke="#f5f2ea" vectorEffect="non-scaling-stroke" strokeWidth="2"><path d="M0 170 L900 190" /><path d="M0 280 L900 300" /><path d="M220 0 L250 460" /><path d="M390 0 L420 460" /><path d="M620 0 L600 460" /><path d="M780 0 L760 460" /></g>
      </svg>

      {districts.map((d) => <span className="map-label" key={d.n} style={{ left: `${d.x}%`, top: `${d.y}%` }}>{d.n}</span>)}

      <svg className="map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {focus && <><path d={routeD(focus.p, focus.d)} className="route-halo" /><path d={routeD(focus.p, focus.d)} className="route-line" /></>}
      </svg>

      {idleDrivers.map((p, i) => <span key={i} className={`mk-idle ${layer === "problem" ? "dim" : ""}`} style={{ left: `${p[0]}%`, top: `${p[1]}%` }} title="Tài xế đang rảnh" />)}

      {focus && <>
        <span className="mk-pin from" style={{ left: `${focus.p[0]}%`, top: `${focus.p[1]}%` }}><i /></span>
        <span className="mk-pin to" style={{ left: `${focus.d[0]}%`, top: `${focus.d[1]}%` }}><Icon name="pin" size={13} /></span>
      </>}

      {waiting.map((o) => (
        <button key={o.id} type="button" className={`mk mk-wait ${sel === o.id ? "is-sel" : ""} ${dim(o) ? "dim" : ""}`} style={{ left: `${o.p[0]}%`, top: `${o.p[1]}%` }} onClick={(e) => { e.stopPropagation(); setSel(o.id); }} aria-label={`Đơn ${o.id} chờ tài xế`}>
          <Icon name="orders" size={13} /><span className="mk-tip"><b>#{o.id}</b> · Chờ tài xế · {o.from}</span>
        </button>
      ))}

      {active.map((o) => {
        const [x, y] = bez(o.p, o.d, o.t);
        return (
          <button key={o.id} type="button" className={`mk mk-veh ${o.late ? "is-late" : ""} ${sel === o.id || hover === o.id ? "is-sel" : ""} ${dim(o) ? "dim" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} onClick={(e) => { e.stopPropagation(); setSel(o.id); }} aria-label={`Đơn ${o.id}`}>
            <Icon name="truck" size={14} />
            <span className="mk-tip"><b>#{o.id}</b> · {o.driver} · {o.status}{o.late ? ` · chậm ${o.late} phút` : ""}</span>
          </button>
        );
      })}

      {!mobile && <>
      <div className="map-hud glass-sm" onClick={(e) => e.stopPropagation()}>
        <span className="hud-live"><i />Trực tiếp</span>
        <span><b>86</b> đang giao</span>
        <span><b>164</b> tài xế online</span>
        <span className="hud-warn"><b>{late.length}</b> có vấn đề</span>
      </div>

      <div className="map-layers glass-sm" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={layer === "all" ? "on" : ""} onClick={() => setLayer("all")}>Tất cả</button>
        <button type="button" className={layer === "problem" ? "on" : ""} onClick={() => setLayer("problem")}>Có vấn đề</button>
      </div>

      <div className="map-legend glass-sm" onClick={(e) => e.stopPropagation()}>
        <span><i className="lg-veh" />Đang giao</span><span><i className="lg-late" />Chậm</span><span><i className="lg-wait" />Chờ tài xế</span><span><i className="lg-idle" />Tài xế rảnh</span>
      </div>

      </>}

      {!mobile && selected && (
        <div className="order-peek glass" onClick={(e) => e.stopPropagation()}>
          <div className="peek-top">
            <b className="peek-id">#{selected.id}</b>
            <Status tone={selected.tone}>{selected.status}</Status>
            {selected.late && <span className="peek-late">Chậm {selected.late} phút</span>}
            <button type="button" className="peek-x" aria-label="Đóng" onClick={() => setSel(null)}><Icon name="close" size={14} /></button>
          </div>
          <dl className="peek-grid">
            <div><dt>Tài xế</dt><dd>{selected.driver}</dd></div>
            <div><dt>Loại xe</dt><dd>{selected.vehicle}</dd></div>
            <div><dt>{selected.eta ? "Còn lại" : "Trạng thái"}</dt><dd>{selected.eta ? `${selected.eta} phút` : selected.status}</dd></div>
            <div><dt>Giá trị</dt><dd>{vnd(selected.value)}</dd></div>
          </dl>
          <div className="peek-route"><span>{selected.from}</span><Icon name="arrow" size={12} /><span>{selected.to}</span></div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => onOpen(selected.id)}>Xem chi tiết</button>
        </div>
      )}
    </div>
  );
}

function Spark({ data, tone = "blue" }: { data: number[]; tone?: string }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 64},${20 - ((v - min) / (max - min || 1)) * 18}`).join(" ");
  return <svg className={`spark spark-${tone}`} width="64" height="22" viewBox="0 0 64 22" aria-hidden="true"><polyline points={pts} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Summary({ late }: { late: number }) {
  const cells = [
    { label: "Đơn hôm nay", value: "248", unit: "", trend: "+12,8%", up: true, note: "so với hôm qua", spark: [18, 22, 20, 28, 31, 30, 38, 44] },
    { label: "Đang giao", value: "86", unit: "", trend: `${late} chậm`, up: false, warn: true, note: "34,7% tổng đơn", spark: [40, 52, 48, 60, 72, 68, 80, 86] },
    { label: "Tài xế online", value: "164", unit: "", trend: "+8", up: true, note: "62 đang rảnh", spark: [120, 128, 140, 136, 150, 155, 158, 164], tone: "green" },
    { label: "Doanh thu hôm nay", value: "48,6", unit: "triệu đ", trend: "+9,2%", up: true, note: "so với hôm qua", spark: [12, 18, 22, 27, 33, 38, 44, 48], tone: "amber" },
  ];
  return (
    <section className="summary" aria-label="Tóm tắt hôm nay">
      {cells.map((c) => (
        <div className="sum-cell" key={c.label}>
          <div className="sum-label">{c.label}</div>
          <div className="sum-row">
            <span className="sum-val">{c.value}{c.unit && <small>{c.unit}</small>}</span>
            <Spark data={c.spark} tone={c.tone} />
          </div>
          <div className="sum-foot"><span className={`trend ${c.warn ? "warn" : c.up ? "up" : "down"}`}>{!c.warn && <Icon name={c.up ? "up" : "down"} size={12} />}{c.trend}</span><span>{c.note}</span></div>
        </div>
      ))}
    </section>
  );
}

type Attn = { kind: "driver" | "order" | "complaint" | "verify"; sev: "red" | "amber"; title: string; sub: string; time?: string; action: string; go: () => void; hoverId?: string };

function Attention({ items, counts, filter, setFilter, setHover }: { items: Attn[]; counts: Record<string, number>; filter: string; setFilter: (k: string) => void; setHover: (id: string | null) => void }) {
  const tiles = [
    { k: "driver", n: counts.driver, l: "hồ sơ chờ duyệt" },
    { k: "order", n: counts.order, l: "đơn giao chậm" },
    { k: "complaint", n: counts.complaint, l: "khiếu nại mới" },
    { k: "verify", n: counts.verify, l: "cần xác minh" },
  ];
  const shown = items.filter((i) => filter === "all" || i.kind === filter);
  return (
    <aside className="attention" aria-label="Cần xử lý">
      <div className="attn-head">
        <div><h2>Cần xử lý</h2><p>Sắp theo mức độ ưu tiên</p></div>
        {filter !== "all" && <button type="button" className="link-btn" onClick={() => setFilter("all")}>Xem tất cả</button>}
      </div>
      <div className="attn-tiles">
        {tiles.map((t) => (
          <button type="button" key={t.k} className={`${filter === t.k ? "on" : ""} ${t.n === 0 ? "zero" : ""}`} onClick={() => setFilter(filter === t.k ? "all" : t.k)}>
            <b>{t.n}</b><span>{t.l}</span>
          </button>
        ))}
      </div>
      <ul className="attn-list">
        {shown.map((i, idx) => (
          <li key={idx} className={`attn-item sev-${i.sev}`} onMouseEnter={() => i.hoverId && setHover(i.hoverId)} onMouseLeave={() => setHover(null)}>
            <i className="attn-rail" />
            <div className="attn-body">
              <div className="attn-top"><strong>{i.title}</strong>{i.time && <time>{i.time}</time>}</div>
              <div className="attn-sub"><span>{i.sub}</span><button type="button" className="btn btn-sm" onClick={i.go}>{i.action}</button></div>
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="attn-empty"><Icon name="check" size={18} />Không còn việc cần xử lý</li>}
      </ul>
    </aside>
  );
}

export default function Dashboard({ sel, setSel, openOrder, goDrivers, goComplaints, pendingLeft, newComplaints }: {
  sel: string | null; setSel: (id: string | null) => void; openOrder: (id: string) => void;
  goDrivers: (id?: string, tab?: "review" | "all") => void; goComplaints: (id?: string) => void; pendingLeft: number; newComplaints: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("Tất cả");
  const lateOrders = orders.filter((o) => o.late).sort((a, b) => (b.late ?? 0) - (a.late ?? 0));

  const items: Attn[] = [
    ...lateOrders.slice(0, 2).map((o): Attn => ({ kind: "order", sev: "red", title: "Đơn giao chậm", sub: `#${o.id} · chậm ${o.late} phút`, action: "Xem đơn", go: () => openOrder(o.id), hoverId: o.id })),
    ...(newComplaints > 0 ? [{ kind: "complaint", sev: "red", title: "Khiếu nại mới", sub: "#DH0987 · Hàng bị trầy xước", time: "4 phút trước", action: "Xử lý", go: () => goComplaints("KN-0231") } as Attn] : []),
    ...(pendingLeft > 0 ? [{ kind: "driver", sev: "amber", title: "Hồ sơ tài xế mới", sub: "Nguyễn Văn Minh", time: "2 phút trước", action: "Xem hồ sơ", go: () => goDrivers("HS-1291", "review") } as Attn] : []),
    ...lateOrders.slice(2).map((o): Attn => ({ kind: "order", sev: "amber", title: "Đơn giao chậm", sub: `#${o.id} · chậm ${o.late} phút`, action: "Xem đơn", go: () => openOrder(o.id), hoverId: o.id })),
    ...(newComplaints > 1 ? [{ kind: "complaint", sev: "amber", title: "Khiếu nại mới", sub: "#DH0975 · Phụ phí ngoài dự kiến", time: "22 phút trước", action: "Xử lý", go: () => goComplaints("KN-0229") } as Attn] : []),
    { kind: "verify", sev: "amber", title: "Tài xế cần xác minh", sub: "Lê Thành Đạt · GPLX sắp hết hạn", time: "1 giờ trước", action: "Xác minh", go: () => goDrivers(undefined, "all") },
    ...(pendingLeft > 1 ? [{ kind: "driver", sev: "amber", title: `${pendingLeft - 1} hồ sơ khác đang chờ`, sub: "Chờ duyệt từ 38 phút trước", action: "Mở hàng đợi", go: () => goDrivers("HS-1290", "review") } as Attn] : []),
  ];

  const rows = orders.filter((o) => tableFilter === "Tất cả" || (tableFilter === "Có vấn đề" ? !!o.late : o.status === tableFilter));

  return (
    <div className="dash">
      <Summary late={lateOrders.length} />
      <div className="cc">
        <div className="cc-main">
          <section className="panel map-panel">
            <header className="panel-head"><div><h2>Hoạt động giao hàng</h2><p>Chọn một đơn trên bản đồ để xem nhanh</p></div></header>
            <OpsMap sel={sel} setSel={setSel} hover={hover} onOpen={openOrder} />
          </section>
          <section className="panel">
            <header className="panel-head">
              <div><h2>Đơn hàng gần đây</h2><p>Cập nhật theo thời gian thực</p></div>
              <div className="seg" role="tablist">
                {["Tất cả", "Đang giao", "Có vấn đề", "Chờ tài xế"].map((f) => <button key={f} type="button" className={tableFilter === f ? "on" : ""} onClick={() => setTableFilter(f)}>{f}</button>)}
              </div>
            </header>
            <div className="table-wrap">
              <table className="dtable">
                <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Tài xế</th><th>Tuyến đường</th><th>Loại xe</th><th>Trạng thái</th><th className="num">Giá trị</th><th>Thời gian</th></tr></thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className={sel === o.id ? "is-sel" : ""} onClick={() => setSel(o.id)} onDoubleClick={() => openOrder(o.id)}>
                      <td><b className="code">#{o.id}</b></td>
                      <td>{o.customer}</td>
                      <td className={o.driver === "—" ? "muted" : ""}>{o.driver}</td>
                      <td><span className="route-cell">{o.from}<Icon name="arrow" size={11} />{o.to}</span></td>
                      <td>{o.vehicle}</td>
                      <td><div className="st-cell"><Status tone={o.tone}>{o.status}</Status>{o.late && <small className="late">+{o.late}′</small>}</div></td>
                      <td className="num"><b>{vnd(o.value)}</b></td>
                      <td className="muted">{o.time}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={8} className="empty-row">Không có đơn phù hợp</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <Attention items={items} counts={{ driver: pendingLeft, order: lateOrders.length, complaint: newComplaints, verify: 1 }} filter={filter} setFilter={setFilter} setHover={setHover} />
      </div>
    </div>
  );
}

