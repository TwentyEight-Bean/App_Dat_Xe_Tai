import { Router } from "express"
import { eq, or } from "drizzle-orm"
import { db } from "../../db"
import { users, driverProfiles } from "../../db/schema"
import { comparePassword, hashPassword } from "../../lib/hash"
import { generateToken } from "../../lib/auth"
import { requestOtp, verifyOtp, verifyOtpCodeOnly } from "../../lib/otpService"
import { validateAndNormalizePhone } from "../../lib/sms/types"
import { validateVietnamesePhone } from "../../lib/phoneValidation"
import { getOrCreateWallet } from "../../lib/walletService"
import { getClientIp } from "../../lib/ipUtils"
import {
  registerDeviceToken,
  removeDeviceToken,
} from "../../lib/notificationService"
import { requireAuth, type AuthRequest } from "../middleware"

const router = Router()

/**
 * POST /api/v1/auth/admin/login
 * Đăng nhập quản trị viên với Email / Password, kiểm tra bcrypt hash & cấp JWT ADMIN
 */
router.post("/admin/login", async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ Email và Mật khẩu quản trị",
      })
    }

    const input = (email || "").trim()
    const targetEmail =
      input.toLowerCase() === "admin" ? "admin@fastdrop.vn" : input

    // Tìm tài khoản theo email hoặc phone
    let [foundUser] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, targetEmail), eq(users.phone, input)))
      .limit(1)

    // Nếu hệ thống chưa có tài khoản admin nào và đăng nhập bằng tài khoản mẫu
    if (
      !foundUser &&
      targetEmail === "admin@fastdrop.vn" &&
      password === "admin123"
    ) {
      const defaultPasswordHash = await hashPassword("admin123")
      const [seededAdmin] = await db
        .insert(users)
        .values({
          phone: "0900000000",
          email: "admin@fastdrop.vn",
          fullName: "Minh Anh (Quản trị viên)",
          passwordHash: defaultPasswordHash,
          role: "ADMIN",
          status: "ACTIVE",
        })
        .returning()
      foundUser = seededAdmin
    }

    if (!foundUser) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản quản trị viên không tồn tại trên hệ thống",
      })
    }

    if (foundUser.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản này không có quyền truy cập Quản trị viên (ADMIN)",
      })
    }

    if (foundUser.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản quản trị viên này đã bị khóa",
      })
    }

    if (!foundUser.passwordHash) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản chưa thiết lập mật khẩu bảo mật",
      })
    }

    // So khớp mật khẩu với mã bcrypt hash từ src/lib/hash.ts
    const isMatch = await comparePassword(password, foundUser.passwordHash)
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Mật khẩu không chính xác. Vui lòng thử lại.",
      })
    }

    // Cấp phát JWT token với quyền ADMIN
    const token = generateToken({
      userId: foundUser.id,
      role: "ADMIN",
      phone: foundUser.phone || "0900000000",
    })

    return res.json({
      success: true,
      message: "Đăng nhập Quản trị viên thành công!",
      token,
      user: {
        id: foundUser.id,
        email: foundUser.email,
        fullName: foundUser.fullName || "Quản trị viên",
        role: foundUser.role,
      },
    })
  } catch (err) {
    next(err)
  }
})

router.post("/request-otp", async (req, res, next) => {
  try {
    const rawPhone = req.body?.phone
    if (!rawPhone || typeof rawPhone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp số điện thoại nhận mã OTP",
      })
    }

    const clientIp = getClientIp(req)
    const result = await requestOtp(rawPhone, clientIp, {
      purpose: req.body?.purpose,
    })
    return res.json(result)
  } catch (err) {
    next(err)
  }
})

router.post("/verify-otp", async (req, res, next) => {
  try {
    const { phone, otp, role, fullName } = req.body || {}
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ Số điện thoại và Mã OTP 6 chữ số",
      })
    }

    const result = await verifyOtp(phone, otp, role, fullName)
    return res.status(result.isNewUser ? 201 : 200).json(result)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/register
 * Đăng ký tài khoản Khách hàng / Tài xế bằng Số điện thoại + Xác thực OTP chính chủ + Thiết lập Mật khẩu / PIN
 */
