import { client } from "../db"
import { ApiError } from "./errors"

/**
 * Hằng số cấu hình mặc định cho hệ thống Ví Ký Quỹ & Hoa Hồng
 */
export const DEFAULT_MIN_DEPOSIT_LIMIT = 200000 // Hạn mức ký quỹ tối thiểu: 200.000 VNĐ
export const DEFAULT_COMMISSION_RATE = 0.2 // Tỷ lệ hoa hồng mặc định: 20%

export interface TopUpWalletDto {
  userId: string
  amount: number
  description?: string
  referenceCode?: string
  performedByUserId?: string
}

export interface AdjustWalletDto {
  targetUserId: string
  amount: number
  type: "ADMIN_ADJUSTMENT" | "BONUS" | "PENALTY" | "REFUND"
  description: string
  referenceCode?: string
  adminUserId: string
}

export interface GetTransactionsOptions {
  page?: number
  limit?: number
  type?: string
}

/**
 * 1. Lấy hoặc tự động tạo ví cho người dùng (nếu chưa có)
 */
export async function getOrCreateWallet(userId: string) {
  if (!userId) {
    throw new ApiError(400, "Thiếu thông tin userId")
  }

  // 1. Kiểm tra ví đã tồn tại chưa
  const existing = await client.unsafe(
    `
    SELECT id, user_id, balance, locked_balance, min_deposit_limit, currency, updated_at
    FROM wallets
    WHERE user_id = $1::uuid
    LIMIT 1
    `,
    [userId],
  )

  if (existing.length > 0) {
    return existing[0]
  }

  // 2. Nếu chưa có, tạo mới với giá trị mặc định
  const created = await client.unsafe(
    `
    INSERT INTO wallets (
      user_id,
      balance,
      locked_balance,
      min_deposit_limit,
      currency,
      updated_at
    ) VALUES (
      $1::uuid,
      0.00,
      0.00,
      $2::numeric,
      'VND',
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING id, user_id, balance, locked_balance, min_deposit_limit, currency, updated_at
    `,
    [userId, DEFAULT_MIN_DEPOSIT_LIMIT],
  )

  return created[0]
}

/**
 * 2. Lấy thông tin chi tiết số dư ví của tài xế / khách hàng
 */
export async function getWalletDetails(userId: string) {
  const wallet = await getOrCreateWallet(userId)

  const balance = Number(wallet.balance || 0)
  const lockedBalance = Number(wallet.locked_balance || 0)
  const availableBalance = balance - lockedBalance
  const minDepositLimit = Number(
    wallet.min_deposit_limit || DEFAULT_MIN_DEPOSIT_LIMIT,
  )

  // Điều kiện đủ ký quỹ: Số dư khả dụng >= Hạn mức ký quỹ tối thiểu
  const isDepositQualified = availableBalance >= minDepositLimit

  return {
    walletId: wallet.id,
    userId: wallet.user_id,
    balance,
    lockedBalance,
    availableBalance,
    minDepositLimit,
    isDepositQualified,
    shortfall: isDepositQualified ? 0 : minDepositLimit - availableBalance,
    currency: wallet.currency || "VND",
    updatedAt: wallet.updated_at,
  }
}

/**
 * 3. Kiểm tra tính đủ điều kiện ký quỹ của tài xế (Trước khi Bật Online hoặc Nhận cuốc)
 */
export async function checkDriverDepositEligibility(driverUserId: string) {
  const wallet = await getWalletDetails(driverUserId)

  if (!wallet.isDepositQualified) {
    return {
      eligible: false,
      availableBalance: wallet.availableBalance,
      minDepositLimit: wallet.minDepositLimit,
      shortfall: wallet.shortfall,
      message: `Số dư ví ký quỹ khả dụng (${wallet.availableBalance.toLocaleString("vi-VN")} đ) chưa đạt hạn mức tối thiểu (${wallet.minDepositLimit.toLocaleString("vi-VN")} đ). Vui lòng nạp thêm tối thiểu ${wallet.shortfall.toLocaleString("vi-VN")} đ để nhận chuyến.`,
    }
  }

  return {
    eligible: true,
    availableBalance: wallet.availableBalance,
    minDepositLimit: wallet.minDepositLimit,
    shortfall: 0,
    message: "Ví ký quỹ đủ điều kiện hoạt động và nhận chuyến.",
  }
}

/**
 * 4. Nạp tiền vào ví tài xế (Atomic Transaction & Row-level Locking)
 */
