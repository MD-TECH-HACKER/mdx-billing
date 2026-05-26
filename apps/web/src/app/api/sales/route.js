import sql from "@/app/api/utils/sql";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import { canAccess } from "@/app/api/utils/permissions";
import { sanitizeSaleForRole } from "@/app/api/utils/financialVisibility";
import { calculateInvoiceTotals } from "@/app/api/utils/invoiceTotals";
import {
  buildManualSaleLine,
  buildProductSaleLine,
  customerNameError,
} from "@/app/api/utils/saleLines";

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

const PAYMENT_METHODS = new Set(["cash", "credit", "upi", "bank", "bank_transfer", "card"]);

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "sale.read");
    await ensureBusinessFeatureSchema();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const status = url.searchParams.get("status");
    const sort = url.searchParams.get("sort") || "newest";
    const columns = canAccess(context.role, "analytics.profit")
      ? "*"
      : "sale_id, shop_id, customer_id, receipt_number, buyer_name, buyer_phone, items, total_amount, total_quantity, tax_amount, discount_amount, paid_amount, due_date, payment_status, payment_method, notes, sale_status, currency_snapshot, created_at, updated_at";
    let query = `SELECT ${columns} FROM sales WHERE shop_id = $1`;
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
      if (status === "cancelled") {
        query += " AND sale_status = 'cancelled'";
      } else {
        values.push(status);
        query += ` AND payment_status = $${values.length} AND (sale_status IS NULL OR sale_status = 'completed')`;
      }
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
    return Response.json({ sales: sales.map((sale) => sanitizeSaleForRole(sale, context.role)) });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/sales", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function resolveCustomer(context, body, buyerName, buyerPhone) {
  if (body.customerId) {
    const id = Number.parseInt(body.customerId, 10);
    const existing = await sql`
      SELECT customer_id, name, phone FROM customers
      WHERE customer_id = ${id} AND shop_id = ${context.shopId} AND is_deleted = FALSE
      LIMIT 1
    `;
    if (!existing[0]) throw new Error("Customer not found");
    return existing[0];
  }

  const existing = buyerPhone
    ? await sql`
        SELECT customer_id, name, phone FROM customers
        WHERE shop_id = ${context.shopId} AND phone = ${buyerPhone} AND is_deleted = FALSE
        LIMIT 1
      `
    : await sql`
        SELECT customer_id, name, phone FROM customers
        WHERE shop_id = ${context.shopId} AND LOWER(name) = LOWER(${buyerName})
          AND phone IS NULL AND is_deleted = FALSE
        LIMIT 1
      `;
  if (existing[0]) return existing[0];
  const created = await sql`
    INSERT INTO customers (shop_id, name, phone)
    VALUES (${context.shopId}, ${buyerName}, ${buyerPhone})
    RETURNING customer_id, name, phone
  `;
  return created[0];
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "sale.write");
    await ensureBusinessFeatureSchema();
    const body = await request.json();
    const buyerName = String(body.buyerName || "").trim().slice(0, 100);
    const nameError = customerNameError(buyerName);
    if (nameError) return Response.json({ error: nameError }, { status: 400 });

    const buyerPhone = String(body.buyerPhone || "").trim().slice(0, 50) || null;
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return Response.json({ error: "Add at least one product or manual bill item." }, { status: 400 });
    }

    const checkoutSessionId = String(body.checkoutSessionId || "").trim() || null;
    if (checkoutSessionId) {
      const existing = await sql`
        SELECT * FROM sales
        WHERE checkout_session_id = ${checkoutSessionId} AND shop_id = ${context.shopId}
        LIMIT 1
      `;
      if (existing[0]) {
        return Response.json({ sale: sanitizeSaleForRole(existing[0], context.role) });
      }
    }

    const productIds = [
      ...new Set(
        items
          .map((item) => Number.parseInt(item.productId, 10))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
    let productMap = {};
    if (productIds.length) {
      const placeholders = productIds.map((_, index) => `$${index + 2}`).join(",");
      const products = await sql(
        `SELECT * FROM products WHERE shop_id = $1 AND product_id IN (${placeholders})`,
        [context.shopId, ...productIds],
      );
      productMap = Object.fromEntries(products.map((product) => [product.product_id, product]));
    }

    const lineItems = [];
    for (const item of items) {
      const productId = Number.parseInt(item.productId, 10);
      if (Number.isInteger(productId) && productId > 0) {
        const product = productMap[productId];
        if (!product) return Response.json({ error: "Product not found" }, { status: 400 });
        lineItems.push(
          buildProductSaleLine(product, {
            quantity: item.quantity,
            selectedUnit: item.selectedUnit,
            discount: item.discount,
            taxRate: item.taxRate ?? product.tax_rate,
          }),
        );
      } else {
        lineItems.push(buildManualSaleLine(item));
      }
    }

    const requiredByProduct = new Map();
    for (const item of lineItems.filter((line) => line.productId)) {
      requiredByProduct.set(
        item.productId,
        (requiredByProduct.get(item.productId) || 0) + item.quantityBaseUnit,
      );
    }
    for (const [productId, required] of requiredByProduct) {
      const available = Number(productMap[productId].stock_base_unit ?? productMap[productId].stock);
      if (required > available) {
        return Response.json(
          { error: `Not enough stock for ${productMap[productId].title}` },
          { status: 400 },
        );
      }
    }

    const lineSubtotal = money(lineItems.reduce((sum, item) => sum + item.subtotal, 0));
    const itemTax = money(lineItems.reduce((sum, item) => sum + item.taxAmount, 0));
    const usesItemTax = lineItems.some((item) => item.taxRate > 0);
    const totalCost = money(lineItems.reduce((sum, item) => sum + item.totalCost, 0));
    const invoice = calculateInvoiceTotals(
      lineSubtotal,
      usesItemTax ? 0 : context.shop.tax_percent,
      body.discountAmount,
    );
    const taxAmount = usesItemTax ? itemTax : invoice.taxAmount;
    const grandTotal = money(invoice.taxableAmount + taxAmount);
    const totalProfit = money(invoice.taxableAmount - totalCost);
    const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);
    const paymentMethod = PAYMENT_METHODS.has(body.paymentMethod) ? body.paymentMethod : "cash";
    const received = money(Math.min(grandTotal, Math.max(0, Number(body.receivedAmount ?? body.paidAmount) || 0)));
    const paidAmount = paymentMethod === "credit" ? received : received || (body.paymentStatus === "paid" ? grandTotal : 0);
    const paymentStatus = paidAmount >= grandTotal ? "paid" : paidAmount > 0 ? "partial" : "credit";
    const dueDate = String(body.dueDate || "").slice(0, 10) || null;
    const notes = String(body.notes || "").trim().slice(0, 500) || null;
    const customer = await resolveCustomer(context, body, buyerName, buyerPhone);
    const receiptNumber = `${context.shop.receipt_prefix || "INV"}-${Date.now()}`;
    const shopSnapshot = JSON.stringify({
      shop_name: context.shop.shop_name,
      shop_description: context.shop.shop_description || null,
      shop_logo: context.shop.shop_logo || null,
      address: context.shop.address || null,
      phone: context.shop.phone || null,
      gstin: context.shop.gstin || null,
      thank_you_message: context.shop.thank_you_message || null,
      default_terms: context.shop.default_terms || null,
      receipt_prefix: context.shop.receipt_prefix || null,
      receipt_size: context.shop.receipt_size || "a4",
      print_mode: context.shop.print_mode || "color",
      default_invoice_type: context.shop.default_invoice_type || "tax_invoice",
    });
    const stockRequests = JSON.stringify(
      [...requiredByProduct].map(([productId, quantityBaseUnit]) => ({
        productId,
        quantityBaseUnit,
        productName: productMap[productId].title,
      })),
    );
    const linesJson = JSON.stringify(lineItems);
    const productLineCount = requiredByProduct.size;

    const saleRows = await sql`
      WITH requested AS (
        SELECT item."productId" AS product_id, item."quantityBaseUnit" AS quantity_base_unit,
               item."productName" AS product_name
        FROM jsonb_to_recordset(${stockRequests}::jsonb)
          AS item("productId" INTEGER, "quantityBaseUnit" NUMERIC, "productName" TEXT)
      ),
      decremented AS (
        UPDATE products product
        SET
          stock_base_unit = COALESCE(product.stock_base_unit, product.stock) - requested.quantity_base_unit,
          stock = (COALESCE(product.stock_base_unit, product.stock) - requested.quantity_base_unit) /
            CASE WHEN product.conversion_rate > 0 THEN product.conversion_rate ELSE 1 END,
          sold_base_unit = COALESCE(product.sold_base_unit, 0) + requested.quantity_base_unit,
          updated_at = NOW()
        FROM requested
        WHERE product.product_id = requested.product_id
          AND product.shop_id = ${context.shopId}
          AND COALESCE(product.stock_base_unit, product.stock) >= requested.quantity_base_unit
        RETURNING product.product_id, requested.product_name, requested.quantity_base_unit,
          COALESCE(product.stock_base_unit, product.stock) AS new_stock_base_unit
      ),
      verified AS (
        SELECT 1 / CASE WHEN COUNT(*) = ${productLineCount} THEN 1 ELSE 0 END AS ok
        FROM decremented
      ),
      created_sale AS (
        INSERT INTO sales
          (owner_id, shop_id, customer_id, receipt_number, buyer_name, buyer_phone, items,
           total_amount, total_cost, total_profit, total_quantity, tax_amount, discount_amount,
           paid_amount, due_date, payment_status, payment_method, notes, sale_status,
           currency_snapshot, tax_percent_snapshot, shop_snapshot, checkout_session_id)
        SELECT
          ${context.shopOwnerId}, ${context.shopId}, ${customer.customer_id}, ${receiptNumber},
          ${buyerName}, ${buyerPhone}, ${linesJson}::jsonb, ${grandTotal}, ${totalCost}, ${totalProfit},
          ${totalQuantity}, ${taxAmount}, ${invoice.discountAmount}, ${paidAmount}, ${dueDate},
          ${paymentStatus}, ${paymentMethod}, ${notes}, 'completed', ${context.shop.currency || "INR"},
          ${Number(context.shop.tax_percent) || 0}, ${shopSnapshot}::jsonb, ${checkoutSessionId}
        FROM verified WHERE verified.ok = 1
        RETURNING *
      ),
      recorded_movements AS (
        INSERT INTO stock_movements
          (shop_id, product_id, product_name_snapshot, movement_type, quantity_change,
           quantity_base_unit, display_quantity, unit, old_stock_base_unit, new_stock_base_unit,
           reason, related_sale_id, reference_type, reference_id, owner_id, created_by)
        SELECT ${context.shopId}, d.product_id, d.product_name, 'sale_stock_out',
          -d.quantity_base_unit, -d.quantity_base_unit, d.quantity_base_unit, 'base',
          d.new_stock_base_unit + d.quantity_base_unit, d.new_stock_base_unit,
          'Invoice stock out', created_sale.sale_id, 'sale', created_sale.sale_id::TEXT,
          ${context.shopOwnerId}, ${context.userId}
        FROM decremented d CROSS JOIN created_sale
        RETURNING movement_id
      ),
      initial_payment AS (
        INSERT INTO payments
          (shop_id, sale_id, customer_id, amount, payment_method, direction, notes, created_by)
        SELECT ${context.shopId}, created_sale.sale_id, ${customer.customer_id}, ${paidAmount},
          ${paymentMethod}, 'received', 'Payment received at billing', ${context.userId}
        FROM created_sale WHERE ${paidAmount} > 0
        RETURNING payment_id
      )
      SELECT created_sale.* FROM created_sale
      CROSS JOIN (SELECT COUNT(*) FROM recorded_movements) movements
      CROSS JOIN (SELECT COUNT(*) FROM initial_payment) payments
    `;
    const sale = saleRows[0];
    await writeAuditEvent(context, "sale.create", "sale", sale.sale_id, {
      receiptNumber,
      totalAmount: grandTotal,
      balanceAmount: money(grandTotal - paidAmount),
      itemCount: lineItems.length,
    });
    return Response.json({ sale: sanitizeSaleForRole(sale, context.role) }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (/Customer not found/i.test(String(error?.message))) {
      return Response.json({ error: "Customer not found" }, { status: 400 });
    }
    if (/quantity|unit|stock|manual item/i.test(String(error?.message))) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error?.code === "22012" || /division by zero/i.test(String(error?.message))) {
      return Response.json({ error: "Stock changed before checkout. Refresh products and try again." }, { status: 409 });
    }
    if (error?.code === "23505" && /checkout_session/i.test(String(error?.detail))) {
      return Response.json({ error: "This checkout was already processed. Please refresh." }, { status: 409 });
    }
    console.error("POST /api/sales", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
