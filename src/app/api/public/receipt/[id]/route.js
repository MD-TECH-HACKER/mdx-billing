import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import { verifyPublicReceiptToken } from "@/app/api/utils/publicReceiptToken";

function parseSaleId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request, { params }) {
  try {
    await ensureBusinessFeatureSchema();
    const id = parseSaleId(params.id);
    if (!id) return Response.json({ error: "Invalid receipt" }, { status: 400 });

    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const rows = await sql`
      SELECT
        s.sale_id, s.shop_id, s.customer_id, s.receipt_number, s.buyer_name,
        s.buyer_phone, s.customer_email, s.items, s.total_amount,
        s.total_quantity, s.tax_amount, s.discount_amount, s.paid_amount,
        s.due_date, s.payment_status, s.payment_method, s.notes,
        s.sale_status, s.currency_snapshot, s.tax_percent_snapshot,
        s.shop_snapshot, s.created_at, s.updated_at,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.shop_name')), sh.shop_name) AS shop_name,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.shop_description')), sh.shop_description) AS shop_description,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.shop_logo')), sh.shop_logo) AS shop_logo,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.address')), sh.address) AS address,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.phone')), sh.phone) AS phone,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.email')), sh.email) AS email,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.gstin')), sh.gstin) AS gstin,
        COALESCE(s.currency_snapshot, sh.currency) AS currency,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.thank_you_message')), sh.thank_you_message) AS thank_you_message,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.default_terms')), sh.default_terms) AS default_terms,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.receipt_size')), sh.receipt_size, 'a4') AS receipt_size,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.print_mode')), sh.print_mode, 'color') AS print_mode,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(s.shop_snapshot, '$.default_invoice_type')), sh.default_invoice_type, 'tax_invoice') AS invoice_type
      FROM sales s
      JOIN shops sh ON sh.shop_id = s.shop_id
      WHERE s.sale_id = ${id}
      LIMIT 1
    `;
    const sale = rows[0];
    if (!sale || !verifyPublicReceiptToken(sale, token)) {
      return Response.json({ error: "Receipt link is invalid" }, { status: 403 });
    }
    return Response.json({ sale });
  } catch (error) {
    console.error("GET /api/public/receipt/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
