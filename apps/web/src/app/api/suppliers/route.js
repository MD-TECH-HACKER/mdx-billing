import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { isValidEmail, normalizeEmail } from "@/app/api/utils/email";

function supplierFields(body) {
  const email = normalizeEmail(body.email) || null;
  const customFields = Array.isArray(body.customFields)
    ? body.customFields
        .map((field) => ({
          key: String(field?.key || "").trim().slice(0, 60),
          value: String(field?.value || "").trim().slice(0, 200),
        }))
        .filter((field) => field.key && field.value)
        .slice(0, 25)
    : [];
  return {
    name: (body.name || "").toString().trim().slice(0, 120),
    phone: (body.phone || "").toString().trim().slice(0, 50) || null,
    email,
    gstin: (body.gstin || "").toString().trim().toUpperCase().slice(0, 20) || null,
    address: (body.address || "").toString().trim().slice(0, 400) || null,
    openingBalance: Number(body.openingBalance) || 0,
    upiId: (body.upiId || "").toString().trim().slice(0, 120) || null,
    qrImageUrl: (body.qrImageUrl || "").toString().trim().slice(0, 1000) || null,
    customFields,
    dueDate: String(body.dueDate || "").slice(0, 10) || null,
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
        COALESCE(SUM(p.paid_amount), 0) + COALESCE((
          SELECT SUM(pay.amount) FROM payments pay
          WHERE pay.supplier_id = s.supplier_id AND pay.shop_id = s.shop_id
            AND pay.direction = 'paid' AND pay.purchase_id IS NULL
        ), 0) AS amount_paid,
        GREATEST(0, COALESCE(s.opening_balance, 0) + COALESCE(SUM(p.total_amount), 0)
          - COALESCE(SUM(p.paid_amount), 0) - COALESCE((
          SELECT SUM(pay.amount) FROM payments pay
          WHERE pay.supplier_id = s.supplier_id AND pay.shop_id = s.shop_id
            AND pay.direction = 'paid' AND pay.purchase_id IS NULL
        ), 0)) AS balance_due,
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
    if (fields.email && !isValidEmail(fields.email)) {
      return Response.json({ error: "Enter a valid supplier email" }, { status: 400 });
    }
    const duplicate = await sql`
      SELECT * FROM suppliers
      WHERE shop_id = ${context.shopId} AND is_deleted = FALSE
        AND LOWER(name) = LOWER(${fields.name})
        AND COALESCE(phone, '') = COALESCE(${fields.phone}, '')
      LIMIT 1
    `;
    if (duplicate[0]) {
      return Response.json(
        { error: "Supplier already exists", supplier: duplicate[0] },
        { status: 409 },
      );
    }
    const rows = await sql`
      INSERT INTO suppliers
        (shop_id, owner_id, name, phone, email, gstin, address, opening_balance,
         upi_id, qr_image_url, custom_fields, due_date, notes)
      VALUES
        (${context.shopId}, ${context.shopOwnerId}, ${fields.name}, ${fields.phone}, ${fields.email}, ${fields.gstin}, ${fields.address}, ${fields.openingBalance},
         ${fields.upiId}, ${fields.qrImageUrl}, ${JSON.stringify(fields.customFields)}::jsonb, ${fields.dueDate}, ${fields.notes})
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
