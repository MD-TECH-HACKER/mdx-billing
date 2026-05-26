import sql from "@/app/api/utils/sql";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { canAccess } from "@/app/api/utils/permissions";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  getStockBaseQuantity,
  sanitizeConversionRate,
  sanitizeProductUnit,
  toBaseQuantity,
} from "@/utils/productUnits";

function parseProductId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function productUnits(body, current) {
  const primaryUnit = sanitizeProductUnit(body.primaryUnit ?? current.primary_unit, {
    fallback: "piece",
  });
  const secondaryUnit = sanitizeProductUnit(body.secondaryUnit ?? current.secondary_unit, {
    fallback: null,
  });
  const conversionRate =
    secondaryUnit && secondaryUnit !== primaryUnit
      ? sanitizeConversionRate(body.conversionRate ?? current.conversion_rate)
      : null;
  return {
    primary_unit: primaryUnit,
    secondary_unit: conversionRate ? secondaryUnit : null,
    conversion_rate: conversionRate,
  };
}

export async function GET(request, { params }) {
  try {
    const context = await requireShopAccess(request, "product.read");
    await ensureBusinessFeatureSchema();
    const id = parseProductId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const columns = canAccess(context.role, "analytics.profit")
      ? "*"
      : "product_id, shop_id, image_url, title, description, selling_price, stock, stock_base_unit, opening_stock_base_unit, sold_base_unit, low_stock_base_unit, category, sku, primary_unit, secondary_unit, conversion_rate, hsn_sac, tax_rate, created_at, updated_at";
    const rows = await sql(
      `SELECT ${columns} FROM products WHERE product_id = $1 AND shop_id = $2 LIMIT 1`,
      [id, context.shopId],
    );
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ product: rows[0] });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/products/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const context = await requireShopAccess(request, "product.write");
    await ensureBusinessFeatureSchema();
    const id = parseProductId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const body = await request.json();
    const currentRows = await sql`
      SELECT * FROM products
      WHERE product_id = ${id} AND shop_id = ${context.shopId}
      LIMIT 1
    `;
    const current = currentRows[0];
    if (!current) return Response.json({ error: "Not found" }, { status: 404 });

    const nextUnits = productUnits(body, current);
    const changesUnitModel =
      nextUnits.primary_unit !== current.primary_unit ||
      nextUnits.secondary_unit !== current.secondary_unit ||
      Number(nextUnits.conversion_rate || 0) !== Number(current.conversion_rate || 0);
    const fields = {};

    if (typeof body.title === "string") fields.title = body.title.trim().slice(0, 150);
    if (typeof body.description === "string")
      fields.description = body.description.trim().slice(0, 1000) || null;
    if (typeof body.imageUrl === "string") fields.image_url = body.imageUrl.trim() || null;
    if (body.sellingPrice !== undefined)
      fields.selling_price = Math.max(0, Number(body.sellingPrice) || 0);
    if (body.costPrice !== undefined)
      fields.cost_price = Math.max(0, Number(body.costPrice) || 0);
    if (typeof body.category === "string")
      fields.category = body.category.trim().slice(0, 50) || null;
    if (typeof body.sku === "string") fields.sku = body.sku.trim().slice(0, 50) || null;
    if (typeof body.hsnSac === "string")
      fields.hsn_sac = body.hsnSac.trim().slice(0, 30) || null;
    if (body.taxRate !== undefined)
      fields.tax_rate = Math.max(0, Math.min(100, Number(body.taxRate) || 0));
    if (body.supplierId !== undefined)
      fields.supplier_id = Number.parseInt(body.supplierId, 10) || null;
    if (fields.supplier_id) {
      const supplier = await sql`
        SELECT supplier_id FROM suppliers
        WHERE supplier_id = ${fields.supplier_id} AND shop_id = ${context.shopId} AND is_deleted = FALSE
        LIMIT 1
      `;
      if (!supplier[0]) return Response.json({ error: "Supplier not found" }, { status: 400 });
    }
    if (body.primaryUnit !== undefined || changesUnitModel)
      fields.primary_unit = nextUnits.primary_unit;
    if (
      body.secondaryUnit !== undefined ||
      body.conversionRate !== undefined ||
      changesUnitModel
    ) {
      fields.secondary_unit = nextUnits.secondary_unit;
      fields.conversion_rate = nextUnits.conversion_rate;
    }

    const currentDisplayStock = Math.max(0, Number(current.stock) || 0);
    if (body.stock !== undefined || changesUnitModel) {
      const displayStock =
        body.stock !== undefined ? Math.max(0, Number(body.stock) || 0) : currentDisplayStock;
      fields.stock = displayStock;
      fields.stock_base_unit = toBaseQuantity(displayStock, nextUnits.primary_unit, nextUnits);
    }
    if (body.lowStockAlertQuantity !== undefined || body.reorderLevel !== undefined) {
      const displayAlert = Math.max(
        0,
        Number(body.lowStockAlertQuantity ?? body.reorderLevel) || 0,
      );
      fields.reorder_level = displayAlert;
      fields.low_stock_base_unit = toBaseQuantity(
        displayAlert,
        nextUnits.primary_unit,
        nextUnits,
      );
    } else if (changesUnitModel) {
      fields.low_stock_base_unit = toBaseQuantity(
        Number(current.reorder_level) || 0,
        nextUnits.primary_unit,
        nextUnits,
      );
    }

    const keys = Object.keys(fields);
    if (keys.length === 0) return Response.json({ error: "No fields" }, { status: 400 });

    const oldStockBase = getStockBaseQuantity(current);
    const values = keys.map((key) => fields[key]);
    values.push(id, context.shopId);
    const setClauses = keys.map((key, index) => `${key} = $${index + 1}`);
    const query = `UPDATE products SET ${setClauses.join(", ")}, updated_at = NOW() WHERE product_id = $${keys.length + 1} AND shop_id = $${keys.length + 2} RETURNING *`;
    const result = await sql(query, values);
    const product = result[0];

    if (fields.stock_base_unit !== undefined) {
      const newStockBase = getStockBaseQuantity(product);
      const stockDiff = newStockBase - oldStockBase;
      if (stockDiff !== 0) {
        const reason = String(body.stockReason || "Manual stock adjustment").slice(0, 200);
        await sql`
          INSERT INTO stock_movements
            (shop_id, product_id, product_name_snapshot, movement_type, quantity_change,
             quantity_base_unit, display_quantity, unit, old_stock_base_unit, new_stock_base_unit,
             reason, reference_type, reference_id, owner_id, created_by)
          VALUES
            (${context.shopId}, ${id}, ${product.title}, 'manual_adjustment', ${stockDiff},
             ${stockDiff}, ${Math.abs(Number(product.stock) - currentDisplayStock)}, ${nextUnits.primary_unit},
             ${oldStockBase}, ${newStockBase}, ${reason}, 'product_edit', ${String(id)},
             ${context.shopOwnerId}, ${context.userId})
        `;
      }
    }

    if (changesUnitModel || body.primaryUnit !== undefined || body.secondaryUnit !== undefined) {
      await sql`
        UPDATE unit_conversions
        SET active = FALSE, updated_at = NOW()
        WHERE product_id = ${id} AND shop_id = ${context.shopId}
      `;
      if (nextUnits.conversion_rate) {
        await sql`
          INSERT INTO unit_conversions
            (shop_id, product_id, from_unit, to_unit, conversion_rate)
          VALUES
            (${context.shopId}, ${id}, ${nextUnits.primary_unit}, ${nextUnits.secondary_unit}, ${nextUnits.conversion_rate})
          ON CONFLICT (product_id, from_unit, to_unit)
          DO UPDATE SET conversion_rate = EXCLUDED.conversion_rate, active = TRUE, updated_at = NOW()
        `;
      }
    }

    await writeAuditEvent(context, "product.update", "product", id, {
      changedFields: keys,
    });
    return Response.json({ product });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("PUT /api/products/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const context = await requireShopAccess(request, "product.write");
    const id = parseProductId(params.id);
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

    const result = await sql`
      DELETE FROM products
      WHERE product_id = ${id} AND shop_id = ${context.shopId}
      RETURNING product_id
    `;
    if (!result[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await writeAuditEvent(context, "product.delete", "product", id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/products/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