export async function topUpWallet(dto: TopUpWalletDto) {
  const { userId, amount, description, referenceCode } = dto

  if (!userId) {
    throw new ApiError(400, "Thiếu thông tin userId")
  }

  const numAmount = Number(amount)
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new ApiError(400, "Số tiền nạp phải là số dương lớn hơn 0")
  }

  // Đảm bảo ví tồn tại trước khi lock
  await getOrCreateWallet(userId)

  // Bắt đầu Transaction với khóa dòng FOR UPDATE để chống Race Condition
  return await client.begin(async (sql) => {
    // 1. Lock dòng ví của người dùng
    const walletRows = await sql`
      SELECT id, user_id, balance, locked_balance, min_deposit_limit
      FROM wallets
      WHERE user_id = ${userId}::uuid
      FOR UPDATE
    `

    if (walletRows.length === 0) {
      throw new ApiError(404, "Không tìm thấy ví người dùng")
    }

    const currentWallet = walletRows[0]
    const balanceBefore = Number(currentWallet.balance || 0)
    const balanceAfter = balanceBefore + numAmount

    // 2. Cập nhật số dư mới
    const updatedWallet = await sql`
      UPDATE wallets
      SET 
        balance = ${balanceAfter}::numeric,
        updated_at = NOW()
      WHERE id = ${currentWallet.id}::uuid
      RETURNING id, balance, locked_balance, min_deposit_limit, updated_at
    `

    const refCode =
      referenceCode ||
      `TOPUP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`
    const desc =
      description || `Nạp ${numAmount.toLocaleString("vi-VN")} đ vào ví ký quỹ`

    // 3. Ghi lịch sử biến động số dư (Ledger)
    const txRows = await sql`
      INSERT INTO wallet_transactions (
        wallet_id,
        booking_id,
        amount,
        balance_before,
        balance_after,
        type,
        description,
        reference_code,
        created_at
      ) VALUES (
        ${currentWallet.id}::uuid,
        NULL,
        ${numAmount}::numeric,
        ${balanceBefore}::numeric,
        ${balanceAfter}::numeric,
        'TOPUP',
        ${desc},
        ${refCode},
        NOW()
      )
      RETURNING id, amount, balance_before, balance_after, type, description, reference_code, created_at
    `

    return {
      success: true,
      transaction: txRows[0],
      wallet: {
        walletId: updatedWallet[0].id,
        balance: Number(updatedWallet[0].balance),
        lockedBalance: Number(updatedWallet[0].locked_balance),
        availableBalance:
          Number(updatedWallet[0].balance) -
          Number(updatedWallet[0].locked_balance),
        minDepositLimit: Number(updatedWallet[0].min_deposit_limit),
      },
      message: `Nạp thành công ${numAmount.toLocaleString("vi-VN")} đ vào ví ký quỹ`,
    }
  })
}

/**
 * 5. Tự động trừ % hoa hồng khi hoàn thành cuốc tiền mặt (hoặc cộng doanh thu cuốc online/ví)
 * HỖ TRỢ CHỐNG TRỪ TRÙNG (IDEMPOTENCY) & TRANSACTION AN TOÀN TUYỆT ĐỐI
 */
