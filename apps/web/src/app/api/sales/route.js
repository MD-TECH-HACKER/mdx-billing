import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const status = url.searchParams.get("status");
    const sort = url.searchParams.get("sort") || "newest";

    let query = `SELECT * FROM sales WHERE owner_id = $1`;
    const values = [session.user.id];
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      query += ` AND (LOWER(COALESCE(buyer_name,'')) LIKE $${values.length} OR LOWER(receipt_number) LIKE $${values.length})`;
    }
    if (fromDate) {
      values.push(fromDate);
      query += ` AND created_at >= $${values.length}`;
    }
    if (toDate) {
      values.push(toDate + "T23:59:59.999Z");
      query += ` AND created_at <= $${values.length}`;
    }
    if (status && status !== "all") {
      values.push(status);
      query += ` AND payment_status = $${values.length}`;
    }

    const orderBy =
      sort === "oldest"
        ? "created_at ASC"
        : sort === "amount_desc"
          ? "total_amount DESC"
          : sort === "amount_asc"
            ? "total_amount ASC"
            : "created_at DESC";
    query += ` ORDER BY ${orderBy} LIMIT 500`;

    const sales = await sql(query, values);
    return Response.json({ sales });
  } catch (err) {
    console.error("GET /api/sales", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return Response.json({ error: "Unauthorized" }, { status: 401 });

    const shopRows =
      await sql`SELECT shop_id, receipt_prefix, tax_percent FROM shops WHERE owner_id = ${session.user.id} LIMIT 1`;
    const shop = shopRows[0];
    if (!shop)
      return Response.json({ error: "Shop not set up" }, { status: 400 });

    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0)
      return Response.json({ error: "No items" }, { status: 400 });

    const buyerName =
      (body.buyerName || "").toString().trim().slice(0, 100) || null;
    const buyerPhone =
      (body.buyerPhone || "").toString().trim().slice(0, 50) || null;
    const notes = (body.notes || "").toString().trim().slice(0, 500) || null;
    const paymentMethod = [
      "cash",
      "card",
      "upi",
      "bank_transfer",
      "other",
    ].includes(body.paymentMethod)
      ? body.paymentMethod
      : "cash";
    const paymentStatus = ["paid", "pending", "partial"].includes(
      body.paymentStatus,
    )
      ? body.paymentStatus
      : "paid";

    // Validate each item exists and belongs to this user, compute totals
    const productIds = items.map((i) => parseInt(i.productId)).filter(Boolean);
    if (productIds.length !== items.length)
      return Response.json({ error: "Invalid items" }, { status: 400 });

    const placeholders = productIds.map((_, i) => `$${i + 2}`).join(",");
    const productRows = await sql(
      `SELECT * FROM products WHERE owner_id = $1 AND product_id IN (${placeholders})`,
      [session.user.id, ...productIds],
    );

    const productMap = {};
    productRows.forEach((p) => {
      productMap[p.product_id] = p;
    });

    let totalAmount = 0;
    let totalCost = 0;
    let totalQuantity = 0;
    const lineItems = [];

    for (const item of items) {
      const p = productMap[parseInt(item.productId)];
      if (!p)
        return Response.json({ error: "Product not found" }, { status: 400 });
      const qty = Math.max(1, parseInt(item.quantity) || 1);
      if (qty > p.stock)
        return Response.json(
          { error: `Not enough stock for ${p.title}` },
          { status: 400 },
        );
      const sp = Number(p.selling_price);
      const cp = Number(p.cost_price);
      totalAmount += sp * qty;
      totalCost += cp * qty;
      totalQuantity += qty;
      lineItems.push({
        productId: p.product_id,
        title: p.title,
        description: p.description,
        imageUrl: p.image_url,
        quantity: qty,
        unitPrice: sp,
        costPrice: cp,
        subtotal: sp * qty,
      });
    }

    const totalProfit = totalAmount - totalCost;
    const taxPercent = Number(shop.tax_percent) || 0;
    const taxAmount = +(totalAmount * (taxPercent / 100)).toFixed(2);
    const grandTotal = +(totalAmount + taxAmount).toFixed(2);

    const receiptNumber = `${shop.receipt_prefix || "INV"}-${Date.now()}`;

    // Transaction: insert sale and decrement stock
    const queries = [
      sql`
        INSERT INTO sales (owner_id, shop_id, receipt_number, buyer_name, buyer_phone, items, total_amount, total_cost, total_profit, total_quantity, tax_amount, payment_status, payment_method, notes)
        VALUES (${session.user.id}, ${shop.shop_id}, ${receiptNumber}, ${buyerName}, ${buyerPhone}, ${JSON.stringify(lineItems)}, ${grandTotal}, ${totalCost}, ${totalProfit}, ${totalQuantity}, ${taxAmount}, ${paymentStatus}, ${paymentMethod}, ${notes})
        RETURNING *`,
    ];
    for (const li of lineItems) {
      queries.push(
        sql`UPDATE products SET stock = stock - ${li.quantity}, updated_at = NOW() WHERE product_id = ${li.productId} AND owner_id = ${session.user.id}`,
      );
    }
    const results = await sql.transaction(queries);
    return Response.json({ sale: results[0][0] });
  } catch (err) {
    console.error("POST /api/sales", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
