import { useState, useEffect } from "react"

import { Icon, Status, Avatar } from "./ui"

import {
  pending as mockPending,
  activeDrivers as mockActive,
  type DocState,
  type Pending,
} from "./data"

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,

    headers: {
      "Content-Type": "application/json",

      Authorization: `Bearer ${localStorage.getItem("admin_auth_token") || "DEV_ADMIN_TOKEN"}`,

      ...(opts?.headers ?? {}),
    },
  })

  const json = await res.json()

  if (!res.ok || json.success === false)
    throw new Error(json.message || "Lỗi API")

  return json.data as T
}

export type Decision = { res: "approved" | "rejected" reason?: string }

const docMeta = [
  { label: "CCCD", hint: "Căn cước công dân", icon: "user" as const },

  { label: "GPLX", hint: "Giấy phép lái xe", icon: "file" as const },

  { label: "Đăng ký xe", hint: "Cà vẹt phương tiện", icon: "truck" as const },

  {
    label: "Ảnh xác thực",

    hint: "Ảnh chụp khuôn mặt",

    icon: "shield" as const,
  },
]

const stateLabel: Record<DocState, string> = {
  none: "Chưa kiểm tra",

  ok: "Hợp lệ",

  review: "Cần xem lại",
}

const stateTone: Record<DocState, "gray" | "green" | "amber"> = {
  none: "gray",

  ok: "green",

  review: "amber",
}