router.post("/register", async (req, res, next) => {
  try {
    const { phone: rawPhone, password, fullName, role, otp } = req.body

    if (!rawPhone || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ Số điện thoại và Mật khẩu / Mã PIN",
      })
    }

    const phoneValidation = validateVietnamesePhone(rawPhone)
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.error || "Số điện thoại không hợp lệ",
      })
    }
    const phone = phoneValidation.phone

    // Cho phép các tài khoản tài xế mẫu (Seed Drivers) tự động khởi tạo khi bấm chọn nhanh
    const isSeedDriver =
      role === "DRIVER" &&
      ["0908815624", "0903124486", "0987452201", "0916348832"].includes(phone)

    if (!isSeedDriver) {
      // Xác minh mã OTP chính chủ để chống đăng ký số điện thoại ảo
      if (!otp || typeof otp !== "string" || otp.trim().length !== 6) {
        return res.status(400).json({
          success: false,
          message:
            "Vui lòng nhập mã OTP 6 chữ số để xác minh số điện thoại chính chủ",
        })
      }

      // Kiểm tra tính chính xác và hiệu lực của mã OTP
      await verifyOtpCodeOnly(phone, otp.trim())
    }

    if (typeof password !== "string" || password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hoặc mã PIN phải có tối thiểu 6 ký tự",
      })
    }

    // Kiểm tra số điện thoại đã tồn tại chưa
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1)

    const targetRole = role === "DRIVER" ? "DRIVER" : "CUSTOMER"
    const passwordHash = await hashPassword(password.trim())

    let userRecord
    if (existingUser) {
      if (existingUser.passwordHash) {
        return res.status(409).json({
          success: false,
          message: "Số điện thoại này đã được đăng ký. Vui lòng chuyển sang Đăng nhập.",
        })
      }
      // Tài khoản cũ chưa có password -> cập nhật password
      const [updated] = await db
        .update(users)
        .set({
          passwordHash,
          fullName: fullName?.trim() || existingUser.fullName,
          role: targetRole,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning()
      userRecord = updated
    } else {
      const [created] = await db
        .insert(users)
        .values({
          phone,
          passwordHash,
          fullName: fullName?.trim() || (targetRole === "DRIVER" ? "Tài xế mới" : "Khách hàng"),
          role: targetRole,
          status: "ACTIVE",
        })
        .returning()
      userRecord = created
    }

    // Nếu là tài xế, khởi tạo hồ sơ và ví
    if (userRecord.role === "DRIVER") {
      const [prof] = await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, userRecord.id))
        .limit(1)
      if (!prof) {
        await db.insert(driverProfiles).values({
          userId: userRecord.id,
          kycStatus: "PENDING",
          isOnline: false,
          isActive: true,
        })
      }
    }
    await getOrCreateWallet(userRecord.id)

    const token = generateToken({
      userId: userRecord.id,
      role: userRecord.role,
      phone: userRecord.phone,
    })

    return res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công!",
      token,
      isNewUser: true,
      user: {
        id: userRecord.id,
        phone: userRecord.phone,
        fullName: userRecord.fullName,
        role: userRecord.role,
        avatarUrl: userRecord.avatarUrl,
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/login
 * Đăng nhập Khách hàng / Tài xế bằng Số điện thoại + Mật khẩu / Mã PIN
 */
router.post("/login", async (req, res, next) => {
  try {
    const { phone: rawPhone, password, role } = req.body

    if (!rawPhone || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ Số điện thoại và Mật khẩu",
      })
    }

    const phoneValidation = validateVietnamesePhone(rawPhone)
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.error || "Số điện thoại không hợp lệ",
      })
    }
    const phone = phoneValidation.phone

    const [foundUser] = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1)

    if (!foundUser) {
      return res.status(404).json({
        success: false,
        message: "Số điện thoại chưa được đăng ký trên hệ thống. Vui lòng bấm Đăng ký.",
      })
    }

    if (foundUser.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ.",
      })
    }

    // Nếu tài khoản cũ chưa tạo mật khẩu
    if (!foundUser.passwordHash) {
      // Tự động thiết lập mật khẩu nhập vào lần đầu cho tài khoản cũ
      const newHash = await hashPassword(password.trim())
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, foundUser.id))
      foundUser.passwordHash = newHash
    } else {
      const isMatch = await comparePassword(password.trim(), foundUser.passwordHash)
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Mật khẩu hoặc mã PIN không chính xác. Vui lòng thử lại.",
        })
      }
    }

    // Nâng cấp role DRIVER nếu đăng nhập từ giao diện tài xế
    if (role === "DRIVER" && foundUser.role === "CUSTOMER") {
      await db.update(users).set({ role: "DRIVER", updatedAt: new Date() }).where(eq(users.id, foundUser.id))
      foundUser.role = "DRIVER"
    }

    if (foundUser.role === "DRIVER") {
      const [prof] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, foundUser.id)).limit(1)
      if (!prof) {
        await db.insert(driverProfiles).values({
          userId: foundUser.id,
          kycStatus: "PENDING",
          isOnline: false,
          isActive: true,
        })
      }
    }
    await getOrCreateWallet(foundUser.id)

    const token = generateToken({
      userId: foundUser.id,
      role: foundUser.role,
      phone: foundUser.phone,
    })

    return res.json({
      success: true,
      message: "Đăng nhập thành công!",
      token,
      isNewUser: false,
      user: {
        id: foundUser.id,
        phone: foundUser.phone,
        fullName: foundUser.fullName,
        role: foundUser.role,
        avatarUrl: foundUser.avatarUrl,
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/change-password
 * Đổi mật khẩu / Mã PIN
 */
router.post("/change-password", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có tối thiểu 6 ký tự",
      })
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1)
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" })
    }

    if (user.passwordHash && currentPassword) {
      const isMatch = await comparePassword(currentPassword.trim(), user.passwordHash)
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Mật khẩu hiện tại không chính xác" })
      }
    }

    const newHash = await hashPassword(newPassword.trim())
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id))

    return res.json({
      success: true,
      message: "Đổi mật khẩu thành công!",
    })
  } catch (err) {
    next(err)
  }
})

