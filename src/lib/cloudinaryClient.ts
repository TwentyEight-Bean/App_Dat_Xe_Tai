/**
 * Cloudinary Upload Client
 * Tích hợp toàn diện 2 API Sprint 1 (Task 1.5):
 * 1. POST /api/v1/upload/signature (Signed Direct Upload lên Cloudinary CDN)
 * 2. POST /api/v1/upload/server    (Server Proxy Upload bằng Base64 Data URI)
 */

export interface UploadSignatureResponse {
  timestamp: number
  signature: string
  apiKey: string
  cloudName: string
  folder: string
}

/**
 * Chuyển đổi File hoặc Blob thành chuỗi Base64 Data URI (data:image/...;base64,...)
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}

/**
 * KÊNH 1: Tải ảnh trực tiếp lên Cloudinary CDN bằng chữ ký số Backend (Signed Direct Upload)
 * Tiết kiệm băng thông máy chủ, tải nhanh.
 * Endpoint Backend: POST /api/v1/upload/signature
 */
export async function uploadImageToCloudinary(
  file: File | Blob,
  folder: "avatars" | "licenses" | "chat_images" = "avatars",
  token?: string | null,
): Promise<string> {
  const storedToken =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null

  // Fallback token dev nếu người dùng đang ở môi trường demo chưa đăng nhập
  const authToken =
    token ||
    storedToken ||
    (folder === "licenses" ? "DEV_DRIVER_TOKEN" : "DEV_CUSTOMER_TOKEN")

  // Bước 1: Gọi API Backend Sprint 1 để lấy chữ ký số (Signed Upload)
  const signatureRes = await fetch("/api/v1/upload/signature", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ folder }),
  })

  const signatureData = await signatureRes.json()

  if (!signatureRes.ok || !signatureData.success) {
    throw new Error(
      signatureData.message ||
        `Không thể lấy chữ ký số upload (Mã lỗi ${signatureRes.status})`,
    )
  }

  const { timestamp, signature, apiKey, cloudName } =
    signatureData.data as UploadSignatureResponse

  // Bước 2: Chuẩn bị form data đẩy trực tiếp lên Cloudinary
  const formData = new FormData()
  formData.append("file", file)
  formData.append("api_key", apiKey)
  formData.append("timestamp", timestamp.toString())
  formData.append("signature", signature)
  formData.append("folder", folder)

  // Bước 3: Gửi file trực tiếp đến API của Cloudinary
  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`

  const uploadRes = await fetch(cloudinaryUrl, {
    method: "POST",
    body: formData,
  })

  const uploadJson = await uploadRes.json()

  if (!uploadRes.ok) {
    const errorMsg =
      uploadJson.error?.message ||
      `Lỗi khi tải ảnh lên Cloudinary (HTTP ${uploadRes.status})`
    throw new Error(errorMsg)
  }

  return uploadJson.secure_url as string
}

/**
 * KÊNH 2: Tải ảnh thông qua Server Backend bằng Base64 Data URI
 * Endpoint Backend: POST /api/v1/upload/server
 * Dành cho trường hợp gửi file qua proxy của server hoặc khi Direct Upload bị lỗi mạng/CORS
 */
export async function uploadImageViaServer(
  fileOrBase64: File | Blob | string,
  folder: "avatars" | "licenses" | "chat_images" = "avatars",
  token?: string | null,
): Promise<string> {
  const storedToken =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null

  const authToken =
    token ||
    storedToken ||
    (folder === "licenses" ? "DEV_DRIVER_TOKEN" : "DEV_CUSTOMER_TOKEN")

  // Chuyển đổi sang Base64 Data URI nếu truyền vào là File/Blob
  let base64Data: string
  if (typeof fileOrBase64 === "string") {
    base64Data = fileOrBase64
  } else {
    base64Data = await fileToBase64(fileOrBase64)
  }

  // Gọi API Backend POST /api/v1/upload/server
  const res = await fetch("/api/v1/upload/server", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      filePath: base64Data,
      folder,
    }),
  })

  const json = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(
      json.message || `Lỗi tải ảnh qua máy chủ (HTTP ${res.status})`,
    )
  }

  return json.data.url as string
}

/**
 * KÊNH KẾT HỢP DỰ PHÒNG TỰ ĐỘNG (Fault-Tolerant Failover Strategy):
 * 1. Ưu tiên gọi Direct Upload (POST /api/v1/upload/signature)
 * 2. Nếu thất bại (CORS / Adblocker chặn CDN / Mạng quốc tế rớt), tự động chuyển sang
 *    upload qua Server (POST /api/v1/upload/server) bằng Base64.
 */
export async function uploadImageWithFallback(
  file: File | Blob,
  folder: "avatars" | "licenses" | "chat_images" = "avatars",
  token?: string | null,
): Promise<string> {
  try {
    // Ưu tiên kênh 1: Direct Upload
    return await uploadImageToCloudinary(file, folder, token)
  } catch (directErr: any) {
    console.warn(
      "⚠️ Direct Upload lên Cloudinary thất bại, tự động kích hoạt kênh Server Upload (POST /upload/server):",
      directErr.message || directErr,
    )
    // Kích hoạt kênh 2: Server Proxy Upload bằng Base64
    return await uploadImageViaServer(file, folder, token)
  }
}