export async function deductTripCommission(bookingId: string) {
  if (!bookingId) {
    throw new ApiError(400, "Thiếu thông tin bookingId")
  }

  // 1. Lấy thông tin chuyến xe và tài xế
  const bookingRows = await client.unsafe(
    `
    SELECT 
      b.id,
      b.booking_code,
      b.status,
      b.total_price,
      b.driver_commission,
      b.payment_method,
      b.payment_status,
      b.driver_id,
      dp.user_id as driver_user_id,
      u.full_name as driver_name
    FROM bookings b
    JOIN driver_profiles dp ON dp.id = b.driver_id
    JOIN users u ON u.id = dp.user_id
    WHERE b.id = $1::uuid
    LIMIT 1
    `,
    [bookingId],
  )

  if (bookingRows.length === 0) {
    throw new ApiError(404, "Không tìm thấy chuyến xe hoặc tài xế phụ trách")
  }

  const booking = bookingRows[0]
  const driverUserId = booking.driver_user_id

  // 2. Kiểm tra tính Idempotent: Cuốc xe này đã được xử lý khấu trừ hoa hồng chưa?
  const existingTx = await client.unsafe(
    `
    SELECT id, amount, type, created_at, balance_before, balance_after
    FROM wallet_transactions
    WHERE booking_id = $1::uuid AND type IN ('COMMISSION_DEDUCTION', 'TRIP_INCOME')
    LIMIT 1
    `,
    [bookingId],
  )

  if (existingTx.length > 0) {
    return {
      alreadyProcessed: true,
      message: "Hoa hồng chuyến xe này đã được xử lý trước đó.",
      transaction: existingTx[0],
      bookingId: booking.id,
      bookingCode: booking.booking_code,
    }
  }

  const totalPrice = Number(booking.total_price)
  let commission = Number(booking.driver_commission)
  if (!commission || commission <= 0) {
    // Nếu chưa có commission trong booking, tính mặc định 20%
    commission = Math.round(totalPrice * DEFAULT_COMMISSION_RATE)
  }

  // Đảm bảo ví tài xế tồn tại
  await getOrCreateWallet(driverUserId)

  // 3. Thực thi Transaction nguyên tử (ACID)
  return await client.begin(async (sql) => {
    // 3.1 Lock dòng ví tài xế
    const walletRows = await sql`
      SELECT id, balance, locked_balance, min_deposit_limit
      FROM wallets
      WHERE user_id = ${driverUserId}::uuid
      FOR UPDATE
    `

    if (walletRows.length === 0) {
      throw new ApiError(404, "Không tìm thấy ví tài xế để trừ hoa hồng")
    }

    const currentWallet = walletRows[0]
    const balanceBefore = Number(currentWallet.balance || 0)
    const paymentMethod = String(booking.payment_method || "CASH").toUpperCase()

    let balanceAfter: number
    let txAmount: number
    let txType: string
    let txDescription: string

    if (paymentMethod === "CASH") {
      // TRƯỜNG HỢP 1: CUỐC TIỀN MẶT (CASH)
      // Khách trả tiền mặt toàn bộ cước phí cho tài xế.
      // Sàn tự động trừ số tiền hoa hồng từ Ví Ký Quỹ của tài xế.
      txAmount = -commission
      balanceAfter = balanceBefore - commission
      txType = "COMMISSION_DEDUCTION"
      txDescription = `Khấu trừ ${commission.toLocaleString("vi-VN")} đ hoa hồng (${Math.round((commission / totalPrice) * 100)}%) chuyến xe ${booking.booking_code} (Khách trả tiền mặt)`
    } else {
      // TRƯỜNG HỢP 2: CUỐC TRẢ BẰNG VÍ / ONLINE (WALLET, VNPAY, MOMO)
      // Khách đã trả tiền vào hệ thống, tài xế không nhận tiền mặt từ khách.
      // Hệ thống cộng tiền thu nhập thực nhận (Doanh thu - Hoa hồng) vào Ví tài xế.
      const netEarnings = totalPrice - commission
      txAmount = netEarnings
      balanceAfter = balanceBefore + netEarnings
      txType = "TRIP_INCOME"
      txDescription = `Cộng doanh thu ${netEarnings.toLocaleString("vi-VN")} đ cho chuyến xe ${booking.booking_code} (Cước: ${totalPrice.toLocaleString("vi-VN")} đ, Hoa hồng sàn: -${commission.toLocaleString("vi-VN")} đ)`
    }

    // 3.2 Cập nhật số dư ví tài xế
    const updatedWallet = await sql`
      UPDATE wallets
      SET 
        balance = ${balanceAfter}::numeric,
        updated_at = NOW()
      WHERE id = ${currentWallet.id}::uuid
      RETURNING id, balance, locked_balance, min_deposit_limit
    `

    const refCode = `COMM_${booking.booking_code}`

    // 3.3 Ghi sổ giao dịch vào wallet_transactions
    const txRows = await sql`
      INSERT INTO wallet_transactions (
        wallet_id,
        booking_id,
        amount,
        balance_before,
        balance_after,
        type,
        description,
        reference_code,
        created_at
      ) VALUES (
        ${currentWallet.id}::uuid,
        ${bookingId}::uuid,
        ${txAmount}::numeric,
        ${balanceBefore}::numeric,
        ${balanceAfter}::numeric,
        ${txType},
        ${txDescription},
        ${refCode},
        NOW()
      )
      RETURNING id, amount, balance_before, balance_after, type, description, reference_code, created_at
    `

    // 3.4 Đảm bảo cập nhật payment_status của chuyến xe sang PAID
    await sql`
      UPDATE bookings
      SET 
        payment_status = 'PAID'::payment_status,
        updated_at = NOW()
      WHERE id = ${bookingId}::uuid
    `

    const finalAvailableBalance =
      Number(updatedWallet[0].balance) - Number(updatedWallet[0].locked_balance)
    const minLimit = Number(updatedWallet[0].min_deposit_limit)

    return {
      alreadyProcessed: false,
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      paymentMethod,
      totalPrice,
      commission,
      netEarnings: paymentMethod === "CASH" ? 0 : totalPrice - commission,
      transaction: txRows[0],
      driverWallet: {
        walletId: updatedWallet[0].id,
        balance: Number(updatedWallet[0].balance),
        availableBalance: finalAvailableBalance,
        minDepositLimit: minLimit,
        isDepositQualified: finalAvailableBalance >= minLimit,
      },
      message:
        paymentMethod === "CASH"
          ? `Đã khấu trừ ${commission.toLocaleString("vi-VN")} đ hoa hồng vào ví tài xế`
          : `Đã cộng thu nhập ${txAmount.toLocaleString("vi-VN")} đ vào ví tài xế`,
    }
  })
}

