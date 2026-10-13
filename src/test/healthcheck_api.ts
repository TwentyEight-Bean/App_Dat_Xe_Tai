import http from "http"
import * as dotenv from "dotenv"

dotenv.config()

const adminToken = "DEV_ADMIN_TOKEN"
const driverToken = "DEV_DRIVER_TOKEN"
const customerToken = "DEV_CUSTOMER_TOKEN"

const BASE_URL = "http://localhost:8443"

function request(method: string, path: string, token?: string, body?: any): Promise<{ status: number; data: any; time: number }> {
  return new Promise((resolve) => {
    const start = Date.now()
    try {
      const url = new URL(path, BASE_URL)
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const req = http.request(
        {
          method,
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          headers,
          timeout: 4000,
        },
        (res) => {
          let data = ""
          res.on("data", (chunk) => (data += chunk))
          res.on("end", () => {
            let json: any = null
            try {
              json = JSON.parse(data)
            } catch {
              json = data.slice(0, 100)
            }
            resolve({ status: res.statusCode || 0, data: json, time: Date.now() - start })
          })
        }
      )

      req.on("error", (err) => {
        resolve({ status: 0, data: { error: err.message }, time: Date.now() - start })
      })

      req.on("timeout", () => {
        req.destroy()
        resolve({ status: 408, data: { error: "Timeout" }, time: Date.now() - start })
      })

      if (body) {
        req.write(typeof body === "string" ? body : JSON.stringify(body))
      }
      req.end()
    } catch (e: any) {
      resolve({ status: -1, data: { error: e.message }, time: Date.now() - start })
    }
  })
}

