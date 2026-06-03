import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "./email";

function secret() {
  const configuredSecret = (
    process.env.PUBLIC_RECEIPT_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET
  );

  if (configuredSecret) return configuredSecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PUBLIC_RECEIPT_SECRET or AUTH_SECRET is required for public receipt links.");
  }

  return "mdx-local-public-receipt-secret";
}

function payloadForSale(sale) {
  return [
    sale?.sale_id,
    sale?.shop_id,
    sale?.receipt_number,
  ].map((value) => String(value || "")).join("|");
}

export function createPublicReceiptToken(sale) {
  return createHmac("sha256", secret())
    .update(payloadForSale(sale))
    .digest("base64url");
}

export function verifyPublicReceiptToken(sale, token) {
  const received = String(token || "");
  if (!received) return false;
  const expected = createPublicReceiptToken(sale);
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function publicReceiptUrl(sale, { download = false } = {}) {
  const appUrl = getAppUrl();
  const token = createPublicReceiptToken(sale);
  const url = new URL(`/receipt/${sale.sale_id}`, appUrl);
  url.searchParams.set("token", token);
  if (download) url.searchParams.set("download", "1");
  return url.toString();
}
