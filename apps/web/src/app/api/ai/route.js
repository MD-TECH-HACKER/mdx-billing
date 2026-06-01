import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
} from "@/app/api/utils/shopAccess";
import { formatStockQuantity, getStockBaseQuantity } from "@/utils/productUnits";

function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function safePrompt(value) {
  return String(value || "").trim().slice(0, 500);
}

function logSummary(prompt) {
  return prompt
    .replace(/\b\d{7,}\b/g, "[masked]")
    .replace(/\S+@\S+\.\S+/g, "[email]")
    .slice(0, 180);
}

function includesAny(prompt, values) {
  return values.some((value) => prompt.includes(value));
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "analytics.read");
    await ensureBusinessFeatureSchema();
    const prompt = safePrompt((await request.json()).prompt);
    if (!prompt) {
      return Response.json({ error: "Ask a business question first." }, { status: 400 });
    }

    const lower = prompt.toLowerCase();
    const [products, today, month, previousMonth, customers, suppliers] = await sql.withTransaction(async (tx) => {
      const products = await tx`SELECT product_id, title, cost_price, selling_price, stock, stock_base_unit, sold_base_unit,
          low_stock_base_unit, primary_unit, secondary_unit, conversion_rate
        FROM products WHERE shop_id = ${context.shopId} ORDER BY title ASC`;
      const today = await tx`SELECT COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(total_profit), 0) AS profit,
          COUNT(*) AS invoice_count, COALESCE(SUM(paid_amount), 0) AS collected
        FROM sales WHERE shop_id = ${context.shopId}
          AND (sale_status IS NULL OR sale_status = 'completed') AND created_at >= CURRENT_DATE`;
      const month = await tx`SELECT COALESCE(SUM(total_amount), 0) AS revenue, COALESCE(SUM(total_profit), 0) AS profit,
          COUNT(*) AS invoice_count,
          COALESCE((SELECT SUM(amount) FROM expenses WHERE shop_id = ${context.shopId}
            AND expense_date >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')), 0) AS expenses
        FROM sales WHERE shop_id = ${context.shopId}
          AND (sale_status IS NULL OR sale_status = 'completed')
          AND created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')`;
      const previousMonth = await tx`SELECT COALESCE(SUM(total_profit), 0) AS profit
        FROM sales WHERE shop_id = ${context.shopId}
          AND (sale_status IS NULL OR sale_status = 'completed')
          AND created_at >= DATE_FORMAT(CURRENT_DATE - INTERVAL 1 MONTH, '%Y-%m-01')
          AND created_at < DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')`;
      const customers = await tx`SELECT c.name, c.phone,
          COALESCE(SUM(CASE WHEN s.sale_status IS NULL OR s.sale_status = 'completed'
            THEN s.total_amount - COALESCE(s.paid_amount, 0) ELSE 0 END), 0) + COALESCE(c.opening_balance, 0) AS due
        FROM customers c LEFT JOIN sales s ON s.customer_id = c.customer_id AND s.shop_id = c.shop_id
        WHERE c.shop_id = ${context.shopId} AND c.is_deleted = FALSE
        GROUP BY c.customer_id ORDER BY due DESC`;
      const suppliers = await tx`SELECT s.name, s.phone,
          GREATEST(0, COALESCE(SUM(p.total_amount - COALESCE(p.paid_amount, 0)), 0) + COALESCE(s.opening_balance, 0) - COALESCE((
            SELECT SUM(pay.amount) FROM payments pay
            WHERE pay.supplier_id = s.supplier_id AND pay.shop_id = s.shop_id
              AND pay.direction = 'paid' AND pay.purchase_id IS NULL
          ), 0)) AS due
        FROM suppliers s LEFT JOIN purchases p ON p.supplier_id = s.supplier_id AND p.shop_id = s.shop_id
        WHERE s.shop_id = ${context.shopId} AND s.is_deleted = FALSE
        GROUP BY s.supplier_id ORDER BY due DESC`;
      return [products, today, month, previousMonth, customers, suppliers];
    });

    const lowStock = products.filter(
      (product) => getStockBaseQuantity(product) <= Number(product.low_stock_base_unit || 0),
    );
    const monthNetProfit = Number(month[0].profit) - Number(month[0].expenses);
    const profitDifference = Number(month[0].profit) - Number(previousMonth[0].profit);
    let answer;
    let type = "business_insight";

    const costAndMargin = lower.match(/cost[^\d]*([\d,]+(?:\.\d+)?)[^\d]+(\d+(?:\.\d+)?)\s*%/);
    if (costAndMargin || includesAny(lower, ["suggest price", "selling price"])) {
      const cost = costAndMargin ? Number(costAndMargin[1].replaceAll(",", "")) : 0;
      const margin = costAndMargin ? Number(costAndMargin[2]) : 25;
      if (cost > 0 && margin > 0 && margin < 100) {
        const salePrice = cost / (1 - margin / 100);
        answer = `For a cost of ${money(cost)} and ${margin}% gross margin, set the selling price at about ${money(salePrice)}. Gross profit per unit will be ${money(salePrice - cost)}.`;
      } else {
        answer = "Give a cost and desired margin, for example: Suggest price for cost Rs 500 and 25% margin.";
      }
      type = "price_suggestion";
    } else if (includesAny(lower, ["low stock", "reorder"])) {
      type = "reorder";
      answer = lowStock.length
        ? `Low stock products: ${lowStock.slice(0, 8).map((product) => {
            const remaining = formatStockQuantity(getStockBaseQuantity(product), product);
            const target = Math.max(Number(product.low_stock_base_unit || 0) * 2, 1);
            const reorder = Math.max(0, target - getStockBaseQuantity(product));
            return `${product.title} (${remaining} remaining; reorder ${formatStockQuantity(reorder, product)})`;
          }).join("; ")}.`
        : "No products are currently at or below their low-stock alert quantity.";
    } else if (includesAny(lower, ["today", "today's"]) && includesAny(lower, ["sale", "profit", "business"])) {
      type = "today_summary";
      answer = `Today: ${today[0].invoice_count} invoices, revenue ${money(today[0].revenue)}, collected ${money(today[0].collected)}, and gross profit ${money(today[0].profit)}.`;
    } else if (includesAny(lower, ["monthly", "month"]) && includesAny(lower, ["profit", "summary", "sales"])) {
      type = "month_summary";
      answer = `This month: ${month[0].invoice_count} invoices, revenue ${money(month[0].revenue)}, gross profit ${money(month[0].profit)}, expenses ${money(month[0].expenses)}, and net profit ${money(monthNetProfit)}.`;
    } else if (lower.includes("why") && lower.includes("profit")) {
      type = "profit_change";
      const direction = profitDifference >= 0 ? "increased" : "decreased";
      answer = `Gross profit has ${direction} by ${money(Math.abs(profitDifference))} compared with last month. This month gross profit is ${money(month[0].profit)}; after ${money(month[0].expenses)} expenses, net profit is ${money(monthNetProfit)}. Review product margins and expense categories in Analytics for the drivers.`;
    } else if (lower.includes("slow") && includesAny(lower, ["product", "moving"])) {
      type = "slow_moving";
      const slow = products.filter((product) => Number(product.sold_base_unit || 0) <= 0).slice(0, 10);
      answer = slow.length
        ? `Products with no recorded sold quantity: ${slow.map((product) => product.title).join(", ")}.`
        : "Every active product currently has recorded sales quantity.";
    } else if (lower.includes("customer") && lower.includes("reminder")) {
      type = "customer_reminder";
      const customer = customers.find((record) => lower.includes(String(record.name).toLowerCase()))
        || customers.find((record) => Number(record.due) > 0);
      answer = customer && Number(customer.due) > 0
        ? `Message: Dear ${customer.name}, this is a reminder that ${money(customer.due)} is pending with ${context.shop.shop_name}. Please arrange payment at your earliest convenience. Thank you.`
        : "There is no customer with an outstanding due balance to remind.";
    } else if (lower.includes("supplier") && includesAny(lower, ["payment", "message"])) {
      type = "supplier_message";
      const supplier = suppliers.find((record) => lower.includes(String(record.name).toLowerCase()))
        || suppliers.find((record) => Number(record.due) > 0);
      answer = supplier && Number(supplier.due) > 0
        ? `Message: Dear ${supplier.name}, our records show ${money(supplier.due)} payable from ${context.shop.shop_name}. We will coordinate settlement shortly. Thank you for your supply support.`
        : "There is no supplier with an outstanding payable balance.";
    } else if (lower.includes("thank") && lower.includes("invoice")) {
      type = "invoice_message";
      answer = `Message: Thank you for purchasing from ${context.shop.shop_name}. Your invoice has been recorded. We appreciate your business and look forward to serving you again.`;
    } else if (lower.includes("description") && lower.includes("product")) {
      type = "product_description";
      const product = products.find((record) => lower.includes(String(record.title).toLowerCase()));
      answer = product
        ? `${product.title}: Reliable quality product available in ${product.primary_unit || "units"}, selected for everyday business needs. Contact us for current availability and pricing.`
        : "Mention an existing product name so I can generate a description using its unit and availability.";
    } else {
      const customerDue = customers.reduce((sum, record) => sum + Number(record.due || 0), 0);
      answer = `Business insight: this month revenue is ${money(month[0].revenue)}, net profit is ${money(monthNetProfit)}, customer dues are ${money(customerDue)}, and ${lowStock.length} products need stock attention.`;
    }

    await sql`
      INSERT INTO ai_logs (shop_id, user_id, request_type, prompt_summary)
      VALUES (${context.shopId}, ${context.userId}, ${type}, ${
        ["customer_reminder", "supplier_message"].includes(type)
          ? "[masked payment message request]"
          : logSummary(prompt)
      })
    `;

    return Response.json({
      answer,
      type,
      suggestions: [
        "How much profit today?",
        "Which product is low stock?",
        "Summarize monthly profit",
        "Show slow-moving products",
      ],
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/ai", error);
    return Response.json({ error: "Could not generate insight." }, { status: 500 });
  }
}
