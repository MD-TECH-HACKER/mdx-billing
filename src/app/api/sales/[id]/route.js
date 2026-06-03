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
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.shop_name')), sh.shop_name) AS shop_name,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.shop_description')), sh.shop_description) AS shop_description,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.shop_logo')), sh.shop_logo) AS shop_logo,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.address')), sh.address) AS address,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.phone')), sh.phone) AS phone,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.email')), sh.email) AS email,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.gstin')), sh.gstin) AS gstin,
        COALESCE(s.currency_snapshot, sh.currency) AS currency,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.thank_you_message')), sh.thank_you_message) AS thank_you_message,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.default_terms')), sh.default_terms) AS default_terms,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.receipt_prefix')), sh.receipt_prefix) AS receipt_prefix,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.receipt_size')), sh.receipt_size, 'a4') AS receipt_size,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.print_mode')), sh.print_mode, 'color') AS print_mode,
        COALESCE(s.invoice_type, JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.default_invoice_type')), sh.default_invoice_type, 'invoice') AS invoice_type
       FROM sales s
       JOIN shops sh ON sh.shop_id = s.shop_id
       WHERE s.sale_id = ? AND s.shop_id = ?
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
    const rows = await sql.withTransaction(async (tx) => {
      const target = await tx`
        SELECT sale_id, customer_id, total_amount, COALESCE(paid_amount, 0) AS paid_amount
        FROM sales
        WHERE sale_id = ${id} AND shop_id = ${context.shopId}
          AND (sale_status IS NULL OR sale_status = 'completed')
        FOR UPDATE
      `;
      if (!target[0]) return [];
      const sale = target[0];
      const accepted = Math.min(amount, sale.total_amount - sale.paid_amount);
      if (accepted <= 0) return [];
      
      await tx`
        UPDATE sales
        SET paid_amount = paid_amount + ${accepted},
            payment_status = CASE WHEN paid_amount + ${accepted} >= total_amount THEN 'paid' ELSE 'partial' END,
            updated_at = NOW()
        WHERE sale_id = ${id}
      `;
      
      await tx`
        INSERT INTO payments (shop_id, sale_id, customer_id, amount, payment_method, direction, notes, created_by)
        VALUES (${context.shopId}, ${id}, ${sale.customer_id}, ${accepted}, ${method}, 'received', ${notes}, ${context.userId})
      `;
      
      return await tx`SELECT * FROM sales WHERE sale_id = ${id}`;
    });
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
    const results = await sql.withTransaction(async (tx) => {
      const saleRows = await tx`
        SELECT items FROM sales
        WHERE sale_id = ${id} AND shop_id = ${context.shopId}
          AND (sale_status IS NULL OR sale_status = 'completed')
        FOR UPDATE
      `;
      if (!saleRows[0]) return { cancelled: false };

      await tx`UPDATE sales SET sale_status = 'cancelled', updated_at = NOW() WHERE sale_id = ${id}`;

      const saleItems = typeof saleRows[0].items === 'string' ? JSON.parse(saleRows[0].items) : saleRows[0].items || [];
      
      let productUpdates = new Map();
      for (const item of saleItems) {
        if (!item.productId) continue;
        const pid = Number.parseInt(item.productId, 10);
        const qty = Number(item.quantityBaseUnit || item.quantity);
        
        let pData = productUpdates.get(pid);
        if (!pData) {
          const pRows = await tx`SELECT stock_base_unit, stock, conversion_rate FROM products WHERE product_id = ${pid}`;
          if (pRows[0]) {
            pData = {
               product: pRows[0],
               oldStockBase: Number(pRows[0].stock_base_unit) || Number(pRows[0].stock) || 0,
               currentStockBase: Number(pRows[0].stock_base_unit) || Number(pRows[0].stock) || 0,
               totalQty: 0
            };
            productUpdates.set(pid, pData);
          }
        }
        
        if (pData) {
           const lineOldStock = pData.currentStockBase;
           pData.currentStockBase += qty;
           const lineNewStock = pData.currentStockBase;
           pData.totalQty += qty;

           await tx`
              INSERT INTO stock_movements
                (shop_id, product_id, product_name_snapshot, movement_type, quantity_change,
                 quantity_base_unit, display_quantity, unit, old_stock_base_unit, new_stock_base_unit,
                 reason, related_sale_id, reference_type, reference_id, owner_id, created_by)
              VALUES
                (${context.shopId}, ${pid}, ${item.productNameSnapshot}, 'sale_cancel_return',
                 ${qty}, ${qty}, ${item.quantity}, ${item.selectedUnit},
                 ${lineOldStock}, ${lineNewStock},
                 'Cancelled sale stock returned', ${id}, 'sale', ${String(id)},
                 ${context.shopOwnerId}, ${context.userId})
           `;
        }

        // Batch updates
        if (Array.isArray(item.batchAllocations)) {
          for (const alloc of item.batchAllocations) {
            if (!alloc.batchId) continue;
            const bRows = await tx`SELECT quantity_remaining_base_unit, conversion_rate_snapshot, unit, primary_unit_snapshot FROM product_batches WHERE batch_id = ${alloc.batchId}`;
            if (bRows[0]) {
              const oldRemBase = Number(bRows[0].quantity_remaining_base_unit) || 0;
              const newRemBase = oldRemBase + Number(alloc.quantityBaseUnit);
              let newRem = newRemBase;
              if (Number(bRows[0].conversion_rate_snapshot) > 0 && bRows[0].unit === bRows[0].primary_unit_snapshot) {
                 newRem = newRemBase / Number(bRows[0].conversion_rate_snapshot);
              }
              
              await tx`
                UPDATE product_batches
                SET quantity_remaining_base_unit = ${newRemBase},
                    quantity_remaining = ${newRem},
                    updated_at = NOW()
                WHERE batch_id = ${alloc.batchId}
              `;
            }
          }
        }
      }

      for (const [pid, pData] of productUpdates.entries()) {
         const newStock = pData.currentStockBase / (Number(pData.product.conversion_rate) || 1);
         await tx`
            UPDATE products
            SET stock_base_unit = ${pData.currentStockBase},
                stock = ${newStock},
                sold_base_unit = GREATEST(0, COALESCE(sold_base_unit, 0) - ${pData.totalQty}),
                updated_at = NOW()
            WHERE product_id = ${pid}
         `;
      }
      
      return { cancelled: true };
    });
    if (!results?.cancelled) {
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
