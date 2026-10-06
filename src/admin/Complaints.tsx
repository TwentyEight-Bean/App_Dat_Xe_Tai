import { useState } from "react";
import { Icon, Status, Avatar } from "./ui";
import { type Complaint } from "./data";

const tone = (s: string) => (s === "Mới" ? "red" : s === "Đã giải quyết" ? "green" : "amber") as "red" | "green" | "amber";
const statuses = ["Mới", "Đang xử lý", "Đã giải quyết"];

export default function Complaints({ items, setItems, focus, openOrder }: { items: Complaint[]; setItems: (f: (p: Complaint[]) => Complaint[]) => void; focus?: string; openOrder: (id: string) => void }) {
  const [st, setSt] = useState("Tất cả");
  const [cat, setCat] = useState("Tất cả");
  const [sel, setSel] = useState(focus ?? items[0].id);
  const [reply, setReply] = useState("");
  const cats = Array.from(new Set(items.map((i) => i.cat)));
  const list = items.filter((i) => (st === "Tất cả" || i.status === st) && (cat === "Tất cả" || i.cat === cat));
  const c = items.find((i) => i.id === sel) ?? items[0];

  const patch = (f: (c: Complaint) => Complaint) => setItems((p) => p.map((x) => (x.id === c.id ? f(x) : x)));
  const setStatus = (s: string) => patch((x) => ({ ...x, status: s, events: [...x.events, { text: s === "Đã giải quyết" ? "Đã giải quyết" : "Admin tiếp nhận xử lý", at: "Vừa xong" }] }));
  const send = () => { if (!reply.trim()) return; patch((x) => ({ ...x, messages: [...x.messages, { from: "admin", text: reply.trim(), at: "Vừa xong" }], status: x.status === "Mới" ? "Đang xử lý" : x.status })); setReply(""); };
  const escalate = (what: string) => patch((x) => ({ ...x, events: [...x.events, { text: what, at: "Vừa xong" }] }));

  return (
    <div className="page">
      <div className="page-head"><div><h1>Khiếu nại</h1><p>Hộp thư hỗ trợ: tiếp nhận, trao đổi và giải quyết tại một nơi</p></div></div>
      <div className="inbox">
        <aside className="ib-filters panel">
          <div className="ib-group">Trạng thái</div>
          {["Tất cả", ...statuses].map((s) => (
            <button type="button" key={s} className={st === s ? "on" : ""} onClick={() => setSt(s)}>
              <span>{s}</span><b className={s === "Mới" ? "hot" : ""}>{s === "Tất cả" ? items.length : items.filter((i) => i.status === s).length}</b>
            </button>
          ))}
          <div className="ib-group">Loại vấn đề</div>
          {["Tất cả", ...cats].map((s) => (
            <button type="button" key={s} className={cat === s ? "on" : ""} onClick={() => setCat(s)}>
              <span>{s}</span><b>{s === "Tất cả" ? items.length : items.filter((i) => i.cat === s).length}</b>
            </button>
          ))}
        </aside>

        <section className="ib-list panel">
          <ul>
            {list.map((i) => (
              <li key={i.id}>
                <button type="button" className={`ib-row ${sel === i.id ? "is-sel" : ""} ${i.status === "Mới" ? "unread" : ""}`} onClick={() => setSel(i.id)}>
                  <i className="unread-dot" />
                  <span className="ib-main">
                    <span className="ib-top"><strong>{i.customer}</strong><time>{i.time}</time></span>
                    <span className="ib-title">{i.title}</span>
                    <span className="ib-meta"><Status tone={tone(i.status)}>{i.status}</Status><small>#{i.order} · {i.cat}</small></span>
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="empty-row">Không có khiếu nại</li>}
          </ul>
        </section>

        <section className="ib-detail panel">
          <header className="ibd-head">
            <div><div className="ibd-id">{c.id}<Status tone={tone(c.status)}>{c.status}</Status></div><h2>{c.title}</h2></div>
            <div className="ibd-actions">
              <button type="button" className={`btn ${c.status === "Đang xử lý" ? "btn-tonal" : ""}`} disabled={c.status === "Đang xử lý" || c.status === "Đã giải quyết"} onClick={() => setStatus("Đang xử lý")}>Đang xử lý</button>
              <button type="button" className="btn btn-success" disabled={c.status === "Đã giải quyết"} onClick={() => setStatus("Đã giải quyết")}><Icon name="check" size={14} />Đã giải quyết</button>
            </div>
          </header>
          <div className="ibd-scroll">
            <dl className="ibd-meta">
              <div><dt>Khách hàng</dt><dd><Avatar initials={c.customer.split(" ").slice(-2).map((w) => w[0]).join("")} size={22} />{c.customer}</dd></div>
              <div><dt>Đơn liên quan</dt><dd><button type="button" className="link-btn code" onClick={() => openOrder(c.order)}>#{c.order}</button></dd></div>
              <div><dt>Tài xế</dt><dd>{c.driver}</dd></div>
              <div><dt>Loại</dt><dd>{c.cat}</dd></div>
            </dl>
            <div className="ibd-issue"><div className="dsec-label">Nội dung phản ánh</div><p>{c.body}</p></div>
            <div className="ibd-cols">
              <div className="ibd-thread">
                <div className="dsec-label">Trao đổi</div>
                {c.messages.map((m, i) => (
                  <div key={i} className={`msg ${m.from}`}><p>{m.text}</p><small>{m.from === "admin" ? "Bạn" : c.customer} · {m.at}</small></div>
                ))}
              </div>
              <div className="ibd-events">
                <div className="dsec-label">Dòng thời gian</div>
                <ol className="steps compact">
                  {c.events.map((e, i) => <li key={i} className={i === c.events.length - 1 ? "done cur" : "done"}><span className="step-dot" /><strong>{e.text}</strong><small>{e.at}</small></li>)}
                </ol>
              </div>
            </div>
          </div>
          <footer className="ibd-foot">
            <div className="reply field">
              <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Trả lời khách hàng…" disabled={c.status === "Đã giải quyết"} />
              <button type="button" className="icon-btn send" aria-label="Gửi" onClick={send} disabled={!reply.trim()}><Icon name="send" size={14} /></button>
            </div>
            <div className="danger-zone">
              <span>Leo thang</span>
              <button type="button" className="btn btn-danger-o btn-sm" onClick={() => escalate("Đã chuyển cấp quản lý")}>Chuyển cấp quản lý</button>
              <button type="button" className="btn btn-danger-o btn-sm" onClick={() => escalate("Đã báo cáo tài xế")}>Báo cáo tài xế</button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
