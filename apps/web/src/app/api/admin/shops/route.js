import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const shops = await sql`
      SELECT 
        s.shop_id, s.shop_name, s.shop_logo, s.created_at, s.currency,
        u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.shop_id) as products_count,
        (SELECT COUNT(*) FROM sales sa WHERE sa.shop_id = s.shop_id) as sales_count,
        (SELECT SUM(total_amount) FROM sales sa WHERE sa.shop_id = s.shop_id) as total_revenue
      FROM shops s
      LEFT JOIN auth_users u ON u.id = s.owner_id
      ORDER BY s.created_at DESC
      LIMIT 200
    `;

    return Response.json({ shops });
  } catch (err) {
    console.error("GET /api/admin/shops error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
