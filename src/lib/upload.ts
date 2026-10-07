import { v2 as cloudinary } from 'cloudinary';

// Cấu hình Cloudinary (Các biến này sẽ được lấy từ .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Lấy Signature để Frontend tự upload file trực tiếp lên Cloudinary.
 * (Best Practice: Server không phải gánh file nặng, tiết kiệm băng thông)
 * 
 * @param folder Thư mục lưu trữ trên Cloudinary (VD: 'avatars', 'licenses')
 * @returns { timestamp, signature, apiKey, cloudName }
 */
export const generateCloudinarySignature = (folder: 'avatars' | 'licenses' | 'chat_images' = 'avatars') => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  
  // Tạo signature với các tham số cần thiết
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
    },
    process.env.CLOUDINARY_API_SECRET as string
  );

  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder
  };
};

/**
 * Upload file từ Server (Dùng trong trường hợp Server nhận file qua multer rồi mới up)
 * @param filePath Đường dẫn file vật lý trên server (VD: '/tmp/image1.jpg') hoặc base64
 * @param folder Thư mục lưu trữ trên Cloudinary
 */
export const uploadFileToServer = async (filePath: string, folder: string) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, { folder });
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error("Lỗi khi upload lên Cloudinary:", error);
    throw new Error("Không thể upload ảnh");
  }
};
