import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const [products, sales, todaySales, monthSales, salesByDay] =
      await sql.transaction([
        sql`SELECT product_id, title, image_url, selling_price, cost_price, stock, category FROM products WHERE owner_id = ${userId}`,
        sql`SELECT sale_id, receipt_number, items, total_amount, total_cost, total_profit, total_quantity, created_at FROM sales WHERE owner_id = ${userId} ORDER BY created_at DESC`,
        sql`SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(total_profit),0) AS profit, COUNT(*) AS count FROM sales WHERE owner_id = ${userId} AND created_at >= CURRENT_DATE`,
        sql`SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(total_profit),0) AS profit, COUNT(*) AS count FROM sales WHERE owner_id = ${userId} AND created_at >= date_trunc('month', CURRENT_DATE)`,
        sql`SELECT date_trunc('day', created_at) AS day, SUM(total_amount) AS revenue, SUM(total_profit) AS profit FROM sales WHERE owner_id = ${userId} AND created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY day ORDER BY day ASC`,
      ]);

    const totalRevenue = sales.reduce((a, s) => a + Number(s.total_amount), 0);
    const totalProfit = sales.reduce((a, s) => a + Number(s.total_profit), 0);
    const totalCost = sales.reduce((a, s) => a + Number(s.total_cost), 0);
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const totalProductsSold = sales.reduce(
      (a, s) => a + Number(s.total_quantity),
      0,
    );

    // Product analytics
    const productStats = {};
    sales.forEach((s) => {
      const items = Array.isArray(s.items) ? s.items : [];
      items.forEach((it) => {
        if (!productStats[it.productId]) {
          productStats[it.productId] = {
            productId: it.productId,
            title: it.title,
            imageUrl: it.imageUrl,
            quantitySold: 0,
            revenue: 0,
            profit: 0,
            cost: 0,
          };
        }
        const stat = productStats[it.productId];
        stat.quantitySold += it.quantity;
        stat.revenue += it.subtotal;
        stat.cost += it.costPrice * it.quantity;
        stat.profit += (it.unitPrice - it.costPrice) * it.quantity;
      });
    });

    products.forEach((p) => {
      if (productStats[p.product_id]) {
        productStats[p.product_id].sellingPrice = Number(p.selling_price);
        productStats[p.product_id].costPrice = Number(p.cost_price);
        productStats[p.product_id].margin =
          Number(p.selling_price) > 0
            ? ((Number(p.selling_price) - Number(p.cost_price)) /
                Number(p.selling_price)) *
              100
            : 0;
      }
    });

    const productAnalytics = Object.values(productStats);
    const bestSelling =
      [...productAnalytics].sort(
        (a, b) => b.quantitySold - a.quantitySold,
      )[0] || null;
    const highestMargin =
      [...products]
        .map((p) => ({
          ...p,
          margin:
            Number(p.selling_price) > 0
              ? ((Number(p.selling_price) - Number(p.cost_price)) /
                  Number(p.selling_price)) *
                100
              : 0,
        }))
        .sort((a, b) => b.margin - a.margin)[0] || null;
    const lowestMargin =
      [...products]
        .map((p) => ({
          ...p,
          margin:
            Number(p.selling_price) > 0
              ? ((Number(p.selling_price) - Number(p.cost_price)) /
                  Number(p.selling_price)) *
                100
              : 0,
        }))
        .sort((a, b) => a.margin - b.margin)[0] || null;

    const lowStock = products.filter((p) => p.stock < 5);

    // Category breakdown
    const categoryMap = {};
    products.forEach((p) => {
      const c = p.category || "Uncategorized";
      categoryMap[c] = (categoryMap[c] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(categoryMap).map(
      ([name, count]) => ({ name, count }),
    );

    return Response.json({
      stats: {
        totalProducts: products.length,
        totalSales: sales.length,
        totalRevenue,
        totalProfit,
        totalCost,
        avgMargin,
        totalProductsSold,
        todayRevenue: Number(todaySales[0].total),
        todayProfit: Number(todaySales[0].profit),
        todayCount: Number(todaySales[0].count),
        monthRevenue: Number(monthSales[0].total),
        monthProfit: Number(monthSales[0].profit),
        monthCount: Number(monthSales[0].count),
        lowStockCount: lowStock.length,
      },
      bestSelling,
      highestMargin,
      lowestMargin,
      lowStock,
      categoryBreakdown,
      salesByDay,
      productAnalytics,
    });
  } catch (err) {
    console.error("GET /api/analytics", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
