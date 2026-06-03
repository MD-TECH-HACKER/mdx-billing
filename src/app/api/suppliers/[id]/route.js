import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { isValidEmail, normalizeEmail } from "@/app/api/utils/email";

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
    const email = normalizeEmail(body.email) || null;
    if (email && !isValidEmail(email)) {
      return Response.json({ error: "Enter a valid supplier email" }, { status: 400 });
    }
    const gstin = (body.gstin || "").toString().trim().toUpperCase().slice(0, 20) || null;
    const address = (body.address || "").toString().trim().slice(0, 400) || null;
    const openingBalance = Number(body.openingBalance) || 0;
    const upiId = (body.upiId || "").toString().trim().slice(0, 120) || null;
    const qrImageUrl = (body.qrImageUrl || "").toString().trim().slice(0, 1000) || null;
    const customFields = Array.isArray(body.customFields)
      ? body.customFields
          .map((field) => ({
            key: String(field?.key || "").trim().slice(0, 60),
            value: String(field?.value || "").trim().slice(0, 200),
          }))
          .filter((field) => field.key && field.value)
          .slice(0, 25)
      : [];
    const dueDate = String(body.dueDate || "").slice(0, 10) || null;
    const notes = (body.notes || "").toString().trim().slice(0, 500) || null;
    const duplicate = await sql`
      SELECT supplier_id FROM suppliers
      WHERE shop_id = ${context.shopId} AND supplier_id <> ${id} AND is_deleted = FALSE
        AND LOWER(name) = LOWER(${name})
        AND COALESCE(phone, '') = COALESCE(${phone}, '')
      LIMIT 1
    `;
    if (duplicate[0]) {
      return Response.json({ error: "Supplier already exists" }, { status: 409 });
    }
    await sql`
      UPDATE suppliers
      SET name = ${name}, phone = ${phone}, email = ${email}, gstin = ${gstin},
          address = ${address}, opening_balance = ${openingBalance}, upi_id = ${upiId},
          qr_image_url = ${qrImageUrl}, custom_fields = ${JSON.stringify(customFields)},
          due_date = ${dueDate}, notes = ${notes}, updated_at = NOW()
      WHERE supplier_id = ${id} AND shop_id = ${context.shopId} AND is_deleted = FALSE
    `;
    const rows = await sql`SELECT * FROM suppliers WHERE supplier_id = ${id} AND shop_id = ${context.shopId} AND is_deleted = FALSE`;
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
    const locks = await sql`SELECT opening_balance FROM suppliers WHERE supplier_id = ${id} AND shop_id = ${context.shopId} AND is_deleted = FALSE FOR UPDATE`;
    if (!locks[0]) return Response.json({ error: "Not found" }, { status: 404 });
    const openingBalance = Number(locks[0].opening_balance) || 0;
    
    const stats = await sql`
      SELECT 
        COALESCE((SELECT SUM(total_amount - COALESCE(paid_amount, 0)) FROM purchases WHERE supplier_id = ${id} AND shop_id = ${context.shopId}), 0) AS purchases,
        COALESCE((SELECT SUM(amount) FROM payments WHERE supplier_id = ${id} AND shop_id = ${context.shopId} AND direction = 'paid' AND purchase_id IS NULL), 0) AS payments
    `;
    const balance_due = Math.max(0, openingBalance + Number(stats[0].purchases) - Number(stats[0].payments));
    
    if (balance_due < amount) {
      return Response.json({ error: `Payment exceeds balance due (${balance_due})` }, { status: 400 });
    }
    
    const insertRes = await sql`
      INSERT INTO payments (shop_id, supplier_id, amount, payment_method, direction, notes, created_by)
      VALUES (${context.shopId}, ${id}, ${amount}, ${method}, 'paid', ${notes}, ${context.userId})
    `;
    const paymentId = insertRes[0].insertId;
    const paymentRows = await sql`SELECT * FROM payments WHERE payment_id = ${paymentId}`;
    const payment = paymentRows[0];
    payment.balance_due = balance_due;
    
    const rows = [payment];
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
    const checkTx = await sql`SELECT EXISTS (SELECT 1 FROM purchases WHERE supplier_id = ${id} AND shop_id = ${context.shopId}) AS has_transactions`;
    const hasTransactions = Boolean(checkTx[0]?.has_transactions);
    
    if (hasTransactions) {
      await sql`UPDATE suppliers SET is_deleted = TRUE, updated_at = NOW() WHERE supplier_id = ${id} AND shop_id = ${context.shopId}`;
    } else {
      await sql`DELETE FROM suppliers WHERE supplier_id = ${id} AND shop_id = ${context.shopId}`;
    }
    
    await writeAuditEvent(context, hasTransactions ? "supplier.archive" : "supplier.delete", "supplier", id);
    return Response.json({ ok: true, archived: hasTransactions });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/suppliers/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
