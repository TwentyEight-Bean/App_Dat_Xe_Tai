import { createServer } from "node:http"
import * as dotenv from "dotenv"
import { handleApiRequest } from "./api/router"
import { initCronJobs } from "./lib/cronJobs"

// Load biến môi trường từ .env
dotenv.config()

const PORT = parseInt(process.env.API_PORT || process.env.PORT || "3000", 10)

const server = createServer(async (req, res) => {
  const handled = await handleApiRequest(req, res)
  if (!handled) {
    res.statusCode = 404
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ success: false, message: "Not found" }))
  }
})

server.listen(PORT, () => {
  // Khởi động các tác vụ định kỳ
  initCronJobs()

  console.log(
    `\n🚀 Truck Booking API Server running at http://localhost:${PORT}`,
  )
  console.log(
    `   - Auth OTP:     POST http://localhost:${PORT}/api/v1/auth/request-otp`,
  )
  console.log(
    `   - Verify OTP:   POST http://localhost:${PORT}/api/v1/auth/verify-otp`,
  )
  console.log(
    `   - Address Book: GET  http://localhost:${PORT}/api/v1/customer/addresses\n`,
  )
})
