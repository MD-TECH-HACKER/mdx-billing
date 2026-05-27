import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";

function categoryFields(body) {
  return {
    name: String(body.name || "").trim().slice(0, 80),
    description: String(body.description || "").trim().slice(0, 300) || null,
    icon: String(body.icon || "").trim().slice(0, 30) || null,
    color: String(body.color || "").trim().slice(0, 20) || null,
  };
}

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "product.read");
    await ensureBusinessFeatureSchema();
    const search = new URL(request.url).searchParams.get("search")?.trim();
    const pattern = search ? `%${search.toLowerCase()}%` : null;
    const categories = await sql`
      SELECT c.*,
        COUNT(p.product_id)::integer AS product_count,
        COALESCE(SUM(COALESCE(p.stock_base_unit, p.stock) *
          CASE WHEN p.conversion_rate > 0 THEN COALESCE(p.cost_price, 0) / p.conversion_rate ELSE COALESCE(p.cost_price, 0) END), 0) AS stock_value,
        COALESCE(SUM(CASE WHEN COALESCE(p.stock_base_unit, p.stock) <= COALESCE(p.low_stock_base_unit, p.reorder_level, 5) THEN 1 ELSE 0 END), 0)::integer AS low_stock_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.category_id AND p.shop_id = c.shop_id
      WHERE c.shop_id = ${context.shopId}
        AND (${pattern}::text IS NULL OR LOWER(c.name) LIKE ${pattern})
      GROUP BY c.category_id
      ORDER BY c.name ASC
    `;
    return Response.json({ categories });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/categories", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "product.write");
    await ensureBusinessFeatureSchema();
    const fields = categoryFields(await request.json());
    if (!fields.name) {
      return Response.json({ error: "Category name is required" }, { status: 400 });
    }
    const duplicate = await sql`
      SELECT category_id, name FROM categories
      WHERE shop_id = ${context.shopId} AND LOWER(name) = LOWER(${fields.name})
      LIMIT 1
    `;
    if (duplicate[0]) {
      return Response.json(
        { error: "Category already exists", category: duplicate[0] },
        { status: 409 },
      );
    }
    const rows = await sql`
      INSERT INTO categories (shop_id, owner_id, name, description, icon, color)
      VALUES (${context.shopId}, ${context.shopOwnerId}, ${fields.name}, ${fields.description}, ${fields.icon}, ${fields.color})
      RETURNING *
    `;
    await writeAuditEvent(context, "category.create", "category", rows[0].category_id, {
      name: fields.name,
    });
    return Response.json({ category: rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/categories", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
