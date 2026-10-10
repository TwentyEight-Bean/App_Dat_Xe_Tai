import { useEffect, useState } from "react"
import { Icon, Status } from "./ui"
import { vnd } from "./data"

/* ── Types ── */
type PricingRule = {
  id: string
  vehicleTypeId: string
  basePrice: string
  baseDistanceKm: string
  pricePerKm: string
  vehicleCode: string
  vehicleName: string
  payloadCapacityKg: string
  dimensionsLxwxh: string | null
  createdAt: string
  updatedAt: string
}

type Surcharge = {
  id: string
  code: string
  name: string
  price: string
  description: string | null
  isActive: boolean
}

/* ── helpers ── */
const fmtVnd = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v
  if (isNaN(n)) return "—"
  return n.toLocaleString("vi-VN") + "đ"
}
const fmtKm = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v
  return isNaN(n) ? "—" : `${n} km`
}
const fmtWeight = (v: string) => {
  const n = parseFloat(v)
  if (isNaN(n)) return v
  return n >= 1000
    ? `${(n / 1000).toLocaleString("vi-VN")} tấn`
    : `${n.toLocaleString("vi-VN")} kg`
}

const vehicleIcons: Record<string, string> = {
  MOTORBIKE: "🏍️",
  VAN: "🚐",
  PICKUP: "🛻",
  TRUCK_500KG: "🚚",
  TRUCK_1T: "🚛",
  TRUCK_2T: "🚛",
  TRUCK_5T: "🚛",
  TRUCK_10T: "🚛",
}

/* ── API fetch wrapper ── */
async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer DEV_ADMIN_TOKEN",
      ...(opts?.headers ?? {}),
    },
  })
  const json = await res.json()
  if (!res.ok || json.success === false)
    throw new Error(json.message || "Lỗi API")
  return json.data as T
}