export function DocPreview({ idx, d }: { idx: number; d: Pending }) {
  const customUrl = (d as any).docUrls?.[idx]
  if (customUrl) {
    return (
      <div
        style={{
          width: "100%",
          height: "230px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          borderRadius: "10px",
          overflow: "hidden",
          padding: "8px",
        }}
      >
        <img
          src={customUrl}
          alt={docMeta[idx]?.label || "Ảnh tài liệu"}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: "6px",
          }}
        />
      </div>
    )
  }

  if (idx === 3)
    return (
      <svg
        viewBox="0 0 360 230"
        className="doc-svg"
        role="img"
        aria-label="Ảnh xác thực khuôn mặt"
      >
        <rect width="360" height="230" rx="10" fill="#dfe9ed" />
        <circle cx="180" cy="100" r="46" fill="#f1d9c3" />
        <path d="M86 230c0-48 42-70 94-70s94 22 94 70Z" fill="#6f8ea6" />
        <path d="M138 86c6-30 78-30 84 0-14-10-70-10-84 0Z" fill="#3b3a3a" />
        <circle cx="164" cy="104" r="3.4" fill="#3b3a3a" />
        <circle cx="196" cy="104" r="3.4" fill="#3b3a3a" />
        <path
          d="M168 124q12 9 24 0"
          stroke="#a5705a"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <g fill="none" stroke="#1478d4" strokeWidth="3" strokeLinecap="round">
          <path
            d="M110 50V34h16M250 34h-16M110 170v16h16M250 186h-16"
            transform="translate(-4 -4) scale(1.03)"
          />
        </g>
        <rect x="118" y="196" width="124" height="22" rx="11" fill="#19a96b" />
        <text
          x="180"
          y="211"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#fff"
        >
          {d.docNums[3]}
        </text>
      </svg>
    )

  const theme = [
    ["#dcebf3", "#1478d4", "CĂN CƯỚC CÔNG DÂN"],

    ["#f3ead6", "#b57a0b", "GIẤY PHÉP LÁI XE"],

    ["#e4e8df", "#4a7a5c", "GIẤY ĐĂNG KÝ XE"],
  ][idx]

  return (
    <svg
      viewBox="0 0 360 230"
      className="doc-svg"
      role="img"
      aria-label={docMeta[idx].hint}
    >
      <rect width="360" height="230" rx="10" fill={theme[0]} />
      <rect
        x="0"
        y="0"
        width="360"
        height="40"
        rx="10"
        fill={theme[1]}
        opacity=".9"
      />
      <text
        x="20"
        y="25"
        fontSize="12"
        fontWeight="700"
        letterSpacing="1.5"
        fill="#fff"
      >
        {theme[2]}
      </text>
      {idx === 2 ? (
        <>
          <rect
            x="24"
            y="62"
            width="150"
            height="54"
            rx="8"
            fill="#fff"
            stroke="#2a3a2f"
            strokeWidth="3"
          />
          <text
            x="99"
            y="98"
            textAnchor="middle"
            fontSize="23"
            fontWeight="800"
            fill="#1f2a24"
          >
            {d.plate}
          </text>
          <g fill="#2a3a2f" opacity=".55">
            <rect x="196" y="66" width="130" height="7" rx="3" />
            <rect x="196" y="84" width="100" height="7" rx="3" />
            <rect x="196" y="102" width="118" height="7" rx="3" />
          </g>
          <text x="24" y="146" fontSize="11" fill="#55605a">
            Nhãn hiệu
          </text>
          <text x="24" y="164" fontSize="14" fontWeight="700" fill="#1f2a24">
            {d.brand}
          </text>
          <text x="196" y="146" fontSize="11" fill="#55605a">
            Chủ xe
          </text>
          <text x="196" y="164" fontSize="14" fontWeight="700" fill="#1f2a24">
            {d.name}
          </text>
        </>
      ) : (
        <>
          <rect
            x="24"
            y="60"
            width="86"
            height="108"
            rx="8"
            fill="#fff"
            opacity=".85"
          />
          <circle cx="67" cy="98" r="18" fill="#c7d6de" />
          <path d="M36 168c0-24 14-34 31-34s31 10 31 34Z" fill="#c7d6de" />
          <text x="128" y="78" fontSize="10" fill="#55606a">
            Họ và tên
          </text>
          <text x="128" y="96" fontSize="15" fontWeight="800" fill="#1b2630">
            {d.name.toUpperCase()}
          </text>
          <text x="128" y="122" fontSize="10" fill="#55606a">
            Ngày sinh
          </text>
          <text x="128" y="138" fontSize="13" fontWeight="700" fill="#1b2630">
            {d.dob}
          </text>
          <text x="128" y="162" fontSize="10" fill="#55606a">
            Số
          </text>
          <text
            x="128"
            y="178"
            fontSize="14"
            fontWeight="800"
            letterSpacing="1"
            fill="#1b2630"
          >
            {d.docNums[idx].split(" ")[0]}
          </text>
        </>
      )}
      <g fill="#1b2630" opacity=".16">
        <rect x="24" y="196" width="312" height="6" rx="3" />
        <rect x="24" y="210" width="220" height="6" rx="3" />
      </g>
    </svg>
  )
}

