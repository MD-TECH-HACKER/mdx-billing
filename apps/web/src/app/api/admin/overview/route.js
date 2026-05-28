import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // Parallel queries for speed
    const [
      userCount,
      shopCount,
      productCount,
      saleCount,
      revenueTotal
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM auth_users`,
      sql`SELECT COUNT(*)::int as count FROM shops`,
      sql`SELECT COUNT(*)::int as count FROM products`,
      sql`SELECT COUNT(*)::int as count FROM sales`,
      sql`SELECT SUM(total_amount)::numeric as total FROM sales`
    ]);

    return Response.json({
      stats: {
        users: userCount[0]?.count || 0,
        shops: shopCount[0]?.count || 0,
        products: productCount[0]?.count || 0,
        sales: saleCount[0]?.count || 0,
        revenue: parseFloat(revenueTotal[0]?.total || 0)
      }
    });
  } catch (err) {
    console.error("GET /api/admin/overview error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
