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
        u.id, u.name, u.email, u.image, u.display_name,
        (SELECT COUNT(*)::int FROM shops WHERE owner_id = u.id::varchar(255) OR owner_id::varchar = u.id::varchar(255)) as shop_count,
        (SELECT COUNT(*)::int FROM sales WHERE owner_id = u.id::varchar(255) OR owner_id::varchar = u.id::varchar(255)) as sales_count
      FROM auth_users u
      ORDER BY u.id DESC
      LIMIT 200
    `;

    return Response.json({ users: detailedUsers });
  } catch (err) {
    console.error("GET /api/admin/users error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