/**
 * 6. Lấy danh sách lịch sử giao dịch ví (phân trang)
 */
export async function getWalletTransactions(
  userId: string,
  options?: GetTransactionsOptions,
) {
  const wallet = await getOrCreateWallet(userId)

  const page = Math.max(1, Number(options?.page || 1))
  const limit = Math.min(100, Math.max(1, Number(options?.limit || 20)))
  const offset = (page - 1) * limit
  const typeFilter = options?.type ? String(options.type).trim() : null

  // 1. Đếm tổng số giao dịch
  let countQuery = `SELECT count(*) as total FROM wallet_transactions WHERE wallet_id = $1::uuid`
  const countParams: any[] = [wallet.id]

  if (typeFilter) {
    countQuery += ` AND type = $2`
    countParams.push(typeFilter)
  }

  const countRes = await client.unsafe(countQuery, countParams)
  const total = parseInt(countRes[0]?.total || "0", 10)

  // 2. Lấy danh sách giao dịch
  let dataQuery = `
    SELECT 
      wt.id,
      wt.wallet_id,
      wt.booking_id,
      wt.amount,
      wt.balance_before,
      wt.balance_after,
      wt.type,
      wt.description,
      wt.reference_code,
      wt.created_at,
      b.booking_code,
      b.total_price as booking_total_price,
      b.payment_method as booking_payment_method
    FROM wallet_transactions wt
    LEFT JOIN bookings b ON b.id = wt.booking_id
    WHERE wt.wallet_id = $1::uuid
  `
  const dataParams: any[] = [wallet.id]

  if (typeFilter) {
    dataQuery += ` AND wt.type = $2`
    dataParams.push(typeFilter)
    dataQuery += ` ORDER BY wt.created_at DESC LIMIT $3 OFFSET $4`
    dataParams.push(limit, offset)
  } else {
    dataQuery += ` ORDER BY wt.created_at DESC LIMIT $2 OFFSET $3`
    dataParams.push(limit, offset)
  }

  const rows = await client.unsafe(dataQuery, dataParams)

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    transactions: rows.map((r: any) => ({
      id: r.id,
      bookingId: r.booking_id,
      bookingCode: r.booking_code || null,
      amount: Number(r.amount),
      balanceBefore:
        r.balance_before !== null ? Number(r.balance_before) : null,
      balanceAfter: r.balance_after !== null ? Number(r.balance_after) : null,
      type: r.type,
      description: r.description,
      referenceCode: r.reference_code,
      createdAt: r.created_at,
      bookingInfo: r.booking_code
        ? {
            code: r.booking_code,
            totalPrice: Number(r.booking_total_price || 0),
            paymentMethod: r.booking_payment_method,
          }
        : null,
    })),
  }
}

/**
 * 7. Admin điều chỉnh số dư ví (Thưởng, Phạt, Hoàn tiền, Nạp tiền thủ công)
 */
