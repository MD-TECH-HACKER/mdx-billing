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
    const customers = pattern
      ? await sql`
          SELECT * FROM customers
          WHERE shop_id = ${context.shopId}
            AND (LOWER(name) LIKE ${pattern} OR LOWER(COALESCE(phone, '')) LIKE ${pattern})
          ORDER BY name ASC
        `
      : await sql`SELECT * FROM customers WHERE shop_id = ${context.shopId} ORDER BY name ASC`;
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
    const rows = await sql`
      INSERT INTO customers (shop_id, name, phone, email, gstin, address, opening_balance, notes)
      VALUES (${context.shopId}, ${fields.name}, ${fields.phone}, ${fields.email}, ${fields.gstin}, ${fields.address}, ${fields.openingBalance}, ${fields.notes})
      RETURNING *
    `;
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
