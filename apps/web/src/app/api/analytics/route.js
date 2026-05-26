import sql from "@/app/api/utils/sql";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
} from "@/app/api/utils/shopAccess";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import { formatStockQuantity, getStockBaseQuantity } from "@/utils/productUnits";

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "analytics.read");
    await ensureBusinessFeatureSchema();
    const shopId = context.shopId;
    const [products, sales, todaySales, monthSales, salesByDay, expenseSummary, expensesByCategory, purchasesMonth, customerDue, supplierDue, saleCollections] =
      await sql.transaction([
        sql`SELECT product_id, title, image_url, selling_price, cost_price, stock, stock_base_unit, sold_base_unit, low_stock_base_unit, primary_unit, secondary_unit, conversion_rate, category FROM products WHERE shop_id = ${shopId}`,
        sql`SELECT sale_id, receipt_number, items, total_amount, total_cost, total_profit, total_quantity, created_at FROM sales WHERE shop_id = ${shopId} AND (sale_status IS NULL OR sale_status = 'completed') ORDER BY created_at DESC`,
        sql`SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(total_profit),0) AS profit, COUNT(*) AS count FROM sales WHERE shop_id = ${shopId} AND (sale_status IS NULL OR sale_status = 'completed') AND created_at >= CURRENT_DATE`,
        sql`SELECT COALESCE(SUM(total_amount),0) AS total, COALESCE(SUM(total_profit),0) AS profit, COUNT(*) AS count FROM sales WHERE shop_id = ${shopId} AND (sale_status IS NULL OR sale_status = 'completed') AND created_at >= date_trunc('month', CURRENT_DATE)`,
        sql`SELECT date_trunc('day', created_at) AS day, SUM(total_amount) AS revenue, SUM(total_profit) AS profit FROM sales WHERE shop_id = ${shopId} AND (sale_status IS NULL OR sale_status = 'completed') AND created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY day ORDER BY day ASC`,
        sql`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS count FROM expenses WHERE shop_id = ${shopId} AND expense_date >= date_trunc('month', CURRENT_DATE)::date`,
        sql`SELECT category, SUM(amount) AS total FROM expenses WHERE shop_id = ${shopId} AND expense_date >= date_trunc('month', CURRENT_DATE)::date GROUP BY category ORDER BY total DESC`,
        sql`SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS count FROM purchases WHERE shop_id = ${shopId} AND purchase_date >= date_trunc('month', CURRENT_DATE)::date`,
        sql`SELECT COALESCE(SUM(s.total_amount - COALESCE(s.paid_amount, 0)), 0) AS total FROM sales s WHERE s.shop_id = ${shopId} AND (s.sale_status IS NULL OR s.sale_status = 'completed')`,
        sql`SELECT COALESCE(SUM(p.total_amount - COALESCE(p.paid_amount, 0)), 0) AS total FROM purchases p WHERE p.shop_id = ${shopId}`,
        sql`SELECT
          COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) AS cash_sales,
          COALESCE(SUM(CASE WHEN payment_status = 'credit' THEN total_amount ELSE 0 END), 0) AS credit_sales,
          COALESCE(SUM(paid_amount), 0) AS total_collected
        FROM sales WHERE shop_id = ${shopId} AND (sale_status IS NULL OR sale_status = 'completed')`,
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
    const totalStockValue = products.reduce((sum, product) => {
      const primaryQuantity = Number(product.conversion_rate) > 0
        ? getStockBaseQuantity(product) / Number(product.conversion_rate)
        : getStockBaseQuantity(product);
      return sum + primaryQuantity * Number(product.cost_price || 0);
    }, 0);
    const totalRemainingStock = products.reduce(
      (sum, product) => sum + getStockBaseQuantity(product),
      0,
    );
    const productStats = {};

    // Build product stats ENTIRELY from sale item snapshots — never overwrite with current product data
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
            soldByUnit: {},
          };
        }
        const stat = productStats[item.productId];
        stat.quantitySold += Number(item.quantityBaseUnit ?? item.quantity);
        stat.revenue += item.subtotal;
        stat.cost += Number(item.totalCost ?? (item.costPrice * item.quantity));
        stat.profit += Number(item.totalProfit ?? ((item.unitPrice - item.costPrice) * item.quantity));
        const soldUnit = item.selectedUnit || item.primaryUnit || "piece";
        stat.soldByUnit[soldUnit] = (stat.soldByUnit[soldUnit] || 0) + Number(item.quantity);
      });
    });

    // Calculate margin from SNAPSHOT data, not current product data
    // Only use current product table for: image (display), stock, category
    products.forEach((product) => {
      if (productStats[product.product_id]) {
        const stat = productStats[product.product_id];
        // Keep the latest image from product table for display (not financial)
        if (product.image_url) {
          stat.image_url = product.image_url;
        }
        // Calculate margin from accumulated snapshot totals (immutable)
        stat.sellingPrice = stat.revenue > 0 && stat.quantitySold > 0
          ? stat.revenue / stat.quantitySold
          : Number(product.selling_price);
        stat.costPrice = stat.cost > 0 && stat.quantitySold > 0
          ? stat.cost / stat.quantitySold
          : Number(product.cost_price);
        stat.margin = stat.revenue > 0
          ? (stat.profit / stat.revenue) * 100
          : 0;
        // Attach current stock for display
        stat.stock = product.stock;
        stat.remainingStock = formatStockQuantity(getStockBaseQuantity(product), product);
        stat.soldStock = formatStockQuantity(Number(product.sold_base_unit) || 0, product);
      }
    });

    // For products that were sold but since deleted, calculate margin from snapshot
    Object.values(productStats).forEach((stat) => {
      if (stat.margin === undefined) {
        stat.sellingPrice = stat.revenue > 0 && stat.quantitySold > 0
          ? stat.revenue / stat.quantitySold
          : 0;
        stat.costPrice = stat.cost > 0 && stat.quantitySold > 0
          ? stat.cost / stat.quantitySold
          : 0;
        stat.margin = stat.revenue > 0
          ? (stat.profit / stat.revenue) * 100
          : 0;
      }
    });

    const productAnalytics = Object.values(productStats);
    const bestSelling =
      [...productAnalytics].sort((a, b) => b.quantitySold - a.quantitySold)[0] || null;

    // Use snapshot-derived margin for sold products, fall back to live data for unsold products
    const allProductsWithMargin = [
      // Sold products: margin from snapshots
      ...productAnalytics.map((stat) => ({
        product_id: stat.productId,
        title: stat.title,
        image_url: stat.imageUrl || stat.image_url,
        selling_price: stat.sellingPrice,
        cost_price: stat.costPrice,
        margin: stat.margin,
        stock: stat.stock,
        totalProfit: stat.profit,
        _fromSnapshot: true,
      })),
      // Unsold products: margin from current product data
      ...products
        .filter((p) => !productStats[p.product_id])
        .map((p) => ({
          product_id: p.product_id,
          title: p.title,
          image_url: p.image_url,
          selling_price: Number(p.selling_price),
          cost_price: Number(p.cost_price),
          margin: Number(p.selling_price) > 0
            ? ((Number(p.selling_price) - Number(p.cost_price)) / Number(p.selling_price)) * 100
            : 0,
          stock: p.stock,
          totalProfit: 0,
          _fromSnapshot: false,
        })),
    ].sort((a, b) => b.margin - a.margin);

    const lowStock = products.filter(
      (product) => getStockBaseQuantity(product) <= Number(product.low_stock_base_unit ?? 5),
    );
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
        totalStockValue,
        totalRemainingStock,
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
        customerDueAmount: Number(customerDue[0].total),
        supplierDueAmount: Number(supplierDue[0].total),
        creditSales: Number(saleCollections[0].credit_sales),
        cashSales: Number(saleCollections[0].cash_sales),
        totalCollected: Number(saleCollections[0].total_collected),
      },
      bestSelling,
      highestMargin: allProductsWithMargin[0] || null,
      lowestMargin: allProductsWithMargin[allProductsWithMargin.length - 1] || null,
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
