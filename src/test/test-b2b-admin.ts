import { db } from "../db"
import { b2bCustomers } from "../db/schema"
import { eq } from "drizzle-orm"

async function runTest() {
  console.log("=== KIỂM THỬ 6 API B2B ADMIN ===")

  const {
    getB2bCustomers,
    getB2bCustomerDetail,
    createB2bCustomer,
    updateB2bCustomer,
    setB2bCustomerStatus,
    recordB2bPayment,
  } = await import("../lib/b2bService")

  const testTaxCode = "MST-TEST-" + Date.now().toString().slice(-6)

  // Test 1: Tạo mới doanh nghiệp
  console.log("1. Tạo mới khách hàng B2B...")
  const newC = await createB2bCustomer({
    companyName: "Công ty TNHH Vận Tải Kiểm Thử " + Date.now().toString().slice(-4),
    taxCode: testTaxCode,
    businessAddress: "123 Đường Test, Quận 1, TP.HCM",
    contactName: "Nguyễn Văn Test",
    contactPhone: "0909123456",
    invoiceEmail: "test@vantai.vn",
    creditLimit: 50000000,
    paymentTermDays: 30,
    discountPercent: 5,
    notes: "Tài khoản test B2B tự động",
  })
  console.log("-> Tạo thành công, ID:", newC.id)

  // Test 2: Lấy danh sách phân trang & tìm kiếm
  console.log("2. Lấy danh sách doanh nghiệp có tìm kiếm...")
  const list = await getB2bCustomers({ page: 1, limit: 10, search: testTaxCode })
  console.log("-> Số lượng tìm thấy:", list.total, "| Danh sách items:", list.customers.length)
  if (list.total === 0) throw new Error("Không tìm thấy doanh nghiệp vừa tạo")

  // Test 3: Lấy chi tiết doanh nghiệp theo ID
  console.log("3. Lấy chi tiết theo ID...")
  const detail = await getB2bCustomerDetail(newC.id)
  console.log("-> Chi tiết:", detail.companyName, "| Hạn mức:", detail.creditLimit)

  // Test 4: Cập nhật thông tin doanh nghiệp
  console.log("4. Cập nhật thông tin hạn mức nợ...")
  const updated = await updateB2bCustomer(newC.id, {
    creditLimit: 80000000,
    contactName: "Nguyễn Văn Test Updated",
  })
  console.log("-> Hạn mức mới:", updated.creditLimit, "| Người đại diện:", updated.contactName)

  // Test 5: Khóa / Kích hoạt trạng thái
  console.log("5. Đổi trạng thái sang SUSPENDED...")
  const suspended = await setB2bCustomerStatus(newC.id, "SUSPENDED")
  console.log("-> Trạng thái mới:", suspended.status)

  // Test 6: Ghi nhận thanh toán công nợ
  console.log("6. Ghi nhận thanh toán công nợ...")
  await db.update(b2bCustomers).set({ currentDebt: "15000000" }).where(eq(b2bCustomers.id, newC.id))
  const paid = await recordB2bPayment(newC.id, 5000000, "Thanh toán tạm ứng kỳ 1")
  console.log("-> Dư nợ sau khi thanh toán:", paid.remainingDebt, "(kỳ vọng 10,000,000)")

  // Dọn dẹp bản ghi test
  await db.delete(b2bCustomers).where(eq(b2bCustomers.id, newC.id))
  console.log("-> Đã xóa dữ liệu test dọn dẹp sạch sẽ.")

  console.log("=== HOÀN TẤT THÀNH CÔNG 6 API B2B SERVICE ===")
  process.exit(0)
}

runTest().catch((err) => {
  console.error("Test B2B thất bại:", err)
  process.exit(1)
})
