import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const detailedUsers = await sql`
      SELECT 
        u.id, u.name, u.email, u.image, u.display_name, u.banned,
        (SELECT COUNT(*) FROM shops WHERE owner_id = u.id) as shop_count,
        (SELECT COUNT(*) FROM sales WHERE owner_id = u.id) as sales_count
      FROM auth_users u
      ORDER BY u.id DESC
      LIMIT 200
    `;

    return Response.json({
      users: detailedUsers.map((user) => ({
        ...user,
        isPlatformAdmin: isAdmin(user),
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/users error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
