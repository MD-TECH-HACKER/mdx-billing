import sql from "@/app/api/utils/sql";
import { isValidEmail, normalizeEmail, sendResendEmail } from "./email";
import { receiptEmailTemplate } from "./emailTemplates";
import { publicReceiptUrl } from "./publicReceiptToken";

const RECEIPT_FROM = "MDX Billing Receipts <receipt@mdx-billing.app>";

function shopFromSale(sale) {
  return {
    shop_name: sale.shop_name,
    shop_description: sale.shop_description,
    shop_logo: sale.shop_logo,
    address: sale.address,
    phone: sale.phone,
    email: sale.email,
    gstin: sale.gstin,
    currency: sale.currency,
    thank_you_message: sale.thank_you_message,
    default_terms: sale.default_terms,
  };
}

export async function loadReceiptForEmail(context, saleId) {
  const rows = await sql`
    SELECT s.*,
      COALESCE(s.shop_snapshot->>'shop_name', sh.shop_name) AS shop_name,
      COALESCE(s.shop_snapshot->>'shop_description', sh.shop_description) AS shop_description,
      COALESCE(s.shop_snapshot->>'shop_logo', sh.shop_logo) AS shop_logo,
      COALESCE(s.shop_snapshot->>'address', sh.address) AS address,
      COALESCE(s.shop_snapshot->>'phone', sh.phone) AS phone,
      COALESCE(s.shop_snapshot->>'email', sh.email) AS email,
      COALESCE(s.shop_snapshot->>'gstin', sh.gstin) AS gstin,
      COALESCE(s.currency_snapshot, sh.currency) AS currency,
      COALESCE(s.shop_snapshot->>'thank_you_message', sh.thank_you_message) AS thank_you_message,
      COALESCE(s.shop_snapshot->>'default_terms', sh.default_terms) AS default_terms
    FROM sales s
    JOIN shops sh ON sh.shop_id = s.shop_id
    WHERE s.sale_id = ${saleId} AND s.shop_id = ${context.shopId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function sendReceiptEmailForSale(context, saleId) {
  const sale = await loadReceiptForEmail(context, saleId);
  if (!sale) {
    throw new Error("Receipt not found");
  }

  const customerEmail = normalizeEmail(sale.customer_email);
  if (!isValidEmail(customerEmail)) {
    throw new Error("Customer email is missing or invalid");
  }

  const receiptUrl = publicReceiptUrl(sale);
  const shop = shopFromSale(sale);
  const data = await sendResendEmail({
    from: RECEIPT_FROM,
    to: customerEmail,
    replyTo: shop.email || "info@mdx-billing.app",
    subject: `Your receipt from ${shop.shop_name || "your shop"} - #${sale.receipt_number}`,
    html: receiptEmailTemplate({
      sale,
      shop,
      receiptUrl,
      downloadUrl: publicReceiptUrl(sale, { download: true }),
    }),
  });

  await sql`
    UPDATE sales
    SET receipt_email_sent = TRUE,
        receipt_email_sent_at = NOW(),
        receipt_email_error = NULL,
        email_message_id = ${data?.id || null},
        updated_at = NOW()
    WHERE sale_id = ${saleId} AND shop_id = ${context.shopId}
  `;

  return { sale, messageId: data?.id || null };
}

export async function markReceiptEmailError(context, saleId, error) {
  await sql`
    UPDATE sales
    SET receipt_email_sent = FALSE,
        receipt_email_error = ${String(error?.message || error || "Email failed").slice(0, 500)},
        updated_at = NOW()
    WHERE sale_id = ${saleId} AND shop_id = ${context.shopId}
  `;
}
