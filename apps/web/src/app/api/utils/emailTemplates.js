import { getAppUrl } from "./email";

const BRAND = "⌬ 𝙈𝘿𝙓 𝗕𝗜𝗟𝗟𝗜𝗡𝗚 𝗔𝗣𝗣 ⌬";
const ORANGE = "#f97316";
const DARK = "#1f2937";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG = "#f9fafb";

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
  if (raw.startsWith("data:image/")) return raw;
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
<body style="margin: 0; padding: 0; background-color: ${BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: ${BG};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <!-- Main Card -->
        <table border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border: 1px solid ${BORDER}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Orange Header Line -->
          <tr>
            <td height="6" style="background-color: ${ORANGE};"></td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              ${inner}
            </td>
          </tr>
        </table>
        <!-- Footer -->
        <table border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td align="center" style="padding-top: 24px; color: ${MUTED}; font-size: 13px;">
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
  const logo = imageUrl(shop?.shop_logo, `${appUrl}/logo.png`);
  const invitee = text(invitedName, "there");
  const shopName = text(shop?.shop_name, "Your shop");
  const roleText = role === "manager" ? "Manager" : "Cashier";

  return wrapper(`
    <div style="text-align: center;">
      <img src="${logo}" alt="MDX Billing" width="64" height="64" style="border-radius: 12px; margin-bottom: 24px; display: inline-block; border: 1px solid ${BORDER};" />
      <h1 style="margin: 0 0 16px 0; font-size: 24px; color: ${DARK}; font-weight: 700;">You're invited!</h1>
      <p style="margin: 0 0 32px 0; font-size: 16px; color: ${MUTED}; line-height: 1.6;">
        Hi ${invitee},<br>
        <strong>${text(inviterName, "The shop owner")}</strong> has invited you to join <strong>${shopName}</strong> as a <strong>${escapeHtml(roleText)}</strong>.
      </p>
      
      <a href="${escapeHtml(inviteUrl)}" style="display: inline-block; background-color: ${ORANGE}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">Accept Invitation</a>
      
      <p style="margin: 32px 0 0 0; font-size: 13px; color: ${MUTED}; line-height: 1.5;">
        If the button doesn't work, copy and paste this URL into your browser:<br>
        <a href="${escapeHtml(inviteUrl)}" style="color: ${ORANGE}; text-decoration: none; word-break: break-all;">${escapeHtml(inviteUrl)}</a>
      </p>
    </div>
  `);
}