export default function Drivers({
  decided,

  setDecided,

  focus,

  tab,

  setTab,
}: {
  decided: Record<string, Decision>

  setDecided: (
    f: (p: Record<string, Decision>) => Record<string, Decision>,
  ) => void

  focus?: string

  tab: "review" | "all"

  setTab: (t: "review" | "all") => void
}) {
  const [dbPending, setDbPending] = useState<any[]>([])

  const [dbActive, setDbActive] = useState<any[]>([])

  useEffect(() => {
    // Fetch pending
    apiFetch<any>("/api/v1/admin/drivers/kyc-pending?page=1&limit=50")
      .then((res) => {
        const data = Array.isArray(res) ? res : (res?.data || res?.drivers || [])
        const mapped = data.map((d: any) => {
          const nameParts = (d.driverName || "Tài xế").split(" ")

          const initials =
            nameParts.length > 1
              ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
              : nameParts[0].substring(0, 2)

          return {
            id: d.id.split("-")[0].toUpperCase(),

            rawId: d.id,

            name: d.driverName,

            initials: initials.toUpperCase(),

            phone: d.phone,

            vehicle: d.vehicleType?.name || "Chưa chọn xe",

            plate: d.licensePlate || "Chưa có",

            submitted: new Date(d.submittedAt).toLocaleDateString("vi-VN"),

            area: "Chưa xác định",

            dob: "Chưa cập nhật",

            docs0: ["none", "none", "none", "none"] as DocState[],

            docNums: ["---", "---", "---", "---"],

            brand: "N/A",
          }
        })

        setDbPending(mapped)
      })

      .catch((e) => {
        console.error(e)

        setDbPending([])
      })

    // Fetch active

    apiFetch<any[]>("/api/admin/drivers?kycStatus=APPROVED")

      .then((data) => {
        const mapped = data.map((d) => {
          const nameParts = (d.driverName || "Tài xế").split(" ")

          const initials =
            nameParts.length > 1
              ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
              : nameParts[0].substring(0, 2)

          return {
            id: d.id.split("-")[0].toUpperCase(),

            rawId: d.id,

            name: d.driverName,

            initials: initials.toUpperCase(),

            phone: d.phone,

            vehicle: d.vehicleType?.name || "Chưa chọn xe",

            rating: d.ratingAvg || "5.0",

            trips: Math.floor(Math.random() * 500),

            isActive: d.isActive !== false,

            status:
              d.isActive === false
                ? "Đã khóa"
                : d.isOnline
                  ? "Đang trực tuyến"
                  : "Ngoại tuyến",

            tone:
              d.isActive === false
                ? "amber"
                : d.isOnline
                  ? "green"
                  : "gray",

            date: new Date(d.submittedAt).toLocaleDateString("vi-VN"),
          }
        })

        setDbActive(mapped)
      })

      .catch((e) => {
        console.error(e)

        setDbActive([])
      })
  }, [])

  const pendingList = dbPending

  const activeList = dbActive

  const [sel, setSel] = useState(focus ?? pendingList[0]?.id)

  const [docs, setDocs] = useState<Record<string, DocState[]>>(() =>
    Object.fromEntries(pendingList.map((p) => [p.id, p.docs0])),
  )

  const [doc, setDoc] = useState(0)

  const [reject, setReject] = useState(false)

  const [reason, setReason] = useState("")

  const d = pendingList.find((p) => p.id === sel) ?? pendingList[0]

  useEffect(() => {
    if (!d?.rawId) return
    apiFetch<any>(`/api/admin/drivers/${d.rawId}`)
      .then((detail) => {
        if (detail && Array.isArray(detail.documents)) {
          const docMap: Record<string, string> = {}
          const docNumMap: Record<string, string> = {}
          detail.documents.forEach((docItem: any) => {
            docMap[docItem.docType] = docItem.fileUrl
            docNumMap[docItem.docType] = docItem.docNumber
          })
          const docUrls = [
            docMap["CCCD_FRONT"] || "",
            docMap["CCCD_BACK"] || "",
            docMap["DRIVER_LICENSE"] || "",
            docMap["PORTRAIT"] || docMap["VEHICLE_REGISTRATION"] || "",
          ]
          const docNums = [
            docNumMap["CCCD_FRONT"] || docNumMap["CCCD_BACK"] || "---",
            docNumMap["CCCD_BACK"] || "---",
            docNumMap["DRIVER_LICENSE"] || detail.driverLicenseNo || "---",
            docNumMap["VEHICLE_REGISTRATION"] || detail.licensePlate || "---",
          ]
          setDbPending((prev) =>
            prev.map((item) =>
              item.rawId === d.rawId
                ? {
                    ...item,
                    docUrls,
                    docNums,
                    plate: detail.licensePlate || item.plate,
                    vehicle: detail.vehicleType?.name || item.vehicle,
                  }
                : item,
            ),
          )
        }
      })
      .catch((err) =>
        console.warn("Could not load driver KYC detail:", err),
      )
  }, [sel, d?.rawId])

  const ds = docs[d?.id] || ["none", "none", "none", "none"]

  const dec = decided[d?.id]

  const checked = ds.filter((s) => s !== "none").length

  const waiting = pendingList.filter((p) => !decided[p.id])

  const next = waiting.find((p) => p.id !== d?.id)

  const setDocState = (s: DocState) => {
    if (!d) return

    setDocs((p) => ({
      ...p,

      [d.id]: p[d.id]?.map((x, i) => (i === doc ? s : x)) || [],
    }))

    if (s === "ok" && doc < 3) setDoc(doc + 1)
  }

  const pick = (id: string) => {
    setSel(id)

    setDoc(0)
  }

  const handleApprove = async () => {
    try {
      if ((d as any).rawId) {
        await apiFetch(`/api/v1/admin/drivers/${(d as any).rawId}/kyc/approve`, {
          method: "POST",
        })
      }

      setDecided((p) => ({ ...p, [d.id]: { res: "approved" } }))
    } catch (e: any) {
      alert("Lỗi phê duyệt: " + e.message)
    }
  }

  const handleReject = async () => {
    try {
      if ((d as any).rawId) {
        await apiFetch(`/api/v1/admin/drivers/${(d as any).rawId}/kyc/reject`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        })
      }

      setDecided((p) => ({ ...p, [d.id]: { res: "rejected", reason } }))

      setReject(false)

      setReason("")
    } catch (e: any) {
      alert("Lỗi từ chối: " + e.message)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tài xế</h1>
          <p>
            {tab === "review"
              ? "Duyệt hồ sơ liên tục, không cần quay lại danh sách"
              : "Toàn bộ đối tác tài xế đang hoạt động trên hệ thống"}
          </p>
        </div>
        <div className="seg">
          <button
            type="button"
            className={tab === "review" ? "on" : ""}
            onClick={() => setTab("review")}
          >
            Chờ duyệt<span className="seg-badge">{waiting.length}</span>
          </button>
          <button
            type="button"
            className={tab === "all" ? "on" : ""}
            onClick={() => setTab("all")}
          >
            Tất cả tài xế
          </button>
        </div>
      </div>

      {tab === "review" ? (
        <div className="review">
          <aside className="rq panel">
            <div className="rq-head">
              Hàng đợi hồ sơ<span>{waiting.length} chờ duyệt</span>
            </div>
            <ul>
              {pendingList.map((p) => {
                const n = docs[p.id]?.filter((s) => s !== "none").length || 0

                const pd = decided[p.id]

                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`rq-item ${sel === p.id ? "is-sel" : ""} ${
                        pd ? "is-done" : ""
                      }`}
                      onClick={() => pick(p.id)}
                    >
                      <Avatar initials={p.initials} size={34} />
                      <span className="rq-main">
                        <strong>{p.name}</strong>
                        <small>
                          {p.vehicle} · {p.submitted}
                        </small>
                        <span className="prog">
                          <i
                            style={{ width: `${(n / 4) * 100}%` }}
                            className={n === 4 ? "full" : ""}
                          />
                        </span>
                      </span>
                      {pd ? (
                        <Status tone={pd.res === "approved" ? "green" : "red"}>
                          {pd.res === "approved" ? "Đã duyệt" : "Từ chối"}
                        </Status>
                      ) : (
                        <span className="prog-n">{n}/4</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          {!d ? (
            <section
              className="rv panel empty-state"
              style={{
                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                color: "#666",
              }}
            >
              <p>Không có hồ sơ nào chờ duyệt lúc này.</p>
            </section>
          ) : (
            <section className="rv panel">
              <header className="rv-head">
                <Avatar initials={d.initials} size={44} />
                <div className="rv-id">
                  <h2>{d.name}</h2>
                  <p>
                    Mã hồ sơ {d.id} · Gửi {d.submitted}
                  </p>
                </div>
                {dec ? (
                  <Status tone={dec.res === "approved" ? "green" : "red"}>
                    {dec.res === "approved" ? "Đã phê duyệt" : "Đã từ chối"}
                  </Status>
                ) : (
                  <Status tone="amber">Chờ duyệt</Status>
                )}
              </header>
              <dl className="rv-info">
                <div>
                  <dt>Điện thoại</dt>
                  <dd>{d.phone}</dd>
                </div>
                <div>
                  <dt>Khu vực</dt>
                  <dd>{d.area}</dd>
                </div>
                <div>
                  <dt>Ngày sinh</dt>
                  <dd>{d.dob}</dd>
                </div>
                <div>
                  <dt>Phương tiện</dt>
                  <dd>
                    {d.vehicle} · {d.plate}
                  </dd>
                </div>
              </dl>

              <div className="rv-body">
                <ul className="doc-list" aria-label="Giấy tờ">
                  {docMeta.map((m, i) => (
                    <li key={m.label}>
                      <button
                        type="button"
                        className={`doc-item ${doc === i ? "is-sel" : ""}`}
                        onClick={() => setDoc(i)}
                      >
                        <span className="doc-ic">
                          <Icon name={m.icon} size={16} />
                        </span>
                        <span className="doc-txt">
                          <strong>{m.label}</strong>
                          <small>{d.docNums[i]}</small>
                        </span>
                        <span
                          className={`doc-state s-${ds[i]}`}
                          title={stateLabel[ds[i]]}
                        >
                          {ds[i] === "ok" ? (
                            <Icon name="check" size={11} />
                          ) : ds[i] === "review" ? (
                            "!"
                          ) : (
                            ""
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="viewer">
                  <div className="viewer-bar">
                    <div>
                      <strong>{docMeta[doc].label}</strong>
                      <small>{docMeta[doc].hint}</small>
                    </div>
                    <Status tone={stateTone[ds[doc]]}>
                      {stateLabel[ds[doc]]}
                    </Status>
                  </div>
                  <div className="viewer-stage">
                    <DocPreview idx={doc} d={d} />
                  </div>
                  <div
                    className="verify"
                    role="radiogroup"
                    aria-label="Kết quả kiểm tra"
                  >
                    {(["none", "ok", "review"] as DocState[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={ds[doc] === s}
                        className={`v-${s} ${ds[doc] === s ? "on" : ""}`}
                        onClick={() => setDocState(s)}
                        disabled={!!dec}
                      >
                        {s === "ok" && <Icon name="check" size={13} />}
                        {stateLabel[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <footer className="rv-foot">
                {dec ? (
                  <>
                    <div className={`result ${dec.res}`}>
                      <Icon
                        name={dec.res === "approved" ? "check" : "close"}
                        size={15}
                      />
                      {dec.res === "approved"
                        ? "Tài khoản đã được kích hoạt và tài xế đã nhận thông báo."
                        : `Đã từ chối: ${dec.reason}`}
                    </div>
                    {next && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => pick(next.id)}
                      >
                        Hồ sơ tiếp theo
                        <Icon name="arrow" size={14} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rv-count">
                      <b>{checked}/4</b> giấy tờ đã kiểm tra
                      {ds.includes("review") && (
                        <span className="warn-text"> · có mục cần xem lại</span>
                      )}
                    </div>
                    <div className="rv-actions">
                      <button
                        type="button"
                        className="btn btn-danger-o"
                        onClick={() => setReject(true)}
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleApprove}
                      >
                        <Icon name="check" size={15} />
                        Phê duyệt tài xế
                      </button>
                    </div>
                  </>
                )}
              </footer>
            </section>
          )}
        </div>
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table className="dtable roomy">
              <thead>
                <tr>
                  <th>Tài xế</th>
                  <th>Điện thoại</th>
                  <th>Phương tiện</th>
                  <th>Đánh giá</th>
                  <th className="num">Số cuốc</th>
                  <th>Trạng thái</th>
                  <th>Tham gia</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pendingList

                  .filter(
                    (p) => !decided[p.id] || decided[p.id].res === "approved",
                  )

                  .map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => {
                        pick(p.id)

                        setTab("review")
                      }}
                    >
                      <td>
                        <div className="who">
                          <Avatar initials={p.initials} />
                          <div>
                            <strong>{p.name}</strong>
                            <small>{p.id}</small>
                          </div>
                        </div>
                      </td>
                      <td>{p.phone}</td>
                      <td>
                        {p.vehicle} · {p.plate}
                      </td>
                      <td className="muted">—</td>
                      <td className="num">0</td>
                      <td>
                        <Status tone={decided[p.id] ? "green" : "amber"}>
                          {decided[p.id] ? "Đang hoạt động" : "Chờ duyệt"}
                        </Status>
                      </td>
                      <td className="muted">Hôm nay</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ fontSize: "12px", padding: "3px 8px" }}
                          onClick={(e) => {
                            e.stopPropagation()
                            pick(p.id)
                            setTab("review")
                          }}
                        >
                          Duyệt hồ sơ
                        </button>
                      </td>
                    </tr>
                  ))}
                {activeList.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="who">
                        <Avatar
                          initials={a.initials}
                          tone={a.tone === "amber" ? "amber" : undefined}
                        />
                        <div>
                          <strong>{a.name}</strong>
                          <small>{a.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>{a.phone}</td>
                    <td>{a.vehicle}</td>
                    <td>
                      <span className="rating">
                        <Icon name="star" size={13} />
                        {a.rating}
                      </span>
                    </td>
                    <td className="num">
                      <b>{a.trips}</b>
                    </td>
                    <td>
                      <Status tone={a.tone}>{a.status}</Status>
                    </td>
                    <td className="muted">{a.date}</td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          a.isActive === false ? "btn-primary" : "btn-danger-o"
                        }`}
                        style={{
                          fontSize: "12px",
                          padding: "3px 8px",
                          color: a.isActive === false ? undefined : "#ef4444",
                          borderColor:
                            a.isActive === false ? undefined : "#fca5a5",
                        }}
                        onClick={async (e) => {
                          e.stopPropagation()
                          const targetActive = a.isActive === false
                          const msg = targetActive
                            ? `Kích hoạt lại tài xế ${a.name}?`
                            : `Khóa tài khoản tài xế ${a.name}? Tài xế sẽ không thể nhận cuốc xe mới.`
                          if (!window.confirm(msg)) return
                          try {
                            const rawId = (a as any).rawId || a.id
                            await apiFetch(
                              `/api/admin/drivers/${rawId}/status`,
                              {
                                method: "PATCH",
                                body: JSON.stringify({
                                  isActive: targetActive,
                                }),
                              },
                            )
                            setDbActive((prev) =>
                              prev.map((item) =>
                                item.id === a.id
                                  ? {
                                      ...item,
                                      isActive: targetActive,
                                      status: targetActive
                                        ? "Đang trực tuyến"
                                        : "Đã khóa",
                                      tone: targetActive ? "green" : "amber",
                                    }
                                  : item,
                              ),
                            )
                          } catch (err: any) {
                            alert("Lỗi cập nhật trạng thái: " + err.message)
                          }
                        }}
                      >
                        {a.isActive === false ? "Mở khóa" : "Khóa"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>
              Hiển thị {activeList.length + pendingList.length} trong tổng số
              tài xế
            </span>
          </div>
        </section>
      )}

      {reject && (
        <div
          className="scrim"
          role="presentation"
          onMouseDown={() => setReject(false)}
        >
          <div
            className="modal glass"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-ic">
              <Icon name="alert" size={20} />
            </div>
            <h3>Từ chối hồ sơ của {d.name}?</h3>
            <p>Lý do sẽ được gửi tới tài xế để họ cập nhật và nộp lại hồ sơ.</p>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Ảnh CCCD mờ, không đọc được số…"
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setReject(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!reason.trim()}
                onClick={handleReject}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
