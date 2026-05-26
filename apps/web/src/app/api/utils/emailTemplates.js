import { getAppUrl } from "./email";

const BRAND = "⌬ 𝙈𝘿𝙓 𝗕𝗜𝗟𝗟𝗜𝗡𝗚 𝗔𝗣𝗣 ⌬";
const ORANGE = "#f97316";
const DARK = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG = "#f6f7fb";

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

function receiptMetric(label, valueHtml, { strong = false, border = false } = {}) {
  return `
    <div style="${border ? `border-top:1px solid ${BORDER};` : ""}padding:${border ? "10px 0 4px" : "5px 0"};box-sizing:border-box;max-width:100%;">
      <div style="color:${MUTED};font-size:12px;line-height:1.35;margin-bottom:3px;">${escapeHtml(label)}</div>
      <div style="color:${DARK};font-size:${strong ? "18px" : "13px"};line-height:1.3;font-weight:${strong ? "900" : "800"};word-break:break-word;overflow-wrap:anywhere;max-width:100%;">${valueHtml}</div>
    </div>`;
}

function roleLabel(role) {
  return role === "manager" ? "Manager" : "Cashier";
}

function wrapper(inner) {
  return `
  <div style="margin:0;padding:0;background:${BG};font-family:Inter,Arial,sans-serif;color:${DARK};">
    <div style="max-width:680px;margin:0 auto;padding:28px 14px;">
      ${inner}
    </div>
  </div>`;
}

