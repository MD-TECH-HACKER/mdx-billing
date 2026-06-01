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
      : "product_id, shop_id, image_url, title, description, selling_price, stock, stock_base_unit, opening_stock_base_unit, sold_base_unit, low_stock_base_unit, category, category_id, category_name_snapshot, sku, primary_unit, secondary_unit, conversion_rate, hsn_sac, tax_rate, gst_rate, tax_mode, gst_exempt, cess_rate, reverse_charge, product_status, product_created_at, supplier_id, created_at, updated_at";
    const rows = await sql(
      `SELECT ${columns} FROM products WHERE product_id = $1 AND shop_id = $2 LIMIT 1`,
      [id, context.shopId],
    );
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    const [batches, movements] = await sql.transaction([
      sql`
        SELECT batch_id, product_name_snapshot, purchase_date, quantity_purchased,
          quantity_remaining, quantity_purchased_base_unit, quantity_remaining_base_unit,
          unit, cost_price, cost_price_base_unit, selling_price, supplier_id,
          supplier_name_snapshot, purchase_invoice_no, notes, source, created_at
        FROM product_batches
        WHERE product_id = ${id} AND shop_id = ${context.shopId}
        ORDER BY purchase_date DESC, batch_id DESC
        LIMIT 100
      `,
      sql`
        SELECT movement_id, movement_type, quantity_change, quantity_base_unit,
          display_quantity, unit, batch_id, old_stock_base_unit, new_stock_base_unit,
          cost_price_snapshot, selling_price_snapshot, reason, related_sale_id,
          related_purchase_id, created_at
        FROM stock_movements
        WHERE product_id = ${id} AND shop_id = ${context.shopId}
        ORDER BY created_at DESC
        LIMIT 100
      `,
    ]);
    return Response.json({ product: rows[0], batches, stockMovements: movements });
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
    if (typeof body.category === "string")
      fields.category = body.category.trim().slice(0, 50) || null;
    if (body.categoryId !== undefined) {
      const categoryId = Number.parseInt(body.categoryId, 10) || null;
      if (categoryId) {
        const category = await sql`
          SELECT category_id, name FROM categories
          WHERE category_id = ${categoryId} AND shop_id = ${context.shopId}
          LIMIT 1
        `;
        if (!category[0]) return Response.json({ error: "Category not found" }, { status: 400 });
        fields.category_id = categoryId;
        fields.category = category[0].name;
        fields.category_name_snapshot = category[0].name;
      } else {
        fields.category_id = null;
        fields.category_name_snapshot = fields.category || null;
      }
    }
    if (typeof body.sku === "string") fields.sku = body.sku.trim().slice(0, 50) || null;
    if (typeof body.hsnSac === "string")
      fields.hsn_sac = body.hsnSac.trim().slice(0, 30) || null;
    if (body.taxRate !== undefined || body.gstRate !== undefined) {
      fields.tax_rate = Math.max(0, Math.min(100, Number(body.taxRate ?? body.gstRate) || 0));
      fields.gst_rate = fields.tax_rate;
    }
    if (typeof body.taxMode === "string")
      fields.tax_mode = ["inclusive", "exclusive"].includes(body.taxMode) ? body.taxMode : "exclusive";
    if (body.gstExempt !== undefined) fields.gst_exempt = !!body.gstExempt;
    if (body.cessRate !== undefined)
      fields.cess_rate = Math.max(0, Math.min(100, Number(body.cessRate) || 0));
    if (body.reverseCharge !== undefined) fields.reverse_charge = !!body.reverseCharge;
    if (typeof body.productStatus === "string")
      fields.product_status = ["active", "inactive"].includes(body.productStatus) ? body.productStatus : "active";
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

    const values = keys.map((key) => fields[key]);
    values.push(id, context.shopId);
    const setClauses = keys.map((key, index) => `${key} = $${index + 1}`);
    const query = `UPDATE products SET ${setClauses.join(", ")}, updated_at = NOW() WHERE product_id = $${keys.length + 1} AND shop_id = $${keys.length + 2}`;
    await sql(query, values);
    const result = await sql`SELECT * FROM products WHERE product_id = ${id}`;
    const product = result[0];

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

    const check = await sql`SELECT product_id FROM products WHERE product_id = ${id} AND shop_id = ${context.shopId}`;
    if (!check[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await sql`DELETE FROM products WHERE product_id = ${id} AND shop_id = ${context.shopId}`;
    await writeAuditEvent(context, "product.delete", "product", id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/products/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
