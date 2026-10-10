import { useState, useEffect } from "react"
import App from "./App"
import DriverApp from "./Driver"
import Admin from "./Admin"

export default function Root() {
  if (window.location.pathname.startsWith("/admin")) {
    return <Admin />
  }

  const [role, setRole] = useState<"customer" | "driver">(
    window.location.hash === "#driver" ? "driver" : "customer",
  )

  useEffect(() => {
    const onHash = () => {
      setRole(window.location.hash === "#driver" ? "driver" : "customer")
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  const choose = (r: "customer" | "driver") => {
    window.location.hash = r === "driver" ? "driver" : ""
    setRole(r)
  }
  return (
    <>
      <div
        className="role-switch"
        role="group"
        aria-label="Chọn ứng dụng (bản demo)"
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
      {role === "driver" ? <DriverApp key="driver" /> : <App key="customer" />}
    </>
  )
}
