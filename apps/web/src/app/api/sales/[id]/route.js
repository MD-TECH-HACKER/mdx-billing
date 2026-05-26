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

function parseSaleId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request, { params }) {
  try {
    const context = await requireShopAccess(request, "sale.read");
    const id = parseSaleId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const saleColumns = canAccess(context.role, "analytics.profit")
      ? "s.*"
      : "s.sale_id, s.shop_id, s.customer_id, s.receipt_number, s.buyer_name, s.buyer_phone, s.items, s.total_amount, s.total_quantity, s.tax_amount, s.discount_amount, s.paid_amount, s.due_date, s.payment_status, s.payment_method, s.notes, s.created_at, s.updated_at";
    const rows = await sql(
      `SELECT ${saleColumns}, sh.shop_name, sh.shop_description, sh.shop_logo, sh.address, sh.phone, sh.currency, sh.thank_you_message, sh.receipt_prefix
       FROM sales s
       JOIN shops sh ON sh.shop_id = s.shop_id
       WHERE s.sale_id = $1 AND s.shop_id = $2
       LIMIT 1`,
      [id, context.shopId],
    );
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ sale: sanitizeSaleForRole(rows[0], context.role) });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/sales/[id]", error);
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
      WITH voided_sale AS (
        DELETE FROM sales
        WHERE sale_id = ${id} AND shop_id = ${context.shopId}
        RETURNING items
      ),
      restored_lines AS (
        SELECT item."productId" AS product_id, item.quantity
        FROM voided_sale
        CROSS JOIN LATERAL jsonb_to_recordset(COALESCE(voided_sale.items, '[]'::jsonb))
          AS item("productId" INTEGER, quantity INTEGER)
        WHERE item."productId" IS NOT NULL AND item.quantity > 0
      ),
      restored_products AS (
        UPDATE products product
        SET stock = product.stock + restored_lines.quantity, updated_at = NOW()
        FROM restored_lines
        WHERE product.product_id = restored_lines.product_id
          AND product.shop_id = ${context.shopId}
        RETURNING product.product_id
      ),
      recorded_movements AS (
        INSERT INTO stock_movements
          (shop_id, product_id, movement_type, quantity_change, reference_type, reference_id, created_by)
        SELECT
          ${context.shopId},
          restored_lines.product_id,
          'sale_void',
          restored_lines.quantity,
          'sale',
          ${String(id)},
          ${context.userId}
        FROM restored_lines
        JOIN restored_products
          ON restored_products.product_id = restored_lines.product_id
        RETURNING movement_id
      )
      SELECT
        EXISTS(SELECT 1 FROM voided_sale) AS deleted,
        (SELECT COUNT(*) FROM recorded_movements) AS restored_movements
    `;
    if (!results[0]?.deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    await writeAuditEvent(context, "sale.delete", "sale", id);

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/sales/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
