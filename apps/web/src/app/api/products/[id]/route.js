import sql from "@/app/api/utils/sql";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { canAccess } from "@/app/api/utils/permissions";
import { sanitizeProductUnit } from "@/utils/productUnits";

function parseProductId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request, { params }) {
  try {
    const context = await requireShopAccess(request, "product.read");
    const id = parseProductId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const columns = canAccess(context.role, "analytics.profit")
      ? "*"
      : "product_id, shop_id, image_url, title, description, selling_price, stock, category, sku, primary_unit, secondary_unit, created_at, updated_at";
    const rows = await sql(
      `SELECT ${columns} FROM products WHERE product_id = $1 AND shop_id = $2 LIMIT 1`,
      [id, context.shopId],
    );
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ product: rows[0] });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/products/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const context = await requireShopAccess(request, "product.write");
    const id = parseProductId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const body = await request.json();
    const fields = {};
    if (typeof body.title === "string")
      fields.title = body.title.trim().slice(0, 150);
    if (typeof body.description === "string")
      fields.description = body.description.trim().slice(0, 1000) || null;
    if (typeof body.imageUrl === "string")
      fields.image_url = body.imageUrl.trim() || null;
    if (body.sellingPrice !== undefined)
      fields.selling_price = Math.max(0, Number(body.sellingPrice) || 0);
    if (body.costPrice !== undefined)
      fields.cost_price = Math.max(0, Number(body.costPrice) || 0);
    if (body.stock !== undefined)
      fields.stock = Math.max(0, Number.parseInt(body.stock, 10) || 0);
    if (typeof body.category === "string")
      fields.category = body.category.trim().slice(0, 50) || null;
    if (typeof body.sku === "string")
      fields.sku = body.sku.trim().slice(0, 50) || null;
    if (body.primaryUnit !== undefined)
      fields.primary_unit = sanitizeProductUnit(body.primaryUnit, {
        fallback: "piece",
      });
    if (body.secondaryUnit !== undefined)
      fields.secondary_unit = sanitizeProductUnit(body.secondaryUnit, {
        fallback: null,
      });

    const keys = Object.keys(fields);
    if (keys.length === 0) {
      return Response.json({ error: "No fields" }, { status: 400 });
    }

    const values = keys.map((key) => fields[key]);
    values.push(id, context.shopId);
    const setClauses = keys.map((key, index) => `${key} = $${index + 1}`);
    const query = `UPDATE products SET ${setClauses.join(", ")}, updated_at = NOW() WHERE product_id = $${keys.length + 1} AND shop_id = $${keys.length + 2} RETURNING *`;
    const result = await sql(query, values);

    if (!result[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await writeAuditEvent(context, "product.update", "product", id, {
      changedFields: keys,
    });
    return Response.json({ product: result[0] });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("PUT /api/products/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const context = await requireShopAccess(request, "product.write");
    const id = parseProductId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const result = await sql`
      DELETE FROM products
      WHERE product_id = ${id} AND shop_id = ${context.shopId}
      RETURNING product_id
    `;
    if (!result[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await writeAuditEvent(context, "product.delete", "product", id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/products/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
