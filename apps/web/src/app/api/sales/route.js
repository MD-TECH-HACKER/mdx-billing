import sql from "@/app/api/utils/sql";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { sanitizeProductUnit } from "@/utils/productUnits";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import { canAccess } from "@/app/api/utils/permissions";
import { sanitizeSaleForRole } from "@/app/api/utils/financialVisibility";
import { calculateInvoiceTotals } from "@/app/api/utils/invoiceTotals";

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "sale.read");
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const status = url.searchParams.get("status");
    const sort = url.searchParams.get("sort") || "newest";
    const columns = canAccess(context.role, "analytics.profit")
      ? "*"
      : "sale_id, shop_id, customer_id, receipt_number, buyer_name, buyer_phone, items, total_amount, total_quantity, tax_amount, discount_amount, paid_amount, due_date, payment_status, payment_method, notes, sale_status, currency_snapshot, created_at, updated_at";
    let query = `SELECT ${columns} FROM sales WHERE shop_id = $1 AND (sale_status IS NULL OR sale_status = 'completed')`;
    const values = [context.shopId];

    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      query += ` AND (LOWER(COALESCE(buyer_name,'')) LIKE $${values.length} OR LOWER(receipt_number) LIKE $${values.length})`;
    }
    if (fromDate) {
      values.push(fromDate);
      query += ` AND created_at >= $${values.length}`;
    }
    if (toDate) {
      values.push(`${toDate}T23:59:59.999Z`);
      query += ` AND created_at <= $${values.length}`;
    }
    if (status && status !== "all") {
      values.push(status);
      query += ` AND payment_status = $${values.length}`;
    }

    const orderBy =
      sort === "oldest"
        ? "created_at ASC"
        : sort === "amount_desc"
          ? "total_amount DESC"
          : sort === "amount_asc"
            ? "total_amount ASC"
            : "created_at DESC";
    query += ` ORDER BY ${orderBy} LIMIT 500`;

    const sales = await sql(query, values);
    return Response.json({
      sales: sales.map((sale) => sanitizeSaleForRole(sale, context.role)),
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/sales", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "sale.write");
    await ensureBusinessFeatureSchema();
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return Response.json({ error: "No items" }, { status: 400 });
    }

    // Idempotency: check for duplicate checkout
    const checkoutSessionId = (body.checkoutSessionId || "").toString().trim() || null;
    if (checkoutSessionId) {
      const existing = await sql`
        SELECT sale_id FROM sales
        WHERE checkout_session_id = ${checkoutSessionId} AND shop_id = ${context.shopId}
        LIMIT 1
      `;
      if (existing[0]) {
        // Return the already-created sale instead of creating a duplicate
        const existingSale = await sql`SELECT * FROM sales WHERE sale_id = ${existing[0].sale_id} LIMIT 1`;
        return Response.json(
          { sale: sanitizeSaleForRole(existingSale[0], context.role) },
          { status: 200 },
        );
      }
    }

    const productIds = items.map((item) => Number.parseInt(item.productId, 10));
    if (productIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      return Response.json({ error: "Invalid items" }, { status: 400 });
    }
    if (new Set(productIds).size !== productIds.length) {
      return Response.json({ error: "Duplicate products are not allowed" }, { status: 400 });
    }

    let customer = null;
    if (body.customerId) {
      const customerId = Number.parseInt(body.customerId, 10);
      const customerRows = await sql`
        SELECT customer_id, name, phone FROM customers
        WHERE customer_id = ${customerId} AND shop_id = ${context.shopId}
        LIMIT 1
      `;
      if (!customerRows[0]) {
        return Response.json({ error: "Customer not found" }, { status: 400 });
      }
      customer = customerRows[0];
    }
    const buyerName =
      (body.buyerName || customer?.name || "").toString().trim().slice(0, 100) || null;
    const buyerPhone =
      (body.buyerPhone || customer?.phone || "").toString().trim().slice(0, 50) || null;
    const notes = (body.notes || "").toString().trim().slice(0, 500) || null;
    const paymentMethod = ["cash", "card", "upi", "bank_transfer", "other"].includes(
      body.paymentMethod,
    )
      ? body.paymentMethod
      : "cash";
    const paymentStatus = ["paid", "pending", "partial"].includes(
      body.paymentStatus,
    )
      ? body.paymentStatus
      : "paid";

    const placeholders = productIds.map((_, index) => `$${index + 2}`).join(",");
    const productRows = await sql(
      `SELECT * FROM products WHERE shop_id = $1 AND product_id IN (${placeholders})`,
      [context.shopId, ...productIds],
    );
    const productMap = Object.fromEntries(
      productRows.map((product) => [product.product_id, product]),
    );

    let totalAmount = 0;
    let totalCost = 0;
    let totalQuantity = 0;
    const lineItems = [];

    for (const item of items) {
      const product = productMap[Number.parseInt(item.productId, 10)];
      if (!product) {
        return Response.json({ error: "Product not found" }, { status: 400 });
      }

      const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
      if (quantity > product.stock) {
        return Response.json(
          { error: `Not enough stock for ${product.title}` },
          { status: 400 },
        );
      }

      const unitPrice = Number(product.selling_price);
      const costPrice = Number(product.cost_price);
      const profitPerUnit = unitPrice - costPrice;
      totalAmount += unitPrice * quantity;
      totalCost += costPrice * quantity;
      totalQuantity += quantity;

      // Full product snapshot — immutable record of what was sold at what price
      lineItems.push({
        productId: product.product_id,
        title: product.title,
        description: product.description,
        imageUrl: product.image_url,
        sku: product.sku || null,
        category: product.category || null,
        quantity,
        unitPrice,
        costPrice,
        profitPerUnit,
        totalCost: costPrice * quantity,
        totalProfit: profitPerUnit * quantity,
        primaryUnit: sanitizeProductUnit(product.primary_unit, {
          fallback: "piece",
        }),
        secondaryUnit: sanitizeProductUnit(product.secondary_unit, {
          fallback: null,
        }),
        subtotal: unitPrice * quantity,
      });
    }

    const { discountAmount, taxableAmount, taxAmount, grandTotal } = calculateInvoiceTotals(
      totalAmount,
      context.shop.tax_percent,
      body.discountAmount,
    );
    const totalProfit = taxableAmount - totalCost;
    const paidAmount =
      paymentStatus === "paid"
        ? grandTotal
        : Math.min(grandTotal, Math.max(0, Number(body.paidAmount) || 0));
    const dueDate = (body.dueDate || "").toString().slice(0, 10) || null;
    const receiptNumber = `${context.shop.receipt_prefix || "INV"}-${Date.now()}`;

    // Shop snapshot — frozen shop details at time of sale for permanent receipt
    const shopSnapshot = JSON.stringify({
      shop_name: context.shop.shop_name,
      shop_description: context.shop.shop_description || null,
      shop_logo: context.shop.shop_logo || null,
      address: context.shop.address || null,
      phone: context.shop.phone || null,
      thank_you_message: context.shop.thank_you_message || null,
      receipt_prefix: context.shop.receipt_prefix || null,
    });
    const currencySnapshot = context.shop.currency || "INR";
    const taxPercentSnapshot = Number(context.shop.tax_percent) || 0;

    const requestedStock = JSON.stringify(
      lineItems.map((lineItem) => ({
        productId: lineItem.productId,
        quantity: lineItem.quantity,
      })),
    );
    const saleRows = await sql`
      WITH requested AS (
        SELECT item."productId" AS product_id, item.quantity
        FROM jsonb_to_recordset(${requestedStock}::jsonb)
          AS item("productId" INTEGER, quantity INTEGER)
      ),
      decremented AS (
        UPDATE products product
        SET stock = product.stock - requested.quantity, updated_at = NOW()
        FROM requested
        WHERE product.product_id = requested.product_id
          AND product.shop_id = ${context.shopId}
          AND product.stock >= requested.quantity
        RETURNING product.product_id
      ),
      verified AS (
        SELECT 1 / (
          CASE
            WHEN COUNT(*) = ${lineItems.length} THEN 1
            ELSE COUNT(*)::INTEGER - COUNT(*)::INTEGER
          END
        ) AS ok
        FROM decremented
      ),
      created_sale AS (
        INSERT INTO sales
          (owner_id, shop_id, customer_id, receipt_number, buyer_name, buyer_phone, items, total_amount, total_cost, total_profit, total_quantity, tax_amount, discount_amount, paid_amount, due_date, payment_status, payment_method, notes, sale_status, currency_snapshot, tax_percent_snapshot, shop_snapshot, checkout_session_id)
        SELECT
          ${context.shopOwnerId},
          ${context.shopId},
          ${customer?.customer_id || null},
          ${receiptNumber},
          ${buyerName},
          ${buyerPhone},
          ${JSON.stringify(lineItems)},
          ${grandTotal},
          ${totalCost},
          ${totalProfit},
          ${totalQuantity},
          ${taxAmount},
          ${discountAmount},
          ${paidAmount},
          ${dueDate},
          ${paymentStatus},
          ${paymentMethod},
          ${notes},
          'completed',
          ${currencySnapshot},
          ${taxPercentSnapshot},
          ${shopSnapshot}::jsonb,
          ${checkoutSessionId}
        FROM verified
        WHERE verified.ok = 1
        RETURNING *
      ),
      recorded_movements AS (
        INSERT INTO stock_movements
          (shop_id, product_id, movement_type, quantity_change, reference_type, reference_id, created_by)
        SELECT
          ${context.shopId},
          requested.product_id,
          'sale',
          -requested.quantity,
          'sale',
          created_sale.sale_id::TEXT,
          ${context.userId}
        FROM requested
        CROSS JOIN created_sale
        RETURNING movement_id
      )
      SELECT created_sale.*
      FROM created_sale
      CROSS JOIN (SELECT COUNT(*) FROM recorded_movements) movement_count
    `;
    const sale = saleRows[0];
    await writeAuditEvent(context, "sale.create", "sale", sale.sale_id, {
      receiptNumber,
      totalAmount: grandTotal,
      itemCount: lineItems.length,
    });
    return Response.json(
      { sale: sanitizeSaleForRole(sale, context.role) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error?.code === "22012" || /division by zero/i.test(String(error?.message))) {
      return Response.json(
        { error: "Stock changed before checkout. Refresh products and try again." },
        { status: 409 },
      );
    }
    // Handle duplicate checkout_session_id (unique constraint violation)
    if (error?.code === "23505" && /checkout_session/i.test(String(error?.detail))) {
      return Response.json(
        { error: "This checkout was already processed. Please refresh." },
        { status: 409 },
      );
    }
    console.error("POST /api/sales", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
