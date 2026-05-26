import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { sanitizeProductUnit } from "@/utils/productUnits";

async function ensureProductUnitColumns() {
  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS primary_unit TEXT DEFAULT 'piece',
    ADD COLUMN IF NOT EXISTS secondary_unit TEXT
  `;
  await sql`
    UPDATE products
    SET primary_unit = 'piece'
    WHERE primary_unit IS NULL OR primary_unit = ''
  `;
}

async function getShopForUser(userId) {
  const rows =
    await sql`SELECT shop_id FROM shops WHERE owner_id = ${userId} LIMIT 1`;
  return rows[0]?.shop_id || null;
}

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureProductUnitColumns();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const category = url.searchParams.get("category");

    let query = `SELECT * FROM products WHERE owner_id = $1`;
    const values = [session.user.id];

    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      query += ` AND (LOWER(title) LIKE $${values.length} OR LOWER(COALESCE(description,'')) LIKE $${values.length})`;
    }
    if (category && category !== "all") {
      values.push(category);
      query += ` AND category = $${values.length}`;
    }
    query += ` ORDER BY created_at DESC`;

    const products = await sql(query, values);
    return Response.json({ products });
  } catch (err) {
    console.error("GET /api/products", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureProductUnitColumns();
    const shopId = await getShopForUser(session.user.id);
    if (!shopId) {
      return Response.json(
        { error: "Set up your shop first" },
        { status: 400 },
      );
    }
    const body = await request.json();
    const title = (body.title || "").toString().trim().slice(0, 150);
    if (!title)
      return Response.json({ error: "Title required" }, { status: 400 });

    const description =
      (body.description || "").toString().trim().slice(0, 1000) || null;
    const imageUrl =
      (body.imageUrl || "").toString().trim() || null;
    const sellingPrice = Math.max(0, Number(body.sellingPrice) || 0);
    const costPrice = Math.max(0, Number(body.costPrice) || 0);
    const stock = Math.max(0, parseInt(body.stock) || 0);
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
      INSERT INTO products (owner_id, shop_id, image_url, title, description, selling_price, cost_price, stock, category, sku, primary_unit, secondary_unit)
      VALUES (${session.user.id}, ${shopId}, ${imageUrl}, ${title}, ${description}, ${sellingPrice}, ${costPrice}, ${stock}, ${category}, ${sku}, ${primaryUnit}, ${secondaryUnit})
      RETURNING *`;
    return Response.json({ product: created[0] });
  } catch (err) {
    console.error("POST /api/products", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
