import * as dotenv from "dotenv"
dotenv.config()

import express from "express"
import uploadRoutes from "../api/routes/upload"
import { errorHandler } from "../api/middleware"

async function runUploadApiTest() {
  console.log("📤 ========================================================")
  console.log(
    "   KIỂM THỬ TÍCH HỢP: API UPLOAD & CHỮ KÝ SỐ CLOUDINARY (SPRINT 1)",
  )
  console.log("==========================================================\n")

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`)
      passed++
    } else {
      console.error(`  ❌ [FAIL] ${testName}`)
      failed++
    }
  }

  // Khởi tạo app express test
  const app = express()
  app.use(express.json())
  app.use("/api/v1/upload", uploadRoutes)
  app.use(errorHandler)

  const server = app.listen(9876)

  try {
    // 1. Kiểm tra chặn khi KHÔNG có Bearer Token
    console.log("1. Kiểm tra bảo mật Authentication:")
    const resNoToken = await fetch(
      "http://localhost:9876/api/v1/upload/signature",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: "avatars" }),
      },
    )
    const jsonNoToken = await resNoToken.json()
    assert(
      resNoToken.status === 401 && jsonNoToken.success === false,
      "Chặn 401 Unauthorized khi thiếu Token xác thực",
    )

    // 2. Kiểm tra tạo chữ ký số với Token hợp lệ (folder avatars)
    console.log("\n2. Kiểm tra tạo chữ ký số upload (folder: avatars):")
    const resAuth = await fetch(
      "http://localhost:9876/api/v1/upload/signature",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer DEV_ADMIN_TOKEN",
        },
        body: JSON.stringify({ folder: "avatars" }),
      },
    )
    const jsonAuth = await resAuth.json()
    assert(
      resAuth.status === 200 &&
        jsonAuth.success === true &&
        !!jsonAuth.data.signature &&
        jsonAuth.data.folder === "avatars",
      "Tạo chữ ký số Cloudinary Signed Direct Upload thành công cho avatars",
    )

    // 3. Kiểm tra tạo chữ ký số cho thư mục giấy tờ tài xế (folder: licenses)
    console.log("\n3. Kiểm tra tạo chữ ký số upload (folder: licenses):")
    const resLicense = await fetch(
      "http://localhost:9876/api/v1/upload/signature",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer DEV_ADMIN_TOKEN",
        },
        body: JSON.stringify({ folder: "licenses" }),
      },
    )
    const jsonLicense = await resLicense.json()
    assert(
      resLicense.status === 200 &&
        jsonLicense.data.folder === "licenses" &&
        !!jsonLicense.data.apiKey,
      "Tạo chữ ký số thành công cho thư mục licenses",
    )

    // 4. Kiểm tra từ chối folder không hợp lệ
    console.log("\n4. Kiểm tra xác thực folder đầu vào:")
    const resBadFolder = await fetch(
      "http://localhost:9876/api/v1/upload/signature",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer DEV_ADMIN_TOKEN",
        },
        body: JSON.stringify({ folder: "hack_root_dir" }),
      },
    )
    const jsonBadFolder = await resBadFolder.json()
    assert(
      resBadFolder.status === 400 && jsonBadFolder.success === false,
      "Từ chối folder bất hợp pháp với HTTP 400 Bad Request",
    )

    // 5. Kiểm tra POST /api/v1/upload/server từ chối khi không có Bearer token
    console.log("\n5. Kiểm tra bảo mật POST /api/v1/upload/server:")
    const resServerNoToken = await fetch(
      "http://localhost:9876/api/v1/upload/server",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: "data:image/png;base64,abc" }),
      },
    )
    const jsonServerNoToken = await resServerNoToken.json()
    assert(
      resServerNoToken.status === 401 && jsonServerNoToken.success === false,
      "Chặn 401 Unauthorized khi thiếu Token xác thực",
    )

    // 6. Kiểm tra POST /api/v1/upload/server từ chối khi thiếu filePath
    console.log("\n6. Kiểm tra validation tham số filePath:")
    const resServerNoPath = await fetch(
      "http://localhost:9876/api/v1/upload/server",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer DEV_ADMIN_TOKEN",
        },
        body: JSON.stringify({ folder: "avatars" }),
      },
    )
    const jsonServerNoPath = await resServerNoPath.json()
    assert(
      resServerNoPath.status === 400 && jsonServerNoPath.success === false,
      "Từ chối thiếu filePath với HTTP 400 Bad Request",
    )

    // 7. Kiểm tra POST /api/v1/upload/server upload thành công với Base64 Data URI
    console.log("\n7. Kiểm tra Upload qua Server với Base64 Data URI:")
    const sampleBase64 =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    const resServerUpload = await fetch(
      "http://localhost:9876/api/v1/upload/server",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer DEV_ADMIN_TOKEN",
        },
        body: JSON.stringify({
          filePath: sampleBase64,
          folder: "avatars",
        }),
      },
    )
    const jsonServerUpload = await resServerUpload.json()
    assert(
      resServerUpload.status === 200 &&
        jsonServerUpload.success === true &&
        !!jsonServerUpload.data.url,
      "Tải ảnh lên Cloudinary qua Server (POST /upload/server) thành công",
    )

    console.log("\n==========================================================")
    console.log(`🎉 TỔNG KẾT API UPLOAD: ${passed} PASS, ${failed} FAIL`)
    console.log("==========================================================\n")

    if (failed > 0) {
      process.exit(1)
    }
  } finally {
    server.close()
  }
}

runUploadApiTest().catch((err) => {
  console.error("Lỗi kiểm thử:", err)
  process.exit(1)
})
