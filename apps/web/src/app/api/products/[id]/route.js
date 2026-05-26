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

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProductUnitColumns();
    const id = parseInt(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const rows =
      await sql`SELECT * FROM products WHERE product_id = ${id} AND owner_id = ${session.user.id} LIMIT 1`;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ product: rows[0] });
  } catch (err) {
    console.error("GET /api/products/[id]", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProductUnitColumns();
    const id = parseInt(params.id);
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
      fields.stock = Math.max(0, parseInt(body.stock) || 0);
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
    if (keys.length === 0)
      return Response.json({ error: "No fields" }, { status: 400 });

    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map((k) => fields[k]);
    const query = `UPDATE products SET ${setClauses.join(", ")}, updated_at = NOW() WHERE product_id = $${values.length + 1} AND owner_id = $${values.length + 2} RETURNING *`;
    const result = await sql(query, [...values, id, session.user.id]);
    if (!result[0])
      return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ product: result[0] });
  } catch (err) {
    console.error("PUT /api/products/[id]", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    await ensureProductUnitColumns();
    const id = parseInt(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const result =
      await sql`DELETE FROM products WHERE product_id = ${id} AND owner_id = ${session.user.id} RETURNING product_id`;
    if (!result[0])
      return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/products/[id]", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
