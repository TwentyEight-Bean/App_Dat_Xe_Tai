import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

/* ---------- tiny shared store ---------- */

function makeStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    use: () =>
      useSyncExternalStore(
        (l) => {
          listeners.add(l);
          return () => listeners.delete(l);
        },
        () => value,
      ),
    set: (next: T) => {
      value = next;
      listeners.forEach((l) => l());
    },
    get: () => value,
  };
}

export type SavedAddress = { id: number; type: "home" | "work" | "other"; name: string; address: string };

const typeName = { home: "Nhà", work: "Công ty", other: "Khác" } as const;
const labelOf = (a: SavedAddress) => (a.type === "other" && a.name.trim() ? a.name.trim() : typeName[a.type]);

const addressStore = makeStore<SavedAddress[]>([
  { id: 1, type: "home", name: "", address: "Chung cư Sunrise City, 27 Nguyễn Hữu Thọ, Q.7" },
  { id: 2, type: "work", name: "", address: "Tòa nhà Bitexco, 2 Hải Triều, Q.1" },
  { id: 3, type: "other", name: "Kho hàng", address: "55 Kinh Dương Vương, Bình Tân" },
]);
export const useAddresses = addressStore.use;

const profileStore = makeStore({ name: "Minh Anh", phone: "0912 345 678", email: "minhanh@example.com", photo: "" });
const payStore = makeStore<"cash" | "wallet">("cash");
const notifStore = makeStore({ orders: true, messages: true, promos: false });
const privacyStore = makeStore({ location: true, lock: false });

/* ---------- icons ---------- */

type AI =
  | "back"
  | "chevron"
  | "user"
  | "pin"
  | "card"
  | "tag"
  | "help"
  | "phone"
  | "bell"
  | "shield"
  | "logout"
  | "pencil"
  | "home"
  | "building"
  | "plus"
  | "check"
  | "camera"
  | "mail"
  | "cash"
  | "wallet"
  | "box"
  | "chat";

