import { useEffect, useRef, useState, type ReactNode } from "react";
import "./mobile.css";
import { Icon, Status, Avatar, type IconName } from "./ui";
import { Steps } from "./Orders";
import { OpsMap } from "./Dashboard";
import { DocPreview, type Decision } from "./Drivers";
import { orders, pending, users, activeDrivers, complaints0, vnd, type Order, type Complaint, type DocState, type UserRow, type Pending } from "./data";

type Tab = "home" | "orders" | "act" | "more";
type Screen =
  | { k: "order"; id: string }
  | { k: "driver"; id: string }
  | { k: "drivers" }
  | { k: "user"; id: string }
  | { k: "users" }
  | { k: "complaint"; id: string }
  | { k: "complaints"; tab?: string }
  | { k: "settings" };

type Nav = { push: (s: Screen) => void; pop: () => void; tab: (t: Tab) => void };
type Shared = {
  decided: Record<string, Decision>; setDecided: (f: (p: Record<string, Decision>) => Record<string, Decision>) => void;
  cs: Complaint[]; setCs: (f: (p: Complaint[]) => Complaint[]) => void;
};
type Attn = { sev: "red" | "amber"; group: "urgent" | "todo" | "review"; title: string; sub: string; action: string; go: () => void };

const csCode = (id: string) => `#${id.replace("-", "")}`;
const csTone = (s: string) => (s === "Mới" ? "red" : s === "Đã giải quyết" ? "green" : "amber") as "red" | "green" | "amber";
const stateLabel: Record<DocState, string> = { none: "Chưa kiểm tra", ok: "Hợp lệ", review: "Cần xem lại" };
const docMeta = [
  { label: "CCCD", icon: "user" as IconName }, { label: "GPLX", icon: "file" as IconName },
  { label: "Đăng ký xe", icon: "truck" as IconName }, { label: "Ảnh xác thực", icon: "shield" as IconName },
];

/* ---------- primitives ---------- */
function Sheet({ title, onClose, children, foot }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
  return (
    <div className="m-scrim" onClick={onClose}>
      <div className="m-sheet glass" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="m-grab" />
        <header className="m-sheet-head"><h3>{title}</h3><button type="button" className="m-icon" aria-label="Đóng" onClick={onClose}><Icon name="close" size={18} /></button></header>
        <div className="m-sheet-body">{children}</div>
        {foot && <footer className="m-sheet-foot">{foot}</footer>}
      </div>
    </div>
  );
}

