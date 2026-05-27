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

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export async function POST(request, { params }) {
  try {
    const context = await requireShopAccess(request, "purchase.write");
    await ensureBusinessFeatureSchema();
    const id = parseId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const body = await request.json();
    const productRows = await sql`
      SELECT * FROM products
      WHERE product_id = ${id} AND shop_id = ${context.shopId}
      LIMIT 1
    `;
    const product = productRows[0];
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

    const model = getUnitModel(product);
    const selectedUnit = sanitizeProductUnit(body.unit, { fallback: model.primaryUnit });
    const quantity = Number(body.quantity);
    const costInput = Number(body.costPrice);
    const sellingInput = Number(body.sellingPrice);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(costInput) ||
      costInput < 0 ||
      !Number.isFinite(sellingInput) ||
      sellingInput < 0 ||
      !availableSaleUnits(product).includes(selectedUnit)
    ) {
      return Response.json(
        { error: "Quantity, unit, cost price and selling price are required" },
        { status: 400 },
      );
    }

    const quantityBaseUnit = toBaseQuantity(quantity, selectedUnit, product);
    const conversionRate = Number(product.conversion_rate) || null;
    const primaryUnitCost =
      conversionRate && selectedUnit === product.secondary_unit ? money(costInput * conversionRate) : money(costInput);
    const primaryUnitSelling =
      conversionRate && selectedUnit === product.secondary_unit ? money(sellingInput * conversionRate) : money(sellingInput);
    const costPriceBaseUnit = conversionRate ? money(primaryUnitCost / conversionRate) : money(primaryUnitCost);
    const totalAmount = money(quantity * costInput);
    const paidAmount = money(Math.min(totalAmount, Math.max(0, Number(body.paidAmount) || 0)));
    const paymentStatus = paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "credit";
    const paymentMethod = ["cash", "upi", "bank", "bank_transfer", "card"].includes(body.paymentMethod)
      ? body.paymentMethod
      : "cash";
    const supplierId = body.supplierId ? Number.parseInt(body.supplierId, 10) : null;
    let supplierName = null;
    if (supplierId) {
      const supplier = await sql`
        SELECT supplier_id, name FROM suppliers
        WHERE supplier_id = ${supplierId} AND shop_id = ${context.shopId} AND is_deleted = FALSE
        LIMIT 1
      `;
      if (!supplier[0]) return Response.json({ error: "Supplier not found" }, { status: 400 });
      supplierName = supplier[0].name;
    }
    const purchaseInvoiceNo = String(body.purchaseInvoiceNo || "").trim().slice(0, 80) || null;
    const notes = String(body.notes || "").trim().slice(0, 500) || null;
    const dueDate = String(body.dueDate || "").slice(0, 10) || null;
    const purchaseDate =
      context.role === "owner" && body.purchaseDate
        ? String(body.purchaseDate).slice(0, 10)
        : null;
    const itemJson = JSON.stringify([
      {
        productId: product.product_id,
        productNameSnapshot: product.title,
        selectedUnit,
        primaryUnitSnapshot: model.primaryUnit,
        secondaryUnitSnapshot: model.secondaryUnit,
        conversionRateSnapshot: model.conversionRate,
        quantity,
        quantityBaseUnit,
        unitCost: money(costInput),
        totalAmount,
      },
    ]);

    const rows = await sql`
      WITH target AS (
        SELECT product_id, title, COALESCE(stock_base_unit, stock) AS old_stock_base_unit
        FROM products
        WHERE product_id = ${id} AND shop_id = ${context.shopId}
        FOR UPDATE
      ),
      updated_product AS (
        UPDATE products p
        SET
          stock_base_unit = target.old_stock_base_unit + ${quantityBaseUnit},
          stock = (target.old_stock_base_unit + ${quantityBaseUnit}) /
            CASE WHEN p.conversion_rate > 0 THEN p.conversion_rate ELSE 1 END,
          cost_price = ${primaryUnitCost},
          selling_price = ${primaryUnitSelling},
          updated_at = NOW()
        FROM target
        WHERE p.product_id = target.product_id AND p.shop_id = ${context.shopId}
        RETURNING p.*, target.old_stock_base_unit
      ),
      created_purchase AS (
        INSERT INTO purchases
          (shop_id, owner_id, supplier_id, bill_number, purchase_date, items, subtotal,
           tax_amount, total_amount, paid_amount, payment_status, due_date, notes, created_by)
        SELECT ${context.shopId}, ${context.shopOwnerId}, ${supplierId}, ${purchaseInvoiceNo},
          COALESCE(${purchaseDate}::date, CURRENT_DATE), ${itemJson}::jsonb, ${totalAmount},
          0, ${totalAmount}, ${paidAmount}, ${paymentStatus}, ${dueDate}, ${notes}, ${context.userId}
        FROM updated_product
        RETURNING *
      ),
      created_batch AS (
        INSERT INTO product_batches
          (product_id, shop_id, owner_id, product_name_snapshot, purchase_date,
           quantity_purchased, quantity_remaining, quantity_purchased_base_unit, quantity_remaining_base_unit,
           unit, primary_unit_snapshot, secondary_unit_snapshot, conversion_rate_snapshot,
           cost_price, cost_price_base_unit, selling_price, supplier_id, supplier_name_snapshot,
           purchase_invoice_no, notes, source, created_by)
        SELECT ${id}, ${context.shopId}, ${context.shopOwnerId}, updated_product.title,
          COALESCE(${purchaseDate}::timestamp, NOW()), ${quantity}, ${quantity}, ${quantityBaseUnit}, ${quantityBaseUnit},
          ${selectedUnit}, ${model.primaryUnit}, ${model.secondaryUnit}, ${model.conversionRate},
          ${primaryUnitCost}, ${costPriceBaseUnit}, ${primaryUnitSelling}, ${supplierId}, ${supplierName},
          ${purchaseInvoiceNo}, ${notes}, 'add_stock', ${context.userId}
        FROM updated_product
        RETURNING *
      ),
      movement AS (
        INSERT INTO stock_movements
          (shop_id, product_id, product_name_snapshot, movement_type, quantity_change,
           quantity_base_unit, display_quantity, unit, batch_id, old_stock_base_unit,
           new_stock_base_unit, cost_price_snapshot, selling_price_snapshot, movement_date,
           reason, related_purchase_id, reference_type, reference_id, owner_id, created_by)
        SELECT ${context.shopId}, ${id}, updated_product.title, 'purchase_stock_in',
          ${quantityBaseUnit}, ${quantityBaseUnit}, ${quantity}, ${selectedUnit}, created_batch.batch_id,
          updated_product.old_stock_base_unit, updated_product.old_stock_base_unit + ${quantityBaseUnit},
          ${primaryUnitCost}, ${primaryUnitSelling}, NOW(), 'Stock added',
          created_purchase.purchase_id, 'purchase', created_purchase.purchase_id::text,
          ${context.shopOwnerId}, ${context.userId}
        FROM updated_product CROSS JOIN created_batch CROSS JOIN created_purchase
        RETURNING movement_id
      ),
      payment AS (
        INSERT INTO payments
          (shop_id, purchase_id, supplier_id, amount, payment_method, direction, notes, created_by)
        SELECT ${context.shopId}, created_purchase.purchase_id, ${supplierId}, ${paidAmount},
          ${paymentMethod}, 'paid', 'Payment recorded with stock entry', ${context.userId}
        FROM created_purchase WHERE ${paidAmount} > 0
        RETURNING payment_id
      )
      SELECT
        (SELECT row_to_json(updated_product) FROM updated_product) AS product,
        (SELECT row_to_json(created_batch) FROM created_batch) AS batch,
        (SELECT row_to_json(created_purchase) FROM created_purchase) AS purchase
      FROM movement
      LIMIT 1
    `;

    await writeAuditEvent(context, "product.stock.add", "product", id, {
      quantity,
      selectedUnit,
      quantityBaseUnit,
      totalAmount,
    });
    return Response.json(
      {
        product: rows[0]?.product,
        batch: rows[0]?.batch,
        purchase: rows[0]?.purchase,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/products/[id]/stock", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
