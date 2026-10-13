import { useState, useEffect } from "react"
import App from "./App"
import DriverApp from "./Driver"
import Admin from "./Admin"

type AppRole = "customer" | "driver" | "admin"

const detectRoleFromUrl = (): AppRole => {
  if (
    typeof window !== "undefined" &&
    (window.location.pathname.startsWith("/admin") ||
      window.location.hash === "#admin")
  ) {
    return "admin"
  }
  if (typeof window !== "undefined" && window.location.hash === "#driver") {
    return "driver"
  }
  return "customer"
}

export default function Root() {
  const [role, setRole] = useState<AppRole>(detectRoleFromUrl)

  useEffect(() => {
    const onHash = () => {
      setRole(detectRoleFromUrl())
    }

    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  const choose = (r: AppRole) => {
    if (r === "admin") {
      window.location.hash = "admin"
    } else if (r === "driver") {
      window.location.hash = "driver"
    } else {
      window.location.hash = ""
    }
    setRole(r)
  }

  return (
    <>
      <div
        className="role-switch"
        role="group"
        aria-label="Chọn ứng dụng (bản demo)"
        style={{ zIndex: 9999 }}
      >
        <button
          aria-pressed={role === "customer"}
          onClick={() => choose("customer")}
          type="button"
        >
          Khách hàng
        </button>
        <button
          aria-pressed={role === "driver"}
          onClick={() => choose("driver")}
          type="button"
        >
          Tài xế
        </button>
      </div>

      {role === "admin" ? (
        <Admin key="admin" />
      ) : role === "driver" ? (
        <DriverApp key="driver" />
      ) : (
        <App key="customer" />
      )}
    </>
  )
}
