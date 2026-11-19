import React, { useState, useEffect } from "react"
import App from "./App"

const DriverApp = React.lazy(() => import("./Driver"))
const Admin = React.lazy(() => import("./Admin"))

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

  return (
    <>
      {role === "admin" ? (
        <React.Suspense fallback={<div>Loading...</div>}>
          <Admin key="admin" />
        </React.Suspense>
      ) : role === "driver" ? (
        <React.Suspense fallback={<div>Loading...</div>}>
          <DriverApp key="driver" />
        </React.Suspense>
      ) : (
        <App key="customer" />
      )}
    </>
  )
}
