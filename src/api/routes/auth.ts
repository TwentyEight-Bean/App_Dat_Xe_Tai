import { Router } from "express"
import { eq, or } from "drizzle-orm"
import { db } from "../../db"
import { users } from "../../db/schema"
import { comparePassword, hashPassword } from "../../lib/hash"
import { generateToken } from "../../lib/auth"
import { requestOtp, verifyOtp } from "../../lib/otpService"
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
    const clientIp = getClientIp(req)
    const result = await requestOtp(req.body.phone, clientIp)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.post("/verify-otp", async (req, res, next) => {
  try {
    const result = await verifyOtp(req.body.phone, req.body.otp, req.body.role)
    res.json(result)
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