export function teamInviteEmailTemplate({ shop, invitedName, role, inviterName, inviteUrl }) {
  const appUrl = getAppUrl();
  const logo = imageUrl(shop?.shop_logo, `${appUrl}/logo.png`);
  const invitee = text(invitedName, "there");
  const shopName = text(shop?.shop_name, "Your shop");
  const roleText = roleLabel(role);

  return wrapper(`
    <div style="background:#ffffff;border:1px solid ${BORDER};border-radius:28px;box-shadow:0 24px 70px rgba(15,23,42,0.12);overflow:hidden;">
      <div style="height:8px;background:linear-gradient(90deg,${ORANGE},#fb923c);"></div>
      <div style="padding:32px 24px;text-align:center;">
        <img src="${escapeHtml(logo)}" alt="MDX Billing" width="76" height="76" style="width:76px;height:76px;border-radius:999px;object-fit:cover;border:4px solid #fff;box-shadow:0 12px 28px rgba(249,115,22,0.28);display:block;margin:0 auto 18px;" />
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:${ORANGE};font-weight:800;margin-bottom:10px;">${escapeHtml(BRAND)}</div>
        <h1 style="margin:0;color:${DARK};font-size:28px;line-height:1.15;font-weight:900;">You are invited to join MDX Billing App</h1>
        <p style="margin:14px auto 0;max-width:480px;color:${MUTED};font-size:15px;line-height:1.6;">Hi ${invitee}, ${text(inviterName, "the shop owner")} invited you to access <strong style="color:${DARK};">${shopName}</strong>.</p>
        <div style="margin:24px auto 8px;max-width:420px;background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:18px;text-align:left;">
          <div style="font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Shop</div>
          <div style="font-size:18px;color:${DARK};font-weight:800;margin-top:4px;">${shopName}</div>
          <div style="margin-top:14px;">
            <span style="display:inline-block;background:${ORANGE};color:#fff;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:800;">${escapeHtml(roleText)}</span>
          </div>
        </div>
        <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;margin-top:22px;background:${ORANGE};color:#ffffff;text-decoration:none;border-radius:16px;padding:15px 24px;font-weight:900;font-size:15px;box-shadow:0 14px 32px rgba(249,115,22,0.35);">Accept Invitation</a>
        <p style="margin:18px auto 0;max-width:520px;color:${MUTED};font-size:12px;line-height:1.6;">If the button does not work, open this link:<br><a href="${escapeHtml(inviteUrl)}" style="color:${ORANGE};word-break:break-all;">${escapeHtml(inviteUrl)}</a></p>
      </div>
      <div style="border-top:1px solid ${BORDER};padding:18px 24px;text-align:center;color:${MUTED};font-size:12px;line-height:1.5;">If you did not expect this invitation, you can ignore this email.</div>
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
  const rows = items
    .map((item) => {
      const name = item.productNameSnapshot || item.title || item.name || "Item";
      const qty = item.quantity || 0;
      const unit = item.selectedUnit || item.unit || "";
      const price = item.pricePerUnitAtSale ?? item.unitPrice ?? item.price ?? 0;
      const discount = item.discountAmount ?? item.discount ?? 0;
      const total = item.totalAmount ?? item.subtotal ?? 0;
      const productImage = imageUrl(item.imageSnapshot || item.imageUrl, "");
      return `
        <div style="border:1px solid ${BORDER};border-radius:16px;padding:12px;margin-bottom:10px;background:#ffffff;box-sizing:border-box;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;">
            <tr>
              ${productImage ? `
              <td width="50" style="width:50px;vertical-align:top;padding-right:10px;">
                <img src="${productImage}" alt="${text(name)}" width="42" height="42" style="width:42px;height:42px;border-radius:12px;object-fit:cover;border:1px solid ${BORDER};display:block;" />
              </td>` : ""}
              <td style="vertical-align:middle;min-width:0;">
                <div style="font-size:14px;line-height:1.35;color:${DARK};font-weight:900;word-break:break-word;overflow-wrap:anywhere;">${text(name)}</div>
              </td>
            </tr>
          </table>
          <div style="margin-top:10px;">
            ${receiptMetric("Qty", `${escapeHtml(qty)} ${text(unit, "")}`)}
            ${receiptMetric("Unit price", escapeHtml(money(price, currency)))}
            ${Number(discount) ? receiptMetric("Discount", escapeHtml(money(discount, currency))) : ""}
            ${receiptMetric("Amount", escapeHtml(money(total, currency)), { strong: true, border: true })}
          </div>
        </div>`;
    })
    .join("");

  return wrapper(`
    <div style="background:#ffffff;border:1px solid ${BORDER};border-radius:28px;box-shadow:0 24px 70px rgba(15,23,42,0.12);overflow:hidden;color-scheme:light only;max-width:100%;box-sizing:border-box;">
      <div style="height:8px;background:linear-gradient(90deg,${ORANGE},#fb923c);"></div>
      <div style="padding:26px 22px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td width="76" style="width:76px;vertical-align:top;">
              <img src="${logo}" alt="${shopName}" width="64" height="64" style="width:64px;height:64px;border-radius:999px;object-fit:cover;border:1px solid ${BORDER};display:block;" />
            </td>
            <td style="vertical-align:middle;">
            <div style="font-size:20px;line-height:1.2;font-weight:900;color:${DARK};word-break:break-word;">${shopName}</div>
            <div style="font-size:12px;line-height:1.5;color:${MUTED};">${text(activeShop.address, "")}</div>
            <div style="font-size:12px;line-height:1.5;color:${MUTED};">${activeShop.phone ? `Phone: ${text(activeShop.phone)}` : ""}</div>
            <div style="font-size:12px;line-height:1.5;color:${MUTED};">${activeShop.email ? `Email: ${text(activeShop.email)}` : ""}</div>
            </td>
          </tr>
        </table>
        <div style="margin-top:22px;display:inline-block;background:#fff7ed;color:${ORANGE};border:1px solid #fed7aa;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900;">Receipt #${text(sale?.receipt_number)}</div>
        <h1 style="margin:14px 0 4px;color:${DARK};font-size:26px;line-height:1.15;font-weight:900;">Your receipt is ready</h1>
        <p style="margin:0;color:${MUTED};font-size:14px;line-height:1.6;">Thank you for shopping with ${shopName}.</p>

        <div style="margin-top:20px;background:#f9fafb;border:1px solid ${BORDER};border-radius:18px;padding:14px;box-sizing:border-box;max-width:100%;">
          ${receiptMetric("Date & time", escapeHtml(dateTime(sale?.created_at)))}
          ${receiptMetric("Customer", text(sale?.buyer_name, "Walk-in Customer"))}
          ${receiptMetric("Customer email", text(sale?.customer_email))}
        </div>

        <div style="margin-top:20px;">
          <div style="background:#111827;color:#ffffff;border-radius:14px;padding:11px 12px;font-size:12px;font-weight:900;">Products</div>
          <div style="margin-top:10px;">${rows || `<div style="padding:16px;text-align:center;color:${MUTED};font-size:13px;border:1px solid ${BORDER};border-radius:16px;">No items</div>`}</div>
        </div>

        <div style="margin-top:18px;margin-left:auto;max-width:360px;background:#fff7ed;border:1px solid #fed7aa;border-radius:18px;padding:15px;box-sizing:border-box;">
          ${receiptMetric("Subtotal", escapeHtml(money(subtotal, currency)))}
          ${receiptMetric("Discount", escapeHtml(money(sale?.discount_amount, currency)))}
          ${receiptMetric("Tax/GST", escapeHtml(money(sale?.tax_amount, currency)))}
          ${receiptMetric("Grand total", escapeHtml(money(sale?.total_amount, currency)), { strong: true, border: true })}
          ${receiptMetric("Payment", text(String(sale?.payment_method || "cash").replace("_", " ")))}
          ${receiptMetric("Paid", escapeHtml(money(sale?.paid_amount, currency)))}
          ${receiptMetric("Balance / change", escapeHtml(money(balance, currency)))}
        </div>

        <div style="text-align:center;margin-top:24px;">
          <a href="${escapeHtml(receiptUrl)}" style="display:inline-block;background:${ORANGE};color:#ffffff;text-decoration:none;border-radius:16px;padding:14px 22px;font-weight:900;font-size:14px;box-shadow:0 14px 32px rgba(249,115,22,0.28);">View Receipt</a>
          ${downloadUrl ? `<a href="${escapeHtml(downloadUrl)}" style="display:inline-block;margin-left:8px;margin-top:8px;background:#111827;color:#ffffff;text-decoration:none;border-radius:16px;padding:14px 22px;font-weight:900;font-size:14px;">Download PDF</a>` : ""}
          <p style="margin:18px 0 0;color:${MUTED};font-size:13px;">${text(activeShop.thank_you_message, "Thank you for your purchase!")}</p>
        </div>
      </div>
      <div style="border-top:1px solid ${BORDER};padding:18px 24px;text-align:center;color:${MUTED};font-size:12px;line-height:1.5;">Powered by ${escapeHtml(BRAND)}</div>
    </div>
  `);
}
