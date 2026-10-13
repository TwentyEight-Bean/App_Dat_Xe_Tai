import { useState, useEffect } from "react"
import { Icon, Status, Avatar } from "./ui"
import { vnd } from "./data"

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

export interface AccountingData {
  timeframe: {
    startDate: string | null
    endDate: string | null
  }
  kpis: {
    grossRevenue: number
    platformCommission: number
    driverNetEarnings: number
    totalTrips: number
    completedTrips: number
    cancelledTrips: number
    completionRate: number
  }
  paymentBreakdown: {
    method: string
    count: number
    amount: number
    percentage: number
  }[]
  vehicleBreakdown: {
    vehicleTypeId: string
    vehicleName: string
    trips: number
    revenue: number
    percentage: number
  }[]
  topDrivers: {
    driverId: string
    userId: string
    fullName: string
    phone: string
    licensePlate: string
    completedTrips: number
    grossRevenue: number
    platformCommission: number
  }[]
  dailyTrends: {
    date: string
    trips: number
    grossRevenue: number
    platformCommission: number
  }[]
}

type DatePreset = "today" | "7days" | "30days" | "month" | "all"

export default function Accounting() {
  const [data, setData] = useState<AccountingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [preset, setPreset] = useState<DatePreset>("30days")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [paymentFilter, setPaymentFilter] = useState<string>("ALL")
  const [error, setError] = useState<string | null>(null)

  const computeDates = (p: DatePreset) => {
    const now = new Date()
    if (p === "today") {
      const d = now.toISOString().split("T")[0]
      return { start: d, end: d }
    }
    if (p === "7days") {
      const past = new Date(now.getTime() - 7 * 86400000)
      return { start: past.toISOString().split("T")[0], end: now.toISOString().split("T")[0] }
    }
    if (p === "30days") {
      const past = new Date(now.getTime() - 30 * 86400000)
      return { start: past.toISOString().split("T")[0], end: now.toISOString().split("T")[0] }
    }
    if (p === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: start.toISOString().split("T")[0], end: now.toISOString().split("T")[0] }
    }
    return { start: "", end: "" }
  }

  const loadData = async (p: DatePreset, customStart?: string, customEnd?: string) => {
    setLoading(true)
    setError(null)
    try {
      const dates = customStart !== undefined ? { start: customStart, end: customEnd || "" } : computeDates(p)
      const params = new URLSearchParams()
      if (dates.start) params.set("startDate", dates.start)
      if (dates.end) params.set("endDate", dates.end)
      if (paymentFilter !== "ALL") params.set("paymentMethod", paymentFilter)

      const queryStr = params.toString() ? `?${params.toString()}` : ""
      const res = await apiFetch<AccountingData>(`/api/v1/accounting/dashboard${queryStr}`)
      setData(res)
    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu kế toán")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(preset)
  }, [preset, paymentFilter])

  const handleExportExcel = async () => {
    setExporting(true)
    try {
      const dates = startDate ? { start: startDate, end: endDate } : computeDates(preset)
      const params = new URLSearchParams()
      if (dates.start) params.set("startDate", dates.start)
      if (dates.end) params.set("endDate", dates.end)
      if (paymentFilter !== "ALL") params.set("paymentMethod", paymentFilter)

      const queryStr = params.toString() ? `?${params.toString()}` : ""
      const res = await fetch(`/api/v1/accounting/export-excel${queryStr}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_auth_token") || "DEV_ADMIN_TOKEN"}`,
        },
      })
      if (!res.ok) throw new Error("Xuất Excel thất bại")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const dateTag = new Date().toISOString().split("T")[0]
      a.download = `Bao_Cao_Ke_Toan_${dateTag}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      alert("Lỗi xuất Excel: " + err.message)
    } finally {
      setExporting(false)
    }
  }

  const kpis = data?.kpis || {
    grossRevenue: 0,
    platformCommission: 0,
    driverNetEarnings: 0,
    totalTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
    completionRate: 0,
  }

  return (
    <div className="a-page" style={{ padding: "24px 32px" }}>
      {/* Top Header & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text, #111827)" }}>
            Báo Cáo Kế Toán & Doanh Thu
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Theo dõi dòng tiền cước xe, 20% chiết khấu hoa hồng sàn và 80% thu nhập đối tác tài xế
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={exporting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#107c41",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            cursor: exporting ? "not-allowed" : "pointer",
            boxShadow: "0 2px 6px rgba(16, 124, 65, 0.25)",
            transition: "all 0.15s ease",
          }}
        >
          <Icon name="file" size={18} />
          {exporting ? "Đang xuất file Excel..." : "XUẤT BÁO CÁO EXCEL (.XLSX)"}
        </button>
      </div>

      {/* Filter Bar */}
      <div
        className="glass"
        style={{
          padding: "14px 20px",
          borderRadius: 12,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* Preset buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(
            [
              { id: "today", label: "Hôm nay" },
              { id: "7days", label: "7 ngày qua" },
              { id: "30days", label: "30 ngày qua" },
              { id: "month", label: "Tháng này" },
              { id: "all", label: "Toàn bộ" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setPreset(item.id)
                setStartDate("")
                setEndDate("")
              }}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                border: preset === item.id ? "1px solid #2563eb" : "1px solid #d1d5db",
                backgroundColor: preset === item.id ? "#eff6ff" : "#fff",
                color: preset === item.id ? "#2563eb" : "#4b5563",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Payment Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Hình thức TT:</label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 13,
              outline: "none",
            }}
          >
            <option value="ALL">Tất cả phương thức</option>
            <option value="CASH">Tiền mặt (CASH)</option>
            <option value="VNPAY">Cổng VNPay</option>
            <option value="MOMO">Ví MoMo</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* 4 Financial KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Card 1: Gross Revenue */}
        <div
          className="glass"
          style={{
            padding: 20,
            borderRadius: 12,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>
            <span>Tổng Doanh Thu Cước</span>
            <span style={{ padding: 6, borderRadius: 8, backgroundColor: "#eff6ff", color: "#2563eb" }}>
              <Icon name="orders" size={16} />
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", margin: "10px 0 4px" }}>
            {loading ? "..." : `${vnd(kpis.grossRevenue)}`}
          </div>
          <div style={{ fontSize: 12, color: "#10b981", fontWeight: 500 }}>
            Gross Merchandise Value (GMV)
          </div>
        </div>

        {/* Card 2: 20% Platform Commission */}
        <div
          className="glass"
          style={{
            padding: 20,
            borderRadius: 12,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>
            <span>Hoa Hồng Sàn (20%)</span>
            <span style={{ padding: 6, borderRadius: 8, backgroundColor: "#ecfdf5", color: "#059669" }}>
              <Icon name="shield" size={16} />
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#059669", margin: "10px 0 4px" }}>
            {loading ? "..." : `${vnd(kpis.platformCommission)}`}
          </div>
          <div style={{ fontSize: 12, color: "#059669", fontWeight: 500 }}>
            Doanh thu thực sàn được giữ
          </div>
        </div>

        {/* Card 3: 80% Driver Net */}
        <div
          className="glass"
          style={{
            padding: 20,
            borderRadius: 12,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>
            <span>Thu Nhập Tài Xế (80%)</span>
            <span style={{ padding: 6, borderRadius: 8, backgroundColor: "#fef3c7", color: "#d97706" }}>
              <Icon name="drivers" size={16} />
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#d97706", margin: "10px 0 4px" }}>
            {loading ? "..." : `${vnd(kpis.driverNetEarnings)}`}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Thu nhập ròng của đối tác tài xế
          </div>
        </div>

        {/* Card 4: Trips & Completion */}
        <div
          className="glass"
          style={{
            padding: 20,
            borderRadius: 12,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#6b7280", fontSize: 13, fontWeight: 500 }}>
            <span>Số Chuyến & Tỷ Lệ Xong</span>
            <span style={{ padding: 6, borderRadius: 8, backgroundColor: "#f3e8ff", color: "#9333ea" }}>
              <Icon name="truck" size={16} />
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", margin: "10px 0 4px" }}>
            {loading ? "..." : `${kpis.completedTrips} / ${kpis.totalTrips}`}
          </div>
          <div style={{ fontSize: 12, color: "#9333ea", fontWeight: 600 }}>
            Tỷ lệ hoàn thành: {loading ? "..." : `${kpis.completionRate}%`}
          </div>
        </div>
      </div>

      {/* Row 2: Payment & Vehicle Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* Payment breakdown */}
        <div
          className="glass"
          style={{
            padding: 20,
            borderRadius: 12,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px", color: "#111827" }}>
            Tỷ Trọng Theo Phương Thức Thanh Toán
          </h2>
          {(!data?.paymentBreakdown || data.paymentBreakdown.length === 0) ? (
            <p style={{ color: "#9ca3af", fontSize: 14 }}>Chưa có dữ liệu</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.paymentBreakdown.map((item) => (
                <div key={item.method}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#374151" }}>
                      {item.method === "CASH" ? "💵 Tiền mặt (CASH)" : item.method === "VNPAY" ? "💳 Cổng VNPay" : item.method === "MOMO" ? "👛 Ví MoMo" : item.method}
                    </span>
                    <span style={{ color: "#6b7280" }}>
                      {vnd(item.amount)} ({item.percentage}%)
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 8, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${item.percentage}%`,
                        backgroundColor: item.method === "CASH" ? "#10b981" : item.method === "VNPAY" ? "#2563eb" : "#d946ef",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vehicle breakdown */}
        <div
          className="glass"
          style={{
            padding: 20,
            borderRadius: 12,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px", color: "#111827" }}>
            Tỷ Trọng Doanh Thu Theo Loại Xe
          </h2>
          {(!data?.vehicleBreakdown || data.vehicleBreakdown.length === 0) ? (
            <p style={{ color: "#9ca3af", fontSize: 14 }}>Chưa có dữ liệu</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.vehicleBreakdown.map((item) => (
                <div key={item.vehicleTypeId}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#374151" }}>{item.vehicleName} ({item.trips} cuốc)</span>
                    <span style={{ color: "#6b7280" }}>{vnd(item.revenue)} ({item.percentage}%)</span>
                  </div>
                  <div style={{ width: "100%", height: 8, backgroundColor: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${item.percentage}%`,
                        backgroundColor: "#f59e0b",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Top 10 Drivers */}
      <div
        className="glass"
        style={{
          padding: 20,
          borderRadius: 12,
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px", color: "#111827" }}>
          Top 10 Tài Xế Đạt Doanh Thu Cao Nhất
        </h2>
        {(!data?.topDrivers || data.topDrivers.length === 0) ? (
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Chưa có cuốc xe nào hoàn thành trong kỳ lọc này</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
                  <th style={{ padding: "10px 12px" }}>Hạng</th>
                  <th style={{ padding: "10px 12px" }}>Tài xế</th>
                  <th style={{ padding: "10px 12px" }}>Biển số</th>
                  <th style={{ padding: "10px 12px" }}>Cuốc hoàn thành</th>
                  <th style={{ padding: "10px 12px" }}>Tổng doanh thu</th>
                  <th style={{ padding: "10px 12px" }}>Hoa hồng 20% đã nộp</th>
                </tr>
              </thead>
              <tbody>
                {data.topDrivers.map((driver, idx) => (
                  <tr key={driver.driverId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px", fontWeight: 700, color: idx < 3 ? "#f59e0b" : "#6b7280" }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 600, color: "#111827" }}>{driver.fullName}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{driver.phone}</div>
                    </td>
                    <td style={{ padding: "12px", fontFamily: "monospace", fontWeight: 600 }}>
                      {driver.licensePlate || "Chưa có"}
                    </td>
                    <td style={{ padding: "12px", fontWeight: 600, color: "#059669" }}>
                      {driver.completedTrips} cuốc
                    </td>
                    <td style={{ padding: "12px", fontWeight: 700, color: "#111827" }}>
                      {vnd(driver.grossRevenue)}
                    </td>
                    <td style={{ padding: "12px", fontWeight: 600, color: "#2563eb" }}>
                      {vnd(driver.platformCommission)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