async function runHealthCheck() {
  console.log("================================================================================")
  console.log("       FULL API HEALTHCHECK WITH AUTH (TESTING LIVE DEV SERVER)")
  console.log("================================================================================\n")

  const testSuite: {
    category: string
    method: string
    path: string
    tokenRole: "ADMIN" | "DRIVER" | "CUSTOMER" | "NONE"
    body?: any
  }[] = [
    // 1. Auth & OTP
    { category: "Auth", method: "POST", path: "/api/v1/auth/request-otp", tokenRole: "NONE", body: { phone: "0901234567" } },
    { category: "Auth", method: "POST", path: "/api/v1/auth/verify-otp", tokenRole: "NONE", body: { phone: "0901234567", otp: "123456" } },
    { category: "Auth", method: "GET", path: "/api/v1/auth/me", tokenRole: "CUSTOMER" },
    { category: "Auth", method: "PUT", path: "/api/v1/auth/me", tokenRole: "CUSTOMER", body: { fullName: "Test User" } },
    { category: "Auth", method: "POST", path: "/api/v1/auth/admin/login", tokenRole: "NONE", body: { email: "admin@fastdrop.vn", password: "admin" } },

    // 2. Customer
    { category: "Customer", method: "GET", path: "/api/v1/customer/wallet", tokenRole: "CUSTOMER" },
    { category: "Customer", method: "GET", path: "/api/v1/customer/wallet/transactions", tokenRole: "CUSTOMER" },
    { category: "Customer", method: "GET", path: "/api/v1/customer/addresses", tokenRole: "CUSTOMER" },
    { category: "Customer", method: "POST", path: "/api/v1/customer/addresses", tokenRole: "CUSTOMER", body: { title: "Nhà", address: "123 CMT8, Q10", lat: 10.77, lng: 106.66 } },

    // 3. Driver
    { category: "Driver", method: "GET", path: "/api/v1/driver/vehicle-types", tokenRole: "NONE" },
    { category: "Driver", method: "GET", path: "/api/v1/driver/nearby?lat=10.77&lng=106.66&radiusKm=5", tokenRole: "NONE" },
    { category: "Driver", method: "GET", path: "/api/v1/driver/profile", tokenRole: "DRIVER" },
    { category: "Driver", method: "GET", path: "/api/v1/driver/kyc/status", tokenRole: "DRIVER" },
    { category: "Driver", method: "PATCH", path: "/api/v1/driver/status", tokenRole: "DRIVER", body: { isOnline: false } },
    { category: "Driver", method: "PATCH", path: "/api/v1/driver/status/online", tokenRole: "DRIVER", body: { isOnline: false } }, // Candidate OpenAPI
    { category: "Driver", method: "PUT", path: "/api/v1/driver/location", tokenRole: "DRIVER", body: { lat: 10.77, lng: 106.66, heading: 90 } },
    { category: "Driver", method: "GET", path: "/api/v1/driver/location", tokenRole: "DRIVER" },
    { category: "Driver", method: "GET", path: "/api/v1/driver/bookings/active", tokenRole: "DRIVER" },
    { category: "Driver", method: "GET", path: "/api/v1/driver/wallet", tokenRole: "DRIVER" },
    { category: "Driver", method: "GET", path: "/api/v1/driver/wallet/transactions", tokenRole: "DRIVER" },

    // 4. Pricing & Bookings
    { category: "Pricing", method: "GET", path: "/api/v1/pricing/rules", tokenRole: "NONE" },
    { category: "Pricing", method: "GET", path: "/api/v1/pricing/services", tokenRole: "NONE" },
    { category: "Pricing", method: "POST", path: "/api/v1/pricing/estimate", tokenRole: "NONE", body: { vehicleTypeId: "van", distanceKm: 10 } },
    { category: "Bookings", method: "POST", path: "/api/v1/bookings/estimate", tokenRole: "CUSTOMER", body: { vehicleTypeId: "van", distanceKm: 10 } },
    { category: "Bookings", method: "GET", path: "/api/v1/bookings", tokenRole: "CUSTOMER" },

    // 5. Payments
    { category: "Payments", method: "GET", path: "/api/v1/payments/history", tokenRole: "CUSTOMER" },
    { category: "Payments", method: "GET", path: "/api/v1/payments/status/NON_EXISTENT", tokenRole: "CUSTOMER" },
    { category: "Payments", method: "GET", path: "/api/v1/payments/vnpay-ipn?vnp_TxnRef=TEST&vnp_ResponseCode=00", tokenRole: "NONE" },
    { category: "Payments", method: "GET", path: "/api/v1/payments/vnpay-return?vnp_TxnRef=TEST&vnp_ResponseCode=00&format=json", tokenRole: "NONE" },
    { category: "Payments", method: "POST", path: "/api/v1/payments/momo-ipn", tokenRole: "NONE", body: { orderId: "TEST", resultCode: 0 } },

    // 6. Calls & Chat
    { category: "Calls", method: "GET", path: "/api/v1/calls/token", tokenRole: "CUSTOMER" },
    { category: "Calls", method: "ALL", path: "/api/v1/calls/answer-url", tokenRole: "NONE" },
    { category: "Calls", method: "GET", path: "/api/v1/calls/history", tokenRole: "CUSTOMER" },
    { category: "Chat", method: "GET", path: "/api/v1/chat/conversations", tokenRole: "CUSTOMER" },

    // 7. Admin
    { category: "Admin", method: "GET", path: "/api/v1/admin/users", tokenRole: "ADMIN" },
    { category: "Admin", method: "GET", path: "/api/v1/admin/drivers", tokenRole: "ADMIN" },
    { category: "Admin", method: "GET", path: "/api/v1/admin/drivers/kyc-pending", tokenRole: "ADMIN" },
    { category: "Admin", method: "POST", path: "/api/v1/admin/drivers/00000000-0000-0000-0000-000000000002/kyc/approve", tokenRole: "ADMIN" }, // Candidate OpenAPI
    { category: "Admin", method: "POST", path: "/api/v1/admin/drivers/00000000-0000-0000-0000-000000000002/kyc/reject", tokenRole: "ADMIN", body: { reason: "Ảnh mờ" } }, // Candidate OpenAPI
    { category: "Admin", method: "GET", path: "/api/v1/admin/wallets", tokenRole: "ADMIN" },
    { category: "Admin", method: "GET", path: "/api/v1/admin/cron/status", tokenRole: "ADMIN" },
    { category: "Admin", method: "GET", path: "/api/v1/admin/pricing/surcharges", tokenRole: "ADMIN" },
    { category: "Admin", method: "GET", path: "/api/v1/admin/pricing/rules", tokenRole: "ADMIN" }, // Candidate OpenAPI & Postman
    { category: "Admin", method: "PUT", path: "/api/v1/admin/pricing/rules/van", tokenRole: "ADMIN", body: { basePrice: 150000 } }, // Candidate OpenAPI & Postman
    { category: "Admin", method: "PUT", path: "/api/v1/admin/pricing/surcharges/BOC_XEP", tokenRole: "ADMIN", body: { price: 50000 } }, // Candidate OpenAPI & Postman
    { category: "Admin", method: "GET", path: "/api/v1/admin/b2b/customers", tokenRole: "ADMIN" },
    { category: "Admin", method: "GET", path: "/api/v1/accounting/dashboard", tokenRole: "ADMIN" },
    { category: "Admin", method: "GET", path: "/api/v1/pusher/events", tokenRole: "NONE" },
  ]

  for (const t of testSuite) {
    const token =
      t.tokenRole === "ADMIN"
        ? adminToken
        : t.tokenRole === "DRIVER"
        ? driverToken
        : t.tokenRole === "CUSTOMER"
        ? customerToken
        : undefined

    const method = t.method === "ALL" ? "GET" : t.method
    const res = await request(method, t.path, token, t.body)

    let isMissingRoute = false
    let isCrash = false

    if (res.status === 404 && res.data?.message?.includes("không tồn tại")) {
      isMissingRoute = true
    } else if (res.status === 500) {
      isCrash = true
    }

    const icon = isMissingRoute ? "❌ [CHƯA TỒN TẠI]" : isCrash ? "⚠️ [LỖI 500 CRASH]" : "✅ [HOẠT ĐỘNG]"
    console.log(`${icon} [HTTP ${res.status}] ${t.method} ${t.path} (${res.time}ms) -> ${JSON.stringify(res.data).slice(0, 70)}`)
  }
}

runHealthCheck()
