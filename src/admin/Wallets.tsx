import { useState, useEffect, useMemo } from "react"
import { Icon, Status, Avatar } from "./ui"
import { vnd } from "./data"
import { clearAdminSession, isUnauthorizedResponse, requireAdminToken } from "./auth"

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = requireAdminToken()
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts?.headers ?? {}),
    },
  })
  const json = await res.json()
  if (!res.ok || json.success === false) {
    if (isUnauthorizedResponse(res.status, json.message)) {
      clearAdminSession()
    }
    throw new Error(json.message || "Lỗi API")
  }
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

export interface TopUpRequestItem {
  id: string
  userId: string
  driverId: string | null
  driverName: string
  driverPhone: string
  driverAvatar: string | null
  licensePlate: string | null
  amount: number
  gateway: string
  transactionCode: string
  status: string
  description: string | null
  rawResponse: any
  currentBalance: number
  availableBalance: number
  createdAt: string
  updatedAt: string
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

  // Tab & Topup Requests Management
  const [activeTab, setActiveTab] = useState<"wallets" | "topup_requests">("wallets")
  const [topupRequests, setTopupRequests] = useState<TopUpRequestItem[]>([])
  const [pendingTopUpCount, setPendingTopUpCount] = useState(0)
  const [topupFilter, setTopupFilter] = useState<"WAITING_APPROVAL" | "PENDING_ALL" | "SUCCESS" | "FAILED" | "ALL">("WAITING_APPROVAL")
  const [loadingTopups, setLoadingTopups] = useState(false)
  const [topupSearch, setTopupSearch] = useState("")

  // Confirm Approve modal
  const [approvingRequest, setApprovingRequest] = useState<TopUpRequestItem | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  // Confirm Reject modal
  const [rejectingRequest, setRejectingRequest] = useState<TopUpRequestItem | null>(null)
  const [rejectReason, setRejectReason] = useState("Chưa nhận được tiền vào tài khoản ngân hàng")
  const [isRejecting, setIsRejecting] = useState(false)

