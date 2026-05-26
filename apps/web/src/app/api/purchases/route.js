import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";

const PAYMENT_STATUSES = new Set(["paid", "pending", "partial"]);

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "purchase.read");
    await ensureBusinessFeatureSchema();
    const purchases = await sql`
      SELECT p.*, s.name AS supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id
      WHERE p.shop_id = ${context.shopId}
      ORDER BY p.purchase_date DESC, p.created_at DESC
      LIMIT 500
    `;
    return Response.json({ purchases });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/purchases", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "purchase.write");
    await ensureBusinessFeatureSchema();
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return Response.json({ error: "Add at least one purchased product" }, { status: 400 });
    }

    const productIds = items.map((item) => Number.parseInt(item.productId, 10));
    if (
      productIds.some((id) => !Number.isInteger(id) || id <= 0) ||
      new Set(productIds).size !== productIds.length
    ) {
      return Response.json({ error: "Invalid or duplicated products" }, { status: 400 });
    }

    let supplierId = null;
    if (body.supplierId) {
      const parsedSupplierId = Number.parseInt(body.supplierId, 10);
      const supplierRows = await sql`
        SELECT supplier_id FROM suppliers
        WHERE supplier_id = ${parsedSupplierId} AND shop_id = ${context.shopId}
        LIMIT 1
      `;
      if (!supplierRows[0]) {
        return Response.json({ error: "Supplier not found" }, { status: 400 });
      }
      supplierId = parsedSupplierId;
    }

    const placeholders = productIds.map((_, index) => `$${index + 2}`).join(",");
    const products = await sql(
      `SELECT product_id, title, cost_price FROM products WHERE shop_id = $1 AND product_id IN (${placeholders})`,
      [context.shopId, ...productIds],
    );
    const productMap = Object.fromEntries(
      products.map((product) => [product.product_id, product]),
    );
    const purchaseItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productMap[Number.parseInt(item.productId, 10)];
      const quantity = Number.parseInt(item.quantity, 10);
      const unitCost = Number(item.unitCost);
      if (!product || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        return Response.json({ error: "Each item requires a product, quantity and valid cost" }, { status: 400 });
      }
      const lineTotal = +(quantity * unitCost).toFixed(2);
      subtotal += lineTotal;
      purchaseItems.push({
        productId: product.product_id,
        title: product.title,
        quantity,
        unitCost,
        lineTotal,
      });
    }

    const taxAmount = Math.max(0, Number(body.taxAmount) || 0);
    const totalAmount = +(subtotal + taxAmount).toFixed(2);
    const billNumber = (body.billNumber || "").toString().trim().slice(0, 60) || null;
    const purchaseDate = (body.purchaseDate || "").toString().slice(0, 10) || null;
    const paymentStatus = PAYMENT_STATUSES.has(body.paymentStatus)
      ? body.paymentStatus
      : "paid";
    const notes = (body.notes || "").toString().trim().slice(0, 500) || null;
    const postedItems = JSON.stringify(purchaseItems);
    const rows = await sql`
      WITH requested AS (
        SELECT item."productId" AS product_id, item.quantity, item."unitCost" AS unit_cost
        FROM jsonb_to_recordset(${postedItems}::jsonb)
          AS item("productId" INTEGER, quantity INTEGER, "unitCost" NUMERIC)
      ),
      received AS (
        UPDATE products product
        SET
          stock = product.stock + requested.quantity,
          cost_price = requested.unit_cost,
          updated_at = NOW()
        FROM requested
        WHERE product.product_id = requested.product_id
          AND product.shop_id = ${context.shopId}
        RETURNING product.product_id
      ),
      verified AS (
        SELECT 1 / (
          CASE
            WHEN COUNT(*) = ${purchaseItems.length} THEN 1
            ELSE COUNT(*)::INTEGER - COUNT(*)::INTEGER
          END
        ) AS ok
        FROM received
      ),
      created_purchase AS (
        INSERT INTO purchases
          (shop_id, supplier_id, bill_number, purchase_date, items, subtotal, tax_amount, total_amount, payment_status, notes, created_by)
        SELECT
          ${context.shopId},
          ${supplierId},
          ${billNumber},
          COALESCE(${purchaseDate}::date, CURRENT_DATE),
          ${postedItems},
          ${subtotal},
          ${taxAmount},
          ${totalAmount},
          ${paymentStatus},
          ${notes},
          ${context.userId}
        FROM verified
        WHERE verified.ok = 1
        RETURNING *
      ),
      recorded_movements AS (
        INSERT INTO stock_movements
          (shop_id, product_id, movement_type, quantity_change, reference_type, reference_id, created_by)
        SELECT
          ${context.shopId},
          requested.product_id,
          'purchase',
          requested.quantity,
          'purchase',
          created_purchase.purchase_id::TEXT,
          ${context.userId}
        FROM requested
        CROSS JOIN created_purchase
        RETURNING movement_id
      )
      SELECT created_purchase.*
      FROM created_purchase
      CROSS JOIN (SELECT COUNT(*) FROM recorded_movements) movement_count
    `;
    const purchase = rows[0];
    await writeAuditEvent(context, "purchase.create", "purchase", purchase.purchase_id, {
      totalAmount,
      itemCount: purchaseItems.length,
    });
    return Response.json({ purchase }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error?.code === "22012" || /division by zero/i.test(String(error?.message))) {
      return Response.json(
        { error: "Products changed before the purchase was posted. Refresh and try again." },
        { status: 409 },
      );
    }
    console.error("POST /api/purchases", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
