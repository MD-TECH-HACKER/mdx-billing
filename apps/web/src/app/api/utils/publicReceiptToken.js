import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "./email";

function secret() {
  return (
    process.env.PUBLIC_RECEIPT_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.RESEND_API_KEY ||
    "mdx-local-public-receipt-secret"
  );
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
  if (!received) {
    console.log("verifyPublicReceiptToken: No received token provided");
    return false;
  }
  const expected = createPublicReceiptToken(sale);
  console.log("verifyPublicReceiptToken: verifying sale", sale?.sale_id);
  console.log("verifyPublicReceiptToken: payload =", [sale?.sale_id, sale?.shop_id, sale?.receipt_number].map(v => String(v || "")).join("|"));
  console.log("verifyPublicReceiptToken: expected =", expected);
  console.log("verifyPublicReceiptToken: received =", received);
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  const match = (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
  console.log("verifyPublicReceiptToken: match result =", match);
  return match;
}

export function publicReceiptUrl(sale, { download = false } = {}) {
  const appUrl = getAppUrl();
  const token = createPublicReceiptToken(sale);
  const url = new URL(`/receipt/${sale.sale_id}`, appUrl);
  url.searchParams.set("token", token);
  if (download) url.searchParams.set("download", "1");
  return url.toString();
}