  // Copy tooltip
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard?.writeText(text)
      setCopiedCode(text)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (e) {}
  }

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

  const loadTopupRequests = async (status = topupFilter, query = topupSearch, isSilent = false) => {
    if (!isSilent && topupRequests.length === 0) {
      setLoadingTopups(true)
    }
    try {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      if (query.trim()) params.set("search", query.trim())
      const res: any = await apiFetch(`/api/v1/admin/wallets/topup-requests?${params.toString()}`)
      setTopupRequests(res.requests || [])
      setPendingTopUpCount(res.pendingCount || 0)
    } catch (err: any) {
      console.warn("Lỗi tải yêu cầu nạp tiền:", err)
    } finally {
      if (!isSilent) {
        setLoadingTopups(false)
      }
    }
  }

  // Load định kỳ yêu cầu nạp tiền mỗi 8 giây (chạy ngầm êm ái, không giật màn hình)
  useEffect(() => {
    loadTopupRequests(topupFilter, topupSearch, false)
    const interval = setInterval(() => {
      loadTopupRequests(topupFilter, topupSearch, true)
    }, 8000)
    return () => clearInterval(interval)
  }, [topupFilter, topupSearch])

  // Map pending topup by userId for quick alert in driver wallets list
  const pendingByUserId = useMemo(() => {
    const map: Record<string, TopUpRequestItem> = {}
    topupRequests.forEach((r) => {
      if ((r.status === "WAITING_APPROVAL" || r.status === "PENDING") && !map[r.userId]) {
        map[r.userId] = r
      }
    })
    return map
  }, [topupRequests])

  // Open transactions modal
  const handleOpenTxs = async (driver: DriverWalletItem) => {
    setSelectedDriver(driver)
    setLoadingTxs(true)
    try {
      apiFetch<any>(`/api/v1/admin/wallets/${driver.userId}`)
        .then((res) => {
          if (res?.data) {
            setSelectedDriver((prev) =>
              prev ? { ...prev, wallet: res.data } : prev,
            )
          }
        })
        .catch(() => {})

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

  // Submit balance adjustment
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

      const driverDisplayName = adjustDriver.fullName?.includes(adjustDriver.phone)
        ? adjustDriver.fullName
        : `${adjustDriver.fullName || "tài xế"} (${adjustDriver.phone})`
      alert(`Điều chỉnh thành công ${finalAmount > 0 ? "+" : ""}${vnd(finalAmount)} vào ví của ${driverDisplayName}`)
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

  // Submit Duyệt nạp tiền VietQR
  const handleApprove = async () => {
    if (!approvingRequest) return
    setIsApproving(true)
    try {
      const res: any = await apiFetch(`/api/v1/admin/wallets/topup-requests/${approvingRequest.id}/approve`, {
        method: "POST",
      })
      alert(res.message || "Đã duyệt nạp tiền thành công!")
      setApprovingRequest(null)
      loadTopupRequests(topupFilter, topupSearch)
      loadWallets(page, search)
    } catch (err: any) {
      alert("Lỗi duyệt nạp tiền: " + err.message)
    } finally {
      setIsApproving(false)
    }
  }

  // Submit Từ chối nạp tiền VietQR
  const handleReject = async () => {
    if (!rejectingRequest) return
    setIsRejecting(true)
    try {
      const res: any = await apiFetch(`/api/v1/admin/wallets/topup-requests/${rejectingRequest.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      })
      alert(res.message || "Đã từ chối yêu cầu nạp tiền!")
      setRejectingRequest(null)
      loadTopupRequests(topupFilter, topupSearch)
    } catch (err: any) {
      alert("Lỗi từ chối nạp tiền: " + err.message)
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <div className="a-page" style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text, #111827)" }}>
            Quản Lý Ví Ký Quỹ & Nạp Tiền Tài Xế
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Kiểm tra hạn mức ký quỹ 200.000đ, xác minh sao kê và duyệt cộng tiền VietQR cho tài xế
          </p>
        </div>
      </div>

      {/* Tab Switcher & Quick Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "inline-flex", background: "#f3f4f6", padding: 4, borderRadius: 10 }}>
          <button
            type="button"
            onClick={() => setActiveTab("wallets")}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "wallets" ? "#ffffff" : "transparent",
              color: activeTab === "wallets" ? "#111827" : "#6b7280",
              boxShadow: activeTab === "wallets" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>👥 Danh sách ví tài xế</span>
            <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 10, background: "#e5e7eb", color: "#374151" }}>
              {total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("topup_requests")}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "topup_requests" ? "#2563eb" : "transparent",
              color: activeTab === "topup_requests" ? "#ffffff" : "#6b7280",
              boxShadow: activeTab === "topup_requests" ? "0 2px 6px rgba(37,99,235,0.3)" : "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>🏦 Duyệt nạp tiền VietQR</span>
            {pendingTopUpCount > 0 ? (
              <span
                style={{
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: activeTab === "topup_requests" ? "#fef08a" : "#ef4444",
                  color: activeTab === "topup_requests" ? "#854d0e" : "#ffffff",
                  fontWeight: 700,
                }}
              >
                {pendingTopUpCount} chờ duyệt
              </span>
            ) : (
              <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 10, background: activeTab === "topup_requests" ? "rgba(255,255,255,0.2)" : "#e5e7eb", color: activeTab === "topup_requests" ? "#fff" : "#374151" }}>
                0
              </span>
            )}
          </button>
        </div>

        {/* Quick notification & refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {pendingTopUpCount > 0 && activeTab === "wallets" && (
            <button
              type="button"
              onClick={() => setActiveTab("topup_requests")}
              style={{
                background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                border: "1.5px solid #f59e0b",
                color: "#92400e",
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 6px rgba(245,158,11,0.25)",
              }}
            >
              <span>🔔 Có {pendingTopUpCount} tài xế vừa báo chuyển khoản VietQR</span>
              <span style={{ textDecoration: "underline" }}>Xem & Duyệt ngay →</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (activeTab === "wallets") loadWallets(page, search)
              else loadTopupRequests(topupFilter, topupSearch)
            }}
            title="Làm mới dữ liệu"
            style={{
              padding: "8px 14px",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>🔄 Làm mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: 8, marginBottom: 20 }}>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("admin_auth_token")
              localStorage.removeItem("admin_user_info")
              window.dispatchEvent(new Event("admin_session_expired"))
              window.location.reload()
            }}
            style={{
              background: "#dc2626",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            Đăng nhập lại
          </button>
        </div>
      )}

      {/* VIEW 1: Wallets Table */}
      {activeTab === "wallets" && (
        <div>
          {/* Search bar */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
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
                      const pendingReq = pendingByUserId[d.userId]

                      return (
                        <tr key={d.userId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, color: "#111827" }}>
                                {d.fullName || `Tài xế (${d.phone})`}
                              </span>
                              {pendingReq && (
                                <span
                                  onClick={() => setApprovingRequest(pendingReq)}
                                  style={{
                                    cursor: "pointer",
                                    fontSize: 11,
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    border: "1px solid #fde68a",
                                    fontWeight: 700,
                                  }}
                                  title="Tài xế vừa báo chuyển khoản. Bấm để duyệt ngay!"
                                >
                                  ⏳ Chờ duyệt nạp {vnd(pendingReq.amount)}
                                </span>
                              )}
                            </div>
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
                            <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                              {pendingReq && (
                                <button
                                  type="button"
                                  onClick={() => setApprovingRequest(pendingReq)}
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    border: "1.5px solid #f59e0b",
                                    backgroundColor: "#fef3c7",
                                    color: "#b45309",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    boxShadow: "0 2px 6px rgba(245, 158, 11, 0.25)",
                                  }}
                                  title={`Tài xế báo đã chuyển khoản ${vnd(pendingReq.amount)}. Bấm để duyệt ngay!`}
                                >
                                  <span>⚡ Duyệt nạp</span>
                                </button>
                              )}
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
        </div>
      )}

      {/* VIEW 2: Topup Requests Table */}
      {activeTab === "topup_requests" && (
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
          {/* Filter Toolbar */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              backgroundColor: "#fafafa",
            }}
          >
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setTopupFilter("WAITING_APPROVAL")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: topupFilter === "WAITING_APPROVAL" ? "1.5px solid #d97706" : "1px solid #d1d5db",
                  background: topupFilter === "WAITING_APPROVAL" ? "#fef3c7" : "#fff",
                  color: topupFilter === "WAITING_APPROVAL" ? "#92400e" : "#4b5563",
                }}
              >
                ⏳ Chờ xác minh {pendingTopUpCount > 0 ? `(${pendingTopUpCount})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setTopupFilter("PENDING_ALL")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: topupFilter === "PENDING_ALL" ? "1.5px solid #2563eb" : "1px solid #d1d5db",
                  background: topupFilter === "PENDING_ALL" ? "#eff6ff" : "#fff",
                  color: topupFilter === "PENDING_ALL" ? "#1d4ed8" : "#4b5563",
                }}
              >
                📋 Tất cả đang chờ
              </button>
              <button
                type="button"
                onClick={() => setTopupFilter("SUCCESS")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: topupFilter === "SUCCESS" ? "1.5px solid #059669" : "1px solid #d1d5db",
                  background: topupFilter === "SUCCESS" ? "#ecfdf5" : "#fff",
                  color: topupFilter === "SUCCESS" ? "#047857" : "#4b5563",
                }}
              >
                ✅ Đã duyệt thành công
              </button>
              <button
                type="button"
                onClick={() => setTopupFilter("FAILED")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: topupFilter === "FAILED" ? "1.5px solid #dc2626" : "1px solid #d1d5db",
                  background: topupFilter === "FAILED" ? "#fef2f2" : "#fff",
                  color: topupFilter === "FAILED" ? "#b91c1c" : "#4b5563",
                }}
              >
                ❌ Đã từ chối
              </button>
              <button
                type="button"
                onClick={() => setTopupFilter("ALL")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: topupFilter === "ALL" ? "1.5px solid #4b5563" : "1px solid #d1d5db",
                  background: topupFilter === "ALL" ? "#f3f4f6" : "#fff",
                  color: topupFilter === "ALL" ? "#111827" : "#4b5563",
                }}
              >
                📁 Tất cả
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Tìm tài xế, SĐT, mã CK..."
                value={topupSearch}
                onChange={(e) => setTopupSearch(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  minWidth: 220,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb", color: "#4b5563" }}>
                  <th style={{ padding: "14px 16px" }}>Tài xế</th>
                  <th style={{ padding: "14px 16px" }}>Số tiền nạp</th>
                  <th style={{ padding: "14px 16px" }}>Mã chuyển khoản (Nội dung)</th>
                  <th style={{ padding: "14px 16px" }}>Ngân hàng thụ hưởng</th>
                  <th style={{ padding: "14px 16px" }}>Số dư hiện tại</th>
                  <th style={{ padding: "14px 16px" }}>Thời gian báo</th>
                  <th style={{ padding: "14px 16px" }}>Trạng thái</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loadingTopups && topupRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                      Đang tải danh sách yêu cầu nạp tiền...
                    </td>
                  </tr>
                ) : topupRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 50, textAlign: "center", color: "#6b7280" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                      <div style={{ fontWeight: 600, color: "#374151" }}>Không có yêu cầu nạp tiền nào trong mục này</div>
                      <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
                        Khi tài xế bấm &quot;Tôi đã chuyển khoản xong&quot;, thông tin sẽ hiển thị tại đây để bạn kiểm tra sao kê và duyệt.
                      </div>
                    </td>
                  </tr>
                ) : (
                  topupRequests.map((req) => {
                    const isPending = req.status === "WAITING_APPROVAL" || req.status === "PENDING"
                    const isSuccess = req.status === "SUCCESS"
                    const isFailed = req.status === "FAILED"

                    return (
                      <tr key={req.id} style={{ borderBottom: "1px solid #f3f4f6", backgroundColor: isPending ? "rgba(254, 243, 199, 0.25)" : "transparent" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ fontWeight: 700, color: "#111827" }}>{req.driverName}</div>
                          <div style={{ fontSize: 12.5, color: "#4b5563" }}>📞 {req.driverPhone}</div>
                          {req.licensePlate && (
                            <div style={{ fontSize: 11.5, color: "#6b7280", fontFamily: "monospace" }}>Xe: {req.licensePlate}</div>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <strong style={{ fontSize: 16, color: "#059669", fontWeight: 800 }}>
                            +{vnd(req.amount)}
                          </strong>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <code style={{ background: "#f3f4f6", padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, color: "#d97706", border: "1px solid #e5e7eb" }}>
                              {req.transactionCode}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(req.transactionCode)}
                              title="Sao chép mã để tra sao kê ngân hàng"
                              style={{
                                border: "1px solid #d1d5db",
                                background: "#fff",
                                borderRadius: 6,
                                padding: "3px 7px",
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                            >
                              {copiedCode === req.transactionCode ? "✓" : "📋"}
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                          <div><strong>Vietcombank</strong> (1049761056)</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>TRAN VU HUNG</div>
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 600, color: "#1f2937" }}>
                          {vnd(req.currentBalance)}
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: 12.5, color: "#6b7280" }}>
                          {new Date(req.createdAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {req.status === "WAITING_APPROVAL" && (
                            <span style={{ padding: "4px 10px", borderRadius: 9999, backgroundColor: "#fef3c7", color: "#b45309", fontSize: 12, fontWeight: 700, border: "1px solid #fde68a", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <span>●</span> Chờ xác minh
                            </span>
                          )}
                          {req.status === "PENDING" && (
                            <span style={{ padding: "4px 10px", borderRadius: 9999, backgroundColor: "#f3f4f6", color: "#4b5563", fontSize: 12, fontWeight: 600 }}>
                              Mới tạo QR
                            </span>
                          )}
                          {isSuccess && (
                            <span style={{ padding: "4px 10px", borderRadius: 9999, backgroundColor: "#ecfdf5", color: "#059669", fontSize: 12, fontWeight: 700 }}>
                              ✓ Đã duyệt nạp
                            </span>
                          )}
                          {isFailed && (
                            <span style={{ padding: "4px 10px", borderRadius: 9999, backgroundColor: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600 }} title={req.description || ""}>
                              ✕ Đã từ chối
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          {isPending ? (
                            <div style={{ display: "inline-flex", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setApprovingRequest(req)}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: 8,
                                  border: "none",
                                  backgroundColor: "#059669",
                                  color: "#ffffff",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                                }}
                              >
                                <span>✅ Duyệt nạp</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingRequest(req)
                                  setRejectReason("Chưa nhận được tiền vào tài khoản ngân hàng")
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: "1px solid #fca5a5",
                                  backgroundColor: "#fef2f2",
                                  color: "#dc2626",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                <span>✕ Từ chối</span>
                              </button>
                            </div>
                          ) : isSuccess ? (
                            <span style={{ fontSize: 12.5, color: "#059669", fontWeight: 600 }}>Đã cộng vào ví</span>
                          ) : (
                            <span style={{ fontSize: 12.5, color: "#9ca3af" }}>Đã đóng</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
                  Lịch Sử Giao Dịch Ví: {selectedDriver.fullName || selectedDriver.phone}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                  Biển số: {selectedDriver.licensePlate || "Chưa cập nhật"} | Số dư hiện tại: <strong style={{ color: "#059669" }}>{vnd(selectedDriver.wallet.balance)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDriver(null)}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: "#6b7280" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {loadingTxs ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Đang tải lịch sử...</div>
              ) : txs.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Chưa có giao dịch nào phát sinh</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left", color: "#6b7280" }}>
                      <th style={{ padding: "8px 12px" }}>Thời gian</th>
                      <th style={{ padding: "8px 12px" }}>Loại</th>
                      <th style={{ padding: "8px 12px" }}>Số tiền</th>
                      <th style={{ padding: "8px 12px" }}>Số dư trước/sau</th>
                      <th style={{ padding: "8px 12px" }}>Nội dung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((tx) => {
                      const isPositive = Number(tx.amount) > 0
                      return (
                        <tr key={tx.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                            {new Date(tx.createdAt).toLocaleString("vi-VN")}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: "#f3f4f6" }}>
                              {tx.type}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: isPositive ? "#059669" : "#dc2626" }}>
                            {isPositive ? "+" : ""}{vnd(tx.amount)}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#4b5563", fontSize: 12 }}>
                            {tx.balanceBefore !== null ? vnd(tx.balanceBefore) : "-"} → {tx.balanceAfter !== null ? vnd(tx.balanceAfter) : "-"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#374151" }}>
                            {tx.description}
                            {tx.bookingCode && (
                              <span style={{ display: "block", fontSize: 11, color: "#2563eb", fontWeight: 600 }}>
                                Mã cuốc: #{tx.bookingCode}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
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
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Điều Chỉnh Số Dư Ví: {adjustDriver.fullName || adjustDriver.phone}
              </h3>
              <button
                type="button"
                onClick={() => setAdjustDriver(null)}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: "#6b7280" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Loại điều chỉnh
                </label>
                <select
                  value={adjustType}
                  onChange={(e: any) => setAdjustType(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                >
                  <option value="BONUS">Thưởng tài xế (+ tiền)</option>
                  <option value="PENALTY">Phạt vi phạm (- tiền)</option>
                  <option value="ADMIN_ADJUSTMENT">Điều chỉnh số dư chung (+/- tiền)</option>
                  <option value="REFUND">Hoàn tiền (+ tiền)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Số tiền (VNĐ)
                </label>
                <input
                  type="number"
                  placeholder="VD: 50000"
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

      {/* Modal 3: Confirm Approve Topup */}
      {approvingRequest && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
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
              maxWidth: 520,
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#ecfdf5",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🏦</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#065f46" }}>
                    Xác nhận duyệt nạp tiền Ví Ký Quỹ
                  </h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#047857" }}>
                    Kiểm tra sao kê ngân hàng trước khi xác nhận cộng tiền
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingRequest(null)}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: "#6b7280" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Chi tiết đối soát */}
              <div
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "16px",
                  marginBottom: 16,
                  fontSize: 13.5,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#6b7280" }}>Tài xế yêu cầu:</span>
                  <strong style={{ color: "#111827" }}>
                    {approvingRequest.driverName} ({approvingRequest.driverPhone})
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                  <span style={{ color: "#6b7280" }}>Mã chuyển khoản:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <code style={{ background: "#e5e7eb", padding: "2px 6px", borderRadius: 4, fontWeight: 700, color: "#d97706" }}>
                      {approvingRequest.transactionCode}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(approvingRequest.transactionCode)}
                      style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13 }}
                    >
                      {copiedCode === approvingRequest.transactionCode ? "✓" : "📋"}
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#6b7280" }}>Tài khoản nhận:</span>
                  <span style={{ color: "#374151", fontWeight: 600 }}>Vietcombank - TRAN VU HUNG (1049761056)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#6b7280" }}>Số dư hiện tại:</span>
                  <span style={{ color: "#374151" }}>{vnd(approvingRequest.currentBalance)}</span>
                </div>
                <hr style={{ border: "none", borderTop: "1px dashed #d1d5db", margin: "10px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>Số tiền duyệt cộng:</span>
                  <strong style={{ color: "#059669", fontSize: 20, fontWeight: 800 }}>
                    +{vnd(approvingRequest.amount)}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12.5, color: "#059669" }}>
                  <span>Số dư sau khi duyệt:</span>
                  <strong>{vnd(approvingRequest.currentBalance + approvingRequest.amount)}</strong>
                </div>
              </div>

              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 12.5,
                  color: "#1e40af",
                  lineHeight: 1.5,
                  marginBottom: 20,
                }}
              >
                ℹ️ <strong>Lưu ý:</strong> Khi bạn bấm <strong>&quot;Xác nhận đã nhận tiền&quot;</strong>, hệ thống sẽ tự động cộng ngay <strong>{vnd(approvingRequest.amount)}</strong> vào ví tài xế, đồng thời gửi thông báo thành công về ứng dụng điện thoại của tài xế.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={() => setApprovingRequest(null)}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={handleApprove}
                  style={{
                    padding: "9px 22px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "#059669",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: isApproving ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(5, 150, 105, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{isApproving ? "⏳ Đang cộng tiền..." : "✅ Xác nhận đã nhận tiền & Duyệt"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Reject Topup Request */}
      {rejectingRequest && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
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
              overflow: "hidden",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#fef2f2",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#991b1b" }}>
                  Từ chối yêu cầu nạp tiền
                </h3>
                <p style={{ margin: 0, fontSize: 12.5, color: "#b91c1c" }}>
                  Gửi lý do giải thích cho tài xế {rejectingRequest.driverName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingRequest(null)}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: "#6b7280" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: 14, fontSize: 13.5, color: "#374151" }}>
                Số tiền: <strong style={{ color: "#dc2626" }}>{vnd(rejectingRequest.amount)}</strong> | Mã CK: <code>{rejectingRequest.transactionCode}</code>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Lý do từ chối:
                </label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13.5, marginBottom: 8 }}
                >
                  <option value="Chưa nhận được tiền vào tài khoản ngân hàng">Chưa nhận được tiền vào tài khoản ngân hàng</option>
                  <option value="Số tiền chuyển khoản không khớp với yêu cầu">Số tiền chuyển khoản không khớp với yêu cầu</option>
                  <option value="Sai nội dung chuyển khoản nên không thể đối soát">Sai nội dung chuyển khoản nên không thể đối soát</option>
                  <option value="Lý do khác">Lý do khác (tự nhập bên dưới)</option>
                </select>

                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13.5 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  disabled={isRejecting}
                  onClick={() => setRejectingRequest(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", backgroundColor: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isRejecting}
                  onClick={handleReject}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "#dc2626",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: isRejecting ? "not-allowed" : "pointer",
                  }}
                >
                  {isRejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
