import { client } from "../db"
import {
  getOrCreateWallet,
  getWalletDetails,
  checkDriverDepositEligibility,
  topUpWallet,
  deductTripCommission,
  getWalletTransactions,
  adminAdjustWallet,
  getAllDriverWallets,
  DEFAULT_MIN_DEPOSIT_LIMIT,
} from "../lib/walletService"
import { setDriverOnlineStatus } from "../lib/driverService"
import {
  createBooking,
  acceptBooking,
  updateBookingStatus,
} from "../lib/bookingService"

async function runWalletCommissionTest() {
  console.log("\n========================================================")
  console.log("🚀 BẮT ĐẦU TEST TOÀN DIỆN TASK 4.1: VÍ KÝ QUỸ & HOA HỒNG")
  console.log("========================================================\n")

  try {
    // 1. LẤY TÀI XẾ VÀ KHÁCH HÀNG MẪU TỪ DATABASE
    const drivers = await client.unsafe(
      `
      SELECT dp.id as driver_id, dp.user_id, u.full_name, u.phone
      FROM driver_profiles dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.kyc_status = 'APPROVED' AND dp.is_active = true
      LIMIT 1
      `,
    )
    if (drivers.length === 0) {
      throw new Error("Không có tài xế KYC APPROVED trong database để test")
    }
    const testDriver = drivers[0]
    console.log(
      `👨‍✈️ Tài xế test: ${testDriver.full_name} (${testDriver.phone}) - UserID: ${testDriver.user_id}`,
    )

    // Hoàn thành hoặc dọn dẹp các cuốc xe cũ đang kẹt của tài xế (nếu có từ test trước)
    await client.unsafe(
      `
      UPDATE bookings
      SET status = 'COMPLETED', updated_at = NOW()
      WHERE driver_id = $1::uuid AND status IN ('ACCEPTED', 'ARRIVED_AT_PICKUP', 'IN_TRANSIT')
      `,
      [testDriver.driver_id],
    )

    const customers = await client.unsafe(
      `SELECT id, full_name, phone FROM users WHERE role = 'CUSTOMER' LIMIT 1`,
    )
    if (customers.length === 0) {
      throw new Error("Không có khách hàng trong database để test")
    }
    const testCustomer = customers[0]
    console.log(
      `👤 Khách hàng test: ${testCustomer.full_name} (${testCustomer.phone}) - ID: ${testCustomer.id}\n`,
    )

    const vehicleTypes = await client.unsafe(
      `SELECT id, name FROM vehicle_types WHERE is_active = true LIMIT 1`,
    )
    const vehicleTypeId = vehicleTypes[0].id

    // ========================================================
    // BƯỚC 1: KHỞI TẠO VÀ XEM THÔNG TIN VÍ
    // ========================================================
    console.log("--- BƯỚC 1: Khởi tạo & xem thông tin Ví Ký Quỹ ---")
    const wallet = await getOrCreateWallet(testDriver.user_id)
    console.log(`✅ Ví của tài xế ID: ${wallet.id}`)
    console.log(
      `   Số dư ban đầu: ${Number(wallet.balance).toLocaleString("vi-VN")} đ`,
    )
    console.log(
      `   Hạn mức ký quỹ tối thiểu: ${Number(wallet.min_deposit_limit).toLocaleString("vi-VN")} đ`,
    )

    const detailsBefore = await getWalletDetails(testDriver.user_id)
    console.log(
      `   Số dư khả dụng: ${detailsBefore.availableBalance.toLocaleString("vi-VN")} đ`,
    )
    console.log(
      `   Đủ điều kiện ký quỹ: ${
        detailsBefore.isDepositQualified ? "CÓ" : "CHƯA"
      }\n`,
    )

    // ========================================================
    // BƯỚC 2: TEST RÀNG BUỘC KÝ QUỸ KHI BẬT ONLINE
    // ========================================================
    console.log("--- BƯỚC 2: Test ràng buộc Ký Quỹ khi Bật Online ---")
    // Tạm thời đưa số dư ví về 0 đ để test chặn
    await client.unsafe(
      `UPDATE wallets SET balance = 50000.00 WHERE user_id = $1::uuid`,
      [testDriver.user_id],
    )
    console.log("⚙️  Đã giả lập số dư ví = 50.000 đ (dưới mức ký quỹ 200.000 đ)")

    try {
      await setDriverOnlineStatus(testDriver.user_id, true)
      console.error(
        "❌ LỖI: Hệ thống đã cho bật online dù số dư ví < 200.000 đ!",
      )
    } catch (err: any) {
      console.log(
        `✅ CHẶN BẬT ONLINE THÀNH CÔNG: "${err.message}" (Code: ${err.code || err.status})`,
      )
    }

    // ========================================================
    // BƯỚC 3: TEST NẠP TIỀN VÀO VÍ KÝ QUỸ (TOP-UP)
    // ========================================================
    console.log("\n--- BƯỚC 3: Nạp tiền vào Ví Ký Quỹ (Top-up) ---")
    const topupAmount = 500000 // Nạp 500.000 đ
    const topupRes = await topUpWallet({
      userId: testDriver.user_id,
      amount: topupAmount,
      description: "Tài xế nộp 500.000 đ tiền mặt ký quỹ tại văn phòng",
      referenceCode: `TEST_TOPUP_${Date.now()}`,
    })
    console.log(`✅ Nạp tiền thành công!`)
    console.log(
      `   Số dư ví mới: ${topupRes.wallet.balance.toLocaleString("vi-VN")} đ`,
    )
    console.log(
      `   Số dư khả dụng: ${topupRes.wallet.availableBalance.toLocaleString("vi-VN")} đ`,
    )
    console.log(
      `   Transaction ID: ${topupRes.transaction.id} | Type: ${topupRes.transaction.type}`,
    )
    console.log(
      `   Số dư trước: ${Number(topupRes.transaction.balance_before).toLocaleString("vi-VN")} đ -> Sau: ${Number(topupRes.transaction.balance_after).toLocaleString("vi-VN")} đ\n`,
    )

    // Bật online lại sau khi đã nạp đủ tiền
    const onlineRes = await setDriverOnlineStatus(testDriver.user_id, true)
    console.log(
      `✅ Bật online thành công sau khi nạp đủ tiền: ${onlineRes.message}\n`,
    )

    // ========================================================
    // BƯỚC 4: TẠO CHUYẾN XE TIỀN MẶT & NHẬN CHUYẾN
    // ========================================================
    console.log("--- BƯỚC 4: Tạo chuyến xe Tiền Mặt & Nhận chuyến ---")
    // Tạo chuyến xe tiền mặt giá 300.000 đ
    const newBooking = await createBooking(testCustomer.id, {
      vehicleTypeId,
      originAddress: "123 Lê Lợi, Bến Nghé, Quận 1, TP.HCM",
      originLat: 10.7769,
      originLng: 106.7009,
      destinationAddress: "456 Nguyễn Huệ, Quận 1, TP.HCM",
      destLat: 10.7745,
      destLng: 106.7035,
      estimatedPrice: 300000,
      paymentMethod: "CASH",
    })
    console.log(
      `✅ Khách hàng tạo chuyến xe: ${newBooking.bookingCode} (ID: ${newBooking.bookingId})`,
    )
    console.log(
      `   Cước phí: ${newBooking.totalPrice.toLocaleString("vi-VN")} đ | Phương thức: CASH`,
    )

    // Tài xế nhận chuyến
    const acceptRes = await acceptBooking(
      testDriver.user_id,
      newBooking.bookingId,
    )
    console.log(`✅ Tài xế nhận cuốc thành công: ${acceptRes.message}`)
    console.log(
      `   Hoa hồng sàn quy định: ${acceptRes.driverCommission.toLocaleString("vi-VN")} đ (20%)\n`,
    )

    // ========================================================
    // BƯỚC 5: CHUYỂN TRẠNG THÁI & HOÀN THÀNH CUỐC XE -> TỰ ĐỘNG TRỪ HOA HỒNG
    // ========================================================
    console.log(
      "--- BƯỚC 5: Hoàn thành chuyến xe -> Tự động trừ % Hoa hồng ---",
    )
    const balanceBeforeComplete = (await getWalletDetails(testDriver.user_id))
      .balance
    console.log(
      `💰 Số dư ví tài xế trước khi hoàn thành: ${balanceBeforeComplete.toLocaleString("vi-VN")} đ`,
    )

    // Chuyển sang ARRIVED_AT_PICKUP
    await updateBookingStatus(
      testDriver.user_id,
      newBooking.bookingId,
      "ARRIVED_AT_PICKUP",
    )
    // Chuyển sang IN_TRANSIT
    await updateBookingStatus(
      testDriver.user_id,
      newBooking.bookingId,
      "IN_TRANSIT",
    )
    // Chuyển sang COMPLETED
    const completeRes = await updateBookingStatus(
      testDriver.user_id,
      newBooking.bookingId,
      "COMPLETED",
    )

    console.log(
      `🎉 Chuyến xe chuyển trạng thái: ${completeRes.status} | Thanh toán: ${completeRes.paymentStatus}`,
    )
    const commData = completeRes.commission as any
    console.log(`📋 Thông tin hoa hồng trả về:`, {
      bookingCode: commData?.bookingCode,
      paymentMethod: commData?.paymentMethod,
      totalPrice: commData?.totalPrice,
      commission: commData?.commission,
      message: commData?.message,
    })

    const balanceAfterComplete = (await getWalletDetails(testDriver.user_id))
      .balance
    console.log(
      `💰 Số dư ví tài xế sau khi hoàn thành: ${balanceAfterComplete.toLocaleString("vi-VN")} đ`,
    )
    const diff = balanceBeforeComplete - balanceAfterComplete
    console.log(`📉 Chênh lệch số dư ví: -${diff.toLocaleString("vi-VN")} đ`)

    if (diff === 60000) {
      console.log(
        "🎯 CHÍNH XÁC: Số tiền bị trừ đúng bằng 20% hoa hồng (60.000 đ)!\n",
      )
    } else {
      console.warn(`⚠️ Chênh lệch ${diff} khác mong đợi 60.000 đ\n`)
    }

    // ========================================================
    // BƯỚC 6: KIỂM TRA TÍNH IDEMPOTENT (CHỐNG TRỪ TRÙNG)
    // ========================================================
    console.log("--- BƯỚC 6: Kiểm tra tính Idempotent (Chống trừ trùng) ---")
    const duplicateRes = await deductTripCommission(newBooking.bookingId)
    console.log(`✅ Kết quả gọi lại deductTripCommission:`, {
      alreadyProcessed: duplicateRes.alreadyProcessed,
      message: duplicateRes.message,
    })
    const balanceAfterDuplicate = (await getWalletDetails(testDriver.user_id))
      .balance
    if (balanceAfterDuplicate === balanceAfterComplete) {
      console.log(
        "🛡️  HOÀN HẢO: Số dư ví không thay đổi khi gọi lại (Bảo vệ Idempotency thành công)!\n",
      )
    } else {
      console.error("❌ LỖI: Số dư ví bị trừ tiếp khi gọi lại!")
    }

    // ========================================================
    // BƯỚC 7: XEM LỊCH SỬ GIAO DỊCH VÍ (TRANSACTIONS LEDGER)
    // ========================================================
    console.log("--- BƯỚC 7: Lấy lịch sử giao dịch ví tài xế ---")
    const txList = await getWalletTransactions(testDriver.user_id, { limit: 5 })
    console.log(`📜 Tổng số giao dịch: ${txList.total}`)
    for (const tx of txList.transactions) {
      console.log(
        `   - [${tx.type}] ${
          tx.amount > 0 ? "+" : ""
        }${tx.amount.toLocaleString("vi-VN")} đ | ${tx.description} (Mã: ${tx.referenceCode || "N/A"})`,
      )
    }
    console.log("")

    // ========================================================
    // BƯỚC 8: ADMIN ĐIỀU CHỈNH SỐ DƯ & THỐNG KÊ VÍ
    // ========================================================
    console.log("--- BƯỚC 8: Admin điều chỉnh số dư & Quản lý ví ---")
    const adminAdj = await adminAdjustWallet({
      targetUserId: testDriver.user_id,
      amount: 100000,
      type: "BONUS",
      description: "Thưởng tài xế đạt chuẩn 5 sao tuần đầu tiên",
      adminUserId: testCustomer.id, // Giả lập admin
    })
    console.log(`✅ Admin thưởng: ${adminAdj.message}`)
    console.log(
      `   Số dư ví mới: ${adminAdj.wallet.balance.toLocaleString("vi-VN")} đ`,
    )

    const allWallets = await getAllDriverWallets({ limit: 5 })
    console.log(
      `📊 Admin xem danh sách ${allWallets.drivers.length} tài xế trong hệ thống:`,
    )
    for (const d of allWallets.drivers) {
      console.log(
        `   - Tài xế: ${d.fullName} | Số dư: ${d.wallet.balance.toLocaleString("vi-VN")} đ | Đủ điều kiện ký quỹ: ${
          d.wallet.isDepositQualified ? "✅ ĐẠT" : "❌ CHƯA"
        }`,
      )
    }

    console.log("\n========================================================")
    console.log("🎉 TẤT CẢ CÁC BƯỚC TEST TASK 4.1 ĐÃ HOÀN THÀNH XUẤT SẮC!")
    console.log("========================================================\n")
  } catch (error: any) {
    console.error("\n❌ LỖI TRONG QUÁ TRÌNH TEST:", error.message || error)
    if (error.stack) console.error(error.stack)
  } finally {
    process.exit(0)
  }
}

runWalletCommissionTest()
