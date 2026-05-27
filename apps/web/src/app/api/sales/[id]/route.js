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
import { publicReceiptUrl } from "@/app/api/utils/publicReceiptToken";

function parseSaleId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function withPublicReceiptLinks(sale) {
  return {
    ...sale,
    publicReceiptUrl: publicReceiptUrl(sale),
    publicReceiptDownloadUrl: publicReceiptUrl(sale, { download: true }),
  };
}

export async function GET(request, { params }) {
  try {
    const context = await requireShopAccess(request, "sale.read");
    await ensureBusinessFeatureSchema();
    const id = parseSaleId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const saleColumns = canAccess(context.role, "analytics.profit")
      ? "s.*"
      : "s.sale_id, s.shop_id, s.customer_id, s.receipt_number, s.buyer_name, s.buyer_phone, s.customer_email, s.customer_gstin, s.billing_address, s.place_of_supply, s.customer_state_code, s.invoice_type, s.items, s.total_amount, s.total_quantity, s.tax_amount, s.discount_amount, s.taxable_amount, s.cgst_amount, s.sgst_amount, s.igst_amount, s.paid_amount, s.due_date, s.payment_status, s.payment_method, s.notes, s.sale_status, s.currency_snapshot, s.tax_percent_snapshot, s.shop_snapshot, s.receipt_email_sent, s.receipt_email_sent_at, s.receipt_email_error, s.email_message_id, s.created_at, s.updated_at";
    const rows = await sql(
      `SELECT ${saleColumns},
        COALESCE(s.shop_snapshot->>'shop_name', sh.shop_name) AS shop_name,
        COALESCE(s.shop_snapshot->>'shop_description', sh.shop_description) AS shop_description,
        COALESCE(s.shop_snapshot->>'shop_logo', sh.shop_logo) AS shop_logo,
        COALESCE(s.shop_snapshot->>'address', sh.address) AS address,
        COALESCE(s.shop_snapshot->>'phone', sh.phone) AS phone,
        COALESCE(s.shop_snapshot->>'email', sh.email) AS email,
        COALESCE(s.shop_snapshot->>'gstin', sh.gstin) AS gstin,
        COALESCE(s.currency_snapshot, sh.currency) AS currency,
        COALESCE(s.shop_snapshot->>'thank_you_message', sh.thank_you_message) AS thank_you_message,
        COALESCE(s.shop_snapshot->>'default_terms', sh.default_terms) AS default_terms,
        COALESCE(s.shop_snapshot->>'receipt_prefix', sh.receipt_prefix) AS receipt_prefix,
        COALESCE(s.shop_snapshot->>'receipt_size', sh.receipt_size, 'a4') AS receipt_size,
        COALESCE(s.shop_snapshot->>'print_mode', sh.print_mode, 'color') AS print_mode,
        COALESCE(s.invoice_type, s.shop_snapshot->>'default_invoice_type', sh.default_invoice_type, 'invoice') AS invoice_type
       FROM sales s
       JOIN shops sh ON sh.shop_id = s.shop_id
       WHERE s.sale_id = $1 AND s.shop_id = $2
       LIMIT 1`,
      [id, context.shopId],
    );
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    const payments = await sql`
      SELECT payment_id, amount, payment_method, direction, notes, payment_date, created_at
      FROM payments
      WHERE sale_id = ${id} AND shop_id = ${context.shopId}
      ORDER BY created_at ASC
    `;
    return Response.json({
      sale: withPublicReceiptLinks(sanitizeSaleForRole(rows[0], context.role)),
      payments,
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/sales/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const context = await requireShopAccess(request, "sale.write");
    await ensureBusinessFeatureSchema();
    const id = parseSaleId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const body = await request.json();
    const amount = Math.round((Number(body.amount) + Number.EPSILON) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    }
    const method = ["cash", "upi", "bank", "bank_transfer", "card"].includes(body.paymentMethod)
      ? body.paymentMethod
      : "cash";
    const notes = String(body.notes || "").trim().slice(0, 300) || null;
    const rows = await sql`
      WITH target AS (
        SELECT sale_id, customer_id, total_amount, COALESCE(paid_amount, 0) AS paid_amount,
          LEAST(${amount}, total_amount - COALESCE(paid_amount, 0)) AS accepted_amount
        FROM sales
        WHERE sale_id = ${id} AND shop_id = ${context.shopId}
          AND (sale_status IS NULL OR sale_status = 'completed')
        FOR UPDATE
      ),
      updated AS (
        UPDATE sales s
        SET
          paid_amount = target.paid_amount + target.accepted_amount,
          payment_status = CASE
            WHEN target.paid_amount + target.accepted_amount >= target.total_amount THEN 'paid'
            ELSE 'partial'
          END,
          updated_at = NOW()
        FROM target
        WHERE s.sale_id = target.sale_id AND target.paid_amount < target.total_amount
        RETURNING s.*, target.customer_id
      ),
      recorded AS (
        INSERT INTO payments
          (shop_id, sale_id, customer_id, amount, payment_method, direction, notes, created_by)
        SELECT ${context.shopId}, updated.sale_id, updated.customer_id,
          target.accepted_amount,
          ${method}, 'received', ${notes}, ${context.userId}
        FROM updated JOIN target ON target.sale_id = updated.sale_id
        RETURNING payment_id
      )
      SELECT updated.* FROM updated CROSS JOIN recorded
    `;
    if (!rows[0]) return Response.json({ error: "Sale is paid, cancelled, or not found" }, { status: 400 });
    await writeAuditEvent(context, "sale.payment", "sale", id, { amount, method });
    return Response.json({ sale: sanitizeSaleForRole(rows[0], context.role) });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("PATCH /api/sales/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const context = await requireShopAccess(request, "sale.delete");
    await ensureBusinessFeatureSchema();
    const id = parseSaleId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const results = await sql`
      WITH cancelled_sale AS (
        UPDATE sales
        SET sale_status = 'cancelled', updated_at = NOW()
        WHERE sale_id = ${id} AND shop_id = ${context.shopId}
          AND (sale_status IS NULL OR sale_status = 'completed')
        RETURNING items
      ),
      restored_lines AS (
        SELECT item."productId" AS product_id,
          MAX(item."productNameSnapshot") AS product_name,
          SUM(COALESCE(item."quantityBaseUnit", item.quantity)) AS quantity_base_unit
        FROM cancelled_sale
        CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(cancelled_sale.items, '[]'::jsonb))
          AS item("productId" INTEGER, "productNameSnapshot" TEXT, "quantityBaseUnit" NUMERIC, quantity NUMERIC)
        WHERE item."productId" IS NOT NULL
        GROUP BY item."productId"
      ),
      restored_products AS (
        UPDATE products product
        SET
          stock_base_unit = COALESCE(product.stock_base_unit, product.stock) + restored_lines.quantity_base_unit,
          stock = (COALESCE(product.stock_base_unit, product.stock) + restored_lines.quantity_base_unit) /
            CASE WHEN product.conversion_rate > 0 THEN product.conversion_rate ELSE 1 END,
          sold_base_unit = GREATEST(0, COALESCE(product.sold_base_unit, 0) - restored_lines.quantity_base_unit),
          updated_at = NOW()
        FROM restored_lines
        WHERE product.product_id = restored_lines.product_id AND product.shop_id = ${context.shopId}
        RETURNING product.product_id, product.title,
          restored_lines.quantity_base_unit,
          COALESCE(product.stock_base_unit, product.stock) AS new_stock_base_unit
      ),
      returned_batches AS (
        SELECT alloc."batchId" AS batch_id,
          SUM(alloc."quantityBaseUnit") AS quantity_base_unit
        FROM cancelled_sale
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cancelled_sale.items, '[]'::jsonb)) item
        CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(item->'batchAllocations', '[]'::jsonb))
          AS alloc("batchId" BIGINT, "quantityBaseUnit" NUMERIC)
        WHERE alloc."batchId" IS NOT NULL
        GROUP BY alloc."batchId"
      ),
      restored_batches AS (
        UPDATE product_batches batch
        SET
          quantity_remaining_base_unit = batch.quantity_remaining_base_unit + returned_batches.quantity_base_unit,
          quantity_remaining = CASE
            WHEN batch.conversion_rate_snapshot > 0 AND batch.unit = batch.primary_unit_snapshot
              THEN (batch.quantity_remaining_base_unit + returned_batches.quantity_base_unit) / batch.conversion_rate_snapshot
            ELSE batch.quantity_remaining_base_unit + returned_batches.quantity_base_unit
          END,
          updated_at = NOW()
        FROM returned_batches
        WHERE batch.batch_id = returned_batches.batch_id AND batch.shop_id = ${context.shopId}
        RETURNING batch.batch_id
      ),
      recorded_movements AS (
        INSERT INTO stock_movements
          (shop_id, product_id, product_name_snapshot, movement_type, quantity_change,
           quantity_base_unit, display_quantity, unit, old_stock_base_unit, new_stock_base_unit,
           reason, related_sale_id, reference_type, reference_id, owner_id, created_by)
        SELECT ${context.shopId}, product_id, title, 'sale_cancel_return',
          quantity_base_unit, quantity_base_unit, quantity_base_unit, 'base',
          new_stock_base_unit - quantity_base_unit, new_stock_base_unit,
          'Cancelled sale stock returned', ${id}, 'sale', ${String(id)},
          ${context.shopOwnerId}, ${context.userId}
        FROM restored_products
        RETURNING movement_id
      )
      SELECT EXISTS(SELECT 1 FROM cancelled_sale) AS cancelled,
        (SELECT COUNT(*) FROM recorded_movements) AS restored_movements,
        (SELECT COUNT(*) FROM restored_batches) AS restored_batches
    `;
    if (!results[0]?.cancelled) {
      return Response.json({ error: "Not found or already cancelled" }, { status: 404 });
    }
    await writeAuditEvent(context, "sale.cancel", "sale", id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/sales/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
