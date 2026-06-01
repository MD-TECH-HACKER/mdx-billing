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

function categoryFields(body) {
  return {
    name: String(body.name || "").trim().slice(0, 80),
    description: String(body.description || "").trim().slice(0, 300) || null,
    icon: String(body.icon || "").trim().slice(0, 30) || null,
    color: String(body.color || "").trim().slice(0, 20) || null,
  };
}

export async function PUT(request, { params }) {
  try {
    const context = await requireShopAccess(request, "product.write");
    await ensureBusinessFeatureSchema();
    const id = parseId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const fields = categoryFields(await request.json());
    if (!fields.name) return Response.json({ error: "Category name is required" }, { status: 400 });

    const duplicate = await sql`
      SELECT category_id FROM categories
      WHERE shop_id = ${context.shopId} AND category_id <> ${id} AND LOWER(name) = LOWER(${fields.name})
      LIMIT 1
    `;
    if (duplicate[0]) return Response.json({ error: "Category already exists" }, { status: 409 });

    await sql`
      UPDATE categories
      SET name = ${fields.name}, description = ${fields.description}, icon = ${fields.icon},
          color = ${fields.color}, updated_at = NOW()
      WHERE category_id = ${id} AND shop_id = ${context.shopId}
    `;
    const rows = await sql`SELECT * FROM categories WHERE category_id = ${id} AND shop_id = ${context.shopId}`;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    
    await sql`
      UPDATE products
      SET category = ${fields.name}, category_name_snapshot = ${fields.name}, updated_at = NOW()
      WHERE category_id = ${id} AND shop_id = ${context.shopId}
    `;
    await writeAuditEvent(context, "category.update", "category", id);
    return Response.json({ category: rows[0] });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("PUT /api/categories/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const context = await requireShopAccess(request, "product.write");
    await ensureBusinessFeatureSchema();
    const id = parseId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const productCount = await sql`
      SELECT COUNT(*) AS count FROM products
      WHERE shop_id = ${context.shopId} AND category_id = ${id}
    `;
    if (Number(productCount[0]?.count) > 0) {
      return Response.json(
        { error: "This category has products. Move products before deleting." },
        { status: 409 },
      );
    }
    const check = await sql`SELECT category_id FROM categories WHERE category_id = ${id} AND shop_id = ${context.shopId}`;
    if (!check[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await sql`DELETE FROM categories WHERE category_id = ${id} AND shop_id = ${context.shopId}`;
    await writeAuditEvent(context, "category.delete", "category", id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/categories/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
