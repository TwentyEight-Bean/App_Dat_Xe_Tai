import { useState, useEffect } from "react"
import { Icon, Status } from "./ui"

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
  return json as T
}

export interface CronSystemStatus {
  success: boolean
  data: {
    status: string
    currentTime: string
    timezone: string
    jobs: {
      blockLowRatingDrivers: {
        name: string
        schedule: string
        description: string
        lastRunAt: string | null
        lastRunStatus: string | null
        processedCount?: number
      }
      databaseBackup: {
        name: string
        schedule: string
        description: string
        lastRunAt: string | null
        lastRunStatus: string | null
        lastBackupFile?: string
      }
    }
    recentBackups: {
      filename: string
      sizeBytes: number
      createdAt: string
      path?: string
    }[]
  }
}

export default function SystemCron() {
  const [cronData, setCronData] = useState<CronSystemStatus["data"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Trigger states
  const [triggeringBlock, setTriggeringBlock] = useState(false)
  const [ratingThreshold, setRatingThreshold] = useState("4.0")
  const [minTrips, setMinTrips] = useState("5")

  const [triggeringBackup, setTriggeringBackup] = useState(false)
  const [keepDays, setKeepDays] = useState("7")

  // Webhook Simulator States
  const [webhookTesting, setWebhookTesting] = useState(false)
  const [webhookLog, setWebhookLog] = useState<string | null>(null)
  const [vnpayTxnRef, setVnpayTxnRef] = useState(
    "VNPAY_TEST_" + Date.now().toString().slice(-6),
  )
  const [momoOrderId, setMomoOrderId] = useState(
    "MOMO_TEST_" + Date.now().toString().slice(-6),
  )

  const handleTestVnpayIpn = async () => {
    setWebhookTesting(true)
    setWebhookLog(null)
    try {
      const url = `/api/v1/payments/vnpay-ipn?vnp_TxnRef=${vnpayTxnRef}&vnp_ResponseCode=00&vnp_Amount=50000000&vnp_BankCode=NCB&vnp_OrderInfo=Nap+tien+thu+nghiem`
      const res = await fetch(url)
      const data = await res.json()
      setWebhookLog(
        `[VNPay IPN Callback 200 OK]:\n${JSON.stringify(data, null, 2)}`,
      )
    } catch (err: any) {
      setWebhookLog(`[Lỗi gọi VNPay IPN]: ${err.message}`)
    } finally {
      setWebhookTesting(false)
    }
  }

  const handleTestMomoIpn = async () => {
    setWebhookTesting(true)
    setWebhookLog(null)
    try {
      const res = await fetch("/api/v1/payments/momo-ipn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: momoOrderId,
          requestId: momoOrderId,
          amount: 200000,
          resultCode: 0,
          message: "Giao dịch thành công.",
          transId: "9988776655",
          extraData: "",
        }),
      })
      const data = await res.json()
      setWebhookLog(
        `[MoMo IPN Webhook 200 OK]:\n${JSON.stringify(data, null, 2)}`,
      )
    } catch (err: any) {
      setWebhookLog(`[Lỗi gọi MoMo IPN]: ${err.message}`)
    } finally {
      setWebhookTesting(false)
    }
  }

  const handleTestStringeeScco = async () => {
    setWebhookTesting(true)
    setWebhookLog(null)
    try {
      const res = await fetch(
        "/api/v1/calls/answer-url?from=0912345678&to=19008888",
      )
      const data = await res.json()
      setWebhookLog(
        `[Stringee SCCO Call Script 200 OK]:\n${JSON.stringify(data, null, 2)}`,
      )
    } catch (err: any) {
      setWebhookLog(`[Lỗi gọi Stringee Answer URL]: ${err.message}`)
    } finally {
      setWebhookTesting(false)
    }
  }

  const handleTestVnpayReturn = async () => {
    setWebhookTesting(true)
    setWebhookLog(null)
    try {
      const url = `/api/v1/payments/vnpay-return?vnp_TxnRef=${encodeURIComponent(
        vnpayTxnRef,
      )}&vnp_ResponseCode=00&vnp_Amount=50000000&vnp_BankCode=NCB&format=json`
      const res = await fetch(url)
      const data = await res.json()
      setWebhookLog(
        `[VNPay Return Callback 200 OK]:\n${JSON.stringify(
          data,
          null,
          2,
        )}\n\n💡 Mẹo: Truy cập trực tiếp link sau để xem giao diện đồ họa Web:\n/api/v1/payments/vnpay-return?vnp_TxnRef=${vnpayTxnRef}&vnp_ResponseCode=00&vnp_Amount=50000000&vnp_BankCode=NCB`,
      )
    } catch (err: any) {
      setWebhookLog(`[Lỗi gọi VNPay Return]: ${err.message}`)
    } finally {
      setWebhookTesting(false)
    }
  }

  const loadStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<CronSystemStatus>("/api/v1/admin/cron/status")
      setCronData(res.data)
    } catch (err: any) {
      setError(err.message || "Không thể tải trạng thái tác vụ nền")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleTriggerBlock = async () => {
    if (!confirm(`Bạn có chắc muốn chạy quét và khóa các tài xế có điểm đánh giá < ${ratingThreshold} sao (tối thiểu ${minTrips} cuốc)?`)) {
      return
    }
    setTriggeringBlock(true)
    try {
      const res: any = await apiFetch("/api/v1/admin/cron/trigger-block-drivers", {
        method: "POST",
        body: JSON.stringify({
          ratingThreshold: Number(ratingThreshold),
          minTrips: Number(minTrips),
        }),
      })
      alert(res.message || "Đã hoàn thành quét khóa tài xế vi phạm")
      loadStatus()
    } catch (err: any) {
      alert("Lỗi thực thi: " + err.message)
    } finally {
      setTriggeringBlock(false)
    }
  }

  const handleTriggerBackup = async () => {
    setTriggeringBackup(true)
    try {
      const res: any = await apiFetch("/api/v1/admin/cron/trigger-backup", {
        method: "POST",
        body: JSON.stringify({
          keepDays: Number(keepDays),
        }),
      })
      alert(res.message || "Đã tạo bản sao lưu Database thành công")
      loadStatus()
    } catch (err: any) {
      alert("Lỗi sao lưu CSDL: " + err.message)
    } finally {
      setTriggeringBackup(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const jobs = cronData?.jobs

  return (
    <div className="a-page" style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text, #111827)" }}>
            Quản Trị Tác Vụ Nền & Sao Lưu CSDL
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Giám sát lịch trình tự động, quét khóa tài xế vi phạm điểm số và tạo snapshot CSDL Neon
          </p>
        </div>

        <button
          type="button"
          onClick={loadStatus}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            backgroundColor: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Icon name="clock" size={16} />
          Làm mới trạng thái
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Two Cron Job Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        {/* Job 1: Block low rating drivers */}
        <div
          className="glass"
          style={{
            padding: 24,
            borderRadius: 12,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: 0 }}>
                  Quét & Khóa Tài Xế Điểm Thấp
                </h2>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  Tự động quét tài xế vi phạm chuẩn dịch vụ
                </div>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 9999,
                  backgroundColor: "#eff6ff",
                  color: "#2563eb",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                03:00 AM Hàng ngày
              </span>
            </div>

            <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#6b7280" }}>Lịch trình (Cron):</span>
                <code style={{ fontWeight: 600, color: "#111827" }}>{jobs?.blockLowRatingDrivers.schedule || "0 3 * * *"}</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#6b7280" }}>Lần chạy gần nhất:</span>
                <span style={{ fontWeight: 500, color: "#111827" }}>
                  {jobs?.blockLowRatingDrivers.lastRunAt ? new Date(jobs.blockLowRatingDrivers.lastRunAt).toLocaleString("vi-VN") : "Chưa ghi nhận"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Tài xế đã xử lý:</span>
                <span style={{ fontWeight: 600, color: "#dc2626" }}>
                  {jobs?.blockLowRatingDrivers.processedCount !== undefined ? `${jobs.blockLowRatingDrivers.processedCount} tài xế` : "0 tài xế"}
                </span>
              </div>
            </div>

            {/* Quick configuration for manual trigger */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4, fontWeight: 500 }}>
                  Ngưỡng điểm sao (&lt;)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={ratingThreshold}
                  onChange={(e) => setRatingThreshold(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4, fontWeight: 500 }}>
                  Số cuốc tối thiểu (&gt;=)
                </label>
                <input
                  type="number"
                  value={minTrips}
                  onChange={(e) => setMinTrips(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerBlock}
            disabled={triggeringBlock}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "#dc2626",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: triggeringBlock ? "not-allowed" : "pointer",
            }}
          >
            {triggeringBlock ? "Đang quét hệ thống..." : "⚡ Chạy Quét & Khóa Ngay Lập Tức"}
          </button>
        </div>

        {/* Job 2: Database backup */}
        <div
          className="glass"
          style={{
            padding: 24,
            borderRadius: 12,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: 0 }}>
                  Tự Động Sao Lưu CSDL Neon
                </h2>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  Tạo snapshot toàn vẹn dữ liệu hệ thống
                </div>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 9999,
                  backgroundColor: "#ecfdf5",
                  color: "#059669",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                02:00 AM Hàng đêm
              </span>
            </div>

            <div style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#6b7280" }}>Lịch trình (Cron):</span>
                <code style={{ fontWeight: 600, color: "#111827" }}>{jobs?.databaseBackup.schedule || "0 2 * * *"}</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#6b7280" }}>Lần chạy gần nhất:</span>
                <span style={{ fontWeight: 500, color: "#111827" }}>
                  {jobs?.databaseBackup.lastRunAt ? new Date(jobs.databaseBackup.lastRunAt).toLocaleString("vi-VN") : "Chưa ghi nhận"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6b7280" }}>Bản backup gần nhất:</span>
                <span style={{ fontWeight: 600, color: "#059669" }}>
                  {jobs?.databaseBackup.lastBackupFile || "Sẵn sàng tạo mới"}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4, fontWeight: 500 }}>
                Thời gian lưu giữ bản sao lưu (ngày)
              </label>
              <input
                type="number"
                value={keepDays}
                onChange={(e) => setKeepDays(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerBackup}
            disabled={triggeringBackup}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "#059669",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: triggeringBackup ? "not-allowed" : "pointer",
            }}
          >
            {triggeringBackup ? "Đang tạo bản sao lưu..." : "💾 Sao Lưu CSDL Ngay Lập Tức"}
          </button>
        </div>
      </div>

      {/* Recent Database Backups Table */}
      <div
        className="glass"
        style={{
          borderRadius: 12,
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
            Danh Sách Bản Sao Lưu Cơ Sở Dữ Liệu Gần Nhất
          </h2>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            Lưu giữ tối đa {keepDays} ngày
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb", color: "#4b5563" }}>
                <th style={{ padding: "12px 16px" }}>Tên file Snapshot</th>
                <th style={{ padding: "12px 16px" }}>Kích thước</th>
                <th style={{ padding: "12px 16px" }}>Thời gian sao lưu</th>
                <th style={{ padding: "12px 16px" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>
                    Đang tải danh sách bản sao lưu...
                  </td>
                </tr>
              ) : (() => {
                const backupList = (cronData as any)?.recentBackups || (cronData as any)?.backupFiles || []
                if (backupList.length === 0) {
                  return (
                    <tr>
                      <td colSpan={4} style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>
                        Chưa có file snapshot nào trong thư mục sao lưu
                      </td>
                    </tr>
                  )
                }
                return backupList.map((b: any) => (
                  <tr key={b.filename} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 600, color: "#111827" }}>
                      📄 {b.filename}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#4b5563" }}>
                      {formatBytes(b.sizeBytes)}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#6b7280" }}>
                      {new Date(b.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 9999,
                          backgroundColor: "#ecfdf5",
                          color: "#059669",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        ✓ Hợp lệ
                      </span>
                    </td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gateway & Webhook Testing Simulator */}
      <div
        className="glass"
        style={{
          borderRadius: 12,
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
          marginTop: 28,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#faf5ff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>🧪</span>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#6b21a8" }}>
              Bộ Công Cụ Giả Lập & Kiểm Thử Webhook Cổng Thanh Toán & Tổng Đài
            </h2>
          </div>
          <p style={{ margin: "4px 0 0", color: "#7e22ce", fontSize: 13 }}>
            Kiểm thử phản hồi máy chủ thực tế cho 3 Webhook: VNPay IPN, MoMo IPN và Stringee SCCO Hotline 1900-8888
          </p>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
            {/* VNPay IPN Tester */}
            <div style={{ border: "1px solid #e9d5ff", borderRadius: 8, padding: 14, backgroundColor: "#faf5ff" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1e40af", marginBottom: 6 }}>
                💳 1. Cổng VNPay (IPN)
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                <code>GET /api/v1/payments/vnpay-ipn</code>
              </div>
              <input
                type="text"
                value={vnpayTxnRef}
                onChange={(e) => setVnpayTxnRef(e.target.value)}
                placeholder="Mã giao dịch VNPay"
                style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #d1d5db", marginBottom: 8 }}
              />
              <button
                type="button"
                onClick={handleTestVnpayIpn}
                disabled={webhookTesting}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "none", backgroundColor: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Gửi IPN Giả Lập VNPay
              </button>
            </div>

            {/* MoMo IPN Tester */}
            <div style={{ border: "1px solid #fbcfe8", borderRadius: 8, padding: 14, backgroundColor: "#fdf2f8" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#be185d", marginBottom: 6 }}>
                👛 2. Cổng MoMo (IPN)
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                <code>POST /api/v1/payments/momo-ipn</code>
              </div>
              <input
                type="text"
                value={momoOrderId}
                onChange={(e) => setMomoOrderId(e.target.value)}
                placeholder="Mã đơn hàng MoMo"
                style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #d1d5db", marginBottom: 8 }}
              />
              <button
                type="button"
                onClick={handleTestMomoIpn}
                disabled={webhookTesting}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "none", backgroundColor: "#db2777", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Gửi IPN Giả Lập MoMo
              </button>
            </div>

            {/* Stringee SCCO Tester */}
            <div style={{ border: "1px solid #fed7aa", borderRadius: 8, padding: 14, backgroundColor: "#fff7ed" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#c2410c", marginBottom: 6 }}>
                📞 3. Stringee SCCO Call
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                <code>GET /api/v1/calls/answer-url</code>
              </div>
              <div style={{ fontSize: 12, color: "#9a3412", marginBottom: 12 }}>
                Đầu số hotline: <strong>1900-8888</strong>
              </div>
              <button
                type="button"
                onClick={handleTestStringeeScco}
                disabled={webhookTesting}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "none", backgroundColor: "#ea580c", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Kiểm Tra SCCO Script
              </button>
            </div>

            {/* VNPay Return Tester */}
            <div style={{ border: "1px solid #bfdbfe", borderRadius: 8, padding: 14, backgroundColor: "#eff6ff" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1d4ed8", marginBottom: 6 }}>
                🔄 4. VNPay Return UI
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                <code>GET /api/v1/payments/vnpay-return</code>
              </div>
              <div style={{ fontSize: 11, color: "#1e40af", marginBottom: 8 }}>
                Kiểm thử trang kết quả thanh toán đồ họa & nút quay lại app
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={handleTestVnpayReturn}
                  disabled={webhookTesting}
                  style={{ flex: 1, padding: "7px 8px", borderRadius: 6, border: "none", backgroundColor: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >
                  Test JSON API
                </button>
                <a
                  href={`/api/v1/payments/vnpay-return?vnp_TxnRef=${vnpayTxnRef}&vnp_ResponseCode=00&vnp_Amount=50000000&vnp_BankCode=NCB`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #2563eb", color: "#2563eb", backgroundColor: "#fff", fontSize: 11, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  Mở UI Web
                </a>
              </div>
            </div>
          </div>

          {/* Log Output Console */}
          {webhookLog && (
            <div style={{ backgroundColor: "#0f172a", color: "#38bdf8", padding: 14, borderRadius: 8, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", overflowX: "auto" }}>
              {webhookLog}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
