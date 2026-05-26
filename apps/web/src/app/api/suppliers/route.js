import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";

function supplierFields(body) {
  return {
    name: (body.name || "").toString().trim().slice(0, 120),
    phone: (body.phone || "").toString().trim().slice(0, 50) || null,
    email: (body.email || "").toString().trim().slice(0, 254) || null,
    gstin: (body.gstin || "").toString().trim().toUpperCase().slice(0, 20) || null,
    address: (body.address || "").toString().trim().slice(0, 400) || null,
    openingBalance: Number(body.openingBalance) || 0,
    notes: (body.notes || "").toString().trim().slice(0, 500) || null,
  };
}

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "supplier.read");
    await ensureBusinessFeatureSchema();
    const search = new URL(request.url).searchParams.get("search")?.trim();
    const pattern = search ? `%${search.toLowerCase()}%` : null;
    const suppliers = await sql`
      SELECT s.*,
        COALESCE(SUM(p.total_amount), 0) AS total_purchase_amount,
        COALESCE(SUM(p.paid_amount), 0) AS amount_paid,
        COALESCE(SUM(p.total_amount - COALESCE(p.paid_amount, 0)), 0) AS balance_due,
        COUNT(p.purchase_id) AS purchase_count,
        MAX(p.purchase_date) AS last_purchase_date,
        (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'paymentId', pay.payment_id,
            'amount', pay.amount,
            'method', pay.payment_method,
            'date', pay.payment_date
          ) ORDER BY pay.created_at DESC), '[]'::jsonb)
          FROM payments pay WHERE pay.supplier_id = s.supplier_id AND pay.shop_id = s.shop_id
        ) AS payment_history
      FROM suppliers s
      LEFT JOIN purchases p ON p.supplier_id = s.supplier_id AND p.shop_id = s.shop_id
      WHERE s.shop_id = ${context.shopId} AND s.is_deleted = FALSE
        AND (${pattern}::text IS NULL OR LOWER(s.name) LIKE ${pattern} OR LOWER(COALESCE(s.phone, '')) LIKE ${pattern})
      GROUP BY s.supplier_id
      ORDER BY s.name ASC
    `;
    return Response.json({ suppliers });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/suppliers", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "supplier.write");
    await ensureBusinessFeatureSchema();
    const fields = supplierFields(await request.json());
    if (!fields.name) {
      return Response.json({ error: "Supplier name is required" }, { status: 400 });
    }
    const rows = await sql`
      INSERT INTO suppliers (shop_id, name, phone, email, gstin, address, opening_balance, notes)
      VALUES (${context.shopId}, ${fields.name}, ${fields.phone}, ${fields.email}, ${fields.gstin}, ${fields.address}, ${fields.openingBalance}, ${fields.notes})
      RETURNING *
    `;
    await writeAuditEvent(context, "supplier.create", "supplier", rows[0].supplier_id, {
      name: fields.name,
    });
    return Response.json({ supplier: rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/suppliers", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
