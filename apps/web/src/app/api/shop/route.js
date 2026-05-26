import sql from "@/app/api/utils/sql";
import { ensureCoreBusinessSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireAuthenticatedUser,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";

export async function GET(request) {
  try {
    await ensureCoreBusinessSchema();
    const context = await requireShopAccess(request, "shop.read");
    return Response.json({ shop: context.shop, role: context.role });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/shop", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId } = await requireAuthenticatedUser();
    await ensureCoreBusinessSchema();

    const body = await request.json();
    const shopName = (body.shopName || "").toString().trim().slice(0, 100);
    const shopDescription = (body.shopDescription || "")
      .toString()
      .trim()
      .slice(0, 500);
    const shopLogo = (body.shopLogo || "").toString().trim() || null;
    const address = (body.address || "").toString().trim().slice(0, 300) || null;
    const phone = (body.phone || "").toString().trim().slice(0, 50) || null;

    if (!shopName) {
      return Response.json({ error: "Shop name is required" }, { status: 400 });
    }

    const created = await sql`
      INSERT INTO shops (owner_id, shop_name, shop_description, shop_logo, address, phone, currency)
      VALUES (${userId}, ${shopName}, ${shopDescription}, ${shopLogo}, ${address}, ${phone}, 'INR')
      RETURNING *
    `;
    const shop = created[0];
    await writeAuditEvent(
      { userId, role: "owner", shopId: shop.shop_id },
      "shop.create",
      "shop",
      shop.shop_id,
      { shopName: shop.shop_name },
    );

    return Response.json({ shop }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/shop", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    await ensureCoreBusinessSchema();
    const context = await requireShopAccess(request, "shop.update");
    const body = await request.json();
    const fields = {};

    if (typeof body.shopName === "string")
      fields.shop_name = body.shopName.trim().slice(0, 100);
    if (typeof body.shopDescription === "string")
      fields.shop_description = body.shopDescription.trim().slice(0, 500);
    if (typeof body.shopLogo === "string")
      fields.shop_logo = body.shopLogo.trim() || null;
    if (typeof body.address === "string")
      fields.address = body.address.trim().slice(0, 300) || null;
    if (typeof body.phone === "string")
      fields.phone = body.phone.trim().slice(0, 50) || null;
    if (typeof body.receiptPrefix === "string")
      fields.receipt_prefix = body.receiptPrefix.trim().slice(0, 10) || "INV";
    if (typeof body.taxPercent === "number")
      fields.tax_percent = Math.max(0, Math.min(100, body.taxPercent));
    if (typeof body.currency === "string")
      fields.currency = body.currency.trim().slice(0, 10).toUpperCase();
    if (typeof body.thankYouMessage === "string")
      fields.thank_you_message = body.thankYouMessage.trim().slice(0, 300);
    if (typeof body.theme === "string")
      fields.theme = body.theme.trim().slice(0, 20);
    if (typeof body.accentColor === "string")
      fields.accent_color = body.accentColor.trim().slice(0, 20);
    if (typeof body.gstin === "string")
      fields.gstin = body.gstin.trim().toUpperCase().slice(0, 20) || null;
    if (typeof body.defaultInvoiceType === "string")
      fields.default_invoice_type = ["tax_invoice", "receipt"].includes(body.defaultInvoiceType)
        ? body.defaultInvoiceType
        : "tax_invoice";
    if (typeof body.defaultPaymentMethod === "string")
      fields.default_payment_method = ["cash", "credit", "upi", "bank"].includes(body.defaultPaymentMethod)
        ? body.defaultPaymentMethod
        : "cash";
    if (typeof body.defaultTerms === "string")
      fields.default_terms = body.defaultTerms.trim().slice(0, 800) || null;
    if (typeof body.receiptSize === "string")
      fields.receipt_size = ["a4", "thermal", "small"].includes(body.receiptSize)
        ? body.receiptSize
        : "a4";
    if (typeof body.printMode === "string")
      fields.print_mode = ["color", "bw"].includes(body.printMode) ? body.printMode : "color";
    if (Array.isArray(body.customUnits)) {
      const customUnits = [
        ...new Set(
          body.customUnits
            .map((unit) => String(unit || "").trim().slice(0, 30))
            .filter(Boolean),
        ),
      ].slice(0, 50);
      fields.custom_units = JSON.stringify(customUnits);
    }
    const keys = Object.keys(fields);
    if (keys.length === 0) {
      return Response.json({ error: "No fields" }, { status: 400 });
    }

    const values = keys.map((key) => fields[key]);
    values.push(context.shopId);
    const setClauses = keys.map((key, index) =>
      key === "custom_units"
        ? `${key} = $${index + 1}::jsonb`
        : `${key} = $${index + 1}`,
    );
    const query = `UPDATE shops SET ${setClauses.join(", ")}, updated_at = NOW() WHERE shop_id = $${values.length} RETURNING *`;
    const result = await sql(query, values);

    if (!result[0]) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await writeAuditEvent(context, "shop.update", "shop", context.shopId, {
      changedFields: keys,
    });
    return Response.json({ shop: result[0] });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("PUT /api/shop", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
