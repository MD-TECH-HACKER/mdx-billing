import sql from "@/app/api/utils/sql";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
} from "@/app/api/utils/shopAccess";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "analytics.read");
    await ensureBusinessFeatureSchema();
    const shopId = context.shopId;
    const [products, sales, todaySales, monthSales, salesByDay, expenseSummary, expensesByCategory, purchasesMonth] =
      await sql.transaction([
        sql`SELECT product_id, title, image_url, selling_price, cost_price, stock, category FROM products WHERE shop_id = ${shopId}`,
        sql`SELECT sale_id, receipt_number, items, total_amount, total_cost, total_profit, total_quantity, created_at FROM sales WHERE shop_id = ${shopId} ORDER BY created_at DESC`,
        sql`SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(total_profit),0) AS profit, COUNT(*) AS count FROM sales WHERE shop_id = ${shopId} AND created_at >= CURRENT_DATE`,
        sql`SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(total_profit),0) AS profit, COUNT(*) AS count FROM sales WHERE shop_id = ${shopId} AND created_at >= date_trunc('month', CURRENT_DATE)`,
        sql`SELECT date_trunc('day', created_at) AS day, SUM(total_amount) AS revenue, SUM(total_profit) AS profit FROM sales WHERE shop_id = ${shopId} AND created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY day ORDER BY day ASC`,
        sql`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM expenses WHERE shop_id = ${shopId} AND expense_date >= date_trunc('month', CURRENT_DATE)::date`,
        sql`SELECT category, SUM(amount) AS total FROM expenses WHERE shop_id = ${shopId} AND expense_date >= date_trunc('month', CURRENT_DATE)::date GROUP BY category ORDER BY total DESC`,
        sql`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count FROM purchases WHERE shop_id = ${shopId} AND purchase_date >= date_trunc('month', CURRENT_DATE)::date`,
      ]);

    const totalRevenue = sales.reduce((amount, sale) => amount + Number(sale.total_amount), 0);
    const totalProfit = sales.reduce((amount, sale) => amount + Number(sale.total_profit), 0);
    const totalCost = sales.reduce((amount, sale) => amount + Number(sale.total_cost), 0);
    const monthExpenses = Number(expenseSummary[0].total);
    const netProfit = Number(monthSales[0].profit) - monthExpenses;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const totalProductsSold = sales.reduce(
      (amount, sale) => amount + Number(sale.total_quantity),
      0,
    );
    const productStats = {};

    sales.forEach((sale) => {
      const items = Array.isArray(sale.items) ? sale.items : [];
      items.forEach((item) => {
        if (!productStats[item.productId]) {
          productStats[item.productId] = {
            productId: item.productId,
            title: item.title,
            imageUrl: item.imageUrl,
            quantitySold: 0,
            revenue: 0,
            profit: 0,
            cost: 0,
          };
        }
        const stat = productStats[item.productId];
        stat.quantitySold += item.quantity;
        stat.revenue += item.subtotal;
        stat.cost += item.costPrice * item.quantity;
        stat.profit += (item.unitPrice - item.costPrice) * item.quantity;
      });
    });

    products.forEach((product) => {
      if (productStats[product.product_id]) {
        productStats[product.product_id].sellingPrice = Number(product.selling_price);
        productStats[product.product_id].costPrice = Number(product.cost_price);
        productStats[product.product_id].margin =
          Number(product.selling_price) > 0
            ? ((Number(product.selling_price) - Number(product.cost_price)) /
                Number(product.selling_price)) *
              100
            : 0;
      }
    });

    const productAnalytics = Object.values(productStats);
    const bestSelling =
      [...productAnalytics].sort((a, b) => b.quantitySold - a.quantitySold)[0] || null;
    const productsByMargin = products
      .map((product) => ({
        ...product,
        margin:
          Number(product.selling_price) > 0
            ? ((Number(product.selling_price) - Number(product.cost_price)) /
                Number(product.selling_price)) *
              100
            : 0,
      }))
      .sort((a, b) => b.margin - a.margin);
    const lowStock = products.filter((product) => product.stock < 5);
    const categoryMap = {};
    products.forEach((product) => {
      const category = product.category || "Uncategorized";
      categoryMap[category] = (categoryMap[category] || 0) + 1;
    });

    return Response.json({
      role: context.role,
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
        monthExpenses,
        netProfit,
        monthPurchases: Number(purchasesMonth[0].total),
        monthPurchaseCount: Number(purchasesMonth[0].count),
        monthCount: Number(monthSales[0].count),
        lowStockCount: lowStock.length,
      },
      bestSelling,
      highestMargin: productsByMargin[0] || null,
      lowestMargin: productsByMargin[productsByMargin.length - 1] || null,
      lowStock,
      categoryBreakdown: Object.entries(categoryMap).map(([name, count]) => ({
        name,
        count,
      })),
      salesByDay,
      expensesByCategory,
      productAnalytics,
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/analytics", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
