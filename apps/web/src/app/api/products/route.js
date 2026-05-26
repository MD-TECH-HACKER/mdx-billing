import sql from "@/app/api/utils/sql";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { canAccess } from "@/app/api/utils/permissions";
import { sanitizeProductUnit } from "@/utils/productUnits";

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "product.read");
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const category = url.searchParams.get("category");
    const columns = canAccess(context.role, "analytics.profit")
      ? "*"
      : "product_id, shop_id, image_url, title, description, selling_price, stock, category, sku, primary_unit, secondary_unit, created_at, updated_at";
    let query = `SELECT ${columns} FROM products WHERE shop_id = $1`;
    const values = [context.shopId];

    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      query += ` AND (LOWER(title) LIKE $${values.length} OR LOWER(COALESCE(description,'')) LIKE $${values.length})`;
    }
    if (category && category !== "all") {
      values.push(category);
      query += ` AND category = $${values.length}`;
    }
    query += " ORDER BY created_at DESC";

    const products = await sql(query, values);
    return Response.json({ products });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/products", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "product.write");
    const body = await request.json();
    const title = (body.title || "").toString().trim().slice(0, 150);

    if (!title) {
      return Response.json({ error: "Title required" }, { status: 400 });
    }

    const description =
      (body.description || "").toString().trim().slice(0, 1000) || null;
    const imageUrl = (body.imageUrl || "").toString().trim() || null;
    const sellingPrice = Math.max(0, Number(body.sellingPrice) || 0);
    const costPrice = Math.max(0, Number(body.costPrice) || 0);
    const stock = Math.max(0, parseInt(body.stock, 10) || 0);
    const category =
      (body.category || "").toString().trim().slice(0, 50) || null;
    const sku = (body.sku || "").toString().trim().slice(0, 50) || null;
    const primaryUnit = sanitizeProductUnit(body.primaryUnit, {
      fallback: "piece",
    });
    const secondaryUnit = sanitizeProductUnit(body.secondaryUnit, {
      fallback: null,
    });

    const created = await sql`
      INSERT INTO products
        (owner_id, shop_id, image_url, title, description, selling_price, cost_price, stock, category, sku, primary_unit, secondary_unit)
      VALUES
        (${context.shopOwnerId}, ${context.shopId}, ${imageUrl}, ${title}, ${description}, ${sellingPrice}, ${costPrice}, ${stock}, ${category}, ${sku}, ${primaryUnit}, ${secondaryUnit})
      RETURNING *
    `;
    await writeAuditEvent(
      context,
      "product.create",
      "product",
      created[0].product_id,
      { title, stock },
    );

    return Response.json({ product: created[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/products", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