export function receiptEmailTemplate({ sale, shop, receiptUrl, downloadUrl }) {
  const appUrl = getAppUrl();
  const activeShop = shop || sale || {};
  const logo = imageUrl(activeShop.shop_logo, `${appUrl}/logo.png`);
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
    items.forEach((item) => {
      const name = item.productNameSnapshot || item.title || item.name || "Item";
      const qty = item.quantity || 0;
      const unit = item.selectedUnit || item.unit || "";
      const price = item.pricePerUnitAtSale ?? item.unitPrice ?? item.price ?? 0;
      const total = item.totalAmount ?? item.subtotal ?? 0;

      itemsHtml += `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid ${BORDER};">
            <div style="font-size: 15px; font-weight: 600; color: ${DARK}; margin-bottom: 4px;">${text(name)}</div>
            <div style="font-size: 13px; color: ${MUTED};">${escapeHtml(qty)} ${text(unit, "")} x ${escapeHtml(money(price, currency))}</div>
          </td>
          <td align="right" style="padding: 16px 0; border-bottom: 1px solid ${BORDER}; font-size: 15px; font-weight: 600; color: ${DARK};">
            ${escapeHtml(money(total, currency))}
          </td>
        </tr>`;
    });
    itemsHtml += `</table>`;
  } else {
    itemsHtml = `<div style="margin-top: 24px; padding: 16px; text-align: center; color: ${MUTED}; font-size: 14px; border: 1px dashed ${BORDER}; border-radius: 8px;">No items</div>`;
  }

  return wrapper(`
    <!-- Shop Info -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="64" style="vertical-align: top; padding-right: 16px;">
          <img src="${logo}" alt="${shopName}" width="64" height="64" style="border-radius: 8px; border: 1px solid ${BORDER}; display: block;" />
        </td>
        <td style="vertical-align: middle;">
          <h1 style="margin: 0 0 4px 0; font-size: 22px; color: ${DARK}; font-weight: 700;">${shopName}</h1>
          <div style="font-size: 13px; color: ${MUTED}; line-height: 1.5;">${text(activeShop.address, "")}</div>
          <div style="font-size: 13px; color: ${MUTED}; line-height: 1.5;">${activeShop.phone ? text(activeShop.phone) : ""}</div>
        </td>
      </tr>
    </table>

    <!-- Receipt Header -->
    <div style="margin-top: 32px; background-color: #fff7ed; border: 1px solid #ffedd5; border-radius: 8px; padding: 16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: ${ORANGE}; letter-spacing: 0.05em;">Receipt</div>
            <div style="font-size: 16px; font-weight: 700; color: #9a3412; margin-top: 4px;">#${text(sale?.receipt_number)}</div>
          </td>
          <td align="right" style="text-align: right;">
            <div style="font-size: 12px; color: #c2410c;">Date</div>
            <div style="font-size: 14px; font-weight: 600; color: #9a3412; margin-top: 4px;">${escapeHtml(dateTime(sale?.created_at))}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    ${itemsHtml}

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
      <tr>
        <td width="50%"></td>
        <td width="50%">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${MUTED};">Subtotal</td>
              <td align="right" style="padding: 8px 0; font-size: 14px; color: ${DARK}; font-weight: 500;">${escapeHtml(money(subtotal, currency))}</td>
            </tr>
            ${Number(sale?.discount_amount) ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${MUTED};">Discount</td>
              <td align="right" style="padding: 8px 0; font-size: 14px; color: #16a34a; font-weight: 500;">-${escapeHtml(money(sale?.discount_amount, currency))}</td>
            </tr>` : ""}
            ${Number(sale?.tax_amount) ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${MUTED};">Tax</td>
              <td align="right" style="padding: 8px 0; font-size: 14px; color: ${DARK}; font-weight: 500;">${escapeHtml(money(sale?.tax_amount, currency))}</td>
            </tr>` : ""}
            <tr>
              <td style="padding: 12px 0; font-size: 16px; color: ${DARK}; font-weight: 700; border-top: 2px solid ${BORDER};">Total</td>
              <td align="right" style="padding: 12px 0; font-size: 18px; color: ${DARK}; font-weight: 800; border-top: 2px solid ${BORDER};">${escapeHtml(money(sale?.total_amount, currency))}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: ${MUTED};">Paid (${text(String(sale?.payment_method || "cash").replace("_", " "))})</td>
              <td align="right" style="padding: 8px 0; font-size: 14px; color: ${DARK}; font-weight: 500;">${escapeHtml(money(sale?.paid_amount, currency))}</td>
            </tr>
            ${balance > 0 ? `
            <tr>
              <td style="padding: 8px 0; font-size: 14px; color: #dc2626; font-weight: 600;">Balance Due</td>
              <td align="right" style="padding: 8px 0; font-size: 14px; color: #dc2626; font-weight: 700;">${escapeHtml(money(balance, currency))}</td>
            </tr>` : ""}
          </table>
        </td>
      </tr>
    </table>

    <!-- Actions -->
    <div style="margin-top: 40px; text-align: center;">
      <a href="${escapeHtml(receiptUrl)}" style="display: inline-block; background-color: ${ORANGE}; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px;">View Full Receipt</a>
      ${downloadUrl ? `<div style="margin-top: 16px;"><a href="${escapeHtml(downloadUrl)}" style="color: ${ORANGE}; text-decoration: none; font-size: 14px; font-weight: 500;">Download PDF</a></div>` : ""}
    </div>

    <!-- Thank you -->
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid ${BORDER}; text-align: center; color: ${MUTED}; font-size: 14px; line-height: 1.6;">
      ${text(activeShop.thank_you_message, "Thank you for your business!")}
    </div>
  `);
}
