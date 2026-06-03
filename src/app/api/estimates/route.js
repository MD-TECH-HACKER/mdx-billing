import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { calculateLineGst } from "@/app/api/utils/gst";
import { priceForUnit } from "@/utils/productUnits";

function money(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "sale.read");
    await ensureBusinessFeatureSchema();
    const estimates = await sql`
      SELECT *
      FROM estimates
      WHERE shop_id = ${context.shopId}
      ORDER BY created_at DESC
      LIMIT 500
    `;
    return Response.json({ estimates });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/estimates", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "sale.write");
    await ensureBusinessFeatureSchema();
    const body = await request.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length) return Response.json({ error: "Add at least one estimate item" }, { status: 400 });

    const productIds = [
      ...new Set(
        rawItems
          .map((item) => Number.parseInt(item.productId, 10))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
    let productMap = {};
    if (productIds.length) {
      const placeholders = productIds.map(() => "?").join(",");
      const products = await sql(
        `SELECT * FROM products WHERE shop_id = ? AND product_id IN (${placeholders})`,
        [context.shopId, ...productIds],
      );
      productMap = Object.fromEntries(products.map((product) => [product.product_id, product]));
    }

    const shopStateCode = String(context.shop.state_code || "").trim().slice(0, 2);
    const customerStateCode = String(body.customerStateCode || "").trim().slice(0, 2) || null;
    const lineItems = rawItems.map((item) => {
      const productId = Number.parseInt(item.productId, 10);
      const product = Number.isInteger(productId) ? productMap[productId] : null;
      if (Number.isInteger(productId) && !product) throw new Error("Product not found");
      const quantity = Math.max(0, Number(item.quantity) || 0);
      if (quantity <= 0) throw new Error("Quantity must be greater than zero");
      const selectedUnit = String(item.selectedUnit || item.unit || product?.primary_unit || "pcs").slice(0, 30);
      const price = product
        ? priceForUnit(product.selling_price, selectedUnit, product)
        : Math.max(0, Number(item.price) || 0);
      const taxRate = Math.max(0, Math.min(100, Number(item.taxRate ?? product?.gst_rate ?? product?.tax_rate) || 0));
      const amounts = calculateLineGst({
        quantity,
        unitPrice: price,
        discount: item.discount,
        gstRate: taxRate,
        taxMode: item.taxMode || product?.tax_mode || context.shop.tax_mode || "exclusive",
        shopStateCode,
        customerStateCode,
        exempted: product?.gst_exempt,
      });
      return {
        productId: product?.product_id || null,
        productNameSnapshot: product?.title || String(item.name || "Estimate item").trim().slice(0, 150),
        title: product?.title || String(item.name || "Estimate item").trim().slice(0, 150),
        imageSnapshot: product?.image_url || null,
        hsnSacSnapshot: product?.hsn_sac || String(item.hsnSac || "").trim().slice(0, 30) || null,
        selectedUnit,
        quantity,
        pricePerUnitAtSale: price,
        unitPrice: price,
        ...amounts,
      };
    });

    const subtotal = money(lineItems.reduce((sum, item) => sum + item.taxableValue, 0));
    const discountAmount = money(Math.min(subtotal, Math.max(0, Number(body.discountAmount) || 0)));
    const taxableAmount = money(subtotal - discountAmount);
    const taxAmount = money(lineItems.reduce((sum, item) => sum + item.taxAmount, 0));
    const cgstAmount = money(lineItems.reduce((sum, item) => sum + item.cgstAmount, 0));
    const sgstAmount = money(lineItems.reduce((sum, item) => sum + item.sgstAmount, 0));
    const igstAmount = money(lineItems.reduce((sum, item) => sum + item.igstAmount, 0));
    const totalAmount = money(taxableAmount + taxAmount);
    const estimateNumber = `${context.shop.receipt_prefix || "EST"}-EST-${Date.now()}`;
    const customerName = String(body.customerName || body.buyerName || "").trim().slice(0, 100) || null;
    const customerPhone = String(body.customerPhone || body.buyerPhone || "").trim().slice(0, 50) || null;
    const customerEmail = String(body.customerEmail || "").trim().toLowerCase().slice(0, 254) || null;
    const notes = String(body.notes || "").trim().slice(0, 800) || null;
    const terms = String(body.terms || context.shop.default_terms || "").trim().slice(0, 800) || null;
    const validUntil = String(body.validUntil || "").slice(0, 10) || null;

    const insertResult = await sql`
      INSERT INTO estimates
        (shop_id, owner_id, estimate_number, customer_name, customer_phone, customer_email,
         customer_gstin, billing_address, place_of_supply, valid_until, items,
         subtotal, discount_amount, taxable_amount, tax_amount, cgst_amount, sgst_amount,
         igst_amount, total_amount, notes, terms, status, created_by)
      VALUES
        (${context.shopId}, ${context.shopOwnerId}, ${estimateNumber}, ${customerName}, ${customerPhone}, ${customerEmail},
         ${String(body.customerGstin || "").trim().toUpperCase().slice(0, 20) || null},
         ${String(body.billingAddress || "").trim().slice(0, 500) || null},
         ${String(body.placeOfSupply || "").trim().slice(0, 100) || null},
         ${validUntil}, ${JSON.stringify(lineItems)},
         ${subtotal}, ${discountAmount}, ${taxableAmount}, ${taxAmount}, ${cgstAmount}, ${sgstAmount},
         ${igstAmount}, ${totalAmount}, ${notes}, ${terms}, 'draft', ${context.userId})
    `;
    const estimateId = insertResult[0].insertId;
    const created = await sql`SELECT * FROM estimates WHERE estimate_id = ${estimateId}`;
    await writeAuditEvent(context, "estimate.create", "estimate", created[0].estimate_id, {
      estimateNumber,
      totalAmount,
    });
    return Response.json({ estimate: created[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (/product|quantity/i.test(String(error?.message))) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/estimates", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
