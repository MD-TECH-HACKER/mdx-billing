import { describe, expect, test } from "vitest";
import { calculateInvoiceTotals } from "./invoiceTotals";

describe("invoice totals", () => {
  test("calculates discount before tax and rounds currency amounts", () => {
    expect(calculateInvoiceTotals(100, 18, 10)).toEqual({
      subtotal: 100,
      discountAmount: 10,
      taxableAmount: 90,
      taxAmount: 16.2,
      grandTotal: 106.2,
    });
  });

  test("does not allow discount to exceed the subtotal", () => {
    expect(calculateInvoiceTotals(50, 5, 80)).toEqual({
      subtotal: 50,
      discountAmount: 50,
      taxableAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
    });
  });
});
