import type { Request, Response, NextFunction } from "express"
import { authenticate, authorizeRoles } from "../middleware/authMiddleware"

// Extended request to include user
export interface AuthRequest extends Request {
  user?: ReturnType<typeof authenticate>
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = authenticate(req.headers.authorization)
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

export const requireRoles = (roles: Array<"CUSTOMER" | "DRIVER" | "ADMIN">) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new Error("UNAUTHORIZED: User not authenticated")
      }
      authorizeRoles(req.user, roles)
      next()
    } catch (err) {
      next(err)
    }
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const message = err.message || "Lỗi hệ thống"
  const isAuthError =
    message.includes("UNAUTHORIZED") || message.includes("Token không hợp lệ")
  const isForbidden = message.includes("FORBIDDEN") || err.statusCode === 403
  const statusCode =
    err.statusCode || (isAuthError ? 401 : isForbidden ? 403 : 400)

  res.status(statusCode).json({
    success: false,
    code: err.code,
    message,
  })
}
