import { Router } from "express"
import {
  generateCloudinarySignature,
  uploadFileToServer,
} from "../../lib/upload"
import { requireAuth, type AuthRequest } from "../middleware"

const router = Router()

/**
 * POST /api/v1/upload/signature
 * Lấy chữ ký số Cloudinary (Signed Direct Upload) để Client/Frontend tự upload ảnh
 * trực tiếp lên Cloudinary mà không qua Server (Avatar, CCCD, Bằng lái, Đăng ký xe).
 */
router.post("/signature", requireAuth, (req: AuthRequest, res, next) => {
  try {
    const folder =
      req.body?.folder as "avatars" | "licenses" | "chat_images" || "avatars"

    // Kiểm tra folder hợp lệ
    const allowedFolders = ["avatars", "licenses", "chat_images"]
    if (!allowedFolders.includes(folder)) {
      res.status(400).json({
        success: false,
        message: `Folder không hợp lệ. Chỉ chấp nhận: ${allowedFolders.join(", ")}`,
      })
      return
    }

    const signatureData = generateCloudinarySignature(folder)

    res.json({
      success: true,
      message: "Tạo chữ ký số upload Cloudinary thành công",
      data: signatureData,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/upload/server
 * Upload ảnh thông qua Server (Dành cho trường hợp gửi file URL hoặc Base64 từ server)
 */
router.post("/server", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { filePath, folder = "avatars" } = req.body

    if (!filePath) {
      res.status(400).json({
        success: false,
        message:
          "Thiếu tham số 'filePath' (Đường dẫn file hoặc chuỗi Base64 Data URI)",
      })
      return
    }

    const result = await uploadFileToServer(filePath, folder)

    res.json({
      success: true,
      message: "Tải lên tệp tin qua Server thành công",
      data: result,
    })
  } catch (err) {
    next(err)
  }
})

export default router
