import { getAppUrl } from "./email";

const BRAND = "MDX Billing App";
// Flipkart inspired colors
const BG = "#000000"; // Pure black background
const CARD_BG = "#09090b"; // Very dark grey
const HEADER_BG = "#2874f0"; // Flipkart Blue
const TEXT_LIGHT = "#ffffff";
const TEXT_MUTED = "#878787"; // Flipkart grey text
const BORDER = "#212121"; 
const ACCENT = "#fb641b"; // Flipkart orange

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function imageUrl(value, fallback) {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("data:image/")) return fallback; // STRIP BASE64
  if (raw.startsWith("/")) return `${getAppUrl()}${raw}`;
  return fallback;
}

function money(value, currency = "INR") {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateTime(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-IN");
}

function text(value, fallback = "-") {
  const trimmed = String(value ?? "").trim();
  return escapeHtml(trimmed || fallback);
}

function wrapper(inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Receipt</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: ${TEXT_LIGHT};">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${BG}; width: 100%;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" style="max-width: 640px; width: 100%; background-color: ${CARD_BG}; border: 1px solid ${BORDER};">
          ${inner}
        </table>
        <!-- Footer -->
        <table border="0" cellpadding="0" cellspacing="0" style="max-width: 640px; width: 100%; margin-top: 16px;">
          <tr>
            <td align="center" style="padding: 16px; color: ${TEXT_MUTED}; font-size: 12px;">
              Powered by ${escapeHtml(BRAND)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function teamInviteEmailTemplate({ shop, invitedName, role, inviterName, inviteUrl }) {
  const appUrl = getAppUrl();
  const appLogo = `${appUrl}/logo.png`;
  const logo = imageUrl(shop?.shop_logo, appLogo);
  const invitee = text(invitedName, "there");
  const shopName = text(shop?.shop_name, "Your shop");
  const roleText = role === "manager" ? "Manager" : "Cashier";

  return wrapper(`
    <!-- Header -->
    <tr>
      <td style="background-color: ${HEADER_BG}; padding: 16px 24px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 22px; font-weight: 700; color: #ffffff;">
              <img src="${appLogo}" width="28" height="28" style="vertical-align: middle; margin-right: 8px; border-radius: 4px;" alt="Logo" />
              ${escapeHtml(BRAND)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 32px 24px;">
        <div style="text-align: center;">
          <img src="${logo}" alt="Shop Logo" width="64" height="64" style="border-radius: 8px; margin-bottom: 24px; border: 1px solid ${BORDER}; background: #fff;" />
          <h1 style="margin: 0 0 16px 0; font-size: 24px; color: ${TEXT_LIGHT}; font-weight: 600;">You're invited!</h1>
          <p style="margin: 0 0 32px 0; font-size: 15px; color: ${TEXT_MUTED}; line-height: 1.6;">
            Hi ${invitee},<br>
            <strong style="color: ${TEXT_LIGHT};">${text(inviterName, "The shop owner")}</strong> has invited you to join <strong style="color: ${TEXT_LIGHT};">${shopName}</strong> as a <strong style="color: ${TEXT_LIGHT};">${escapeHtml(roleText)}</strong>.
          </p>
          <a href="${escapeHtml(inviteUrl)}" style="display: inline-block; background-color: ${HEADER_BG}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 4px;">Accept Invitation</a>
          <p style="margin: 32px 0 0 0; font-size: 12px; color: ${TEXT_MUTED}; line-height: 1.5;">
            If the button doesn't work, copy and paste this URL into your browser:<br>
            <a href="${escapeHtml(inviteUrl)}" style="color: ${HEADER_BG}; text-decoration: none; word-break: break-all;">${escapeHtml(inviteUrl)}</a>
          </p>
        </div>
      </td>
    </tr>
  `);
}

export function receiptEmailTemplate({ sale, shop, receiptUrl, downloadUrl }) {
  const appUrl = getAppUrl();
  const appLogo = `${appUrl}/logo.png`;
  const activeShop = shop || sale || {};
  let logo = appLogo;
  if (activeShop.shop_logo) {
    if (activeShop.shop_logo.startsWith("data:image/")) {
      logo = `${appUrl}/api/public/shops/${activeShop.shop_id}/logo`;
    } else {
      logo = imageUrl(activeShop.shop_logo, appLogo);
    }
  }
  let receiptToken = "";
  let saleId = sale?.sale_id || "";
  if (receiptUrl) {
    try {
      const parsedUrl = new URL(receiptUrl);
      receiptToken = parsedUrl.searchParams.get("token") || "";
      if (!saleId) saleId = parsedUrl.pathname.split("/").pop();
    } catch(e) {}
  }
  const shopName = text(activeShop.shop_name, "Your shop");
  const currency = sale?.currency_snapshot || sale?.currency || activeShop.currency || "INR";
  const items = Array.isArray(sale?.items) ? sale.items : [];
  const subtotal =
    Number(sale?.total_amount || 0) -
    Number(sale?.tax_amount || 0) +
    Number(sale?.discount_amount || 0);
  const balance = Math.max(0, Number(sale?.total_amount || 0) - Number(sale?.paid_amount || 0));

  let itemsHtml = "";
  if (items.length > 0) {
    itemsHtml = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px; border-top: 1px solid ${BORDER};">`;
    items.forEach((item, index) => {
      const name = item.productNameSnapshot || item.title || item.name || "Item";
      const qty = item.quantity || 0;
      const unit = item.selectedUnit || item.unit || "";
      const price = item.pricePerUnitAtSale ?? item.unitPrice ?? item.price ?? 0;
      const total = item.totalAmount ?? item.subtotal ?? 0;
      
      let itemImage = "";
      const rawImage = item.imageSnapshot || item.imageUrl || "";
      if (rawImage.startsWith("data:image/")) {
        itemImage = `${appUrl}/api/public/receipt/${saleId}/items/${index}/image?token=${receiptToken}`;
      } else {
        itemImage = imageUrl(rawImage, "");
      }

      itemsHtml += `
        <tr>
          ${itemImage ? `
          <td width="48" style="vertical-align: top; padding: 16px 12px 16px 0; border-bottom: 1px solid ${BORDER};">
            <img src="${itemImage}" alt="${escapeHtml(name)}" width="48" height="48" style="border-radius: 6px; object-fit: cover; border: 1px solid ${BORDER}; background: #fff;" />
          </td>
          <td style="padding: 16px 0; border-bottom: 1px solid ${BORDER}; vertical-align: top;">
          ` : `
          <td style="padding: 16px 0; border-bottom: 1px solid ${BORDER}; vertical-align: top;" colspan="2">
          `}
            <div style="font-size: 14px; font-weight: 600; color: ${TEXT_LIGHT}; margin-bottom: 6px;">${text(name)}</div>
            <div style="font-size: 12px; color: ${TEXT_MUTED};">Qty: ${escapeHtml(qty)} ${text(unit, "")} &nbsp;|&nbsp; Price: ${escapeHtml(money(price, currency))}</div>
          </td>
          <td align="right" style="padding: 16px 0; border-bottom: 1px solid ${BORDER}; font-size: 14px; font-weight: 600; color: ${TEXT_LIGHT};">
            ${escapeHtml(money(total, currency))}
          </td>
        </tr>`;
    });
    itemsHtml += `</table>`;
  } else {
    itemsHtml = `<div style="margin-top: 24px; padding: 16px; text-align: center; color: ${TEXT_MUTED}; font-size: 14px; border: 1px dashed ${BORDER};">No items</div>`;
  }

  return wrapper(`
    <!-- Header -->
    <tr>
      <td style="background-color: ${HEADER_BG}; padding: 16px 24px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 20px; font-weight: 700; color: #ffffff;">
              <img src="${appLogo}" width="26" height="26" style="vertical-align: middle; margin-right: 8px; border-radius: 4px;" alt="App Logo" />
              ${escapeHtml(BRAND)}
            </td>
            <td align="right" style="font-size: 14px; font-weight: 600; color: #ffffff;">
              Receipt Generated
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Content Body -->
    <tr>
      <td style="padding: 32px 24px;">
        <h2 style="margin: 0 0 8px 0; font-size: 18px; color: ${TEXT_LIGHT}; font-weight: 600;">Hi there,</h2>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: ${TEXT_MUTED};">Thank you for your purchase from ${shopName}.</p>

        <!-- Receipt Status Tracker (Flipkart Style) -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 32px; border: 1px solid ${BORDER}; border-radius: 4px; padding: 16px;">
          <tr>
            <td width="60" style="padding-right: 16px; vertical-align: top;">
               <img src="${logo}" width="60" height="60" style="border-radius: 4px; border: 1px solid ${BORDER}; background: #fff;" alt="Shop Logo" />
            </td>
            <td style="vertical-align: top;">
              <div style="font-size: 16px; font-weight: 600; color: ${TEXT_LIGHT};">${shopName}</div>
              <div style="font-size: 12px; color: ${TEXT_MUTED}; margin-top: 4px;">Receipt: #${text(sale?.receipt_number)}</div>
              <div style="font-size: 12px; color: ${TEXT_MUTED}; margin-top: 2px;">Date: ${escapeHtml(dateTime(sale?.created_at))}</div>
            </td>
          </tr>
        </table>

        <h3 style="margin: 0 0 16px 0; font-size: 16px; color: ${TEXT_LIGHT}; border-bottom: 1px solid ${BORDER}; padding-bottom: 8px;">Order Details</h3>

        <!-- Items -->
        ${itemsHtml}

        <!-- Totals -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
          <tr>
            <td width="30%"></td>
            <td width="70%">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${TEXT_MUTED};">Item(s) Subtotal</td>
                  <td align="right" style="padding: 8px 0; font-size: 13px; color: ${TEXT_LIGHT};">${escapeHtml(money(subtotal, currency))}</td>
                </tr>
                ${Number(sale?.discount_amount) ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${TEXT_MUTED};">Discount</td>
                  <td align="right" style="padding: 8px 0; font-size: 13px; color: #388e3c;">-${escapeHtml(money(sale?.discount_amount, currency))}</td>
                </tr>` : ""}
                ${Number(sale?.tax_amount) ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${TEXT_MUTED};">Tax / GST</td>
                  <td align="right" style="padding: 8px 0; font-size: 13px; color: ${TEXT_LIGHT};">${escapeHtml(money(sale?.tax_amount, currency))}</td>
                </tr>` : ""}
                <tr>
                  <td style="padding: 12px 0; font-size: 15px; color: ${TEXT_LIGHT}; font-weight: 600; border-top: 1px solid ${BORDER}; border-bottom: 1px solid ${BORDER};">Amount Payable</td>
                  <td align="right" style="padding: 12px 0; font-size: 15px; color: ${TEXT_LIGHT}; font-weight: 600; border-top: 1px solid ${BORDER}; border-bottom: 1px solid ${BORDER};">${escapeHtml(money(sale?.total_amount, currency))}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${TEXT_MUTED};">Paid (${text(String(sale?.payment_method || "cash").replace("_", " "))})</td>
                  <td align="right" style="padding: 8px 0; font-size: 13px; color: ${TEXT_LIGHT};">${escapeHtml(money(sale?.paid_amount, currency))}</td>
                </tr>
                ${balance > 0 ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: ${ACCENT}; font-weight: 600;">Balance Due</td>
                  <td align="right" style="padding: 8px 0; font-size: 13px; color: ${ACCENT}; font-weight: 600;">${escapeHtml(money(balance, currency))}</td>
                </tr>` : ""}
              </table>
            </td>
          </tr>
        </table>

        <!-- Actions -->
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-top: 32px;">
          <tr>
            <td align="center">
              <a href="${escapeHtml(receiptUrl)}" style="display: inline-block; background-color: ${HEADER_BG}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 32px; border-radius: 2px;">View Full Receipt</a>
              ${downloadUrl ? `<div style="margin-top: 16px;"><a href="${escapeHtml(downloadUrl)}" style="color: ${HEADER_BG}; text-decoration: none; font-size: 13px; font-weight: 500;">Download PDF</a></div>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer Additional Info -->
    <tr>
      <td style="background-color: #000000; padding: 24px; border-top: 1px solid ${BORDER};">
        <h4 style="margin: 0 0 8px 0; font-size: 13px; color: ${TEXT_LIGHT}; font-weight: 600;">Thank you for shopping with ${shopName}!</h4>
        <p style="margin: 0; font-size: 12px; color: ${TEXT_MUTED};">Got Questions? Please contact the shop directly at ${text(activeShop.phone, "")} or ${text(activeShop.email, "")}.</p>
      </td>
    </tr>
  `);
}
