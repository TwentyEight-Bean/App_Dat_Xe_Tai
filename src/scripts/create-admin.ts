import "dotenv/config"
import { eq, or } from "drizzle-orm"
import { db } from "../db"
import { users } from "../db/schema"
import { hashPassword } from "../lib/hash"

/**
 * CLI tạo hoặc cập nhật mật khẩu tài khoản Quản trị viên (ADMIN).
 * Cách dùng:
 *   npx tsx src/scripts/create-admin.ts <email> <password> [phone] [fullName]
 */
async function main() {
  const email = process.argv[2]?.trim()
  const password = process.argv[3]
  const phone = process.argv[4]?.trim() || "0900000000"
  const fullName = process.argv[5]?.trim() || "Quản trị viên Hệ thống"

  if (!email || !password) {
    console.error(
      "Thiếu tham số. Cách dùng: npx tsx src/scripts/create-admin.ts <email> <password> [phone] [fullName]",
    )
    process.exit(1)
  }

  if (password.length < 10) {
    console.error("Mật khẩu Admin phải dài tối thiểu 10 ký tự.")
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)
  const [existing] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, email), eq(users.phone, phone)))
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email,
        fullName,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning({
        id: users.id,
        email: users.email,
        phone: users.phone,
        role: users.role,
      })
    console.log("Đã cập nhật tài khoản ADMIN:", updated)
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        phone,
        fullName,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      })
      .returning({
        id: users.id,
        email: users.email,
        phone: users.phone,
        role: users.role,
      })
    console.log("Đã tạo tài khoản ADMIN mới:", created)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error("Lỗi tạo tài khoản ADMIN:", err)
  process.exit(1)
})
