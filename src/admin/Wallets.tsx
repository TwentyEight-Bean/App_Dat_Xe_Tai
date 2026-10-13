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
  return json as T
}

export interface DriverWalletItem {
  driverId: string
  userId: string
  fullName: string
  phone: string
  avatarUrl: string | null
  licensePlate: string | null
  kycStatus: string
  isOnline: boolean
  isActive: boolean
  wallet: {
    walletId: string | null
    balance: number
    lockedBalance: number
    availableBalance: number
    minDepositLimit: number
    isDepositQualified: boolean
    updatedAt: string | null
  }
}

export interface WalletTransactionItem {
  id: string
  bookingId: string | null
  bookingCode: string | null
  amount: number
  balanceBefore: number | null
  balanceAfter: number | null
  type: string
  description: string
  referenceCode: string | null
  createdAt: string
  bookingInfo?: {
    code: string
    totalPrice: number
    paymentMethod: string
  } | null
}

export default function Wallets() {
  const [drivers, setDrivers] = useState<DriverWalletItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selected driver for ledger / detail modal
  const [selectedDriver, setSelectedDriver] = useState<DriverWalletItem | null>(null)
  const [txs, setTxs] = useState<WalletTransactionItem[]>([])
  const [loadingTxs, setLoadingTxs] = useState(false)

  // Adjust balance modal
  const [adjustDriver, setAdjustDriver] = useState<DriverWalletItem | null>(null)
  const [adjustType, setAdjustType] = useState<"BONUS" | "PENALTY" | "ADMIN_ADJUSTMENT" | "REFUND">("BONUS")
  const [adjustAmount, setAdjustAmount] = useState<string>("")
  const [adjustDesc, setAdjustDesc] = useState<string>("")
  const [submittingAdjust, setSubmittingAdjust] = useState(false)

  const loadWallets = async (p = 1, query = search) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), limit: "15" })
      if (query.trim()) params.set("search", query.trim())

      const res: any = await apiFetch(`/api/v1/admin/wallets?${params.toString()}`)
      setDrivers(res.drivers || [])
      setTotal(res.total || 0)
      setPage(res.page || 1)
      setTotalPages(res.totalPages || 1)
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách ví tài xế")
    } finally {
      setLoading(false)
    }
  }

  // Tự động debounce tìm kiếm 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      loadWallets(1, search)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    loadWallets(page, search)
  }, [page])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadWallets(1, search)
  }

  // Open transactions modal
  const handleOpenTxs = async (driver: DriverWalletItem) => {
    setSelectedDriver(driver)
    setLoadingTxs(true)
    try {
      // 1. Làm mới chi tiết số dư ví độc lập từ DB qua GET /api/v1/admin/wallets/:userId
      apiFetch<any>(`/api/v1/admin/wallets/${driver.userId}`)
        .then((res) => {
          if (res?.data) {
            setSelectedDriver((prev) =>
              prev ? { ...prev, wallet: res.data } : prev,
            )
          }
        })
        .catch(() => {})

      // 2. Lấy danh sách giao dịch ví
      const res: any = await apiFetch(
        `/api/v1/admin/wallets/${driver.userId}/transactions?limit=50`,
      )
      setTxs(res.transactions || [])
    } catch (err: any) {
      alert("Lỗi tải lịch sử giao dịch: " + err.message)
    } finally {
      setLoadingTxs(false)
    }
  }

  // Submit balance adjustment với Idempotency Key bảo vệ
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustDriver) return
    const numAmount = Number(adjustAmount)
    if (isNaN(numAmount) || numAmount === 0) {
      alert("Số tiền điều chỉnh phải khác 0")
      return
    }
    if (!adjustDesc.trim()) {
      alert("Vui lòng nhập lý do điều chỉnh")
      return
    }

    setSubmittingAdjust(true)
    try {
      // If penalty, ensure it's negative if user typed positive
      const finalAmount = adjustType === "PENALTY" ? -Math.abs(numAmount) : Math.abs(numAmount)
      const idempotencyKey = `adj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      await apiFetch(`/api/v1/admin/wallets/${adjustDriver.userId}/adjust`, {
        method: "POST",
        body: JSON.stringify({
          amount: finalAmount,
          type: adjustType,
          description: adjustDesc.trim(),
          idempotencyKey,
        }),
      })

      alert(`Điều chỉnh thành công ${finalAmount > 0 ? "+" : ""}${vnd(finalAmount)} vào ví tài xế ${adjustDriver.fullName}`)
      setAdjustDriver(null)
      setAdjustAmount("")
      setAdjustDesc("")
      loadWallets(page, search)
    } catch (err: any) {
      alert("Lỗi điều chỉnh ví: " + err.message)
    } finally {
      setSubmittingAdjust(false)
    }
  }

  return (
    <div className="a-page" style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text, #111827)" }}>
            Quản Lý Ví Ký Quỹ Tài Xế
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Kiểm tra hạn mức ký quỹ 200.000đ, lịch sử khấu trừ hoa hồng 20% và điều chỉnh số dư tài xế
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Tìm theo tên, SĐT, biển số..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
              minWidth: 260,
              outline: "none",
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tìm
          </button>
        </form>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Wallets Table */}
      <div
        className="glass"
        style={{
          borderRadius: 12,
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb", color: "#4b5563" }}>
                <th style={{ padding: "14px 16px" }}>Tài xế</th>
                <th style={{ padding: "14px 16px" }}>Số điện thoại</th>
                <th style={{ padding: "14px 16px" }}>Biển số xe</th>
                <th style={{ padding: "14px 16px" }}>Số dư thực tế</th>
                <th style={{ padding: "14px 16px" }}>Số dư khả dụng</th>
                <th style={{ padding: "14px 16px" }}>Hạn mức chuẩn</th>
                <th style={{ padding: "14px 16px" }}>Trạng thái ký quỹ</th>
                <th style={{ padding: "14px 16px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                    Đang tải danh sách ví...
                  </td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                    Không tìm thấy tài xế nào
                  </td>
                </tr>
              ) : (
                drivers.map((d) => {
                  const isQualified = d.wallet.isDepositQualified
                  const shortfall = isQualified ? 0 : d.wallet.minDepositLimit - d.wallet.availableBalance

                  return (
                    <tr key={d.userId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{d.fullName}</div>
                        <div style={{ fontSize: 12, color: d.isOnline ? "#059669" : "#9ca3af" }}>
                          {d.isOnline ? "● Đang trực tuyến" : "○ Ngoại tuyến"}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#374151" }}>{d.phone}</td>
                      <td style={{ padding: "14px 16px", fontFamily: "monospace", fontWeight: 600 }}>
                        {d.licensePlate || "Chưa có"}
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#111827" }}>
                        {vnd(d.wallet.balance)}
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: isQualified ? "#059669" : "#dc2626" }}>
                        {vnd(d.wallet.availableBalance)}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#6b7280" }}>
                        {vnd(d.wallet.minDepositLimit)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {isQualified ? (
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
                            ✓ Đạt chuẩn
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 9999,
                              backgroundColor: "#fef2f2",
                              color: "#dc2626",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            Thiếu {vnd(shortfall)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenTxs(d)}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: "1px solid #d1d5db",
                              backgroundColor: "#fff",
                              color: "#374151",
                              cursor: "pointer",
                            }}
                          >
                            Lịch sử
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustDriver(d)
                              setAdjustAmount("")
                              setAdjustDesc("")
                            }}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: "none",
                              backgroundColor: "#2563eb",
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            ± Điều chỉnh
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderTop: "1px solid #e5e7eb", color: "#6b7280", fontSize: 13 }}>
          <div>Tổng cộng: {total} tài xế</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #d1d5db", cursor: page <= 1 ? "not-allowed" : "pointer" }}
            >
              Trang trước
            </button>
            <span>Trang {page} / {totalPages || 1}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #d1d5db", cursor: page >= totalPages ? "not-allowed" : "pointer" }}
            >
              Trang sau
            </button>
          </div>
        </div>
      </div>

      {/* Modal 1: Ledger / History */}
      {selectedDriver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 800,
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                  Lịch Sử Giao Dịch Ví: {selectedDriver.fullName}
                </h2>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                  Số dư hiện tại: <strong style={{ color: "#111827" }}>{vnd(selectedDriver.wallet.balance)}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDriver(null)}
                style={{ border: "none", backgroundColor: "transparent", cursor: "pointer", padding: 4 }}
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {loadingTxs ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Đang tải lịch sử...</div>
              ) : txs.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Chưa có giao dịch nào trong ví</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
                      <th style={{ padding: "10px 8px" }}>Thời gian</th>
                      <th style={{ padding: "10px 8px" }}>Loại giao dịch</th>
                      <th style={{ padding: "10px 8px" }}>Số tiền</th>
                      <th style={{ padding: "10px 8px" }}>Số dư trước/sau</th>
                      <th style={{ padding: "10px 8px" }}>Mô tả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((tx) => {
                      const isNegative = tx.amount < 0
                      return (
                        <tr key={tx.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "12px 8px", color: "#6b7280" }}>
                            {new Date(tx.createdAt).toLocaleString("vi-VN")}
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                backgroundColor: isNegative ? "#fee2e2" : "#dcfce7",
                                color: isNegative ? "#dc2626" : "#15803d",
                              }}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td style={{ padding: "12px 8px", fontWeight: 700, color: isNegative ? "#dc2626" : "#15803d" }}>
                            {isNegative ? "" : "+"}{vnd(tx.amount)}
                          </td>
                          <td style={{ padding: "12px 8px", color: "#4b5563" }}>
                            {tx.balanceBefore !== null ? vnd(tx.balanceBefore) : "-"} ➔ {tx.balanceAfter !== null ? vnd(tx.balanceAfter) : "-"}
                          </td>
                          <td style={{ padding: "12px 8px", color: "#374151" }}>
                            <div>{tx.description}</div>
                            {tx.bookingCode && (
                              <small style={{ color: "#2563eb", fontWeight: 600 }}>Mã đơn: #{tx.bookingCode}</small>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedDriver(null)}
                style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #d1d5db", backgroundColor: "#fff", cursor: "pointer", fontWeight: 600 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Adjust Balance */}
      {adjustDriver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                Điều Chỉnh Số Dư Ví
              </h2>
              <button
                type="button"
                onClick={() => setAdjustDriver(null)}
                style={{ border: "none", backgroundColor: "transparent", cursor: "pointer" }}
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div style={{ padding: "10px 14px", backgroundColor: "#f3f4f6", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <div>Tài xế: <strong>{adjustDriver.fullName}</strong> ({adjustDriver.phone})</div>
              <div>Số dư hiện tại: <strong style={{ color: "#2563eb" }}>{vnd(adjustDriver.wallet.balance)}</strong></div>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Loại điều chỉnh
                </label>
                <select
                  value={adjustType}
                  onChange={(e: any) => setAdjustType(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                >
                  <option value="BONUS">Thưởng (BONUS) - Cộng tiền</option>
                  <option value="PENALTY">Phạt vi phạm (PENALTY) - Trừ tiền</option>
                  <option value="ADMIN_ADJUSTMENT">Nạp thủ công / Điều chỉnh khác</option>
                  <option value="REFUND">Hoàn tiền (REFUND) - Cộng tiền</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Số tiền (VNĐ)
                  {adjustAmount && !isNaN(Number(adjustAmount)) && Number(adjustAmount) > 0 && (
                    <span style={{ color: adjustType === "PENALTY" ? "#dc2626" : "#059669", fontWeight: 700, marginLeft: 8 }}>
                      ({adjustType === "PENALTY" ? "-" : "+"}{vnd(Number(adjustAmount))})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  placeholder="Nhập số tiền..."
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Lý do điều chỉnh (Bắt buộc)
                </label>
                <textarea
                  placeholder="Nhập lý do chi tiết (VD: Thưởng tuần, Phạt từ chối cuốc...)"
                  value={adjustDesc}
                  onChange={(e) => setAdjustDesc(e.target.value)}
                  rows={3}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setAdjustDriver(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", backgroundColor: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: adjustType === "PENALTY" ? "#dc2626" : "#2563eb",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: submittingAdjust ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingAdjust ? "Đang xử lý..." : "Xác nhận điều chỉnh"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
