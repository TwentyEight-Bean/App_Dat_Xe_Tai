import { useState, useEffect, useMemo } from "react"
import { Icon, Avatar, Status } from "./ui"
import Complaints from "./Complaints"
import { type Complaint } from "./data"

export type DriverRatingItem = {
  id: string
  rating: number
  tags: string[]
  comment: string | null
  createdAt: string
  bookingId: string
  bookingCode: string
  originAddress: string
  destinationAddress: string
  totalPrice: number | string
  driverId: string
  licensePlate: string
  driverRatingAvg: number | string
  vehicleTypeName: string
  driverName: string
  driverPhone: string
  driverAvatar: string | null
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  customerAvatar: string | null
}

export type RatingSummary = {
  totalRatings: number
  avgRating: number
  distribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
}

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
  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Lỗi API")
  }
  return json as T
}

export default function RatingsAndComplaints({
  complaints,
  setComplaints,
  complaintsFocus,
  openOrder,
  initialTab = "ratings",
}: {
  complaints: Complaint[]
  setComplaints: (f: (p: Complaint[]) => Complaint[]) => void
  complaintsFocus?: string
  openOrder: (id: string) => void
  initialTab?: "ratings" | "complaints"
}) {
  const [activeTab, setActiveTab] = useState<"ratings" | "complaints">(initialTab)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  // Ratings State
  const [ratings, setRatings] = useState<DriverRatingItem[]>([])
  const [summary, setSummary] = useState<RatingSummary>({
    totalRatings: 0,
    avgRating: 5.0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [starFilter, setStarFilter] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchRatings = async () => {
    setLoading(true)
    setError("")
    try {
      const q = new URLSearchParams()
      if (starFilter !== null) q.append("rating", starFilter.toString())
      if (search.trim()) q.append("search", search.trim())
      q.append("page", page.toString())
      q.append("limit", "15")

      const res = await apiFetch<any>(`/api/v1/admin/ratings?${q.toString()}`)
      if (res.data) setRatings(res.data)
      if (res.summary) setSummary(res.summary)
      if (res.pagination?.totalPages) setTotalPages(res.pagination.totalPages)
    } catch (err: any) {
      console.warn("Lỗi tải danh sách đánh giá tài xế:", err.message)
      setError(err.message || "Không thể tải danh sách đánh giá")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "ratings") {
      fetchRatings()
    }
  }, [activeTab, starFilter, page])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchRatings()
  }

  const satisfactionRate = useMemo(() => {
    const total = summary.totalRatings
    if (!total) return 100
    const high = (summary.distribution[5] || 0) + (summary.distribution[4] || 0)
    return Math.round((high / total) * 100)
  }, [summary])

  const lowRatingCount = useMemo(() => {
    return (
      (summary.distribution[1] || 0) +
      (summary.distribution[2] || 0) +
      (summary.distribution[3] || 0)
    )
  }, [summary])

  const newComplaintsCount = complaints.filter((c) => c.status === "Mới").length

  return (
    <div className="page" style={{ paddingBottom: 48 }}>
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span>Đánh Giá & Khiếu Nại</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 8,
                background: "rgba(37, 99, 235, 0.1)",
                color: "#2563eb",
              }}
            >
              Chất lượng dịch vụ
            </span>
          </h1>
          <p>
            {activeTab === "ratings"
              ? "Toàn bộ đánh giá, nhận xét (Feedback & Reviews) của khách hàng về tài xế"
              : "Tiếp nhận khiếu nại, sự cố chuyến đi và trao đổi hỗ trợ khách hàng"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="seg">
          <button
            type="button"
            className={activeTab === "ratings" ? "on" : ""}
            onClick={() => setActiveTab("ratings")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="star" size={14} />
            <span>Đánh giá tài xế</span>
            <span className="seg-badge">{summary.totalRatings || ratings.length}</span>
          </button>
          <button
            type="button"
            className={activeTab === "complaints" ? "on" : ""}
            onClick={() => setActiveTab("complaints")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="alert" size={14} />
            <span>Khiếu nại</span>
            {newComplaintsCount > 0 && (
              <span className="seg-badge" style={{ background: "#fee2e2", color: "#dc2626" }}>
                {newComplaintsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === "ratings" ? (
        <div>
          {/* KPI Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 14,
              marginBottom: 18,
            }}
          >
            {/* Metric 1: Avg Rating */}
            <div
              className="panel pad"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #fefce8 100%)",
                border: "1px solid #fef08a",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#854d0e" }}>
                  ⭐ Điểm trung bình toàn sàn
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "#fef9c3",
                    color: "#a16207",
                  }}
                >
                  {summary.avgRating >= 4.5 ? "Rất tốt" : "Đạt chuẩn"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                <strong style={{ fontSize: 28, fontWeight: 900, color: "#713f12" }}>
                  {summary.avgRating}
                </strong>
                <span style={{ fontSize: 14, color: "#a16207", fontWeight: 700 }}>/ 5.0 ★</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "#854d0e" }}>
                Dựa trên {summary.totalRatings} lượt đánh giá thực tế
              </div>
            </div>

            {/* Metric 2: Total Reviews */}
            <div className="panel pad">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                💬 Tổng lượt đánh giá
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                <strong style={{ fontSize: 28, fontWeight: 900, color: "var(--ink)" }}>
                  {summary.totalRatings}
                </strong>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>lượt</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--muted)" }}>
                {summary.distribution[5] || 0} lượt đạt 5 sao hoàn hảo
              </div>
            </div>

            {/* Metric 3: High Satisfaction % */}
            <div
              className="panel pad"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
                border: "1px solid #bbf7d0",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "#166534" }}>
                👍 Tỷ lệ hài lòng (4 - 5 sao)
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                <strong style={{ fontSize: 28, fontWeight: 900, color: "#15803d" }}>
                  {satisfactionRate}%
                </strong>
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: "#166534" }}>
                {(summary.distribution[5] || 0) + (summary.distribution[4] || 0)} lượt phản hồi tích cực
              </div>
            </div>

            {/* Metric 4: Low Rating Alert */}
            <div
              className="panel pad"
              style={{
                background: lowRatingCount > 0 ? "linear-gradient(135deg, #ffffff 0%, #fff1f2 100%)" : undefined,
                border: lowRatingCount > 0 ? "1px solid #fecdd3" : undefined,
                cursor: lowRatingCount > 0 ? "pointer" : "default",
              }}
              onClick={() => {
                if (lowRatingCount > 0) {
                  setStarFilter(3)
                  setPage(1)
                }
              }}
              title="Bấm để lọc các đánh giá ≤ 3 sao"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: lowRatingCount > 0 ? "#9f1239" : "var(--muted)" }}>
                  ⚠️ Cần chú ý (≤ 3 sao)
                </span>
                {lowRatingCount > 0 && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 99,
                      background: "#ffe4e6",
                      color: "#e11d48",
                    }}
                  >
                    Xem ngay
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                <strong
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: lowRatingCount > 0 ? "#be123c" : "var(--ink)",
                  }}
                >
                  {lowRatingCount}
                </strong>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>đánh giá</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 11.5, color: lowRatingCount > 0 ? "#9f1239" : "var(--muted)" }}>
                {lowRatingCount > 0 ? "Tài xế cần được hỗ trợ & nhắc nhở" : "Không có phản hồi tiêu cực"}
              </div>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div
            className="panel"
            style={{
              padding: "12px 16px",
              marginBottom: 16,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            {/* Star Filter Chips */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginRight: 4 }}>
                Lọc sao:
              </span>
              <button
                type="button"
                className={`btn btn-sm ${starFilter === null ? "btn-primary" : ""}`}
                onClick={() => {
                  setStarFilter(null)
                  setPage(1)
                }}
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: starFilter === null ? "none" : "1px solid var(--line)",
                  background: starFilter === null ? "var(--blue)" : "#fff",
                }}
              >
                Tất cả ({summary.totalRatings})
              </button>
              {[5, 4, 3, 2, 1].map((s) => {
                const count = summary.distribution[s as keyof typeof summary.distribution] || 0
                const isSelected = starFilter === s
                return (
                  <button
                    key={s}
                    type="button"
                    className={`btn btn-sm ${isSelected ? "btn-primary" : ""}`}
                    onClick={() => {
                      setStarFilter(isSelected ? null : s)
                      setPage(1)
                    }}
                    style={{
                      fontSize: 12,
                      padding: "5px 12px",
                      borderRadius: 20,
                      border: isSelected ? "none" : "1px solid var(--line)",
                      background: isSelected ? "#f59e0b" : "#fff",
                      color: isSelected ? "#fff" : "var(--ink)",
                      fontWeight: 600,
                    }}
                  >
                    <span>{s} ★</span>
                    <small style={{ marginLeft: 4, opacity: isSelected ? 0.9 : 0.7 }}>
                      ({count})
                    </small>
                  </button>
                )
              })}
            </div>

            {/* Search Input */}
            <form
              onSubmit={handleSearchSubmit}
              style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 280 }}
            >
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  placeholder="Tìm tài xế, khách, mã chuyến xe..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 12px 7px 30px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    fontSize: 12.5,
                    outline: "none",
                    background: "#fff",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 9,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                  }}
                >
                  <Icon name="search" size={14} />
                </span>
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("")
                      setPage(1)
                    }}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      padding: 2,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-sm"
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Tìm
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  setStarFilter(null)
                  setPage(1)
                  fetchRatings()
                }}
                className="btn btn-sm"
                title="Làm mới danh sách"
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "#fff",
                }}
              >
                🔄
              </button>
            </form>
          </div>

          {/* Ratings Table */}
          <section className="panel" style={{ overflow: "hidden" }}>
            <div className="table-wrap">
              <table className="dtable roomy" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ width: 130 }}>Cuốc xe</th>
                    <th style={{ width: 220 }}>Tài xế được đánh giá</th>
                    <th style={{ width: 170 }}>Khách hàng</th>
                    <th style={{ width: 130 }}>Đánh giá</th>
                    <th style={{ width: 220 }}>Thẻ nhận xét (Tags)</th>
                    <th>Nội dung góp ý của khách</th>
                    <th style={{ width: 140 }}>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && ratings.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)" }}>
                        Đang tải danh sách đánh giá...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px 16px", color: "#dc2626" }}>
                        ⚠️ {error}
                      </td>
                    </tr>
                  ) : ratings.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "48px 16px", color: "var(--muted)" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
                        <strong style={{ fontSize: 14, color: "var(--ink)", display: "block", marginBottom: 4 }}>
                          Không có đánh giá nào phù hợp
                        </strong>
                        <small>Thử thay đổi bộ lọc sao hoặc từ khóa tìm kiếm</small>
                      </td>
                    </tr>
                  ) : (
                    ratings.map((item) => {
                      const driverInitials = item.driverName
                        ? item.driverName.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase()
                        : "TX"
                      const customerInitials = item.customerName
                        ? item.customerName.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase()
                        : "KH"

                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                          {/* 1. Cuốc xe */}
                          <td>
                            <div>
                              <button
                                type="button"
                                onClick={() => openOrder(item.bookingId || item.bookingCode)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  color: "#2563eb",
                                  fontWeight: 800,
                                  fontSize: 12.5,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  textDecoration: "underline",
                                }}
                              >
                                {item.bookingCode}
                              </button>
                              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                {Number(item.totalPrice).toLocaleString("vi-VN")}đ
                              </div>
                            </div>
                          </td>

                          {/* 2. Tài xế */}
                          <td>
                            <div className="who" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <Avatar initials={driverInitials} size={34} />
                              <div>
                                <strong style={{ fontSize: 13, color: "var(--ink)" }}>{item.driverName}</strong>
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                  {item.driverPhone} · {item.licensePlate}
                                </div>
                                <div style={{ fontSize: 10.5, color: "#166534", fontWeight: 700, marginTop: 1 }}>
                                  {item.vehicleTypeName} (⭐ {item.driverRatingAvg || "5.0"})
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 3. Khách hàng */}
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar initials={customerInitials} size={28} />
                              <div>
                                <strong style={{ fontSize: 12.5, color: "var(--ink)" }}>
                                  {item.customerName || "Khách vãng lai"}
                                </strong>
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                  {item.customerPhone || "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 4. Số sao */}
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 16, color: "#f59e0b", letterSpacing: 1 }}>
                                {"★".repeat(item.rating)}
                                <span style={{ opacity: 0.25 }}>{"★".repeat(5 - item.rating)}</span>
                              </span>
                              <strong
                                style={{
                                  fontSize: 12.5,
                                  color: item.rating >= 4 ? "#15803d" : item.rating === 3 ? "#b45309" : "#dc2626",
                                  fontWeight: 800,
                                }}
                              >
                                {item.rating}.0
                              </strong>
                            </div>
                          </td>

                          {/* 5. Thẻ nhận xét (Tags) */}
                          <td>
                            {item.tags && item.tags.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {item.tags.map((t, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 600,
                                      padding: "2px 7px",
                                      borderRadius: 12,
                                      background: "#eff6ff",
                                      color: "#1d4ed8",
                                      border: "1px solid #bfdbfe",
                                    }}
                                  >
                                    ✓ {t}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: 11.5 }}>—</span>
                            )}
                          </td>

                          {/* 6. Lời nhắn khách hàng */}
                          <td>
                            {item.comment ? (
                              <div
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  background: "#f8fafc",
                                  border: "1px solid #e2e8f0",
                                  fontSize: 12,
                                  color: "#1e293b",
                                  lineHeight: 1.4,
                                  maxWidth: 380,
                                }}
                              >
                                "{item.comment}"
                              </div>
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: 11.5, fontStyle: "italic" }}>
                                Không có lời nhắn
                              </span>
                            )}
                          </td>

                          {/* 7. Thời gian */}
                          <td style={{ fontSize: 11.5, color: "var(--muted)" }}>
                            {new Date(item.createdAt).toLocaleString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 18px",
                  borderTop: "1px solid var(--line-soft)",
                  background: "#f8fafc",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Trang {page} / {totalPages} ({summary.totalRatings} đánh giá)
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    style={{ fontSize: 12, padding: "4px 10px" }}
                  >
                    ← Trang trước
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    style={{ fontSize: 12, padding: "4px 10px" }}
                  >
                    Trang sau →
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : (
        /* Sub Tab 2: Khiếu nại khách hàng */
        <Complaints
          items={complaints}
          setItems={setComplaints}
          focus={complaintsFocus}
          openOrder={openOrder}
        />
      )}
    </div>
  )
}
