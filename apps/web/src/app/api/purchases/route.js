import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import {
  availableSaleUnits,
  getUnitModel,
  sanitizeProductUnit,
  toBaseQuantity,
} from "@/utils/productUnits";

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "purchase.read");
    await ensureBusinessFeatureSchema();
    const purchases = await sql`
      SELECT p.*, s.name AS supplier_name,
        GREATEST(0, p.total_amount - COALESCE(p.paid_amount, 0)) AS balance_amount
      FROM purchases p
      LEFT JOIN suppliers s ON s.supplier_id = p.supplier_id AND s.shop_id = p.shop_id
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
    if (!items.length) {
      return Response.json({ error: "Add at least one purchased product" }, { status: 400 });
    }

    const productIds = [...new Set(items.map((item) => Number.parseInt(item.productId, 10)))];
    if (productIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      return Response.json({ error: "Invalid product" }, { status: 400 });
    }
    let supplierId = null;
    let supplierName = null;
    if (body.supplierId) {
      const candidate = Number.parseInt(body.supplierId, 10);
      const supplier = await sql`
        SELECT supplier_id, name FROM suppliers
        WHERE supplier_id = ${candidate} AND shop_id = ${context.shopId} AND is_deleted = FALSE
        LIMIT 1
      `;
      if (!supplier[0]) return Response.json({ error: "Supplier not found" }, { status: 400 });
      supplierId = candidate;
      supplierName = supplier[0].name;
    }
    const placeholders = productIds.map((_, index) => `$${index + 2}`).join(",");
    const products = await sql(
      `SELECT * FROM products WHERE shop_id = $1 AND product_id IN (${placeholders})`,
      [context.shopId, ...productIds],
    );
    const productMap = Object.fromEntries(products.map((product) => [product.product_id, product]));
    const purchaseItems = [];
    const receivedByProduct = new Map();
    let subtotal = 0;

    for (const item of items) {
      const product = productMap[Number.parseInt(item.productId, 10)];
      if (!product) return Response.json({ error: "Product not found" }, { status: 400 });
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      const selectedUnit = sanitizeProductUnit(item.selectedUnit, {
        fallback: getUnitModel(product).primaryUnit,
      });
      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitCost) ||
        unitCost < 0 ||
        !availableSaleUnits(product).includes(selectedUnit)
      ) {
        return Response.json({ error: "Each purchase line requires a valid quantity, unit and cost" }, { status: 400 });
      }
      const quantityBaseUnit = toBaseQuantity(quantity, selectedUnit, product);
      const conversionRate = Number(product.conversion_rate) || null;
      const primaryUnitCost =
        conversionRate && selectedUnit === product.secondary_unit
          ? money(unitCost * conversionRate)
          : money(unitCost);
      const hasSellingInput =
        String(item.sellingPrice ?? "").trim() !== "" && Number.isFinite(Number(item.sellingPrice));
      const primaryUnitSelling = hasSellingInput
        ? money(
            conversionRate && selectedUnit === product.secondary_unit
              ? Number(item.sellingPrice) * conversionRate
              : Number(item.sellingPrice),
          )
        : Number(product.selling_price) || 0;
      const costPriceBaseUnit = conversionRate
        ? money(primaryUnitCost / conversionRate)
        : primaryUnitCost;
      const lineTotal = money(quantity * unitCost);
      subtotal += lineTotal;
      purchaseItems.push({
        productId: product.product_id,
        productNameSnapshot: product.title,
        selectedUnit,
        primaryUnitSnapshot: product.primary_unit || "piece",
        secondaryUnitSnapshot: product.secondary_unit || null,
        conversionRateSnapshot: conversionRate,
        quantity,
        quantityBaseUnit,
        unitCost: money(unitCost),
        primaryUnitCost,
        costPriceBaseUnit,
        sellingPrice: primaryUnitSelling,
        totalAmount: lineTotal,
      });
      const current = receivedByProduct.get(product.product_id) || {
        productId: product.product_id,
        productName: product.title,
        quantityBaseUnit: 0,
        primaryUnitCost,
        sellingPrice: item.sellingPrice === "" ? null : Number(item.sellingPrice),
      };
      current.quantityBaseUnit += quantityBaseUnit;
      current.primaryUnitCost = primaryUnitCost;
      if (Number.isFinite(Number(item.sellingPrice))) current.sellingPrice = Number(item.sellingPrice);
      receivedByProduct.set(product.product_id, current);
    }

    subtotal = money(subtotal);
    const taxAmount = money(Math.max(0, Number(body.taxAmount) || 0));
    const totalAmount = money(subtotal + taxAmount);
    const paidAmount = money(Math.min(totalAmount, Math.max(0, Number(body.paidAmount) || (body.paymentStatus === "paid" ? totalAmount : 0))));
    const paymentStatus = paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "credit";
    const paymentMethod = ["cash", "upi", "bank", "bank_transfer"].includes(body.paymentMethod)
      ? body.paymentMethod
      : "cash";
    const postedItems = JSON.stringify(purchaseItems);
    const batchItems = JSON.stringify(
      purchaseItems.map((item) => ({
        ...item,
        supplierName,
      })),
    );
    const receivedProducts = JSON.stringify([...receivedByProduct.values()]);
    const billNumber = String(body.billNumber || "").trim().slice(0, 60) || null;
    const purchaseDate = String(body.purchaseDate || "").slice(0, 10) || null;
    const notes = String(body.notes || "").trim().slice(0, 500) || null;
    const rows = await sql`
      WITH requested AS (
        SELECT item."productId" AS product_id, item."productName" AS product_name,
          item."quantityBaseUnit" AS quantity_base_unit,
          item."primaryUnitCost" AS primary_unit_cost,
          item."sellingPrice" AS selling_price
        FROM jsonb_to_recordset(${receivedProducts}::jsonb)
          AS item("productId" INTEGER, "productName" TEXT, "quantityBaseUnit" NUMERIC,
            "primaryUnitCost" NUMERIC, "sellingPrice" NUMERIC)
      ),
      received AS (
        UPDATE products product
        SET
          stock_base_unit = COALESCE(product.stock_base_unit, product.stock) + requested.quantity_base_unit,
          stock = (COALESCE(product.stock_base_unit, product.stock) + requested.quantity_base_unit) /
            CASE WHEN product.conversion_rate > 0 THEN product.conversion_rate ELSE 1 END,
          cost_price = requested.primary_unit_cost,
          selling_price = COALESCE(requested.selling_price, product.selling_price),
          updated_at = NOW()
        FROM requested
        WHERE product.product_id = requested.product_id AND product.shop_id = ${context.shopId}
        RETURNING product.product_id, product.title, requested.quantity_base_unit,
          COALESCE(product.stock_base_unit, product.stock) AS new_stock_base_unit
      ),
      verified AS (
        SELECT 1 / CASE WHEN COUNT(*) = ${receivedByProduct.size} THEN 1 ELSE 0 END AS ok FROM received
      ),
      created_purchase AS (
        INSERT INTO purchases
          (shop_id, supplier_id, bill_number, purchase_date, items, subtotal, tax_amount,
           total_amount, paid_amount, payment_status, notes, created_by, owner_id)
        SELECT ${context.shopId}, ${supplierId}, ${billNumber}, COALESCE(${purchaseDate}::date, CURRENT_DATE),
          ${postedItems}::jsonb, ${subtotal}, ${taxAmount}, ${totalAmount}, ${paidAmount},
          ${paymentStatus}, ${notes}, ${context.userId}, ${context.shopOwnerId}
        FROM verified WHERE verified.ok = 1
        RETURNING *
      ),
      created_batches AS (
        INSERT INTO product_batches
          (product_id, shop_id, owner_id, product_name_snapshot, purchase_date,
           quantity_purchased, quantity_remaining, quantity_purchased_base_unit, quantity_remaining_base_unit,
           unit, primary_unit_snapshot, secondary_unit_snapshot, conversion_rate_snapshot,
           cost_price, cost_price_base_unit, selling_price, supplier_id, supplier_name_snapshot,
           purchase_invoice_no, notes, source, created_by)
        SELECT item."productId", ${context.shopId}, ${context.shopOwnerId}, item."productNameSnapshot",
          created_purchase.purchase_date::timestamp, item.quantity, item.quantity,
          item."quantityBaseUnit", item."quantityBaseUnit", item."selectedUnit",
          item."primaryUnitSnapshot", item."secondaryUnitSnapshot", item."conversionRateSnapshot",
          item."primaryUnitCost", item."costPriceBaseUnit", item."sellingPrice",
          ${supplierId}, item."supplierName", ${billNumber}, ${notes}, 'purchase', ${context.userId}
        FROM created_purchase
        CROSS JOIN LATERAL jsonb_to_recordset(${batchItems}::jsonb)
          AS item("productId" INTEGER, "productNameSnapshot" TEXT, "selectedUnit" TEXT,
            "primaryUnitSnapshot" TEXT, "secondaryUnitSnapshot" TEXT, "conversionRateSnapshot" NUMERIC,
            quantity NUMERIC, "quantityBaseUnit" NUMERIC, "unitCost" NUMERIC, "primaryUnitCost" NUMERIC,
            "costPriceBaseUnit" NUMERIC, "sellingPrice" NUMERIC, "supplierName" TEXT)
        RETURNING batch_id
      ),
      movements AS (
        INSERT INTO stock_movements
          (shop_id, product_id, product_name_snapshot, movement_type, quantity_change,
           quantity_base_unit, display_quantity, unit, old_stock_base_unit, new_stock_base_unit,
           reason, related_purchase_id, reference_type, reference_id, owner_id, created_by)
        SELECT ${context.shopId}, received.product_id, received.title, 'purchase_stock_in',
          received.quantity_base_unit, received.quantity_base_unit, received.quantity_base_unit, 'base',
          received.new_stock_base_unit - received.quantity_base_unit, received.new_stock_base_unit,
          'Purchase stock received', created_purchase.purchase_id, 'purchase',
          created_purchase.purchase_id::TEXT, ${context.shopOwnerId}, ${context.userId}
        FROM received CROSS JOIN created_purchase
        RETURNING movement_id
      ),
      payment AS (
        INSERT INTO payments
          (shop_id, purchase_id, supplier_id, amount, payment_method, direction, notes, created_by)
        SELECT ${context.shopId}, created_purchase.purchase_id, ${supplierId}, ${paidAmount},
          ${paymentMethod}, 'paid', 'Payment recorded on purchase', ${context.userId}
        FROM created_purchase WHERE ${paidAmount} > 0
        RETURNING payment_id
      )
      SELECT created_purchase.* FROM created_purchase
      CROSS JOIN (SELECT COUNT(*) FROM created_batches) batch_count
      CROSS JOIN (SELECT COUNT(*) FROM movements) movement_count
      CROSS JOIN (SELECT COUNT(*) FROM payment) payment_count
    `;
    const purchase = rows[0];
    await writeAuditEvent(context, "purchase.create", "purchase", purchase.purchase_id, {
      totalAmount,
      paidAmount,
      itemCount: purchaseItems.length,
    });
    return Response.json({ purchase }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error?.code === "22012" || /division by zero/i.test(String(error?.message))) {
      return Response.json({ error: "Products changed before the purchase was posted. Refresh and try again." }, { status: 409 });
    }
    console.error("POST /api/purchases", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
