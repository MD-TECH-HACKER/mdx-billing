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
      WHERE supplier_id = ${id} AND shop_id = ${context.shopId}
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

export async function DELETE(request, { params }) {
  try {
    const context = await requireShopAccess(request, "supplier.write");
    await ensureBusinessFeatureSchema();
    const id = parseId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const rows = await sql`
      DELETE FROM suppliers WHERE supplier_id = ${id} AND shop_id = ${context.shopId}
      RETURNING supplier_id
    `;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await writeAuditEvent(context, "supplier.delete", "supplier", id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/suppliers/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
