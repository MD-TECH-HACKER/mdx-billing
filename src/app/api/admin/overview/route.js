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
      revenueTotal,
      salesGrowth
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM auth_users`,
      sql`SELECT COUNT(*) as count FROM shops`,
      sql`SELECT COUNT(*) as count FROM products`,
      sql`SELECT COUNT(*) as count FROM sales`,
      sql`SELECT SUM(total_amount) as total FROM sales`,
      sql`SELECT DATE_FORMAT(created_at, '%b') as name, COUNT(*) as sales FROM sales WHERE created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-01-01') GROUP BY name ORDER BY MIN(created_at) ASC`
    ]);

    return Response.json({
      stats: {
        users: userCount[0]?.count || 0,
        shops: shopCount[0]?.count || 0,
        products: productCount[0]?.count || 0,
        sales: saleCount[0]?.count || 0,
        revenue: parseFloat(revenueTotal[0]?.total || 0),
        growth: salesGrowth.map(row => ({ name: row.name, sales: row.sales, users: 0 }))
      }
    });
  } catch (err) {
    console.error("GET /api/admin/overview error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
