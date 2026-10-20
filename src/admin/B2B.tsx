import { useState, useEffect } from "react"
import { Icon, Status } from "./ui"
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
  if (!res.ok || json.success === false) {
    if (res.status === 401 || json.message?.includes("Token không hợp lệ") || json.message?.includes("UNAUTHORIZED")) {
      localStorage.removeItem("admin_auth_token")
      localStorage.removeItem("admin_user_info")
      window.dispatchEvent(new Event("admin_session_expired"))
    }
    throw new Error(json.message || "Lỗi API")
  }
  return json as T
}

export interface B2bCustomer {
  id: string
  companyName: string
  taxCode: string
  businessAddress: string
  contactName: string
  contactPhone: string
  invoiceEmail: string | null
  creditLimit: number
  currentDebt: number
  paymentTermDays: number
  discountPercent: number
  status: "ACTIVE" | "SUSPENDED" | "CANCELLED"
  notes: string | null
  createdAt: string
  updatedAt: string
}

export default function B2B() {
  const [customers, setCustomers] = useState<B2bCustomer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal create/edit
  const [editingCustomer, setEditingCustomer] = useState<B2bCustomer | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    companyName: "",
    taxCode: "",
    businessAddress: "",
    contactName: "",
    contactPhone: "",
    invoiceEmail: "",
    creditLimit: "50000000",
    paymentTermDays: "30",
    discountPercent: "5",
    notes: "",
  })
  const [submitting, setSubmitting] = useState(false)

  // Payment modal
  const [paymentCustomer, setPaymentCustomer] = useState<B2bCustomer | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNote, setPaymentNote] = useState("")
  const [submittingPayment, setSubmittingPayment] = useState(false)

  const loadData = async (p = page, q = search, st = statusFilter) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), limit: "15" })
      if (q.trim()) params.set("search", q.trim())
      if (st !== "ALL") params.set("status", st)

      const res: any = await apiFetch(`/api/v1/admin/b2b/customers?${params.toString()}`)
      setCustomers(res.data || [])
      if (res.pagination) {
        setTotal(res.pagination.total || 0)
        setPage(res.pagination.page || 1)
        setTotalPages(res.pagination.totalPages || 1)
      }
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách doanh nghiệp B2B")
    } finally {
      setLoading(false)
    }
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData(1, search, statusFilter)
    }, 350)
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  useEffect(() => {
    loadData(page, search, statusFilter)
  }, [page])

  const handleOpenCreate = () => {
    setIsCreating(true)
    setEditingCustomer(null)
    setFormData({
      companyName: "",
      taxCode: "",
      businessAddress: "",
      contactName: "",
      contactPhone: "",
      invoiceEmail: "",
      creditLimit: "50000000",
      paymentTermDays: "30",
      discountPercent: "5",
      notes: "",
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = async (c: B2bCustomer) => {
    setIsCreating(false)
    setEditingCustomer(c)
    setIsModalOpen(true)

    // Khởi tạo trước với dữ liệu có sẵn
    setFormData({
      companyName: c.companyName || "",
      taxCode: c.taxCode || "",
      businessAddress: c.businessAddress || "",
      contactName: c.contactName || "",
      contactPhone: c.contactPhone || "",
      invoiceEmail: c.invoiceEmail || "",
      creditLimit: String(c.creditLimit || 0),
      paymentTermDays: String(c.paymentTermDays || 30),
      discountPercent: String(c.discountPercent || 0),
      notes: c.notes || "",
    })

    // Đồng bộ chi tiết mới nhất từ DB qua GET /api/v1/admin/b2b/customers/:id
    try {
      const res: any = await apiFetch(`/api/v1/admin/b2b/customers/${c.id}`)
      const detail = res.data || res || c
      setFormData({
        companyName: detail.companyName || "",
        taxCode: detail.taxCode || "",
        businessAddress: detail.businessAddress || "",
        contactName: detail.contactName || "",
        contactPhone: detail.contactPhone || "",
        invoiceEmail: detail.invoiceEmail || "",
        creditLimit: String(detail.creditLimit || 0),
        paymentTermDays: String(detail.paymentTermDays || 30),
        discountPercent: String(detail.discountPercent || 0),
        notes: detail.notes || "",
      })
    } catch (err) {
      console.warn("Lỗi tải chi tiết B2B từ server:", err)
    }
  }

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.companyName.trim() || !formData.taxCode.trim()) {
      alert("Vui lòng nhập tên công ty và mã số thuế")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        companyName: formData.companyName.trim(),
        taxCode: formData.taxCode.trim(),
        businessAddress: formData.businessAddress.trim(),
        contactName: formData.contactName.trim(),
        contactPhone: formData.contactPhone.trim(),
        invoiceEmail: formData.invoiceEmail.trim() || undefined,
        creditLimit: Number(formData.creditLimit) || 0,
        paymentTermDays: Number(formData.paymentTermDays) || 30,
        discountPercent: Number(formData.discountPercent) || 0,
        notes: formData.notes.trim() || undefined,
      }

      if (isCreating) {
        await apiFetch("/api/v1/admin/b2b/customers", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        alert("Thêm mới khách hàng doanh nghiệp B2B thành công!")
      } else if (editingCustomer) {
        await apiFetch(`/api/v1/admin/b2b/customers/${editingCustomer.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
        alert("Cập nhật thông tin doanh nghiệp thành công!")
      }

      setIsModalOpen(false)
      loadData(page, search, statusFilter)
    } catch (err: any) {
      alert("Lỗi lưu doanh nghiệp: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (c: B2bCustomer) => {
    const nextStatus = c.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    const actionText = nextStatus === "ACTIVE" ? "kích hoạt lại" : "tạm khóa"
    if (!confirm(`Bạn có chắc muốn ${actionText} hợp đồng B2B của "${c.companyName}"?`)) return

    try {
      await apiFetch(`/api/v1/admin/b2b/customers/${c.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      })
      alert(`Đã ${actionText} thành công!`)
      loadData(page, search, statusFilter)
    } catch (err: any) {
      alert("Lỗi đổi trạng thái: " + err.message)
    }
  }

  const handleOpenPayment = (c: B2bCustomer) => {
    setPaymentCustomer(c)
    setPaymentAmount(String(c.currentDebt || 0))
    setPaymentNote("Doanh nghiệp thanh toán công nợ chu kỳ")
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentCustomer) return
    const num = Number(paymentAmount)
    if (isNaN(num) || num <= 0) {
      alert("Số tiền thanh toán phải lớn hơn 0")
      return
    }

    setSubmittingPayment(true)
    try {
      await apiFetch(`/api/v1/admin/b2b/customers/${paymentCustomer.id}/payment`, {
        method: "POST",
        body: JSON.stringify({
          amount: num,
          note: paymentNote.trim() || undefined,
        }),
      })
      alert(`Đã ghi nhận thanh toán ${vnd(num)} cho doanh nghiệp "${paymentCustomer.companyName}"!`)
      setPaymentCustomer(null)
      loadData(page, search, statusFilter)
    } catch (err: any) {
      alert("Lỗi ghi nhận thanh toán: " + err.message)
    } finally {
      setSubmittingPayment(false)
    }
  }

  // KPIs
  const totalCredit = customers.reduce((sum, c) => sum + Number(c.creditLimit || 0), 0)
  const totalDebt = customers.reduce((sum, c) => sum + Number(c.currentDebt || 0), 0)
  const activeCount = customers.filter((c) => c.status === "ACTIVE").length

  return (
    <div className="a-page" style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text, #111827)" }}>
            Quản Lý Khách Hàng Doanh Nghiệp B2B
          </h1>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Theo dõi hợp đồng vận tải doanh nghiệp, hạn mức tín dụng và công nợ chu kỳ đối soát
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#2563eb",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
          }}
        >
          <span>+</span>
          <span>THÊM DOANH NGHIỆP MỚI</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="glass" style={{ padding: 20, borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e5e7eb" }}>
          <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Tổng Số Doanh Nghiệp B2B</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", margin: "8px 0 4px" }}>
            {loading ? "..." : total}
          </div>
          <div style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>
            {activeCount} đang hoạt động
          </div>
        </div>

        <div className="glass" style={{ padding: 20, borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e5e7eb" }}>
          <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Tổng Hạn Mức Tín Dụng</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#2563eb", margin: "8px 0 4px" }}>
            {loading ? "..." : vnd(totalCredit)}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Hạn mức công nợ tối đa
          </div>
        </div>

        <div className="glass" style={{ padding: 20, borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e5e7eb" }}>
          <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Dư Nợ Hiện Tại (Cần Thu)</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#d97706", margin: "8px 0 4px" }}>
            {loading ? "..." : vnd(totalDebt)}
          </div>
          <div style={{ fontSize: 12, color: "#d97706", fontWeight: 500 }}>
            Công nợ đang chờ đối soát
          </div>
        </div>

        <div className="glass" style={{ padding: 20, borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e5e7eb" }}>
          <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 500 }}>Hạn Mức Khả Dụng</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#059669", margin: "8px 0 4px" }}>
            {loading ? "..." : vnd(Math.max(0, totalCredit - totalDebt))}
          </div>
          <div style={{ fontSize: 12, color: "#059669" }}>
            Sẵn sàng đặt chuyến thêm
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="glass"
        style={{
          padding: "14px 20px",
          borderRadius: 12,
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260 }}>
          <input
            type="text"
            placeholder="🔍 Tìm theo tên công ty, mã số thuế (MST), số điện thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 420,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 13,
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Trạng thái:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
            <option value="SUSPENDED">Tạm khóa (SUSPENDED)</option>
            <option value="CANCELLED">Đã hủy hợp đồng</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 8, backgroundColor: "#fef2f2", color: "#dc2626", marginBottom: 20, border: "1px solid #fecaca" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div className="glass" style={{ borderRadius: 12, backgroundColor: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb", color: "#4b5563" }}>
                <th style={{ padding: "12px 16px" }}>Doanh Nghiệp & MST</th>
                <th style={{ padding: "12px 16px" }}>Người Đại Diện & SĐT</th>
                <th style={{ padding: "12px 16px" }}>Hạn Mức Tín Dụng</th>
                <th style={{ padding: "12px 16px" }}>Dư Nợ Hiện Tại</th>
                <th style={{ padding: "12px 16px" }}>Chu Kỳ & Chiết Khấu</th>
                <th style={{ padding: "12px 16px" }}>Trạng Thái</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
                    Đang nạp danh sách khách hàng doanh nghiệp B2B...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
                    Không tìm thấy doanh nghiệp B2B nào phù hợp
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const debtPercent = c.creditLimit > 0 ? Math.min(100, Math.round((c.currentDebt / c.creditLimit) * 100)) : 0
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>{c.companyName}</div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, fontFamily: "monospace" }}>
                          MST: {c.taxCode}
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#111827" }}>{c.contactName}</div>
                        <div style={{ fontSize: 12, color: "#2563eb" }}>{c.contactPhone}</div>
                        {c.invoiceEmail && <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.invoiceEmail}</div>}
                      </td>

                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#2563eb" }}>
                        {vnd(c.creditLimit)}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: c.currentDebt > 0 ? "#dc2626" : "#059669" }}>
                          {vnd(c.currentDebt)}
                        </div>
                        <div style={{ width: 100, height: 5, borderRadius: 4, backgroundColor: "#e5e7eb", marginTop: 4, overflow: "hidden" }}>
                          <div style={{ width: `${debtPercent}%`, height: "100%", backgroundColor: debtPercent > 80 ? "#dc2626" : "#2563eb" }} />
                        </div>
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#4b5563" }}>{c.paymentTermDays} ngày</div>
                        {c.discountPercent > 0 && (
                          <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                            Giảm {c.discountPercent}%
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 9999,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: c.status === "ACTIVE" ? "#ecfdf5" : "#fef2f2",
                            color: c.status === "ACTIVE" ? "#059669" : "#dc2626",
                          }}
                        >
                          {c.status === "ACTIVE" ? "✓ Đang chạy" : "⚠ Tạm khóa"}
                        </span>
                      </td>

                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(c)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #10b981",
                              backgroundColor: "#ecfdf5",
                              color: "#059669",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Thu nợ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#fff",
                              color: "#334155",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(c)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "none",
                              backgroundColor: c.status === "ACTIVE" ? "#fee2e2" : "#dbeafe",
                              color: c.status === "ACTIVE" ? "#dc2626" : "#2563eb",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {c.status === "ACTIVE" ? "Khóa" : "Mở"}
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
        {totalPages > 1 && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              Hiển thị trang {page} / {totalPages} (Tổng {total} doanh nghiệp)
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "#fff", cursor: page <= 1 ? "not-allowed" : "pointer" }}
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", backgroundColor: "#fff", cursor: page >= totalPages ? "not-allowed" : "pointer" }}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Tạo / Sửa Doanh Nghiệp */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: 16 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 14, width: "100%", maxWidth: 540, padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#111827" }}>
                {isCreating ? "Thêm Mới Doanh Nghiệp B2B" : `Sửa Thông Tin: ${editingCustomer?.companyName}`}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#6b7280" }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Tên công ty / Doanh nghiệp *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Công ty Cổ phần Giao Nhận Á Châu"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Mã số thuế (MST) *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 0314892184"
                    value={formData.taxCode}
                    onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Số điện thoại liên hệ *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 0988123456"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Người đại diện liên hệ</label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn Tuấn"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Email nhận hóa đơn</label>
                  <input
                    type="email"
                    placeholder="VD: ketoan@achau.com"
                    value={formData.invoiceEmail}
                    onChange={(e) => setFormData({ ...formData, invoiceEmail: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Địa chỉ trụ sở</label>
                <input
                  type="text"
                  placeholder="VD: Tòa nhà Bitexco, Q.1, TP.HCM"
                  value={formData.businessAddress}
                  onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Hạn mức tín dụng (VNĐ)</label>
                  <input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Kỳ thanh toán</label>
                  <select
                    value={formData.paymentTermDays}
                    onChange={(e) => setFormData({ ...formData, paymentTermDays: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  >
                    <option value="15">15 ngày</option>
                    <option value="30">30 ngày</option>
                    <option value="45">45 ngày</option>
                    <option value="60">60 ngày</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Chiết khấu (%)</label>
                  <input
                    type="number"
                    value={formData.discountPercent}
                    onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Ghi chú hợp đồng</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú điều khoản đặc biệt..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", backgroundColor: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: "#2563eb", color: "#fff", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Đang lưu..." : isCreating ? "Tạo Doanh Nghiệp" : "Lưu Thay Đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Ghi Nhận Thu Nợ */}
      {paymentCustomer && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: 16 }}>
          <div style={{ backgroundColor: "#fff", borderRadius: 14, width: "100%", maxWidth: 440, padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px", color: "#111827" }}>
              Ghi Nhận Thanh Toán Công Nợ
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
              Doanh nghiệp: <strong style={{ color: "#111827" }}>{paymentCustomer.companyName}</strong>
              <br />
              Dư nợ hiện tại: <strong style={{ color: "#dc2626" }}>{vnd(paymentCustomer.currentDebt)}</strong>
            </p>

            <form onSubmit={handleRecordPayment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Số tiền thanh toán (VNĐ) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="Nhập số tiền..."
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  Nội dung / Chứng từ chuyển khoản
                </label>
                <textarea
                  rows={2}
                  placeholder="VD: Ủy nhiệm chi số UNC-84920 ngân hàng VCB..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setPaymentCustomer(null)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", backgroundColor: "#fff", cursor: "pointer", fontWeight: 600 }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: "#059669", color: "#fff", fontWeight: 600, cursor: submittingPayment ? "not-allowed" : "pointer" }}
                >
                  {submittingPayment ? "Đang xử lý..." : "Xác Nhận Thu Nợ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