router.get("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const [foundUser] = await db
      .select({
        userId: users.id,
        phone: users.phone,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1)

    res.json({
      success: true,
      user: foundUser || req.user,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * PUT /api/v1/auth/me
 * Cập nhật thông tin cá nhân của người dùng hiện tại (Họ tên, email, avatar)
 */
router.put("/me", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { fullName, email, avatarUrl } = req.body
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    }
    if (fullName !== undefined) updateData.fullName = typeof fullName === "string" ? fullName.trim() : null
    if (email !== undefined) updateData.email = typeof email === "string" && email.trim() ? email.trim() : null
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, req.user!.userId))
      .returning()

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      })
    }

    res.json({
      success: true,
      message: "Cập nhật thông tin thành công",
      user: {
        userId: updatedUser.id,
        phone: updatedUser.phone,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
        status: updatedUser.status,
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/device-token
 * Đăng ký / cập nhật FCM Device Token sau khi đăng nhập
 */
router.post(
  "/device-token",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const device = await registerDeviceToken(req.user!.userId, req.body)
      res.json({
        success: true,
        message: "Đăng ký thiết bị nhận thông báo đẩy thành công",
        data: device,
      })
    } catch (err) {
      next(err)
    }
  },
)

/**
 * DELETE /api/v1/auth/device-token
 * Hủy đăng ký FCM Device Token khi đăng xuất
 */
router.delete(
  "/device-token",
  requireAuth,
  async (req: AuthRequest, res, next) => {
    try {
      const { fcmToken } = req.body
      const result = await removeDeviceToken(req.user!.userId, fcmToken)
      res.json({
        success: true,
        message: "Hủy đăng ký thiết bị thành công",
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },
)

export default router
