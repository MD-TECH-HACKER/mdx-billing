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
} from "@/app/api/utils/saleLines";
import { allocateFifoBatches } from "@/app/api/utils/productBatches";
import { isValidEmail, normalizeEmail } from "@/app/api/utils/email";
import {
  markReceiptEmailError,
  sendReceiptEmailForSale,
} from "@/app/api/utils/receiptEmail";
import { publicReceiptUrl } from "@/app/api/utils/publicReceiptToken";

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function withPublicReceiptLinks(sale) {
  return {
    ...sale,
    publicReceiptUrl: publicReceiptUrl(sale),
    publicReceiptDownloadUrl: publicReceiptUrl(sale, { download: true }),
  };
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
      : "sale_id, shop_id, customer_id, receipt_number, buyer_name, buyer_phone, customer_email, customer_gstin, billing_address, place_of_supply, customer_state_code, invoice_type, items, total_amount, total_quantity, tax_amount, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, paid_amount, due_date, payment_status, payment_method, notes, sale_status, currency_snapshot, receipt_email_sent, receipt_email_sent_at, receipt_email_error, email_message_id, created_at, updated_at";
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

async function resolveCustomer(context, body, buyerName, buyerPhone, customerEmail) {
  if (body.customerId) {
    const id = Number.parseInt(body.customerId, 10);
    const existing = await sql`
      SELECT customer_id, name, phone, email FROM customers
      WHERE customer_id = ${id} AND shop_id = ${context.shopId} AND is_deleted = FALSE
      LIMIT 1
    `;
    if (!existing[0]) throw new Error("Customer not found");
    if (customerEmail && existing[0].email !== customerEmail) {
      await sql`
        UPDATE customers
        SET email = ${customerEmail}, updated_at = NOW()
        WHERE customer_id = ${id} AND shop_id = ${context.shopId}
      `;
      existing[0].email = customerEmail;
    }
    return existing[0];
  }

  if (!buyerName && !buyerPhone) {
    return null;
  }

  const existing = buyerPhone
    ? await sql`
        SELECT customer_id, name, phone, email FROM customers
        WHERE shop_id = ${context.shopId} AND phone = ${buyerPhone} AND is_deleted = FALSE
        LIMIT 1
      `
    : await sql`
        SELECT customer_id, name, phone, email FROM customers
        WHERE shop_id = ${context.shopId} AND LOWER(name) = LOWER(${buyerName})
          AND phone IS NULL AND is_deleted = FALSE
        LIMIT 1
      `;
  if (existing[0]) {
    if (customerEmail && existing[0].email !== customerEmail) {
      await sql`
        UPDATE customers
        SET email = ${customerEmail}, updated_at = NOW()
        WHERE customer_id = ${existing[0].customer_id} AND shop_id = ${context.shopId}
      `;
      existing[0].email = customerEmail;
    }
    return existing[0];
  }
  const created = await sql`
    INSERT INTO customers (shop_id, name, phone, email)
    VALUES (${context.shopId}, ${buyerName || "Walk-in Customer"}, ${buyerPhone}, ${customerEmail || null})
    RETURNING customer_id, name, phone, email
  `;
  return created[0];
}

export async function POST(request) {
  let isEstimateConversion = false;
  try {
    const context = await requireShopAccess(request, "sale.write");
    await ensureBusinessFeatureSchema();
    const body = await request.json();
    const buyerName = String(body.buyerName || "").trim().slice(0, 100);
    const buyerPhone = String(body.buyerPhone || "").trim().slice(0, 50) || null;
    const buyerEmail = normalizeEmail(body.customerEmail ?? body.buyerEmail);
    const invoiceType = ["invoice", "gst_invoice", "receipt"].includes(body.invoiceType)
      ? body.invoiceType
      : "invoice";
    const customerGstin = String(body.customerGstin || "").trim().toUpperCase().slice(0, 20) || null;
    const billingAddress = String(body.billingAddress || "").trim().slice(0, 500) || null;
    const placeOfSupply = String(body.placeOfSupply || "").trim().slice(0, 100) || null;
    const customerStateCode = String(body.customerStateCode || "").trim().slice(0, 2) || null;
    const shopStateCode = String(context.shop.state_code || "").trim().slice(0, 2) || null;
    if (buyerEmail && !isValidEmail(buyerEmail)) {
      return Response.json({ error: "Enter a valid customer email" }, { status: 400 });
    }
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return Response.json({ error: "Add at least one product or manual bill item." }, { status: 400 });
    }
    const sourceEstimateId = Number.parseInt(body.sourceEstimateId, 10);
    let sourceEstimate = null;
    if (Number.isInteger(sourceEstimateId) && sourceEstimateId > 0) {
      const estimates = await sql`
        SELECT estimate_id, estimate_number, status, items
        FROM estimates
        WHERE estimate_id = ${sourceEstimateId}
          AND shop_id = ${context.shopId}
          AND status = 'draft'
        LIMIT 1
      `;
      sourceEstimate = estimates[0] || null;
      if (!sourceEstimate) {
        return Response.json({ error: "Estimate is not available for conversion" }, { status: 409 });
      }
      isEstimateConversion = true;
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
    let productBatches = {};
    if (productIds.length) {
      const placeholders = productIds.map((_, index) => `$${index + 2}`).join(",");
      const products = await sql(
        `SELECT * FROM products WHERE shop_id = $1 AND product_id IN (${placeholders})`,
        [context.shopId, ...productIds],
      );
      productMap = Object.fromEntries(products.map((product) => [product.product_id, product]));
      const batchPlaceholders = productIds.map((_, index) => `$${index + 2}`).join(",");
      const batches = await sql(
        `SELECT * FROM product_batches
         WHERE shop_id = $1 AND product_id IN (${batchPlaceholders})
           AND quantity_remaining_base_unit > 0
         ORDER BY purchase_date ASC, batch_id ASC`,
        [context.shopId, ...productIds],
      );
      productBatches = batches.reduce((acc, batch) => {
        acc[batch.product_id] = acc[batch.product_id] || [];
        acc[batch.product_id].push(batch);
        return acc;
      }, {});
    }

    const lineItems = [];
    const batchRequests = [];
    for (const [itemIndex, item] of items.entries()) {
      const productId = Number.parseInt(item.productId, 10);
      const quotedLine = sourceEstimate && Array.isArray(sourceEstimate.items)
        ? sourceEstimate.items[itemIndex]
        : null;
      if (Number.isInteger(productId) && productId > 0) {
        const product = productMap[productId];
        if (!product) return Response.json({ error: "Product not found" }, { status: 400 });
        const quoteMatchesProduct =
          quotedLine &&
          String(quotedLine.productId || "") === String(productId) &&
          String(quotedLine.selectedUnit || "").toLowerCase() ===
            String(item.selectedUnit || product.primary_unit || "").toLowerCase();
        const line = buildProductSaleLine(product, {
          quantity: item.quantity,
          selectedUnit: item.selectedUnit,
          unitPriceOverride: quoteMatchesProduct
            ? quotedLine.pricePerUnitAtSale ?? quotedLine.unitPrice
            : undefined,
          discount: item.discount,
          taxRate: item.taxRate ?? product.gst_rate ?? product.tax_rate,
          taxMode: item.taxMode || product.tax_mode || context.shop.tax_mode || "exclusive",
          shopStateCode,
          customerStateCode,
        });
        const pricePerBaseUnit =
          line.quantityBaseUnit > 0
            ? money((line.pricePerUnitAtSale * line.quantity) / line.quantityBaseUnit)
            : line.pricePerUnitAtSale;
        const allocation = allocateFifoBatches({
          quantityBaseUnit: line.quantityBaseUnit,
          sellingPricePerBaseUnit: pricePerBaseUnit,
          batches: productBatches[productId] || [],
          product,
        });
        line.batchId = allocation.allocations[0]?.batchId || null;
        line.batchAllocations = allocation.allocations;
        line.costPerBaseUnitAtSale = line.quantityBaseUnit > 0
          ? money(allocation.totalCost / line.quantityBaseUnit)
          : 0;
        line.costPrice = line.costPerBaseUnitAtSale;
        line.totalCost = allocation.totalCost;
        line.totalProfit = money(line.subtotal - allocation.totalCost);
        line.marginPercent = line.subtotal > 0 ? money((line.totalProfit / line.subtotal) * 100) : 0;
        allocation.allocations.forEach((batch) => {
          batchRequests.push({
            batchId: batch.batchId,
            productId,
            quantityBaseUnit: batch.quantityBaseUnit,
          });
        });
        lineItems.push(line);
      } else {
        lineItems.push(
          buildManualSaleLine({
            ...item,
            taxMode: item.taxMode || context.shop.tax_mode || "exclusive",
            shopStateCode,
            customerStateCode,
          }),
        );
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
    const cgstAmount = money(lineItems.reduce((sum, item) => sum + Number(item.cgstAmount || 0), 0));
    const sgstAmount = money(lineItems.reduce((sum, item) => sum + Number(item.sgstAmount || 0), 0));
    const igstAmount = money(lineItems.reduce((sum, item) => sum + Number(item.igstAmount || 0), 0));
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
    const customer = await resolveCustomer(context, body, buyerName, buyerPhone, buyerEmail);
    const displayBuyerName = buyerName || customer?.name || "Walk-in Customer";
    const displayBuyerPhone = buyerPhone || customer?.phone || null;
    const displayBuyerEmail = buyerEmail || customer?.email || null;
    const receiptNumber = `${context.shop.receipt_prefix || "INV"}-${Date.now()}`;
    const shopSnapshot = JSON.stringify({
      shop_name: context.shop.shop_name,
      business_legal_name: context.shop.business_legal_name || null,
      shop_description: context.shop.shop_description || null,
      shop_logo: context.shop.shop_logo || null,
      address: context.shop.business_address || context.shop.address || null,
      phone: context.shop.phone || null,
      email: context.shop.email || null,
      gstin: context.shop.gstin || null,
      state: context.shop.state || null,
      state_code: context.shop.state_code || null,
      thank_you_message: context.shop.thank_you_message || null,
      default_terms: context.shop.default_terms || null,
      receipt_prefix: context.shop.receipt_prefix || null,
      receipt_size: context.shop.receipt_size || "a4",
      print_mode: context.shop.print_mode || "color",
      default_invoice_type: invoiceType,
    });
    const stockRequests = JSON.stringify(
      [...requiredByProduct].map(([productId, quantityBaseUnit]) => ({
        productId,
        quantityBaseUnit,
        productName: productMap[productId].title,
      })),
    );
    const linesJson = JSON.stringify(lineItems);
    const batchRequestsJson = JSON.stringify(batchRequests);
    const productLineCount = requiredByProduct.size;
    const batchLineCount = batchRequests.length;

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
      requested_batches AS (
        SELECT item."batchId" AS batch_id, item."productId" AS product_id,
          item."quantityBaseUnit" AS quantity_base_unit
        FROM jsonb_to_recordset(${batchRequestsJson}::jsonb)
          AS item("batchId" BIGINT, "productId" INTEGER, "quantityBaseUnit" NUMERIC)
      ),
      decremented_batches AS (
        UPDATE product_batches batch
        SET
          quantity_remaining_base_unit = batch.quantity_remaining_base_unit - requested_batches.quantity_base_unit,
          quantity_remaining = CASE
            WHEN batch.conversion_rate_snapshot > 0 AND batch.unit = batch.primary_unit_snapshot
              THEN (batch.quantity_remaining_base_unit - requested_batches.quantity_base_unit) / batch.conversion_rate_snapshot
            ELSE batch.quantity_remaining_base_unit - requested_batches.quantity_base_unit
          END,
          updated_at = NOW()
        FROM requested_batches
        WHERE batch.batch_id = requested_batches.batch_id
          AND batch.shop_id = ${context.shopId}
          AND batch.product_id = requested_batches.product_id
          AND batch.quantity_remaining_base_unit >= requested_batches.quantity_base_unit
        RETURNING batch.batch_id
      ),
      verified AS (
        SELECT 1 / CASE
          WHEN (SELECT COUNT(*) FROM decremented) = ${productLineCount}
           AND (SELECT COUNT(*) FROM decremented_batches) = ${batchLineCount}
          THEN 1 ELSE 0 END AS ok
      ),
      created_sale AS (
        INSERT INTO sales
          (owner_id, shop_id, customer_id, receipt_number, buyer_name, buyer_phone, customer_email, items,
           total_amount, total_cost, total_profit, total_quantity, tax_amount, discount_amount,
           invoice_type, customer_gstin, billing_address, place_of_supply, customer_state_code,
           taxable_amount, cgst_amount, sgst_amount, igst_amount, gst_breakdown,
           paid_amount, due_date, payment_status, payment_method, notes, sale_status,
           currency_snapshot, tax_percent_snapshot, shop_snapshot, checkout_session_id)
        SELECT
          ${context.shopOwnerId}, ${context.shopId}, ${customer?.customer_id || null}, ${receiptNumber},
          ${displayBuyerName}, ${displayBuyerPhone}, ${displayBuyerEmail}, ${linesJson}::jsonb, ${grandTotal}, ${totalCost}, ${totalProfit},
          ${totalQuantity}, ${taxAmount}, ${invoice.discountAmount},
          ${invoiceType}, ${customerGstin}, ${billingAddress}, ${placeOfSupply}, ${customerStateCode},
          ${invoice.taxableAmount}, ${cgstAmount}, ${sgstAmount}, ${igstAmount},
          ${JSON.stringify({ cgstAmount, sgstAmount, igstAmount, shopStateCode, customerStateCode })}::jsonb,
          ${paidAmount}, ${dueDate},
          ${paymentStatus}, ${paymentMethod}, ${notes}, 'completed', ${context.shop.currency || "INR"},
          ${Number(context.shop.tax_percent) || 0}, ${shopSnapshot}::jsonb, ${checkoutSessionId}
        FROM verified WHERE verified.ok = 1
        RETURNING *
      ),
      sale_lines AS (
        SELECT item."productId" AS product_id, item."productNameSnapshot" AS product_name,
          item."quantityBaseUnit" AS quantity_base_unit, item.quantity AS display_quantity,
          item."selectedUnit" AS unit,
          SUM(item."quantityBaseUnit") OVER (
            PARTITION BY item."productId" ORDER BY line.ordinality
          ) AS cumulative_quantity_base_unit
        FROM jsonb_array_elements(${linesJson}::jsonb) WITH ORDINALITY AS line(value, ordinality)
        CROSS JOIN LATERAL jsonb_to_record(line.value)
          AS item("productId" INTEGER, "productNameSnapshot" TEXT, "quantityBaseUnit" NUMERIC,
            quantity NUMERIC, "selectedUnit" TEXT)
        WHERE item."productId" IS NOT NULL
      ),
      recorded_movements AS (
        INSERT INTO stock_movements
          (shop_id, product_id, product_name_snapshot, movement_type, quantity_change,
           quantity_base_unit, display_quantity, unit, old_stock_base_unit, new_stock_base_unit,
           reason, related_sale_id, reference_type, reference_id, owner_id, created_by)
        SELECT ${context.shopId}, line.product_id, line.product_name, 'sale_stock_out',
          -line.quantity_base_unit, -line.quantity_base_unit, line.display_quantity, line.unit,
          d.new_stock_base_unit + d.quantity_base_unit - (line.cumulative_quantity_base_unit - line.quantity_base_unit),
          d.new_stock_base_unit + d.quantity_base_unit - line.cumulative_quantity_base_unit,
          'Invoice stock out', created_sale.sale_id, 'sale', created_sale.sale_id::TEXT,
          ${context.shopOwnerId}, ${context.userId}
        FROM sale_lines line
        JOIN decremented d ON d.product_id = line.product_id
        CROSS JOIN created_sale
        RETURNING movement_id
      ),
      initial_payment AS (
        INSERT INTO payments
          (shop_id, sale_id, customer_id, amount, payment_method, direction, notes, created_by)
        SELECT ${context.shopId}, created_sale.sale_id, ${customer?.customer_id || null}, ${paidAmount},
          ${paymentMethod}, 'received', 'Payment received at billing', ${context.userId}
        FROM created_sale WHERE ${paidAmount} > 0
        RETURNING payment_id
      ),
      converted_estimate AS (
        UPDATE estimates estimate
        SET status = 'converted', converted_sale_id = created_sale.sale_id, updated_at = NOW()
        FROM created_sale
        WHERE estimate.estimate_id = ${sourceEstimate?.estimate_id || null}
          AND estimate.shop_id = ${context.shopId}
          AND estimate.status = 'draft'
        RETURNING estimate.estimate_id
      ),
      conversion_verified AS (
        SELECT 1 / CASE
          WHEN ${!sourceEstimate} OR (SELECT COUNT(*) FROM converted_estimate) = 1
          THEN 1 ELSE 0 END AS ok
      )
      SELECT created_sale.* FROM created_sale
      CROSS JOIN (SELECT COUNT(*) FROM recorded_movements) movements
      CROSS JOIN (SELECT COUNT(*) FROM initial_payment) payments
      CROSS JOIN conversion_verified
    `;
    const sale = saleRows[0];
    await writeAuditEvent(context, "sale.create", "sale", sale.sale_id, {
      receiptNumber,
      totalAmount: grandTotal,
      balanceAmount: money(grandTotal - paidAmount),
      itemCount: lineItems.length,
      sourceEstimateId: sourceEstimate?.estimate_id || null,
    });
    const receiptEmail = { attempted: false, sent: false };
    if (context.shop.send_receipt_email && displayBuyerEmail) {
      receiptEmail.attempted = true;
      try {
        const emailResult = await sendReceiptEmailForSale(context, sale.sale_id);
        receiptEmail.sent = true;
        receiptEmail.messageId = emailResult.messageId;
      } catch (emailError) {
        await markReceiptEmailError(context, sale.sale_id, emailError);
        receiptEmail.error = "Receipt email could not be sent";
      }
    }
    return Response.json(
      { sale: withPublicReceiptLinks(sanitizeSaleForRole(sale, context.role)), receiptEmail },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (/Customer not found/i.test(String(error?.message))) {
      return Response.json({ error: "Customer not found" }, { status: 400 });
    }
    if (/quantity|unit|stock|manual item/i.test(String(error?.message))) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error?.code === "22012" || /division by zero/i.test(String(error?.message))) {
      return Response.json(
        {
          error: isEstimateConversion
            ? "This estimate was already converted or stock changed before saving. Refresh and try again."
            : "Stock changed before saving. Refresh products and try again.",
        },
        { status: 409 },
      );
    }
    if (error?.code === "23505" && /checkout_session/i.test(String(error?.detail))) {
      return Response.json({ error: "This bill was already saved. Please refresh." }, { status: 409 });
    }
    console.error("POST /api/sales", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
