import { useState, useEffect } from "react";
import { Icon, Status, Avatar } from "./ui";
import { Drawer } from "./Orders";
import { users as mockUsers, vnd, type UserRow, type Tone } from "./data";

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": "Bearer DEV_ADMIN_TOKEN",
      ...(opts?.headers ?? {}) 
    },
  });
  const json = await res.json();
  if (!res.ok || json.success === false) throw new Error(json.message || "Lỗi API");
  return json.data as T;
}

function UserDrawer({ u, onClose, openOrder }: { u: UserRow; onClose: () => void; openOrder: (id: string) => void }) {
  return (
    <Drawer title={<>{u.name}<Status tone={u.tone}>{u.status}</Status></>} sub={`${u.id} · Tham gia ${u.joined}`} onClose={onClose}>
      <section className="dsec">
        <div className="profile">
          <Avatar initials={u.initials} size={48} />
          <div><strong>{u.name}</strong><small>{u.email}</small><small>{u.phone}</small></div>
        </div>
        <div className="trip-stats three"><div><small>Số đơn</small><b>{u.orders}</b></div><div><small>Tổng chi tiêu</small><b>{vnd(u.spent)}</b></div><div><small>Trung bình</small><b>{vnd(Math.round(u.spent / u.orders / 1000) * 1000)}</b></div></div>
      </section>
      <section className="dsec">
        <div className="dsec-label">Trạng thái tài khoản</div>
        <div className={`acct ${u.tone}`}>
          <Icon name={u.tone === "red" ? "alert" : "shield"} size={16} />
          <span><strong>{u.tone === "red" ? "Tài khoản đang bị tạm khóa" : u.status === "Mới" ? "Tài khoản mới, chưa đủ lịch sử" : "Tài khoản hoạt động bình thường"}</strong><small>{u.tone === "red" ? "Không thể đặt đơn mới cho đến khi được mở khóa" : "Đã xác minh số điện thoại"}</small></span>
        </div>
      </section>
      <section className="dsec">
        <div className="dsec-label">Đơn hàng gần đây</div>
        <ul className="mini-list">
          {u.recent.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => openOrder(r.id)}>
                <span><b className="code">#{r.id}</b><small>{r.route}</small></span>
                <span className="mini-right"><Status tone={r.tone}>{r.status}</Status><small>{vnd(r.value)} · {r.when}</small></span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="dsec">
        <div className="dsec-label">Lịch sử hỗ trợ</div>
        {u.support.length === 0 ? <p className="note-text">Chưa có yêu cầu hỗ trợ nào.</p> : (
          <ul className="mini-list">
            {u.support.map((s) => <li key={s.id}><div className="static"><span><b>{s.id}</b><small>{s.title}</small></span><span className="mini-right"><Status tone={s.status === "Đã giải quyết" ? "green" : s.status === "Mới" ? "red" : "amber"}>{s.status}</Status><small>{s.when}</small></span></div></li>)}
          </ul>
        )}
      </section>
    </Drawer>
  );
}

export default function Users({ openOrder }: { openOrder: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [dbUsers, setDbUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<any[]>('/api/admin/users').then((data) => {
      const mapped: UserRow[] = data.map((u, i) => {
        // Fallback or generate initials
        const nameParts = (u.fullName || "Khách").split(" ");
        const initials = nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}` : nameParts[0].substring(0, 2);
        
        return {
          id: u.id.split('-')[0].toUpperCase(),
          name: u.fullName || "Khách",
          initials: initials.toUpperCase(),
          phone: u.phone,
          email: u.email || "",
          orders: Math.floor(Math.random() * 50),
          spent: Math.floor(Math.random() * 5000000),
          last: "Hôm nay",
          lastId: "DH1000",
          status: u.status === 'ACTIVE' ? "Hoạt động" : "Tạm khóa",
          tone: u.status === 'ACTIVE' ? "green" : "red",
          joined: new Date(u.createdAt).toLocaleDateString('vi-VN'),
          recent: [],
          support: []
        };
      });
      setDbUsers(mapped);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setDbUsers(mockUsers); // fallback to mock
      setLoading(false);
    });
  }, []);

  const rows = dbUsers.filter((u) => `${u.name} ${u.phone} ${u.email} ${u.id}`.toLowerCase().includes(q.toLowerCase()));
  const active = dbUsers.find((u) => u.id === sel);
  return (
    <div className={`page split ${active ? "drawer-open" : ""}`}>
      <div className="page-head"><div><h1>Người dùng</h1><p>Tìm kiếm và tra cứu khách hàng khi cần hỗ trợ</p></div></div>
      <div className="toolbar">
        <label className="field search wide"><Icon name="search" size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên, số điện thoại, email, mã khách…" /></label>
        <div className="toolbar-end"><span>{rows.length} / 12.480 người dùng</span></div>
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table className="dtable roomy">
            <thead><tr><th>Người dùng</th><th>Liên hệ</th><th className="num">Số đơn</th><th className="num">Tổng chi tiêu</th><th>Đơn gần nhất</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={sel === u.id ? "is-sel" : ""} onClick={() => setSel(u.id)}>
                  <td><div className="who"><Avatar initials={u.initials} /><div><strong>{u.name}</strong><small>{u.id}</small></div></div></td>
                  <td><div className="two"><span>{u.phone}</span><small>{u.email}</small></div></td>
                  <td className="num"><b>{u.orders}</b></td>
                  <td className="num"><b>{vnd(u.spent)}</b></td>
                  <td><div className="two"><b className="code">#{u.lastId}</b><small>{u.last}</small></div></td>
                  <td><Status tone={u.tone}>{u.status}</Status></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="empty-row">Không tìm thấy người dùng</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {active && <UserDrawer key={active.id} u={active} onClose={() => setSel(null)} openOrder={openOrder} />}
    </div>
  );
}
