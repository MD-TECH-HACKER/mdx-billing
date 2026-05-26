import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
    const rows = await sql`
      SELECT s.*, sh.shop_name, sh.shop_description, sh.shop_logo, sh.address, sh.phone, sh.currency, sh.thank_you_message, sh.receipt_prefix
      FROM sales s
      JOIN shops sh ON sh.shop_id = s.shop_id
      WHERE s.sale_id = ${id} AND s.owner_id = ${session.user.id} LIMIT 1`;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ sale: rows[0] });
  } catch (err) {
    console.error("GET /api/sales/[id]", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    // Get the sale first so we can restore stock
    const saleRows = await sql`
      SELECT items FROM sales WHERE sale_id = ${id} AND owner_id = ${session.user.id} LIMIT 1
    `;
    if (!saleRows[0])
      return Response.json({ error: "Not found" }, { status: 404 });

    const items = Array.isArray(saleRows[0].items) ? saleRows[0].items : [];

    // Restore stock + delete sale in a single transaction
    const queries = [];
    for (const it of items) {
      if (it.productId && it.quantity) {
        queries.push(
          sql`UPDATE products SET stock = stock + ${it.quantity}, updated_at = NOW() WHERE product_id = ${it.productId} AND owner_id = ${session.user.id}`,
        );
      }
    }
    queries.push(
      sql`DELETE FROM sales WHERE sale_id = ${id} AND owner_id = ${session.user.id} RETURNING sale_id`,
    );
    await sql.transaction(queries);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sales/[id]", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
