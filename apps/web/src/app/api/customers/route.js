import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";

function customerFields(body) {
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
    const context = await requireShopAccess(request, "customer.read");
    await ensureBusinessFeatureSchema();
    const search = new URL(request.url).searchParams.get("search")?.trim();
    const pattern = search ? `%${search.toLowerCase()}%` : null;
    const customers = await sql`
      SELECT c.*,
        COALESCE(SUM(CASE WHEN s.sale_status IS NULL OR s.sale_status = 'completed' THEN s.total_amount ELSE 0 END), 0) AS total_purchases,
        COALESCE(SUM(CASE WHEN s.sale_status IS NULL OR s.sale_status = 'completed' THEN s.paid_amount ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN s.sale_status IS NULL OR s.sale_status = 'completed' THEN s.total_amount - COALESCE(s.paid_amount, 0) ELSE 0 END), 0) AS total_due,
        COALESCE(c.opening_balance, 0) + COALESCE(SUM(CASE WHEN s.sale_status IS NULL OR s.sale_status = 'completed' THEN s.total_amount - COALESCE(s.paid_amount, 0) ELSE 0 END), 0) AS credit_balance,
        MAX(CASE WHEN s.sale_status IS NULL OR s.sale_status = 'completed' THEN s.created_at END) AS last_purchase_date,
        SUM(CASE WHEN s.sale_id IS NOT NULL AND (s.sale_status IS NULL OR s.sale_status = 'completed') THEN 1 ELSE 0 END) AS invoice_count,
        (
          SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
            'paymentId', pay.payment_id,
            'amount', pay.amount,
            'method', pay.payment_method,
            'date', pay.payment_date
          )), '[]')
          FROM (SELECT * FROM payments ORDER BY created_at DESC) pay WHERE pay.customer_id = c.customer_id AND pay.shop_id = c.shop_id
        ) AS payment_history
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.customer_id AND s.shop_id = c.shop_id
      WHERE c.shop_id = ${context.shopId} AND c.is_deleted = FALSE
        AND (${pattern} IS NULL OR LOWER(c.name) LIKE ${pattern} OR LOWER(COALESCE(c.phone, '')) LIKE ${pattern})
      GROUP BY c.customer_id
      ORDER BY c.name ASC
    `;
    return Response.json({ customers });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/customers", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "customer.write");
    await ensureBusinessFeatureSchema();
    const fields = customerFields(await request.json());
    if (!fields.name) {
      return Response.json({ error: "Customer name is required" }, { status: 400 });
    }
    const insertResult = await sql`
      INSERT INTO customers (shop_id, name, phone, email, gstin, address, opening_balance, notes)
      VALUES (${context.shopId}, ${fields.name}, ${fields.phone}, ${fields.email}, ${fields.gstin}, ${fields.address}, ${fields.openingBalance}, ${fields.notes})
    `;
    const id = insertResult[0].insertId;
    const rows = await sql`SELECT * FROM customers WHERE customer_id = ${id}`;
    await writeAuditEvent(context, "customer.create", "customer", rows[0].customer_id, {
      name: fields.name,
    });
    return Response.json({ customer: rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/customers", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
