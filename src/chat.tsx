import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/* ---------- types & store ---------- */

export type Side = "customer" | "driver";

export type Msg = {
  id: number;
  from: Side;
  kind: "text" | "location";
  text: string;
  time: string;
};

export type Conv = {
  id: string;
  driverName: string;
  driverInitials: string;
  customerName: string;
  vehicle: string;
  order: string;
  status: "active" | "completed";
  endedAt?: string;
  messages: Msg[];
  unread: Record<Side, number>;
};

export const CURRENT_CONV = "c1";

let seq = 100;
const m = (from: Side, text: string, time: string, kind: Msg["kind"] = "text"): Msg => ({
  id: ++seq,
  from,
  kind,
  text,
  time,
});

let state: Conv[] = [
  {
    id: "c1",
    driverName: "Nguyễn Văn Minh",
    driverInitials: "NM",
    customerName: "Chị Lan Anh",
    vehicle: "Xe van",
    order: "#DH1024",
    status: "active",
    unread: { customer: 1, driver: 0 },
    messages: [
      m("driver", "Chào bạn, mình là Minh, tài xế nhận đơn #DH1024.", "10:24"),
      m("customer", "Chào anh, hàng là 6 thùng carton, để sẵn ở cổng nhé.", "10:26"),
      m("driver", "Ok bạn, mình đang chạy từ Quận 3 qua.", "10:27"),
      m("customer", "Bạn tới đâu rồi?", "10:31"),
      m("driver", "Anh sắp tới điểm lấy rồi nhé", "10:32"),
    ],
  },
  {
    id: "c2",
    driverName: "Trần Quốc Bảo",
    driverInitials: "TB",
    customerName: "Chị Lan Anh",
    vehicle: "Xe tải 500kg",
    order: "#DH0987",
    status: "completed",
    endedAt: "Hôm qua",
    unread: { customer: 0, driver: 0 },
    messages: [
      m("driver", "Mình đã tới điểm lấy hàng, bạn ra giúp mình nhé.", "14:05"),
      m("customer", "Mình ra ngay, anh chờ chút nhé.", "14:06"),
      m("driver", "Đã giao xong, cảm ơn bạn!", "15:12"),
    ],
  },
  {
    id: "c3",
    driverName: "Lê Hoàng Nam",
    driverInitials: "LN",
    customerName: "Chị Lan Anh",
    vehicle: "Xe van",
    order: "#DH0952",
    status: "completed",
    endedAt: "Thứ Hai",
    unread: { customer: 0, driver: 0 },
    messages: [
      m("customer", "Khi tới gọi mình nhé", "09:10"),
      m("driver", "Mình sẽ gọi khi tới", "09:11"),
      m("driver", "Giao hàng thành công nhé bạn.", "10:02"),
    ],
  },
];

