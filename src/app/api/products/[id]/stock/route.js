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

    const result = await sql.withTransaction(async (tx) => {
      const targetRows = await tx`
        SELECT product_id, title, COALESCE(stock_base_unit, stock) AS old_stock_base_unit, conversion_rate
        FROM products
        WHERE product_id = ${id} AND shop_id = ${context.shopId}
        FOR UPDATE
      `;
      if (!targetRows[0]) return null;
      const target = targetRows[0];
      
      const oldStockBase = Number(target.old_stock_base_unit) || 0;
      const newStockBase = oldStockBase + quantityBaseUnit;
      const newStock = newStockBase / (Number(target.conversion_rate) || 1);

      await tx`
        UPDATE products
        SET stock_base_unit = ${newStockBase},
            stock = ${newStock},
            cost_price = ${primaryUnitCost},
            selling_price = ${primaryUnitSelling},
            updated_at = NOW()
        WHERE product_id = ${id}
      `;

      const [purchaseRes] = await tx`
        INSERT INTO purchases
          (shop_id, owner_id, supplier_id, bill_number, purchase_date, items, subtotal,
           tax_amount, total_amount, paid_amount, payment_status, due_date, notes, created_by)
        VALUES
          (${context.shopId}, ${context.shopOwnerId}, ${supplierId}, ${purchaseInvoiceNo},
           ${purchaseDate || new Date().toISOString().split('T')[0]}, ${itemJson}, ${totalAmount},
           0, ${totalAmount}, ${paidAmount}, ${paymentStatus}, ${dueDate}, ${notes}, ${context.userId})
      `;
      const purchaseId = purchaseRes.insertId;

      const [batchRes] = await tx`
        INSERT INTO product_batches
          (product_id, shop_id, owner_id, product_name_snapshot, purchase_date,
           quantity_purchased, quantity_remaining, quantity_purchased_base_unit, quantity_remaining_base_unit,
           unit, primary_unit_snapshot, secondary_unit_snapshot, conversion_rate_snapshot,
           cost_price, cost_price_base_unit, selling_price, supplier_id, supplier_name_snapshot,
           purchase_invoice_no, notes, source, created_by)
        VALUES
          (${id}, ${context.shopId}, ${context.shopOwnerId}, ${target.title},
           NOW(), ${quantity}, ${quantity}, ${quantityBaseUnit}, ${quantityBaseUnit},
           ${selectedUnit}, ${model.primaryUnit}, ${model.secondaryUnit}, ${model.conversionRate},
           ${primaryUnitCost}, ${costPriceBaseUnit}, ${primaryUnitSelling}, ${supplierId}, ${supplierName},
           ${purchaseInvoiceNo}, ${notes}, 'add_stock', ${context.userId})
      `;
      const batchId = batchRes.insertId;

      await tx`
        INSERT INTO stock_movements
          (shop_id, product_id, product_name_snapshot, movement_type, quantity_change,
           quantity_base_unit, display_quantity, unit, batch_id, old_stock_base_unit,
           new_stock_base_unit, cost_price_snapshot, selling_price_snapshot, movement_date,
           reason, related_purchase_id, reference_type, reference_id, owner_id, created_by)
        VALUES
          (${context.shopId}, ${id}, ${target.title}, 'purchase_stock_in',
           ${quantityBaseUnit}, ${quantityBaseUnit}, ${quantity}, ${selectedUnit}, ${batchId},
           ${oldStockBase}, ${newStockBase},
           ${primaryUnitCost}, ${primaryUnitSelling}, NOW(), 'Stock added',
           ${purchaseId}, 'purchase', ${String(purchaseId)},
           ${context.shopOwnerId}, ${context.userId})
      `;

      if (paidAmount > 0) {
        await tx`
          INSERT INTO payments
            (shop_id, purchase_id, supplier_id, amount, payment_method, direction, notes, created_by)
          VALUES
            (${context.shopId}, ${purchaseId}, ${supplierId}, ${paidAmount},
             ${paymentMethod}, 'paid', 'Payment recorded with stock entry', ${context.userId})
        `;
      }
      
      const productRow = await tx`SELECT * FROM products WHERE product_id = ${id}`;
      const batchRow = await tx`SELECT * FROM product_batches WHERE batch_id = ${batchId}`;
      const purchaseRow = await tx`SELECT * FROM purchases WHERE purchase_id = ${purchaseId}`;
      return { product: productRow[0], batch: batchRow[0], purchase: purchaseRow[0] };
    });

    await writeAuditEvent(context, "product.stock.add", "product", id, {
      quantity,
      selectedUnit,
      quantityBaseUnit,
      totalAmount,
    });
    return Response.json(
      {
        product: result.product,
        batch: result.batch,
        purchase: result.purchase,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/products/[id]/stock", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
