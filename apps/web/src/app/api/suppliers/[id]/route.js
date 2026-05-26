import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request, { params }) {
  try {
    const context = await requireShopAccess(request, "supplier.write");
    await ensureBusinessFeatureSchema();
    const id = parseId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const body = await request.json();
    const name = (body.name || "").toString().trim().slice(0, 120);
    if (!name) return Response.json({ error: "Supplier name is required" }, { status: 400 });
    const phone = (body.phone || "").toString().trim().slice(0, 50) || null;
    const email = (body.email || "").toString().trim().slice(0, 254) || null;
    const gstin = (body.gstin || "").toString().trim().toUpperCase().slice(0, 20) || null;
    const address = (body.address || "").toString().trim().slice(0, 400) || null;
    const openingBalance = Number(body.openingBalance) || 0;
    const notes = (body.notes || "").toString().trim().slice(0, 500) || null;
    const rows = await sql`
      UPDATE suppliers
      SET name = ${name}, phone = ${phone}, email = ${email}, gstin = ${gstin},
          address = ${address}, opening_balance = ${openingBalance}, notes = ${notes}, updated_at = NOW()
      WHERE supplier_id = ${id} AND shop_id = ${context.shopId} AND is_deleted = FALSE
      RETURNING *
    `;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await writeAuditEvent(context, "supplier.update", "supplier", id);
    return Response.json({ supplier: rows[0] });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("PUT /api/suppliers/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const context = await requireShopAccess(request, "supplier.write");
    await ensureBusinessFeatureSchema();
    const id = parseId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const body = await request.json();
    const amount = Math.round((Number(body.amount) + Number.EPSILON) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Payment amount must be greater than zero" }, { status: 400 });
    }
    const method = ["cash", "upi", "bank", "bank_transfer"].includes(body.paymentMethod)
      ? body.paymentMethod
      : "cash";
    const notes = String(body.notes || "").trim().slice(0, 300) || null;
    const rows = await sql`
      WITH locked_supplier AS (
        SELECT supplier_id, COALESCE(opening_balance, 0) AS opening_balance
        FROM suppliers
        WHERE supplier_id = ${id} AND shop_id = ${context.shopId} AND is_deleted = FALSE
        FOR UPDATE
      ),
      outstanding AS (
        SELECT locked_supplier.supplier_id,
          GREATEST(0, locked_supplier.opening_balance +
            COALESCE((SELECT SUM(total_amount - COALESCE(paid_amount, 0)) FROM purchases
              WHERE supplier_id = locked_supplier.supplier_id AND shop_id = ${context.shopId}), 0) -
            COALESCE((SELECT SUM(amount) FROM payments
              WHERE supplier_id = locked_supplier.supplier_id AND shop_id = ${context.shopId}
                AND direction = 'paid' AND purchase_id IS NULL), 0)
          ) AS balance_due
        FROM locked_supplier
      ),
      created AS (
        INSERT INTO payments
          (shop_id, supplier_id, amount, payment_method, direction, notes, created_by)
        SELECT ${context.shopId}, outstanding.supplier_id, ${amount}, ${method}, 'paid', ${notes}, ${context.userId}
        FROM outstanding WHERE outstanding.balance_due >= ${amount}
        RETURNING *
      )
      SELECT outstanding.balance_due, created.*
      FROM outstanding LEFT JOIN created ON TRUE
    `;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    if (!rows[0].payment_id) {
      return Response.json({ error: `Payment exceeds balance due (${rows[0].balance_due})` }, { status: 400 });
    }
    await writeAuditEvent(context, "supplier.payment", "supplier", id, { amount, method });
    return Response.json({ payment: rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("PATCH /api/suppliers/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const context = await requireShopAccess(request, "supplier.write");
    await ensureBusinessFeatureSchema();
    const id = parseId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const rows = await sql`
      WITH transacted AS (
        SELECT EXISTS (
          SELECT 1 FROM purchases WHERE supplier_id = ${id} AND shop_id = ${context.shopId}
        ) AS has_transactions
      ),
      archived AS (
        UPDATE suppliers SET is_deleted = TRUE, updated_at = NOW()
        WHERE supplier_id = ${id} AND shop_id = ${context.shopId}
          AND (SELECT has_transactions FROM transacted)
        RETURNING supplier_id, TRUE AS archived
      ),
      removed AS (
        DELETE FROM suppliers
        WHERE supplier_id = ${id} AND shop_id = ${context.shopId}
          AND NOT (SELECT has_transactions FROM transacted)
        RETURNING supplier_id, FALSE AS archived
      )
      SELECT * FROM archived UNION ALL SELECT * FROM removed
    `;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await writeAuditEvent(context, rows[0].archived ? "supplier.archive" : "supplier.delete", "supplier", id);
    return Response.json({ ok: true, archived: rows[0].archived });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/suppliers/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
