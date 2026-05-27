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

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "product.read");
    await ensureBusinessFeatureSchema();
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const category = url.searchParams.get("category");
    const categoryId = Number.parseInt(url.searchParams.get("categoryId"), 10);
    const columns = canAccess(context.role, "analytics.profit")
      ? "*"
      : "product_id, shop_id, image_url, title, description, selling_price, stock, stock_base_unit, opening_stock_base_unit, sold_base_unit, low_stock_base_unit, category, category_id, category_name_snapshot, sku, primary_unit, secondary_unit, conversion_rate, hsn_sac, tax_rate, gst_rate, tax_mode, gst_exempt, cess_rate, reverse_charge, product_status, product_created_at, supplier_id, created_at, updated_at";
    let query = `SELECT ${columns} FROM products WHERE shop_id = $1`;
    const values = [context.shopId];

    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      query += ` AND (LOWER(title) LIKE $${values.length} OR LOWER(COALESCE(description,'')) LIKE $${values.length})`;
    }
    if (category && category !== "all") {
      values.push(category);
      query += ` AND category = $${values.length}`;
    }
    if (Number.isInteger(categoryId) && categoryId > 0) {
      values.push(categoryId);
      query += ` AND category_id = $${values.length}`;
    }
    query += " ORDER BY created_at DESC";

    const products = await sql(query, values);
    return Response.json({ products });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/products", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "product.write");
    await ensureBusinessFeatureSchema();
    const body = await request.json();
    const title = (body.title || "").toString().trim().slice(0, 150);

    if (!title) {
      return Response.json({ error: "Title required" }, { status: 400 });
    }

    const description =
      (body.description || "").toString().trim().slice(0, 1000) || null;
    const imageUrl = (body.imageUrl || "").toString().trim() || null;
    const sellingPrice = Math.max(0, Number(body.sellingPrice) || 0);
    const costPrice = Math.max(0, Number(body.costPrice) || 0);
    const openingStock = Math.max(0, Number(body.openingStock ?? body.stock) || 0);
    const category =
      (body.category || "").toString().trim().slice(0, 50) || null;
    const categoryId = Number.isInteger(Number.parseInt(body.categoryId, 10))
      ? Number.parseInt(body.categoryId, 10)
      : null;
    let categoryNameSnapshot = category;
    if (categoryId) {
      const categoryRows = await sql`
        SELECT category_id, name FROM categories
        WHERE category_id = ${categoryId} AND shop_id = ${context.shopId}
        LIMIT 1
      `;
      if (!categoryRows[0]) return Response.json({ error: "Category not found" }, { status: 400 });
      categoryNameSnapshot = categoryRows[0].name;
    }
    const sku = (body.sku || "").toString().trim().slice(0, 50) || null;
    const primaryUnit = sanitizeProductUnit(body.primaryUnit, {
      fallback: "piece",
    });
    const secondaryUnit = sanitizeProductUnit(body.secondaryUnit, {
      fallback: null,
    });
    const conversionRate =
      secondaryUnit && secondaryUnit !== primaryUnit
        ? sanitizeConversionRate(body.conversionRate)
        : null;
    const unitModel = {
      primary_unit: primaryUnit,
      secondary_unit: conversionRate ? secondaryUnit : null,
      conversion_rate: conversionRate,
    };
    const openingStockBaseUnit = toBaseQuantity(openingStock, primaryUnit, unitModel);
    const lowStock = Math.max(0, Number(body.lowStockAlertQuantity ?? body.reorderLevel) || 0);
    const lowStockBaseUnit = toBaseQuantity(lowStock, primaryUnit, unitModel);
    const hsnSac = (body.hsnSac || "").toString().trim().slice(0, 30) || null;
    const taxRate = Math.max(0, Math.min(100, Number(body.taxRate ?? body.gstRate) || 0));
    const taxMode = ["inclusive", "exclusive"].includes(body.taxMode) ? body.taxMode : "exclusive";
    const gstExempt = !!body.gstExempt;
    const cessRate = Math.max(0, Math.min(100, Number(body.cessRate) || 0));
    const reverseCharge = !!body.reverseCharge;
    const productStatus = ["active", "inactive"].includes(body.productStatus) ? body.productStatus : "active";
    const supplierId = Number.isInteger(Number.parseInt(body.supplierId, 10))
      ? Number.parseInt(body.supplierId, 10)
      : null;
    if (supplierId) {
      const supplier = await sql`
        SELECT supplier_id FROM suppliers
        WHERE supplier_id = ${supplierId} AND shop_id = ${context.shopId} AND is_deleted = FALSE
        LIMIT 1
      `;
      if (!supplier[0]) return Response.json({ error: "Supplier not found" }, { status: 400 });
    }

    const created = await sql`
      INSERT INTO products
        (owner_id, shop_id, image_url, title, description, selling_price, cost_price, stock,
         opening_stock_base_unit, stock_base_unit, sold_base_unit, low_stock_base_unit,
         category, category_id, category_name_snapshot, sku, primary_unit, secondary_unit, conversion_rate,
         hsn_sac, tax_rate, gst_rate, tax_mode, gst_exempt, cess_rate, reverse_charge, product_status,
         supplier_id, product_created_at)
      VALUES
        (${context.shopOwnerId}, ${context.shopId}, ${imageUrl}, ${title}, ${description}, ${sellingPrice}, ${costPrice}, ${openingStock},
         ${openingStockBaseUnit}, ${openingStockBaseUnit}, 0, ${lowStockBaseUnit},
         ${categoryNameSnapshot}, ${categoryId}, ${categoryNameSnapshot}, ${sku}, ${primaryUnit}, ${conversionRate ? secondaryUnit : null}, ${conversionRate},
         ${hsnSac}, ${taxRate}, ${taxRate}, ${taxMode}, ${gstExempt}, ${cessRate}, ${reverseCharge}, ${productStatus},
         ${supplierId}, NOW())
      RETURNING *
    `;
    if (conversionRate) {
      await sql`
        INSERT INTO unit_conversions
          (shop_id, product_id, from_unit, to_unit, conversion_rate)
        VALUES
          (${context.shopId}, ${created[0].product_id}, ${primaryUnit}, ${secondaryUnit}, ${conversionRate})
        ON CONFLICT (product_id, from_unit, to_unit)
        DO UPDATE SET conversion_rate = EXCLUDED.conversion_rate, active = TRUE, updated_at = NOW()
      `;
    }
    if (openingStockBaseUnit > 0) {
      const costPriceBaseUnit = conversionRate ? costPrice / conversionRate : costPrice;
      const supplierRows = supplierId
        ? await sql`
            SELECT name FROM suppliers
            WHERE supplier_id = ${supplierId} AND shop_id = ${context.shopId}
            LIMIT 1
          `
        : [];
      const batchRows = await sql`
        INSERT INTO product_batches
          (product_id, shop_id, owner_id, product_name_snapshot, purchase_date,
           quantity_purchased, quantity_remaining, quantity_purchased_base_unit, quantity_remaining_base_unit,
           unit, primary_unit_snapshot, secondary_unit_snapshot, conversion_rate_snapshot,
           cost_price, cost_price_base_unit, selling_price, supplier_id, supplier_name_snapshot,
           purchase_invoice_no, notes, source, created_by)
        VALUES
          (${created[0].product_id}, ${context.shopId}, ${context.shopOwnerId}, ${title}, NOW(),
           ${openingStock}, ${openingStock}, ${openingStockBaseUnit}, ${openingStockBaseUnit},
           ${primaryUnit}, ${primaryUnit}, ${conversionRate ? secondaryUnit : null}, ${conversionRate},
           ${costPrice}, ${costPriceBaseUnit}, ${sellingPrice}, ${supplierId}, ${supplierRows[0]?.name || null},
           NULL, 'Opening stock batch', 'opening_stock', ${context.userId})
        RETURNING batch_id
      `;
      await sql`
        INSERT INTO stock_movements
          (shop_id, product_id, product_name_snapshot, movement_type, quantity_change,
           quantity_base_unit, display_quantity, unit, batch_id, old_stock_base_unit, new_stock_base_unit,
           cost_price_snapshot, selling_price_snapshot, movement_date, reason, owner_id, created_by)
        VALUES
          (${context.shopId}, ${created[0].product_id}, ${title}, 'opening_stock', ${openingStockBaseUnit},
           ${openingStockBaseUnit}, ${openingStock}, ${primaryUnit}, ${batchRows[0]?.batch_id || null}, 0, ${openingStockBaseUnit},
           ${costPrice}, ${sellingPrice}, NOW(), 'Opening stock', ${context.shopOwnerId}, ${context.userId})
      `;
    }
    await writeAuditEvent(
      context,
      "product.create",
      "product",
      created[0].product_id,
      { title, openingStockBaseUnit },
    );

    return Response.json({ product: created[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/products", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