const viewing: Record<Side, string | null> = { customer: null, driver: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const nextTime = (c: Conv) => {
  const [h, mm] = (c.messages[c.messages.length - 1]?.time ?? "10:32").split(":").map(Number);
  const t = h * 60 + mm + 1;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

const update = (id: string, fn: (c: Conv) => Conv) => {
  state = state.map((c) => (c.id === id ? fn(c) : c));
  emit();
};

export function sendMessage(id: string, from: Side, text: string, kind: Msg["kind"] = "text") {
  const to: Side = from === "customer" ? "driver" : "customer";
  update(id, (c) => ({
    ...c,
    messages: [...c.messages, m(from, text, nextTime(c), kind)],
    unread: { ...c.unread, [to]: viewing[to] === id ? 0 : c.unread[to] + 1 },
  }));
}

export function markRead(id: string, side: Side) {
  const c = state.find((x) => x.id === id);
  if (!c || c.unread[side] === 0) return;
  update(id, (x) => ({ ...x, unread: { ...x.unread, [side]: 0 } }));
}

export function setOrderStatus(id: string, status: Conv["status"]) {
  const c = state.find((x) => x.id === id);
  if (!c || c.status === status) return;
  update(id, (x) => ({ ...x, status, endedAt: status === "completed" ? "Vừa xong" : undefined }));
}

const replyFor = (text: string, kind: Msg["kind"]) => {
  if (kind === "location") return "Mình thấy vị trí rồi nhé, mình tới ngay.";
  if (text === "Bạn tới đâu rồi?") return "Mình còn khoảng 3 phút nữa tới nhé.";
  if (text === "Khi tới gọi mình nhé") return "Ok bạn, mình tới sẽ gọi.";
  if (text === "Mình đang ở điểm lấy hàng") return "Mình thấy rồi, mình tới ngay.";
  return "Mình nhận được rồi nhé.";
};

const replyTimers = new Map<string, number>();
export function scheduleReply(id: string, from: Side, text: string, kind: Msg["kind"]) {
  window.clearTimeout(replyTimers.get(id));
  const delay = 2200;
  replyTimers.set(
    id,
    window.setTimeout(() => {
      const c = state.find((x) => x.id === id);
      if (!c || c.status !== "active") return;
      sendMessage(
        id,
        from === "customer" ? "driver" : "customer",
        from === "customer" ? replyFor(text, kind) : "Vâng, mình ở cổng số 2 nhé.",
      );
    }, delay),
  );
}

let ambientStarted = false;
export function startAmbient() {
  if (ambientStarted) return;
  ambientStarted = true;
  window.setTimeout(() => {
    const c = state.find((x) => x.id === CURRENT_CONV);
    if (c?.status === "active") sendMessage(CURRENT_CONV, "driver", "Hàng có cần bốc xếp giúp không bạn?");
  }, 20000);
}

export function simulateCustomerPing() {
  window.setTimeout(() => {
    const c = state.find((x) => x.id === CURRENT_CONV);
    if (c?.status === "active") sendMessage(CURRENT_CONV, "customer", "Mình ở cổng số 2, bác tài tới nhắn mình nhé.");
  }, 6000);
}

export function useConvs() {
  return useSyncExternalStore(subscribe, () => state);
}

export function useUnread(side: Side) {
  return useConvs().reduce((n, c) => n + c.unread[side], 0);
}

export function useViewing(side: Side, id: string | null) {
  useEffect(() => {
    if (!id) return;
    viewing[side] = id;
    markRead(id, side);
    return () => {
      viewing[side] = null;
    };
  }, [side, id]);
}

/* ---------- icons ---------- */

type CI = "back" | "send" | "plus" | "pin" | "phone" | "truck" | "check" | "chevron" | "keyboard" | "lock";

function CIcon({ name, size = 20, strokeWidth = 1.8 }: { name: CI; size?: number; strokeWidth?: number }) {
  const paths: Record<CI, ReactNode> = {
    back: <path d="m15 18-6-6 6-6" />,
    send: <path d="M12 19V5m-5 5 5-5 5 5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    pin: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    phone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    ),
    truck: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    keyboard: (
      <>
        <rect height="12" rx="2" width="18" x="3" y="6" />
        <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
      </>
    ),
    lock: (
      <>
        <rect height="9" rx="2" width="14" x="5" y="11" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
  };
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
  );
}

/* ---------- messages list (customer) ---------- */

export function MessagesScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const convs = useConvs();
  const active = convs.filter((c) => c.status === "active");
  const recent = convs.filter((c) => c.status === "completed");

  const row = (c: Conv) => {
    const last = c.messages[c.messages.length - 1];
    const unread = c.unread.customer;
    return (
      <li key={c.id}>
        <button className={`conv-row ${unread ? "unread" : ""}`} onClick={() => onOpen(c.id)} type="button">
          <span className="driver-avatar small" aria-hidden="true">
            {c.driverInitials}
            {c.status === "active" && <span className="driver-online" />}
          </span>
          <span className="conv-main">
            <span className="conv-top">
              <strong>{c.driverName}</strong>
              <time>{c.status === "completed" ? c.endedAt : last.time}</time>
            </span>
            <small className="conv-order">
              {c.vehicle} · Đơn {c.order}
            </small>
            <span className="conv-last">
              {last.kind === "location" ? "Đã gửi một vị trí" : last.text}
            </span>
          </span>
          {unread > 0 && (
            <span aria-label={`${unread} tin chưa đọc`} className="conv-badge">
              {unread}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <section className="orders-screen messages-screen">
      <header className="orders-head">
        <h1>Tin nhắn</h1>
      </header>
      {active.length > 0 && (
        <>
          <h2 className="conv-section">Đang giao</h2>
          <ul className="conv-list">{active.map(row)}</ul>
        </>
      )}
      {recent.length > 0 && (
        <>
          <h2 className="conv-section">Gần đây</h2>
          <ul className="conv-list">{recent.map(row)}</ul>
        </>
      )}
    </section>
  );
}

/* ---------- chat ---------- */

const quickReplies: Record<Side, string[]> = {
  customer: ["Bạn tới đâu rồi?", "Khi tới gọi mình nhé", "Mình đang ở điểm lấy hàng"],
  driver: ["Mình đang đến", "Mình đã tới điểm lấy", "Mình sẽ gọi khi tới"],
};

const sharedPlace: Record<Side, string> = {
  customer: "21 Nguyễn Đình Chiểu, Q.1",
  driver: "Gần 45 Pasteur, Q.1",
};

function MiniMap() {
  return (
    <svg aria-hidden="true" className="loc-map" preserveAspectRatio="xMidYMid slice" viewBox="0 0 200 84">
      <rect fill="#e7eae0" height="84" width="200" />
      <path d="M0 58 L200 40" stroke="#fff" strokeWidth="9" />
      <path d="M70 0 L92 84" stroke="#fff" strokeWidth="7" />
      <path d="M150 0 L138 84" stroke="#f3eee2" strokeWidth="5" />
      <path d="M0 20 L200 14" stroke="#f3eee2" strokeWidth="4" />
      <path d="M118 84 C130 70 160 70 200 76" fill="none" stroke="#cfe5f3" strokeWidth="10" />
      <circle cx="98" cy="44" fill="#1f6bf2" fillOpacity=".18" r="15" />
      <circle cx="98" cy="44" fill="#1f6bf2" r="6" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}

export function ChatScreen({
  convId,
  side,
  moving = false,
  onBack,
  onTrip,
  onOpenMap,
}: {
  convId: string;
  side: Side;
  moving?: boolean;
  onBack: () => void;
  onTrip?: () => void;
  onOpenMap: () => void;
}) {
  const conv = useConvs().find((c) => c.id === convId);
  useViewing(side, convId);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(false);
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const count = conv?.messages.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  if (!conv) return null;
  const done = conv.status === "completed";
  const isDriver = side === "driver";
  const name = isDriver ? conv.customerName : conv.driverName;
  const initials = isDriver ? "LA" : conv.driverInitials;
  const quickOnly = isDriver && moving && !typing;

  const send = (text: string, kind: Msg["kind"] = "text") => {
    const t = text.trim();
    if (!t || done) return;
    sendMessage(convId, side, t, kind);
    scheduleReply(convId, side, t, kind);
    setDraft("");
    setMenu(false);
  };

  return (
    <section className={`chat-screen ${isDriver ? "as-driver" : ""}`} aria-label={`Trò chuyện với ${name}`}>
      <header className="chat-head">
        <button aria-label="Quay lại" className="chat-icon-btn" onClick={onBack} type="button">
          <CIcon name="back" size={22} />
        </button>
        <span className="driver-avatar small" aria-hidden="true">
          {initials}
          {!done && <span className="driver-online" />}
        </span>
        <span className="chat-id">
          <strong>{name}</strong>
          <small className={done ? "" : "on"}>
            {done
              ? "Đã kết thúc"
              : isDriver
                ? "Khách hàng · Đang trong chuyến"
                : "Trực tuyến · Đang giao hàng"}
          </small>
        </span>
        <a aria-label={`Gọi ${name}`} className="chat-icon-btn call" href="tel:" onClick={(e) => e.preventDefault()}>
          <CIcon name="phone" size={20} />
        </a>
      </header>

      <div className={`chat-order ${done ? "done" : ""}`}>
        <span className="chat-order-icon">
          <CIcon name={done ? "check" : "truck"} size={18} strokeWidth={done ? 2.6 : 1.8} />
        </span>
        <span className="chat-order-copy">
          <strong>{done ? "Đơn hàng đã hoàn thành" : "Đơn đang giao"}</strong>
          <small>
            {conv.vehicle} · {conv.order}
          </small>
        </span>
        {!done && !isDriver && onTrip && (
          <button className="chat-order-link" onClick={onTrip} type="button">
            Xem hành trình
            <CIcon name="chevron" size={14} strokeWidth={2.4} />
          </button>
        )}
      </div>

      <div className="chat-thread" role="log" aria-live="polite">
        <p className="chat-day">Hôm nay</p>
        {conv.messages.map((msg) => (
          <div className={`bubble-row ${msg.from === side ? "mine" : "theirs"}`} key={msg.id}>
            {msg.kind === "location" ? (
              <div className="bubble loc-bubble">
                <MiniMap />
                <div className="loc-copy">
                  <span className="loc-name">
                    <CIcon name="pin" size={15} />
                    {msg.text}
                  </span>
                  <button className="loc-link" onClick={onOpenMap} type="button">
                    Xem trên bản đồ
                  </button>
                </div>
                <time>{msg.time}</time>
              </div>
            ) : (
              <div className="bubble">
                <span>{msg.text}</span>
                <time>{msg.time}</time>
              </div>
            )}
          </div>
        ))}
        {done && (
          <p className="chat-closed">
            <CIcon name="lock" size={14} />
            Đơn hàng đã hoàn thành · Bạn chỉ có thể xem lại tin nhắn
          </p>
        )}
        <div ref={endRef} />
      </div>

      {!done && (
        <footer className="chat-foot">
          {menu && (
            <div className="chat-menu" role="menu">
              <button onClick={() => send(sharedPlace[side], "location")} role="menuitem" type="button">
                <span className="chat-menu-icon">
                  <CIcon name="pin" size={18} />
                </span>
                <span>
                  <strong>Gửi vị trí</strong>
                  <small>Vị trí hiện tại của bạn</small>
                </span>
              </button>
            </div>
          )}
          <div className="quick-replies">
            {quickReplies[side].map((q) => (
              <button key={q} onClick={() => send(q)} type="button">
                {q}
              </button>
            ))}
          </div>
          {quickOnly ? (
            <div className="composer-moving glass glass-strong">
              <button aria-label="Gửi vị trí" className="chat-plus" onClick={() => send(sharedPlace.driver, "location")} type="button">
                <CIcon name="pin" size={22} />
              </button>
              <span>Đang di chuyển · Hãy dùng trả lời nhanh</span>
              <button className="composer-type" onClick={() => setTyping(true)} type="button">
                <CIcon name="keyboard" size={20} />
                <span>Nhập</span>
              </button>
            </div>
          ) : (
            <form
              className="composer glass glass-strong"
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
            >
              <button
                aria-expanded={menu}
                aria-label="Thêm"
                className={`chat-plus ${menu ? "open" : ""}`}
                onClick={() => setMenu((o) => !o)}
                type="button"
              >
                <CIcon name="plus" size={22} strokeWidth={2.2} />
              </button>
              <input
                aria-label="Nhập tin nhắn"
                autoFocus={typing}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Nhập tin nhắn..."
                value={draft}
              />
              <button aria-label="Gửi" className="chat-send" disabled={!draft.trim()} type="submit">
                <CIcon name="send" size={20} strokeWidth={2.4} />
              </button>
            </form>
          )}
        </footer>
      )}
    </section>
  );
}