/* ── Inline Edit Modal ── */
function EditRuleModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: PricingRule
  onClose: () => void
  onSaved: () => void
}) {
  const [basePrice, setBasePrice] = useState(rule.basePrice)
  const [baseKm, setBaseKm] = useState(rule.baseDistanceKm)
  const [perKm, setPerKm] = useState(rule.pricePerKm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const save = async () => {
    setSaving(true)
    setErr("")
    try {
      await apiFetch(`/api/admin/pricing/rules/${rule.vehicleTypeId}`, {
        method: "PATCH",
        body: JSON.stringify({
          basePrice: parseFloat(basePrice),
          baseDistanceKm: parseFloat(baseKm),
          pricePerKm: parseFloat(perKm),
        }),
      })
      onSaved()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="scrim" role="presentation" onMouseDown={onClose}>
      <div
        className="modal glass"
        role="dialog"
        aria-label={`Sửa bảng giá ${rule.vehicleName}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pr-modal-ic">
          <span>{vehicleIcons[rule.vehicleCode] ?? "🚚"}</span>
        </div>
        <h3>Sửa bảng giá · {rule.vehicleName}</h3>
        <p>Cập nhật công thức tính cước vận chuyển cho loại xe này.</p>

        <div className="pr-form">
          <label className="pr-field">
            <span className="pr-label">Giá mở cửa (đ)</span>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              min={0}
              step={1000}
            />
            <small className="pr-hint">Cước khởi điểm cho mỗi chuyến đi</small>
          </label>
          <label className="pr-field">
            <span className="pr-label">Cự ly mở cửa (km)</span>
            <input
              type="number"
              value={baseKm}
              onChange={(e) => setBaseKm(e.target.value)}
              min={0}
              step={0.5}
            />
            <small className="pr-hint">Số km đã bao gồm trong giá mở cửa</small>
          </label>
          <label className="pr-field">
            <span className="pr-label">Giá mỗi km vượt (đ/km)</span>
            <input
              type="number"
              value={perKm}
              onChange={(e) => setPerKm(e.target.value)}
              min={0}
              step={500}
            />
            <small className="pr-hint">
              Phí tính thêm cho mỗi km vượt cự ly mở cửa
            </small>
          </label>
        </div>

        {err && <div className="pr-err">{err}</div>}

        <div className="pr-preview">
          <Icon name="route" size={14} />
          <span>
            Ví dụ 10 km:{" "}
            <b>
              {fmtVnd(
                parseFloat(basePrice) +
                  Math.max(0, 10 - parseFloat(baseKm)) * parseFloat(perKm),
              )}
            </b>
          </span>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={save}
          >
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Surcharge Edit Modal ── */
function EditSurchargeModal({
  item,
  onClose,
  onSaved, // null = create new
}: {
  item: Surcharge | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !item
  const [code, setCode] = useState(item?.code ?? "")
  const [name, setName] = useState(item?.name ?? "")
  const [price, setPrice] = useState(item?.price ?? "0")
  const [desc, setDesc] = useState(item?.description ?? "")
  const [active, setActive] = useState(item?.isActive ?? true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const save = async () => {
    setSaving(true)
    setErr("")
    try {
      if (isNew) {
        await apiFetch("/api/admin/pricing/surcharges", {
          method: "POST",
          body: JSON.stringify({
            code,
            name,
            price: parseFloat(price),
            description: desc,
          }),
        })
      } else {
        await apiFetch(`/api/admin/pricing/surcharges/${item!.code}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            price: parseFloat(price),
            description: desc,
            isActive: active,
          }),
        })
      }
      onSaved()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="scrim" role="presentation" onMouseDown={onClose}>
      <div
        className="modal glass"
        role="dialog"
        aria-label={isNew ? "Thêm phụ phí" : `Sửa phụ phí ${item!.name}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pr-modal-ic surcharge">
          <Icon name="layers" size={20} />
        </div>
        <h3>{isNew ? "Thêm phụ phí mới" : `Sửa phụ phí · ${item!.name}`}</h3>
        <p>
          {isNew
            ? "Tạo một loại phụ phí dịch vụ mới."
            : "Cập nhật thông tin phụ phí dịch vụ."}
        </p>

        <div className="pr-form">
          <label className="pr-field">
            <span className="pr-label">Mã phụ phí</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={!isNew}
              placeholder="VD: EXTRA_STOP"
            />
          </label>
          <label className="pr-field">
            <span className="pr-label">Tên hiển thị</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Điểm dừng thêm"
            />
          </label>
          <label className="pr-field">
            <span className="pr-label">Phí (đ)</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min={0}
              step={1000}
            />
          </label>
          <label className="pr-field">
            <span className="pr-label">Mô tả</span>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Mô tả ngắn (tùy chọn)"
            />
          </label>
          {!isNew && (
            <label className="pr-toggle">
              <span className="pr-label">Trạng thái</span>
              <button
                type="button"
                className={`pr-switch ${active ? "on" : ""}`}
                onClick={() => setActive(!active)}
                role="switch"
                aria-checked={active}
              >
                <span />
              </button>
              <small>{active ? "Đang hoạt động" : "Đã tắt"}</small>
            </label>
          )}
        </div>

        {err && <div className="pr-err">{err}</div>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !code.trim() || !name.trim()}
            onClick={save}
          >
            {saving ? "Đang lưu…" : isNew ? "Tạo phụ phí" : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_RULES: PricingRule[] = [
  {
    id: "p-500kg",
    vehicleTypeId: "v-500kg",
    basePrice: "150000",
    baseDistanceKm: "4.0",
    pricePerKm: "15000",
    vehicleCode: "TRUCK_500KG",
    vehicleName: "Xe Van 500kg",
    payloadCapacityKg: "500",
    dimensionsLxwxh: "1.7m x 1.2m x 1.2m",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-1ton",
    vehicleTypeId: "v-1ton",
    basePrice: "200000",
    baseDistanceKm: "4.0",
    pricePerKm: "17000",
    vehicleCode: "TRUCK_1T",
    vehicleName: "Xe tải 1 tấn",
    payloadCapacityKg: "1000",
    dimensionsLxwxh: "3.0m x 1.6m x 1.7m",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-2ton-thungkin",
    vehicleTypeId: "v-2ton-thungkin",
    basePrice: "280000",
    baseDistanceKm: "4.0",
    pricePerKm: "21000",
    vehicleCode: "TRUCK_2T",
    vehicleName: "Xe tải 2 tấn (Thùng kín)",
    payloadCapacityKg: "2000",
    dimensionsLxwxh: "4.3m x 1.8m x 1.8m",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-2ton-muibat",
    vehicleTypeId: "v-2ton-muibat",
    basePrice: "280000",
    baseDistanceKm: "4.0",
    pricePerKm: "21000",
    vehicleCode: "TRUCK_2T",
    vehicleName: "Xe tải 2 tấn (Mui bạt)",
    payloadCapacityKg: "2000",
    dimensionsLxwxh: "4.3m x 1.8m x 1.9m",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-5ton",
    vehicleTypeId: "v-5ton",
    basePrice: "450000",
    baseDistanceKm: "4.0",
    pricePerKm: "28000",
    vehicleCode: "TRUCK_5T",
    vehicleName: "Xe tải 5 tấn",
    payloadCapacityKg: "5000",
    dimensionsLxwxh: "6.0m x 2.2m x 2.2m",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const DEFAULT_SURCHARGES: Surcharge[] = [
  {
    id: "s-loading-floor",
    code: "LOADING_FLOOR",
    name: "Bốc xếp tầng trệt",
    description:
      "Tài xế hỗ trợ bốc xếp hàng hóa lên/xuống xe tại tầng trệt (bán kính dưới 10m)",
    price: "50000",
    isActive: true,
  },
  {
    id: "s-loading-stairs",
    code: "LOADING_STAIRS",
    name: "Bốc xếp lầu / thang bộ",
    description:
      "Khuân vác hàng hóa lên/xuống cầu thang bộ (không có thang máy)",
    price: "100000",
    isActive: true,
  },
  {
    id: "s-extra-helper",
    code: "EXTRA_HELPER",
    name: "Thêm 1 người bốc xếp theo xe",
    description:
      "Bố trí thêm 1 phụ xe đi cùng hỗ trợ bốc xếp các kiện hàng cồng kềnh",
    price: "200000",
    isActive: true,
  },
  {
    id: "s-night-surcharge",
    code: "NIGHT_SURCHARGE",
    name: "Phụ phí ban đêm (22:00 - 06:00)",
    description: "Phụ thu chạy xe và giao hàng khung giờ đêm",
    price: "20000",
    isActive: true,
  },
  {
    id: "s-extra-stop",
    code: "EXTRA_STOP",
    name: "Thêm điểm giao hàng phụ",
    description:
      "Dừng thêm 1 điểm trên cùng tuyến đường (bán kính lệch dưới 5km)",
    price: "35000",
    isActive: true,
  },
]

/* ── Main Pricing Page ── */
export default function Pricing() {
  const [tab, setTab] = useState<"rules" | "surcharges">("rules")
  const [rules, setRules] = useState<PricingRule[]>([])
  const [surcharges, setSurcharges] = useState<Surcharge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editRule, setEditRule] = useState<PricingRule | null>(null)
  const [editSurcharge, setEditSurcharge] = useState<Surcharge | null | "new">(
    null,
  )

  const fetchAll = async () => {
    setLoading(true)
    setError("")
    try {
      const [r, s] = await Promise.all([
        apiFetch<PricingRule[]>("/api/pricing/rules"),
        apiFetch<Surcharge[]>("/api/pricing/services"),
      ])
      setRules(r.length > 0 ? r : DEFAULT_RULES)
      setSurcharges(s.length > 0 ? s : DEFAULT_SURCHARGES)
    } catch (e: any) {
      console.warn(
        "Pricing API fetch failed, loading default fallback data:",
        e.message,
      )
      setRules(DEFAULT_RULES)
      setSurcharges(DEFAULT_SURCHARGES)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const refresh = () => {
    setEditRule(null)
    setEditSurcharge(null)
    fetchAll()
  }

  const activeSurcharges = surcharges.filter((s) => s.isActive).length

  return (
    <div className="page pricing-page">
      <div className="page-head">
        <div>
          <h1>Bảng giá</h1>
          <p>Quản lý cước vận chuyển và phụ phí dịch vụ</p>
        </div>
        <div className="h-row">
          {tab === "surcharges" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditSurcharge("new")}
            >
              <Icon name="layers" size={14} />
              Thêm phụ phí
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={fetchAll}
            disabled={loading}
          >
            <Icon name="clock" size={14} />
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="pr-stats">
        <div className="pr-stat-card">
          <div className="pr-stat-ic blue">
            <Icon name="truck" size={18} />
          </div>
          <div>
            <b>{rules.length}</b>
            <small>Loại xe</small>
          </div>
        </div>
        <div className="pr-stat-card">
          <div className="pr-stat-ic green">
            <Icon name="layers" size={18} />
          </div>
          <div>
            <b>{activeSurcharges}</b>
            <small>Phụ phí hoạt động</small>
          </div>
        </div>
        <div className="pr-stat-card">
          <div className="pr-stat-ic amber">
            <Icon name="wallet" size={18} />
          </div>
          <div>
            <b>20%</b>
            <small>Hoa hồng sàn</small>
          </div>
        </div>
        <div className="pr-stat-card">
          <div className="pr-stat-ic sky">
            <Icon name="route" size={18} />
          </div>
          <div>
            <b>OSRM</b>
            <small>Tính khoảng cách</small>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="pr-tabs">
        <div className="seg">
          <button
            type="button"
            className={tab === "rules" ? "on" : ""}
            onClick={() => setTab("rules")}
          >
            <Icon name="truck" size={14} />
            Cước vận chuyển
          </button>
          <button
            type="button"
            className={tab === "surcharges" ? "on" : ""}
            onClick={() => setTab("surcharges")}
          >
            <Icon name="layers" size={14} />
            Phụ phí dịch vụ
            {activeSurcharges > 0 && (
              <span className="seg-badge">{activeSurcharges}</span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="pr-error panel pad">
          <Icon name="alert" size={16} />
          <span>{error}</span>
          <button type="button" className="btn btn-sm" onClick={fetchAll}>
            Thử lại
          </button>
        </div>
      )}

      {/* Rules tab */}
      {tab === "rules" && (
        <div className="pr-grid">
          {loading && rules.length === 0 && (
            <div className="pr-loading">
              <div className="pr-spinner" />
              <span>Đang tải bảng giá…</span>
            </div>
          )}
          {rules.map((r) => (
            <div className="pr-card panel" key={r.id}>
              <div className="pr-card-head">
                <span className="pr-vehicle-icon">
                  {vehicleIcons[r.vehicleCode] ?? "🚚"}
                </span>
                <div className="pr-card-title">
                  <strong>{r.vehicleName}</strong>
                  <small>
                    {fmtWeight(r.payloadCapacityKg)}
                    {r.dimensionsLxwxh ? ` · ${r.dimensionsLxwxh}` : ""}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setEditRule(r)}
                >
                  Sửa giá
                </button>
              </div>

              <div className="pr-card-body">
                <div className="pr-metric">
                  <div className="pr-metric-label">
                    <Icon name="wallet" size={13} />
                    Giá mở cửa
                  </div>
                  <b className="pr-metric-val blue">{fmtVnd(r.basePrice)}</b>
                </div>
                <div className="pr-metric">
                  <div className="pr-metric-label">
                    <Icon name="route" size={13} />
                    Cự ly mở cửa
                  </div>
                  <b className="pr-metric-val">{fmtKm(r.baseDistanceKm)}</b>
                </div>
                <div className="pr-metric">
                  <div className="pr-metric-label">
                    <Icon name="pin" size={13} />
                    Giá mỗi km vượt
                  </div>
                  <b className="pr-metric-val green">{fmtVnd(r.pricePerKm)}</b>
                </div>
              </div>

              <div className="pr-card-foot">
                <div className="pr-example">
                  <small>Ước tính 10 km:</small>
                  <b>
                    {fmtVnd(
                      parseFloat(r.basePrice) +
                        Math.max(0, 10 - parseFloat(r.baseDistanceKm)) *
                          parseFloat(r.pricePerKm),
                    )}
                  </b>
                </div>
                <div className="pr-example">
                  <small>Ước tính 25 km:</small>
                  <b>
                    {fmtVnd(
                      parseFloat(r.basePrice) +
                        Math.max(0, 25 - parseFloat(r.baseDistanceKm)) *
                          parseFloat(r.pricePerKm),
                    )}
                  </b>
                </div>
              </div>
            </div>
          ))}
          {!loading && rules.length === 0 && !error && (
            <div className="pr-empty panel pad">
              <Icon name="truck" size={28} />
              <strong>Chưa có bảng giá nào</strong>
              <p>Hãy thiết lập bảng giá cho các loại xe tải.</p>
            </div>
          )}
        </div>
      )}

      {/* Surcharges tab */}
      {tab === "surcharges" && (
        <section className="panel">
          <div className="table-wrap">
            <table className="dtable roomy">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên phụ phí</th>
                  <th>Mô tả</th>
                  <th className="num">Phí</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && surcharges.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      Đang tải phụ phí…
                    </td>
                  </tr>
                )}
                {surcharges.map((s) => (
                  <tr key={s.id} className={!s.isActive ? "pr-inactive" : ""}>
                    <td>
                      <b className="code">{s.code}</b>
                    </td>
                    <td>
                      <b>{s.name}</b>
                    </td>
                    <td>
                      <span className="muted">{s.description || "—"}</span>
                    </td>
                    <td className="num">
                      <b>{fmtVnd(s.price)}</b>
                    </td>
                    <td>
                      <Status tone={s.isActive ? "green" : "gray"}>
                        {s.isActive ? "Hoạt động" : "Đã tắt"}
                      </Status>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setEditSurcharge(s)}
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && surcharges.length === 0 && !error && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      Chưa có phụ phí nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>
              Tổng: <b>{surcharges.length}</b> phụ phí ·{" "}
              <b>{activeSurcharges}</b> đang hoạt động
            </span>
          </div>
        </section>
      )}

      {/* Pricing formula explanation */}
      <section className="pr-formula panel pad">
        <div className="pr-formula-head">
          <Icon name="wallet" size={16} />
          <strong>Công thức tính cước</strong>
        </div>
        <div className="pr-formula-body">
          <div className="pr-formula-eq">
            <span className="pr-tag blue">Giá mở cửa</span>
            <span className="pr-op">+</span>
            <span className="pr-tag green">km vượt × Đơn giá/km</span>
            <span className="pr-op">+</span>
            <span className="pr-tag amber">Σ phụ phí</span>
            <span className="pr-op">=</span>
            <span className="pr-tag result">Tổng cước</span>
          </div>
          <div className="pr-formula-note">
            <small>
              Hoa hồng sàn: <b>20%</b> cước vận chuyển · Tài xế nhận: <b>80%</b>{" "}
              cước + <b>100%</b> phụ phí bốc xếp
            </small>
          </div>
        </div>
      </section>

      {/* Edit modals */}
      {editRule && (
        <EditRuleModal
          rule={editRule}
          onClose={() => setEditRule(null)}
          onSaved={refresh}
        />
      )}
      {editSurcharge && (
        <EditSurchargeModal
          item={editSurcharge === "new" ? null : editSurcharge}
          onClose={() => setEditSurcharge(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}
