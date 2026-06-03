import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createPublicReceiptToken, verifyPublicReceiptToken } from "./publicReceiptToken";

const ORIGINAL_ENV = { ...process.env };
const sale = {
  sale_id: 7,
  shop_id: 3,
  receipt_number: "MDX-7",
};

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.PUBLIC_RECEIPT_SECRET;
  delete process.env.AUTH_SECRET;
  delete process.env.SESSION_SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("public receipt token security", () => {
  test("verifies configured HMAC tokens without logging token material", () => {
    process.env.PUBLIC_RECEIPT_SECRET = "test-public-receipt-secret";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const token = createPublicReceiptToken(sale);

    expect(verifyPublicReceiptToken(sale, token)).toBe(true);
    expect(verifyPublicReceiptToken(sale, `${token}x`)).toBe(false);
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("refuses the local fallback secret in production", () => {
    process.env.NODE_ENV = "production";

    expect(() => createPublicReceiptToken(sale)).toThrow(
      "PUBLIC_RECEIPT_SECRET or AUTH_SECRET is required",
    );
  });
});