function Fold({ title, hint, open: o = false, children }: { title: string; hint?: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(o);
  return (
    <section className={`m-fold ${open ? "open" : ""}`}>
      <button type="button" className="m-fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <strong>{title}</strong>{hint && <small>{hint}</small>}<Icon name="chevron" size={18} />
      </button>
      {open && <div className="m-fold-body">{children}</div>}
    </section>
  );
}

function Header({ title, sub, onBack, end }: { title: string; sub?: string; onBack: () => void; end?: ReactNode }) {
  return (
    <header className="m-bar">
      <button type="button" className="m-icon" aria-label="Quay lại" onClick={onBack}><Icon name="arrow" size={22} /></button>
      <div className="m-bar-t"><strong>{title}</strong>{sub && <small>{sub}</small>}</div>
      {end}
    </header>
  );
}

function Search({ value, set, ph }: { value: string; set: (s: string) => void; ph: string }) {
  return <label className="m-search"><Icon name="search" size={18} /><input value={value} onChange={(e) => set(e.target.value)} placeholder={ph} enterKeyHint="search" /></label>;
}

function OrderRow({ o, onClick }: { o: Order; onClick: () => void }) {
  return (
    <button type="button" className="m-card m-order" onClick={onClick}>
      <span className="m-order-top"><b className="m-code">#{o.id}</b><Status tone={o.tone}>{o.status}</Status></span>
      <span className="m-order-route">{o.from}<Icon name="arrow" size={13} />{o.to}</span>
      <span className="m-order-sub">{o.driver === "—" ? "Chưa có tài xế" : o.driver} · {o.vehicle}</span>
      <span className="m-order-foot"><b>{vnd(o.value)}</b><span className={o.late ? "m-late" : ""}>{o.late ? `Chậm ${o.late} phút` : o.eta ? `${o.eta} phút` : o.time}</span></span>
    </button>
  );
}

/* ---------- screens ---------- */
function Home({ nav, attn, top, lateCount, sel, setSel }: { nav: Nav; attn: Attn[]; top: Attn[]; lateCount: number; sel: string | null; setSel: (id: string | null) => void }) {
  const picked = orders.find((o) => o.id === sel);
  const cells = [
    { l: "Đơn hôm nay", v: "248", n: "+12,8%", t: "up" },
    { l: "Đang giao", v: "86", n: `${lateCount} chậm`, t: "warn" },
    { l: "Tài xế online", v: "164", n: "+8", t: "up" },
    { l: "Doanh thu", v: "48,6tr", n: "+9,2%", t: "up" },
  ];
  return (
    <div className="m-page">
      <header className="m-top">
        <div><small>TP. Hồ Chí Minh</small><strong>Tổng quan</strong></div>
        <span className="m-live"><i />Trực tiếp</span>
        <button type="button" className="m-icon bell" aria-label="Thông báo" onClick={() => nav.tab("act")}><Icon name="bell" size={20} />{attn.length > 0 && <span />}</button>
      </header>

      <section className="m-sum" aria-label="Tóm tắt hôm nay">
        {cells.map((c) => (
          <div key={c.l}><small>{c.l}</small><b>{c.v}</b><span className={`m-trend ${c.t}`}>{c.n}</span></div>
        ))}
      </section>

      <section className="m-sec">
        <h2>Cần bạn xử lý</h2>
        <ul className="m-card m-list">
          {top.map((a) => (
            <li key={a.title + a.sub}>
              <i className={`m-dot ${a.sev}`} />
              <span className="m-li-t"><strong>{a.title}</strong><small>{a.sub}</small></span>
              <button type="button" className="m-btn m-btn-sm" onClick={a.go}>{a.action}</button>
            </li>
          ))}
          {top.length === 0 && <li className="m-empty"><Icon name="check" size={18} />Không còn việc cần xử lý</li>}
        </ul>
        {attn.length > 0 && <button type="button" className="m-link" onClick={() => nav.tab("act")}>Xem tất cả {attn.length} việc cần xử lý<Icon name="arrow" size={14} /></button>}
      </section>

      <section className="m-sec">
        <h2>Hoạt động giao hàng</h2>
        <div className="m-map"><OpsMap mobile sel={sel} setSel={setSel} hover={null} onOpen={(id) => nav.push({ k: "order", id })} /></div>
      </section>

      <section className="m-sec">
        <h2>Đơn gần đây</h2>
        <div className="m-stack">{orders.slice(0, 3).map((o) => <OrderRow key={o.id} o={o} onClick={() => nav.push({ k: "order", id: o.id })} />)}</div>
        <button type="button" className="m-btn m-btn-block m-btn-soft" onClick={() => nav.tab("orders")}>Xem tất cả đơn</button>
      </section>

      {picked && (
        <Sheet title={`#${picked.id}`} onClose={() => setSel(null)} foot={<button type="button" className="m-btn m-btn-primary m-btn-block" onClick={() => { nav.push({ k: "order", id: picked.id }); setSel(null); }}>Xem đơn</button>}>
          <div className="m-peek"><strong>{picked.driver === "—" ? "Chưa có tài xế" : picked.driver}</strong><span><Status tone={picked.tone}>{picked.status}</Status>{picked.late && <b className="m-late"> Chậm {picked.late} phút</b>}</span><small>{picked.from} → {picked.to} · {vnd(picked.value)}</small></div>
        </Sheet>
      )}
    </div>
  );
}

function OrdersList({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState("Tất cả");
  const [sheet, setSheet] = useState(false);
  const [status, setStatus] = useState("Tất cả");
  const [vehicle, setVehicle] = useState("Tất cả");
  const [date, setDate] = useState("Hôm nay");
  const statuses = ["Tất cả", "Chờ tài xế", "Đã nhận", "Đang giao", "Hoàn thành", "Đã hủy"];
  const vehicles = ["Tất cả", "Xe máy", "Xe van", "Xe bán tải", "Xe tải 500kg"];
  const rows = orders.filter((o) =>
    (chip === "Tất cả" || (chip === "Có vấn đề" ? !!o.late : o.status === chip)) &&
    (status === "Tất cả" || o.status === status) && (vehicle === "Tất cả" || o.vehicle === vehicle) &&
    `${o.id} ${o.customer} ${o.driver}`.toLowerCase().includes(q.toLowerCase()));
  const active = (status !== "Tất cả" ? 1 : 0) + (vehicle !== "Tất cả" ? 1 : 0) + (date !== "Hôm nay" ? 1 : 0);
  const Chips = ({ list, v, set }: { list: string[]; v: string; set: (s: string) => void }) => <div className="m-chips wrap">{list.map((s) => <button type="button" key={s} className={v === s ? "on" : ""} onClick={() => set(s)}>{s}</button>)}</div>;
  return (
    <div className="m-page">
      <header className="m-top"><div><strong className="m-h1">Đơn hàng</strong></div></header>
      <Search value={q} set={setQ} ph="Mã đơn, khách hàng, tài xế…" />
      <div className="m-chips">
        {["Tất cả", "Đang giao", "Có vấn đề"].map((c) => <button type="button" key={c} className={chip === c ? "on" : ""} onClick={() => setChip(c)}>{c}</button>)}
        <button type="button" className="m-filter" onClick={() => setSheet(true)}><Icon name="filter" size={16} />Bộ lọc{active > 0 && <b>{active}</b>}</button>
      </div>
      <div className="m-stack">
        {rows.map((o) => <OrderRow key={o.id} o={o} onClick={() => nav.push({ k: "order", id: o.id })} />)}
        {rows.length === 0 && <p className="m-none">Không có đơn phù hợp</p>}
      </div>
      {sheet && (
        <Sheet title="Bộ lọc đơn hàng" onClose={() => setSheet(false)} foot={<><button type="button" className="m-btn" onClick={() => { setStatus("Tất cả"); setVehicle("Tất cả"); setDate("Hôm nay"); }}>Đặt lại</button><button type="button" className="m-btn m-btn-primary" onClick={() => setSheet(false)}>Xem {rows.length} đơn</button></>}>
          <div className="m-flabel">Trạng thái</div><Chips list={statuses} v={status} set={setStatus} />
          <div className="m-flabel">Loại xe</div><Chips list={vehicles} v={vehicle} set={setVehicle} />
          <div className="m-flabel">Thời gian</div><Chips list={["Hôm nay", "Hôm qua", "7 ngày qua", "30 ngày qua"]} v={date} set={setDate} />
        </Sheet>
      )}
    </div>
  );
}

function OrderDetailM({ id, nav }: { id: string; nav: Nav }) {
  const o = orders.find((x) => x.id === id)!;
  const promo = o.value > 100000 ? 10000 : 0;
  const surge = o.late ? 15000 : 0;
  const live = !o.cancelled && o.stage < 4;
  return (
    <div className="m-detail">
      <Header title={`#${o.id}`} sub={`Tạo lúc ${o.time}`} onBack={nav.pop} />
      <div className="m-page tight">
        <section className="m-card m-hero">
          <div className="m-hero-top"><Status tone={o.tone}>{o.status}</Status>{o.late && <b className="m-late">Chậm {o.late} phút</b>}</div>
          <strong className="m-hero-route">{o.from}<Icon name="arrow" size={16} />{o.to}</strong>
          <span className="m-hero-sub">{o.driver === "—" ? "Đang tìm tài xế phù hợp" : `${o.driver} · ${o.vehicle}`}</span>
          {o.eta ? <span className="m-eta"><Icon name="clock" size={16} />{o.eta} phút còn lại</span> : null}
          <div className="m-call">
            {o.driverPhone ? <a className="m-btn" href={`tel:${o.driverPhone.replace(/\s/g, "")}`}><Icon name="phone" size={16} />Liên hệ tài xế</a> : <span className="m-btn disabled">Chưa có tài xế</span>}
            <a className="m-btn" href={`tel:${o.phone.replace(/\s/g, "")}`}><Icon name="phone" size={16} />Liên hệ khách</a>
          </div>
        </section>
        <Fold title="Tiến trình" hint={live ? "Đang diễn ra" : undefined} open={live}><Steps o={o} /></Fold>
        <Fold title="Hành trình" hint={`${o.km} km`}>
          <div className="m-addr"><span className="dotg" /><div><small>Điểm lấy</small><strong>{o.fromAddr}</strong></div></div>
          <div className="m-addr"><span className="dotb"><Icon name="pin" size={11} /></span><div><small>Điểm giao</small><strong>{o.toAddr}</strong></div></div>
        </Fold>
        <Fold title="Thanh toán" hint={vnd(o.value)}>
          <div className="m-price"><span>Cước vận chuyển</span><b>{vnd(o.value + promo - surge)}</b></div>
          {surge > 0 && <div className="m-price"><span>Phụ phí giờ cao điểm</span><b>{vnd(surge)}</b></div>}
          {promo > 0 && <div className="m-price"><span>Khuyến mãi</span><b className="pos">−{vnd(promo)}</b></div>}
          <div className="m-price total"><span>Tổng cộng · Tiền mặt</span><b>{vnd(o.value)}</b></div>
        </Fold>
        <Fold title="Thông tin khách hàng" hint={o.customer}>
          <div className="m-person"><Avatar initials={o.customer.split(" ").slice(-2).map((w) => w[0]).join("")} size={40} /><span><strong>{o.customer}</strong><small>{o.phone}</small></span></div>
        </Fold>
      </div>
    </div>
  );
}

function ActionCenter({ nav, attn }: { nav: Nav; attn: Attn[] }) {
  const groups: { g: Attn["group"]; t: string }[] = [{ g: "urgent", t: "Khẩn cấp" }, { g: "todo", t: "Cần xử lý" }, { g: "review", t: "Chờ duyệt" }];
  void nav;
  return (
    <div className="m-page">
      <header className="m-top"><div><strong className="m-h1">Xử lý</strong><small>{attn.length} việc đang chờ bạn</small></div></header>
      {groups.map(({ g, t }) => {
        const list = attn.filter((a) => a.group === g);
        if (!list.length) return null;
        return (
          <section className="m-sec" key={g}>
            <h2>{t}<span>{list.length}</span></h2>
            <ul className="m-card m-list tall">
              {list.map((a) => (
                <li key={a.title + a.sub}>
                  <i className={`m-dot ${a.sev}`} />
                  <span className="m-li-t"><strong>{a.title}</strong><small>{a.sub}</small></span>
                  <button type="button" className={`m-btn m-btn-sm ${a.sev === "red" ? "m-btn-primary" : ""}`} onClick={a.go}>{a.action}</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {attn.length === 0 && <p className="m-none"><Icon name="check" size={20} /><br />Không còn việc cần xử lý</p>}
    </div>
  );
}

function More({ nav, waiting, newCs }: { nav: Nav; waiting: number; newCs: number }) {
  const items: { icon: IconName; l: string; s: Screen; n?: number }[] = [
    { icon: "drivers", l: "Tài xế", s: { k: "drivers" }, n: waiting },
    { icon: "users", l: "Người dùng", s: { k: "users" } },
    { icon: "alert", l: "Khiếu nại", s: { k: "complaints" }, n: newCs },
    { icon: "settings", l: "Cài đặt", s: { k: "settings" } },
  ];
  return (
    <div className="m-page">
      <header className="m-top"><div><strong className="m-h1">Thêm</strong></div></header>
      <div className="m-card m-me"><Avatar initials="AD" size={44} /><span><strong>Minh Anh</strong><small>Quản trị viên · TP. Hồ Chí Minh</small></span></div>
      <ul className="m-card m-menu">
        {items.map((i) => (
          <li key={i.l}><button type="button" onClick={() => nav.push(i.s)}><span className="m-menu-ic"><Icon name={i.icon} size={18} /></span><strong>{i.l}</strong>{!!i.n && <b className="m-badge">{i.n}</b>}<Icon name="arrow" size={18} /></button></li>
        ))}
      </ul>
    </div>
  );
}

function DriversM({ nav, sh, docs }: { nav: Nav; sh: Shared; docs: Record<string, DocState[]> }) {
  const [tab, setTab] = useState<"review" | "all">("review");
  const list = pending.filter((p) => !sh.decided[p.id]);
  return (
    <div className="m-detail">
      <Header title="Tài xế" onBack={nav.pop} />
      <div className="m-page tight">
        <div className="m-tabs">
          <button type="button" className={tab === "review" ? "on" : ""} onClick={() => setTab("review")}>Chờ duyệt {list.length}</button>
          <button type="button" className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>Đang hoạt động</button>
        </div>
        {tab === "review" ? (
          <>
            <h2 className="m-h2">Hồ sơ chờ duyệt</h2>
            <div className="m-stack">
              {list.map((p) => (
                <div className="m-card m-drv" key={p.id}>
                  <div className="m-person"><Avatar initials={p.initials} size={44} /><span><strong>{p.name}</strong><small>{p.vehicle}</small><small>Gửi {p.submitted}</small></span></div>
                  <div className="m-drv-foot"><span className="m-prog-t">{docs[p.id].filter((s) => s !== "none").length}/4 giấy tờ</span><button type="button" className="m-btn m-btn-primary" onClick={() => nav.push({ k: "driver", id: p.id })}>Xem hồ sơ</button></div>
                </div>
              ))}
              {list.length === 0 && <p className="m-none"><Icon name="check" size={20} /><br />Đã xử lý hết hồ sơ</p>}
            </div>
          </>
        ) : (
          <ul className="m-card m-rows">
            {activeDrivers.map((d) => (
              <li key={d.id} className="m-row static"><Avatar initials={d.initials} size={40} tone={d.tone} /><span className="m-li-t"><strong>{d.name}</strong><small>{d.vehicle}</small></span><Status tone={d.tone}>{d.status}</Status></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DriverReview({ p, nav, sh, docs, setDocs }: { p: Pending; nav: Nav; sh: Shared; docs: Record<string, DocState[]>; setDocs: (f: (x: Record<string, DocState[]>) => Record<string, DocState[]>) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  const ds = docs[p.id];
  const dec = sh.decided[p.id];
  const next = pending.find((x) => x.id !== p.id && !sh.decided[x.id]);
  const setState = (i: number, s: DocState) => setDocs((x) => ({ ...x, [p.id]: x[p.id].map((v, j) => (j === i ? s : v)) }));
  const info: [string, string][] = [["Điện thoại", p.phone], ["Khu vực", p.area], ["Ngày sinh", p.dob], ["Biển số", p.plate], ["Phương tiện", p.brand]];
  return (
    <div className="m-detail has-foot">
      <Header title="Duyệt hồ sơ" sub={p.id} onBack={nav.pop} />
      <div className="m-page tight">
        <section className="m-card m-hero">
          <div className="m-person"><Avatar initials={p.initials} size={48} /><span><strong className="m-name">{p.name}</strong><small>{p.vehicle}</small></span></div>
          {dec ? <Status tone={dec.res === "approved" ? "green" : "red"}>{dec.res === "approved" ? "Đã phê duyệt" : "Đã từ chối"}</Status> : <Status tone="amber">Chờ duyệt</Status>}
        </section>
        <section className="m-card m-kv">{info.map(([k, v]) => <div key={k}><small>{k}</small><strong>{v}</strong></div>)}</section>
        <h2 className="m-h2">Giấy tờ <span>{ds.filter((s) => s !== "none").length}/4 đã kiểm tra</span></h2>
        <ul className="m-card m-rows">
          {docMeta.map((d, i) => (
            <li key={d.label}>
              <button type="button" className="m-row" onClick={() => setOpen(i)}>
                <span className="m-menu-ic"><Icon name={d.icon} size={18} /></span>
                <span className="m-li-t"><strong>{d.label}</strong><small className={`st-${ds[i]}`}>{stateLabel[ds[i]]}</small></span>
                <span className={`m-ck s-${ds[i]}`}>{ds[i] === "ok" ? <Icon name="check" size={14} /> : ds[i] === "review" ? "!" : null}</span>
                <Icon name="arrow" size={18} />
              </button>
            </li>
          ))}
        </ul>
        {dec && (
          <div className={`m-result ${dec.res}`}><Icon name={dec.res === "approved" ? "check" : "close"} size={18} /><span>{dec.res === "approved" ? "Tài khoản đã được kích hoạt và tài xế đã nhận thông báo." : `Đã từ chối: ${dec.reason}`}</span></div>
        )}
      </div>

      <div className="m-foot glass">
        {dec ? (
          next ? <button type="button" className="m-btn m-btn-primary m-btn-block" onClick={() => { nav.pop(); nav.push({ k: "driver", id: next.id }); }}>Hồ sơ tiếp theo</button>
               : <button type="button" className="m-btn m-btn-block" onClick={nav.pop}>Về danh sách</button>
        ) : (
          <>
            <button type="button" className="m-btn m-btn-danger-o" onClick={() => setReject(true)}>Từ chối</button>
            <button type="button" className="m-btn m-btn-primary" onClick={() => sh.setDecided((x) => ({ ...x, [p.id]: { res: "approved" } }))}><Icon name="check" size={16} />Phê duyệt</button>
          </>
        )}
      </div>

      {open !== null && (
        <Sheet title={docMeta[open].label} onClose={() => setOpen(null)} foot={!dec ? <button type="button" className="m-btn m-btn-primary m-btn-block" onClick={() => { setState(open, "ok"); setOpen(open < 3 ? open + 1 : null); }}><Icon name="check" size={16} />Hợp lệ{open < 3 ? " · tiếp theo" : ""}</button> : undefined}>
          <div className="m-doc"><DocPreview idx={open} d={p} /></div>
          <div className="m-seg" role="radiogroup">
            {(["none", "ok", "review"] as DocState[]).map((s) => <button type="button" key={s} role="radio" aria-checked={ds[open] === s} disabled={!!dec} className={ds[open] === s ? `on v-${s}` : ""} onClick={() => setState(open, s)}>{stateLabel[s]}</button>)}
          </div>
        </Sheet>
      )}
      {reject && (
        <Sheet title="Từ chối hồ sơ" onClose={() => setReject(false)} foot={<><button type="button" className="m-btn" onClick={() => setReject(false)}>Hủy</button><button type="button" className="m-btn m-btn-danger" disabled={!reason.trim()} onClick={() => { sh.setDecided((x) => ({ ...x, [p.id]: { res: "rejected", reason } })); setReject(false); setReason(""); }}>Xác nhận từ chối</button></>}>
          <p className="m-note">Lý do sẽ được gửi tới {p.name}.</p>
          <textarea className="m-ta" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: Ảnh GPLX bị mờ, vui lòng chụp lại" />
        </Sheet>
      )}
    </div>
  );
}

function UsersM({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const rows = users.filter((u) => `${u.name} ${u.phone} ${u.email} ${u.id}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="m-detail">
      <Header title="Người dùng" onBack={nav.pop} />
      <div className="m-page tight">
        <Search value={q} set={setQ} ph="Tên, SĐT, email, mã khách…" />
        <ul className="m-card m-rows">
          {rows.map((u) => (
            <li key={u.id}><button type="button" className="m-row" onClick={() => nav.push({ k: "user", id: u.id })}>
              <Avatar initials={u.initials} size={42} /><span className="m-li-t"><strong>{u.name}</strong><small>{u.phone}</small><small>{u.id}</small></span><Icon name="arrow" size={18} />
            </button></li>
          ))}
          {rows.length === 0 && <li className="m-none">Không tìm thấy người dùng</li>}
        </ul>
      </div>
    </div>
  );
}

function UserDetailM({ u, nav }: { u: UserRow; nav: Nav }) {
  return (
    <div className="m-detail">
      <Header title="Người dùng" sub={u.id} onBack={nav.pop} />
      <div className="m-page tight">
        <section className="m-card m-hero">
          <div className="m-person"><Avatar initials={u.initials} size={52} /><span><strong className="m-name">{u.name}</strong><small>Tham gia {u.joined}</small></span></div>
          <Status tone={u.tone}>{u.status}</Status>
          <div className="m-call">
            <a className="m-btn" href={`tel:${u.phone.replace(/\s/g, "")}`}><Icon name="phone" size={16} />{u.phone}</a>
            <a className="m-btn" href={`mailto:${u.email}`}><Icon name="message" size={16} />Email</a>
          </div>
        </section>
        <section className="m-card m-stats"><div><small>Số đơn</small><b>{u.orders}</b></div><div><small>Tổng chi tiêu</small><b>{vnd(u.spent)}</b></div></section>
        <section className={`m-card m-acct ${u.tone}`}>
          <Icon name={u.tone === "red" ? "alert" : "shield"} size={18} />
          <span><strong>{u.tone === "red" ? "Tài khoản đang bị tạm khóa" : u.status === "Mới" ? "Tài khoản mới, chưa đủ lịch sử" : "Tài khoản hoạt động bình thường"}</strong><small>{u.tone === "red" ? "Không thể đặt đơn mới cho đến khi được mở khóa" : "Đã xác minh số điện thoại"}</small></span>
        </section>
        <Fold title="Đơn hàng gần đây" hint={`${u.recent.length} đơn`} open>
          <ul className="m-rows flat">
            {u.recent.map((r) => (
              <li key={r.id}><button type="button" className="m-row" onClick={() => nav.push({ k: "order", id: r.id })}>
                <span className="m-li-t"><strong className="m-code">#{r.id}</strong><small>{r.route}</small><small>{vnd(r.value)} · {r.when}</small></span><Status tone={r.tone}>{r.status}</Status>
              </button></li>
            ))}
          </ul>
        </Fold>
        <Fold title="Lịch sử hỗ trợ" hint={u.support.length ? `${u.support.length} yêu cầu` : "Chưa có"}>
          {u.support.length === 0 ? <p className="m-note">Chưa có yêu cầu hỗ trợ nào.</p> : (
            <ul className="m-rows flat">{u.support.map((s) => <li key={s.id} className="m-row static"><span className="m-li-t"><strong>{s.id}</strong><small>{s.title}</small><small>{s.when}</small></span><Status tone={csTone(s.status)}>{s.status}</Status></li>)}</ul>
          )}
        </Fold>
      </div>
    </div>
  );
}

function ComplaintsM({ nav, sh, initial }: { nav: Nav; sh: Shared; initial?: string }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(initial ?? "Tất cả");
  const [sheet, setSheet] = useState(false);
  const [cat, setCat] = useState("Tất cả");
  const [date, setDate] = useState("Tất cả");
  const cats = ["Tất cả", ...Array.from(new Set(sh.cs.map((c) => c.cat)))];
  const nNew = sh.cs.filter((c) => c.status === "Mới").length;
  const rows = sh.cs.filter((c) => (tab === "Tất cả" || c.status === tab) && (cat === "Tất cả" || c.cat === cat) && `${c.title} ${c.customer} ${c.order} ${c.id}`.toLowerCase().includes(q.toLowerCase()));
  const Chips = ({ list, v, set }: { list: string[]; v: string; set: (s: string) => void }) => <div className="m-chips wrap">{list.map((s) => <button type="button" key={s} className={v === s ? "on" : ""} onClick={() => set(s)}>{s}</button>)}</div>;
  const active = (cat !== "Tất cả" ? 1 : 0) + (date !== "Tất cả" ? 1 : 0);
  return (
    <div className="m-detail">
      <Header title="Khiếu nại" onBack={nav.pop} />
      <div className="m-page tight">
        <Search value={q} set={setQ} ph="Tiêu đề, khách hàng, mã đơn…" />
        <div className="m-chips">
          {[["Tất cả", ""], ["Mới", nNew ? String(nNew) : ""], ["Đang xử lý", ""]].map(([t, n]) => <button type="button" key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}{n && <b>{n}</b>}</button>)}
          <button type="button" className="m-filter" onClick={() => setSheet(true)}><Icon name="filter" size={16} />Bộ lọc{active > 0 && <b>{active}</b>}</button>
        </div>
        <ul className="m-card m-rows">
          {rows.map((c) => (
            <li key={c.id}><button type="button" className={`m-row top ${c.status === "Mới" ? "unread" : ""}`} onClick={() => nav.push({ k: "complaint", id: c.id })}>
              <span className="m-li-t"><Status tone={csTone(c.status)}>{c.status}</Status><strong className="wrap">{c.title}</strong><small>{c.customer}</small><small>#{c.order} · {c.time}</small></span><Icon name="arrow" size={18} />
            </button></li>
          ))}
          {rows.length === 0 && <li className="m-none">Không có khiếu nại</li>}
        </ul>
      </div>
      {sheet && (
        <Sheet title="Bộ lọc khiếu nại" onClose={() => setSheet(false)} foot={<><button type="button" className="m-btn" onClick={() => { setCat("Tất cả"); setDate("Tất cả"); setTab("Tất cả"); }}>Đặt lại</button><button type="button" className="m-btn m-btn-primary" onClick={() => setSheet(false)}>Xem {rows.length} khiếu nại</button></>}>
          <div className="m-flabel">Trạng thái</div><Chips list={["Tất cả", "Mới", "Đang xử lý", "Đã giải quyết"]} v={tab} set={setTab} />
          <div className="m-flabel">Loại vấn đề</div><Chips list={cats} v={cat} set={setCat} />
          <div className="m-flabel">Thời gian</div><Chips list={["Tất cả", "Hôm nay", "7 ngày qua", "30 ngày qua"]} v={date} set={setDate} />
        </Sheet>
      )}
    </div>
  );
}

function ComplaintDetailM({ c, nav, sh }: { c: Complaint; nav: Nav; sh: Shared }) {
  const [reply, setReply] = useState("");
  const patch = (f: (x: Complaint) => Complaint) => sh.setCs((p) => p.map((x) => (x.id === c.id ? f(x) : x)));
  const setStatus = (s: string) => patch((x) => ({ ...x, status: s, events: [...x.events, { text: s === "Đã giải quyết" ? "Đã giải quyết" : "Admin tiếp nhận xử lý", at: "Vừa xong" }] }));
  const send = () => { if (!reply.trim()) return; patch((x) => ({ ...x, messages: [...x.messages, { from: "admin", text: reply.trim(), at: "Vừa xong" }], status: x.status === "Mới" ? "Đang xử lý" : x.status })); setReply(""); };
  const escalate = (what: string) => patch((x) => ({ ...x, events: [...x.events, { text: what, at: "Vừa xong" }] }));
  const done = c.status === "Đã giải quyết";
  return (
    <div className="m-detail has-foot">
      <Header title="Khiếu nại" sub={c.id} onBack={nav.pop} />
      <div className="m-page tight">
        <section className="m-card m-hero">
          <div className="m-hero-top"><Status tone={csTone(c.status)}>{c.status}</Status><small>{c.cat} · {c.time}</small></div>
          <strong className="m-name">{c.title}</strong>
          <p className="m-body">{c.body}</p>
          <div className="m-kv2"><div><small>Khách hàng</small><strong>{c.customer}</strong></div><div><small>Đơn liên quan</small><button type="button" className="m-linkbtn" onClick={() => nav.push({ k: "order", id: c.order })}>#{c.order}</button></div></div>
        </section>
        <Fold title="Trao đổi" hint={`${c.messages.length} tin nhắn`} open>
          {c.messages.map((m, i) => <div key={i} className={`m-msg ${m.from}`}><p>{m.text}</p><small>{m.from === "admin" ? "Bạn" : c.customer} · {m.at}</small></div>)}
          <div className="m-reply">
            <input value={reply} disabled={done} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Trả lời khách hàng…" />
            <button type="button" className="m-icon send" aria-label="Gửi" disabled={!reply.trim()} onClick={send}><Icon name="send" size={16} /></button>
          </div>
        </Fold>
        <Fold title="Dòng thời gian" hint={`${c.events.length} sự kiện`}>
          <ol className="steps compact">{c.events.map((e, i) => <li key={i} className={i === c.events.length - 1 ? "done cur" : "done"}><span className="step-dot" /><strong>{e.text}</strong><small>{e.at}</small></li>)}</ol>
        </Fold>
        <Fold title="Leo thang" hint="Hành động nghiêm trọng">
          <div className="m-danger">
            <button type="button" className="m-btn m-btn-danger-o" onClick={() => escalate("Đã chuyển cấp quản lý")}>Chuyển cấp quản lý</button>
            <button type="button" className="m-btn m-btn-danger-o" onClick={() => escalate("Đã báo cáo tài xế")}>Báo cáo tài xế</button>
          </div>
        </Fold>
      </div>
      <div className="m-foot glass">
        <button type="button" className="m-btn" disabled={c.status !== "Mới"} onClick={() => setStatus("Đang xử lý")}>{c.status === "Đang xử lý" ? "Đang xử lý" : "Nhận xử lý"}</button>
        <button type="button" className="m-btn m-btn-success" disabled={done} onClick={() => setStatus("Đã giải quyết")}><Icon name="check" size={16} />Đã giải quyết</button>
      </div>
    </div>
  );
}

/* ---------- shell ---------- */
export default function MobileAdmin({ decided, setDecided, cs, setCs }: Shared) {
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Screen[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, DocState[]>>(() => Object.fromEntries(pending.map((p) => [p.id, p.docs0])));
  const scroller = useRef<HTMLDivElement>(null);
  const top = stack[stack.length - 1];
  const key = top ? JSON.stringify(top) : tab;
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [key]);

  const nav: Nav = {
    push: (s) => setStack((p) => [...p, s]),
    pop: () => setStack((p) => p.slice(0, -1)),
    tab: (t) => { setTab(t); setStack([]); },
  };
  const sh: Shared = { decided, setDecided, cs, setCs };

  const late = orders.filter((o) => o.late).sort((a, b) => (b.late ?? 0) - (a.late ?? 0));
  const waiting = pending.filter((p) => !decided[p.id]);
  const newCs = cs.filter((c) => c.status === "Mới");
  const attn: Attn[] = [
    ...late.map((o): Attn => ({ sev: (o.late ?? 0) >= 15 ? "red" : "amber", group: (o.late ?? 0) >= 15 ? "urgent" : "todo", title: `Đơn #${o.id}`, sub: `Giao chậm ${o.late} phút`, action: "Xem", go: () => nav.push({ k: "order", id: o.id }) })),
    ...newCs.map((c, i): Attn => ({ sev: i === 0 ? "red" : "amber", group: i === 0 ? "urgent" : "todo", title: `Khiếu nại ${csCode(c.id)}`, sub: c.title, action: "Xử lý", go: () => nav.push({ k: "complaint", id: c.id }) })),
    { sev: "amber", group: "todo", title: "Lê Thành Đạt", sub: "Tài xế cần xác minh · GPLX sắp hết hạn", action: "Xác minh", go: () => nav.push({ k: "drivers" }) },
    ...waiting.map((p): Attn => ({ sev: "amber", group: "review", title: p.name, sub: `Hồ sơ tài xế chờ duyệt · ${p.submitted}`, action: "Xem hồ sơ", go: () => nav.push({ k: "driver", id: p.id }) })),
  ];
  const home: Attn[] = [
    ...(late[0] ? [{ sev: "red", group: "urgent", title: `#${late[0].id}`, sub: `Giao chậm ${late[0].late} phút`, action: "Xem", go: () => nav.push({ k: "order", id: late[0].id }) } as Attn] : []),
    ...(waiting.length ? [{ sev: "amber", group: "review", title: `${waiting.length} tài xế chờ duyệt`, sub: "Hồ sơ mới cần kiểm tra", action: "Duyệt", go: () => nav.push({ k: "drivers" }) } as Attn] : []),
    ...(newCs.length ? [{ sev: "red", group: "urgent", title: `${newCs.length} khiếu nại mới`, sub: newCs[0].title, action: "Xử lý", go: () => nav.push({ k: "complaints", tab: "Mới" }) } as Attn] : []),
  ];

  let body: ReactNode;
  if (top?.k === "order") body = <OrderDetailM id={top.id} nav={nav} />;
  else if (top?.k === "drivers") body = <DriversM nav={nav} sh={sh} docs={docs} />;
  else if (top?.k === "driver") body = <DriverReview p={pending.find((p) => p.id === top.id)!} nav={nav} sh={sh} docs={docs} setDocs={setDocs} />;
  else if (top?.k === "users") body = <UsersM nav={nav} />;
  else if (top?.k === "user") body = <UserDetailM u={users.find((u) => u.id === top.id)!} nav={nav} />;
  else if (top?.k === "complaints") body = <ComplaintsM nav={nav} sh={sh} initial={top.tab} />;
  else if (top?.k === "complaint") body = <ComplaintDetailM c={cs.find((c) => c.id === top.id) ?? complaints0[0]} nav={nav} sh={sh} />;
  else if (top?.k === "settings") body = (
    <div className="m-detail"><Header title="Cài đặt" onBack={nav.pop} /><div className="m-page tight"><section className="m-card m-hero"><strong>6 nhóm thiết lập</strong><p className="m-body">Khu vực hoạt động, bảng giá, thông báo, phân quyền, tích hợp và bảo mật.</p></section></div></div>
  );
  else if (tab === "home") body = <Home nav={nav} attn={attn} top={home} lateCount={late.length} sel={sel} setSel={setSel} />;
  else if (tab === "orders") body = <OrdersList nav={nav} />;
  else if (tab === "act") body = <ActionCenter nav={nav} attn={attn} />;
  else body = <More nav={nav} waiting={waiting.length} newCs={newCs.length} />;

  const tabs: { id: Tab; l: string; icon: IconName; n?: number }[] = [
    { id: "home", l: "Tổng quan", icon: "grid" }, { id: "orders", l: "Đơn hàng", icon: "orders" },
    { id: "act", l: "Xử lý", icon: "alert", n: attn.length }, { id: "more", l: "Thêm", icon: "more" },
  ];
  const hideNav = !!top;
  return (
    <div className="m-app">
      <div className={`m-scroll ${hideNav ? "no-nav" : ""}`} ref={scroller}>{body}</div>
      {!hideNav && (
        <nav className="m-nav glass" aria-label="Điều hướng">
          {tabs.map((t) => (
            <button type="button" key={t.id} className={tab === t.id ? "on" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => nav.tab(t.id)}>
              <span className="m-nav-ic"><Icon name={t.icon} size={22} />{!!t.n && <b>{t.n}</b>}</span><span>{t.l}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