export async function adminAdjustWallet(dto: AdjustWalletDto) {
  const {
    targetUserId,
    amount,
    type,
    description,
    referenceCode,
    adminUserId,
  } = dto

  if (!targetUserId) {
    throw new ApiError(400, "Thiếu thông tin targetUserId")
  }
  if (!description) {
    throw new ApiError(400, "Vui lòng nhập lý do điều chỉnh số dư ví")
  }

  const numAmount = Number(amount)
  if (isNaN(numAmount) || numAmount === 0) {
    throw new ApiError(400, "Số tiền điều chỉnh phải khác 0")
  }

  await getOrCreateWallet(targetUserId)

  return await client.begin(async (sql) => {
    const walletRows = await sql`
      SELECT id, balance, locked_balance, min_deposit_limit
      FROM wallets
      WHERE user_id = ${targetUserId}::uuid
      FOR UPDATE
    `

    if (walletRows.length === 0) {
      throw new ApiError(404, "Không tìm thấy ví người dùng")
    }

    const currentWallet = walletRows[0]
    const balanceBefore = Number(currentWallet.balance || 0)
    const balanceAfter = balanceBefore + numAmount

    const updated = await sql`
      UPDATE wallets
      SET 
        balance = ${balanceAfter}::numeric,
        updated_at = NOW()
      WHERE id = ${currentWallet.id}::uuid
      RETURNING id, balance, locked_balance, min_deposit_limit, updated_at
    `

    const refCode = referenceCode || `ADMIN_ADJ_${Date.now()}`

    const txRows = await sql`
      INSERT INTO wallet_transactions (
        wallet_id,
        booking_id,
        amount,
        balance_before,
        balance_after,
        type,
        description,
        reference_code,
        created_at
      ) VALUES (
        ${currentWallet.id}::uuid,
        NULL,
        ${numAmount}::numeric,
        ${balanceBefore}::numeric,
        ${balanceAfter}::numeric,
        ${type || "ADMIN_ADJUSTMENT"},
        ${description},
        ${refCode},
        NOW()
      )
      RETURNING id, amount, balance_before, balance_after, type, description, reference_code, created_at
    `

    return {
      success: true,
      transaction: txRows[0],
      wallet: {
        walletId: updated[0].id,
        balance: Number(updated[0].balance),
        availableBalance:
          Number(updated[0].balance) - Number(updated[0].locked_balance),
      },
      message: `Admin đã điều chỉnh ${
        numAmount > 0 ? "+" : ""
      }${numAmount.toLocaleString("vi-VN")} đ vào ví người dùng`,
    }
  })
}

/**
 * 8. Admin lấy danh sách ví của tất cả tài xế kèm trạng thái ký quỹ
 */
export async function getAllDriverWallets(options?: {
  page?: number
  limit?: number
  search?: string
}) {
  const page = Math.max(1, Number(options?.page || 1))
  const limit = Math.min(100, Math.max(1, Number(options?.limit || 20)))
  const offset = (page - 1) * limit
  const search = options?.search ? `%${options.search.trim()}%` : null

  let countQuery = `
    SELECT count(*) as total
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE 1=1
  `
  const countParams: any[] = []

  if (search) {
    countQuery += ` AND (u.full_name ILIKE $1 OR u.phone ILIKE $1 OR dp.license_plate ILIKE $1)`
    countParams.push(search)
  }

  const countRes = await client.unsafe(countQuery, countParams)
  const total = parseInt(countRes[0]?.total || "0", 10)

  let dataQuery = `
    SELECT 
      dp.id as driver_id,
      dp.user_id,
      u.full_name,
      u.phone,
      u.avatar_url,
      dp.license_plate,
      dp.kyc_status,
      dp.is_online,
      dp.is_active,
      COALESCE(w.id, NULL) as wallet_id,
      COALESCE(w.balance, 0) as balance,
      COALESCE(w.locked_balance, 0) as locked_balance,
      COALESCE(w.min_deposit_limit, 200000) as min_deposit_limit,
      w.updated_at as wallet_updated_at
    FROM driver_profiles dp
    JOIN users u ON u.id = dp.user_id
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE 1=1
  `
  const dataParams: any[] = []

  if (search) {
    dataQuery += ` AND (u.full_name ILIKE $1 OR u.phone ILIKE $1 OR dp.license_plate ILIKE $1)`
    dataParams.push(search)
    dataQuery += ` ORDER BY dp.created_at DESC LIMIT $2 OFFSET $3`
    dataParams.push(limit, offset)
  } else {
    dataQuery += ` ORDER BY dp.created_at DESC LIMIT $1 OFFSET $2`
    dataParams.push(limit, offset)
  }

  const rows = await client.unsafe(dataQuery, dataParams)

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    drivers: rows.map((r: any) => {
      const balance = Number(r.balance || 0)
      const lockedBalance = Number(r.locked_balance || 0)
      const availableBalance = balance - lockedBalance
      const minDepositLimit = Number(
        r.min_deposit_limit || DEFAULT_MIN_DEPOSIT_LIMIT,
      )
      const isDepositQualified = availableBalance >= minDepositLimit

      return {
        driverId: r.driver_id,
        userId: r.user_id,
        fullName: r.full_name,
        phone: r.phone,
        avatarUrl: r.avatar_url,
        licensePlate: r.license_plate,
        kycStatus: r.kyc_status,
        isOnline: r.is_online,
        isActive: r.is_active,
        wallet: {
          walletId: r.wallet_id,
          balance,
          lockedBalance,
          availableBalance,
          minDepositLimit,
          isDepositQualified,
          updatedAt: r.wallet_updated_at,
        },
      }
    }),
  }
}