function AIcon({ name, size = 20, strokeWidth = 1.8 }: { name: AI; size?: number; strokeWidth?: number }) {
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
    shield: <path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6l-7-3Z" />,
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
    chat: <path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.8-4A8 8 0 1 1 21 12Z" />,
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

/* ---------- small parts ---------- */

type Page = "home" | "profile" | "addresses" | "addressEdit" | "payment" | "notifications" | "offers" | "privacy" | "help" | "signedout";

function SubHead({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="orders-head">
      <button aria-label="Quay lại" className="icon-button back-button" onClick={onBack} type="button">
        <AIcon name="back" size={20} />
      </button>
      <h1>{title}</h1>
      <span className="head-spacer" />
    </header>
  );
}

function Row({
  icon,
  label,
  value,
  onClick,
}: {
  icon: AI;
  label: string;
  value?: string;
  onClick: () => void;
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
  );
}

function Switch({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <li>
      <button aria-checked={on} className="acc-row switch" onClick={() => onChange(!on)} role="switch" type="button">
        <span className="acc-row-text">
          <strong>{label}</strong>
          <small>{hint}</small>
        </span>
        <span className={`acc-switch ${on ? "on" : ""}`}>
          <i />
        </span>
      </button>
    </li>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div className="acc-toast" role="status">
      <AIcon name="check" size={16} strokeWidth={2.6} />
      {text}
    </div>
  );
}

/* ---------- main ---------- */

export type OrderOption = { id: string; label: string };

export default function AccountScreen({
  supportOrder,
  orderOptions,
  canUseAddress,
  onUseAddress,
  onBackToOrder,
  onNavHidden,
}: {
  supportOrder: string | null;
  orderOptions: OrderOption[];
  canUseAddress: boolean;
  onUseAddress: (address: string) => void;
  onBackToOrder: () => void;
  onNavHidden: (hidden: boolean) => void;
}) {
  const [page, setPage] = useState<Page>(supportOrder ? "help" : "home");
  const [editId, setEditId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);
  const [focusContact, setFocusContact] = useState(false);

  const profile = profileStore.use();
  const addresses = addressStore.use();
  const pay = payStore.use();
  const notif = notifStore.use();
  const privacy = privacyStore.use();

  useEffect(() => {
    onNavHidden(page === "profile" || page === "addressEdit");
    return () => onNavHidden(false);
  }, [page]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const go = (p: Page) => setPage(p);
  const initials = profile.name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const Avatar = ({ big }: { big?: boolean }) => (
    <span className={`acc-avatar ${big ? "big" : ""}`} aria-hidden="true">
      {profile.photo ? <img alt="" src={profile.photo} /> : initials}
    </span>
  );

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
            <strong>{profile.name}</strong>
            <small>{profile.phone}</small>
          </span>
          <button className="text-button" onClick={() => go("profile")} type="button">
            Chỉnh sửa
          </button>
        </div>

        <h2 className="conv-section">Tài khoản</h2>
        <ul className="acc-list">
          <Row icon="user" label="Thông tin cá nhân" onClick={() => go("profile")} />
          <Row icon="pin" label="Địa chỉ đã lưu" onClick={() => go("addresses")} value={`${addresses.length}`} />
          <Row
            icon="card"
            label="Phương thức thanh toán"
            onClick={() => go("payment")}
            value={pay === "cash" ? "Tiền mặt" : "Ví điện tử"}
          />
        </ul>

        <h2 className="conv-section">Ưu đãi</h2>
        <ul className="acc-list">
          <Row icon="tag" label="Ưu đãi của tôi" onClick={() => go("offers")} value="2" />
        </ul>

        <h2 className="conv-section">Hỗ trợ</h2>
        <ul className="acc-list">
          <Row icon="help" label="Trung tâm trợ giúp" onClick={() => go("help")} />
          <Row
            icon="phone"
            label="Liên hệ hỗ trợ"
            onClick={() => {
              setFocusContact(true);
              go("help");
            }}
          />
        </ul>

        <h2 className="conv-section">Cài đặt</h2>
        <ul className="acc-list">
          <Row icon="bell" label="Thông báo" onClick={() => go("notifications")} />
          <Row icon="shield" label="Quyền riêng tư & bảo mật" onClick={() => go("privacy")} />
        </ul>

        <button className="acc-logout" onClick={() => setConfirmOut(true)} type="button">
          <AIcon name="logout" size={18} />
          Đăng xuất
        </button>
        <p className="acc-version">Phiên bản 1.0</p>
        {toast && <Toast text={toast} />}

        {confirmOut && (
          <div className="acc-scrim" onClick={() => setConfirmOut(false)}>
            <div aria-modal="true" className="acc-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
              <strong>Đăng xuất khỏi tài khoản?</strong>
              <p>Bạn có thể đăng nhập lại bất cứ lúc nào bằng số điện thoại.</p>
              <div>
                <button className="secondary-button" onClick={() => setConfirmOut(false)} type="button">
                  Hủy
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setConfirmOut(false);
                    go("signedout");
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
    );
  }

  if (page === "signedout") {
    return (
      <section className="orders-screen account-screen">
        <div className="acc-empty">
          <span className="acc-empty-icon">
            <AIcon name="user" size={28} />
          </span>
          <strong>Bạn đã đăng xuất</strong>
          <p>Đăng nhập lại để tiếp tục đặt xe và xem đơn hàng.</p>
          <button className="primary-button" onClick={() => go("home")} type="button">
            <span>Đăng nhập lại</span>
          </button>
        </div>
      </section>
    );
  }

  if (page === "profile") {
    return (
      <ProfileForm
        Avatar={Avatar}
        onBack={() => go("home")}
        onSaved={() => {
          setToast("Đã lưu thay đổi");
          go("home");
        }}
        toast={toast}
      />
    );
  }

  if (page === "addresses") {
    return (
      <section className="orders-screen account-screen">
        <SubHead onBack={() => go("home")} title="Địa chỉ đã lưu" />
        <ul className="acc-list addr">
          {addresses.map((a) => (
            <li className="addr-item" key={a.id}>
              <span className={`addr-icon ${a.type}`}>
                <AIcon name={a.type === "home" ? "home" : a.type === "work" ? "building" : "pin"} size={19} />
              </span>
              <span className="addr-copy">
                <strong>{labelOf(a)}</strong>
                <small>{a.address}</small>
                {canUseAddress && (
                  <button className="text-button" onClick={() => onUseAddress(a.address)} type="button">
                    Giao đến đây
                  </button>
                )}
              </span>
              <button
                aria-label={`Sửa địa chỉ ${labelOf(a)}`}
                className="acc-edit"
                onClick={() => {
                  setEditId(a.id);
                  go("addressEdit");
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
            setEditId(null);
            go("addressEdit");
          }}
          type="button"
        >
          <AIcon name="plus" size={18} strokeWidth={2.2} />
          Thêm địa chỉ
        </button>
        {toast && <Toast text={toast} />}
      </section>
    );
  }

  if (page === "addressEdit") {
    return (
      <AddressForm
        existing={addresses.find((a) => a.id === editId) ?? null}
        onBack={() => go("addresses")}
        onDone={(msg) => {
          setToast(msg);
          go("addresses");
        }}
      />
    );
  }

  if (page === "payment") {
    const methods = [
      { id: "cash" as const, icon: "cash" as AI, name: "Tiền mặt", hint: "Trả cho tài xế khi nhận hàng" },
      { id: "wallet" as const, icon: "wallet" as AI, name: "Ví điện tử", hint: "Đã liên kết · ••• 678" },
    ];
    return (
      <section className="orders-screen account-screen">
        <SubHead onBack={() => go("home")} title="Phương thức thanh toán" />
        <ul className="acc-list">
          {methods.map((m) => (
            <li key={m.id}>
              <button
                aria-pressed={pay === m.id}
                className="acc-row"
                onClick={() => {
                  payStore.set(m.id);
                  setToast("Đã đổi phương thức mặc định");
                }}
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
        <p className="acc-note">Phương thức mặc định sẽ được chọn sẵn cho các đơn mới.</p>
        {toast && <Toast text={toast} />}
      </section>
    );
  }

  if (page === "notifications") {
    return (
      <section className="orders-screen account-screen">
        <SubHead onBack={() => go("home")} title="Thông báo" />
        <ul className="acc-list">
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
      </section>
    );
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
    );
  }

  if (page === "offers") {
    return (
      <section className="orders-screen account-screen">
        <SubHead onBack={() => go("home")} title="Ưu đãi của tôi" />
        <ul className="acc-list">
          {[
            { code: "GIAO30", text: "Giảm 30.000đ cho đơn từ 150.000đ", exp: "Hết hạn 30/10" },
            { code: "VANMOI", text: "Giảm 15% cuốc Xe van đầu tháng", exp: "Hết hạn 05/11" },
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
    );
  }

  return (
    <HelpPage
      focusContact={focusContact}
      onBack={supportOrder ? onBackToOrder : () => go("home")}
      orderOptions={orderOptions}
      supportOrder={supportOrder}
    />
  );
}

/* ---------- profile form ---------- */

function ProfileForm({
  Avatar,
  onBack,
  onSaved,
  toast,
}: {
  Avatar: (p: { big?: boolean }) => ReactNode;
  onBack: () => void;
  onSaved: () => void;
  toast: string;
}) {
  const p = profileStore.get();
  const [name, setName] = useState(p.name);
  const [email, setEmail] = useState(p.email);
  const [photo, setPhoto] = useState(p.photo);
  const fileRef = useRef<HTMLInputElement>(null);
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const dirty = name !== p.name || email !== p.email || photo !== p.photo;
  const valid = name.trim().length > 1 && emailOk;

  return (
    <section className="orders-screen account-screen form">
      <SubHead onBack={onBack} title="Thông tin cá nhân" />
      <div className="acc-photo">
        <span className="acc-avatar big" aria-hidden="true">
          {photo ? <img alt="" src={photo} /> : name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </span>
        <span>
          <strong>Ảnh đại diện</strong>
          <button className="text-button" onClick={() => fileRef.current?.click()} type="button">
            Đổi ảnh
          </button>
        </span>
        <input
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPhoto(URL.createObjectURL(f));
          }}
          ref={fileRef}
          type="file"
        />
      </div>

      <label className="acc-field">
        <span>Họ và tên</span>
        <input autoComplete="name" onChange={(e) => setName(e.target.value)} value={name} />
      </label>
      <label className="acc-field readonly">
        <span>Số điện thoại</span>
        <input readOnly value={p.phone} />
        <small>Đã xác minh · Liên hệ hỗ trợ nếu cần đổi số</small>
      </label>
      <label className={`acc-field ${email && !emailOk ? "invalid" : ""}`}>
        <span>Email</span>
        <input autoComplete="email" inputMode="email" onChange={(e) => setEmail(e.target.value)} value={email} />
        {email && !emailOk && <small className="err">Email chưa hợp lệ</small>}
      </label>

      <button
        className="primary-button acc-save"
        disabled={!dirty || !valid}
        onClick={() => {
          profileStore.set({ ...p, name: name.trim(), email: email.trim(), photo });
          onSaved();
        }}
        type="button"
      >
        <span>Lưu thay đổi</span>
      </button>
      {toast && <Toast text={toast} />}
    </section>
  );
}

/* ---------- address form ---------- */

function AddressForm({
  existing,
  onBack,
  onDone,
}: {
  existing: SavedAddress | null;
  onBack: () => void;
  onDone: (msg: string) => void;
}) {
  const [type, setType] = useState<SavedAddress["type"]>(existing?.type ?? "home");
  const [name, setName] = useState(existing?.name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const list = addressStore.get();

  const save = () => {
    if (!address.trim()) return;
    const next: SavedAddress = { id: existing?.id ?? Date.now(), type, name: type === "other" ? name : "", address: address.trim() };
    addressStore.set(existing ? list.map((a) => (a.id === existing.id ? next : a)) : [...list, next]);
    onDone(existing ? "Đã cập nhật địa chỉ" : "Đã thêm địa chỉ");
  };

  return (
    <section className="orders-screen account-screen form">
      <SubHead onBack={onBack} title={existing ? "Sửa địa chỉ" : "Thêm địa chỉ"} />
      <div className="filter-tabs acc-types" role="group" aria-label="Loại địa chỉ">
        {(["home", "work", "other"] as const).map((t) => (
          <button aria-pressed={type === t} className={type === t ? "on" : ""} key={t} onClick={() => setType(t)} type="button">
            {typeName[t]}
          </button>
        ))}
      </div>
      {type === "other" && (
        <label className="acc-field">
          <span>Tên gợi nhớ</span>
          <input onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Kho hàng" value={name} />
        </label>
      )}
      <label className="acc-field">
        <span>Địa chỉ đầy đủ</span>
        <input onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, quận" value={address} />
      </label>
      <button className="primary-button acc-save" disabled={!address.trim()} onClick={save} type="button">
        <span>Lưu địa chỉ</span>
      </button>
      {existing && (
        <button
          className="acc-danger"
          onClick={() => {
            addressStore.set(list.filter((a) => a.id !== existing.id));
            onDone("Đã xóa địa chỉ");
          }}
          type="button"
        >
          Xóa địa chỉ
        </button>
      )}
    </section>
  );
}

/* ---------- help ---------- */

const faqs = [
  { q: "Cách tính giá cước như thế nào?", a: "Giá dựa trên quãng đường, loại xe và phí dịch vụ. Bạn luôn thấy giá ước tính trước khi đặt." },
  { q: "Tôi có thể hủy đơn không?", a: "Bạn có thể hủy miễn phí trước khi tài xế đến điểm lấy hàng." },
  { q: "Hàng hóa nào không được vận chuyển?", a: "Hàng cấm, chất dễ cháy nổ và động vật sống không được nhận vận chuyển." },
  { q: "Khi nào tôi thanh toán?", a: "Với tiền mặt, bạn trả cho tài xế sau khi hàng được giao thành công." },
];
const issues = ["Tài xế đến trễ", "Hàng bị hư hỏng hoặc thất lạc", "Tính sai cước phí", "Vấn đề khác"];

function HelpPage({
  supportOrder,
  orderOptions,
  focusContact,
  onBack,
}: {
  supportOrder: string | null;
  orderOptions: OrderOption[];
  focusContact: boolean;
  onBack: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [orderId, setOrderId] = useState(supportOrder ?? "");
  const [sent, setSent] = useState("");
  const contactRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusContact) contactRef.current?.scrollIntoView({ block: "start" });
  }, [focusContact]);

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
            <button aria-expanded={open === i} className="acc-row faq" onClick={() => setOpen(open === i ? null : i)} type="button">
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
        <div className="acc-sent">
          <span className="acc-empty-icon ok">
            <AIcon name="check" size={22} strokeWidth={2.6} />
          </span>
          <strong>Đã gửi yêu cầu</strong>
          <p>
            Chúng tôi sẽ phản hồi về đơn {sent} trong vòng 15 phút.
          </p>
          <button
            className="text-button"
            onClick={() => {
              setSent("");
              setIssue(null);
            }}
            type="button"
          >
            Gửi yêu cầu khác
          </button>
        </div>
      ) : (
        <>
          {!supportOrder && (
            <label className="acc-field select">
              <span>Chọn đơn hàng</span>
              <select onChange={(e) => setOrderId(e.target.value)} value={orderId}>
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
                <button aria-pressed={issue === s} className="acc-row" onClick={() => setIssue(s)} type="button">
                  <span className="acc-row-label">{s}</span>
                  <span className={`acc-radio ${issue === s ? "on" : ""}`}>
                    <i />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button className="primary-button acc-save" disabled={!issue || !orderId} onClick={() => setSent(orderId)} type="button">
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
  );
}
