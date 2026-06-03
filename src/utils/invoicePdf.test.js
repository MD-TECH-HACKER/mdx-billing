import { describe, expect, test } from "vitest";
import { buildInvoicePdfBytes } from "./invoicePdf";

describe("invoice PDF", () => {
  test("generates a valid PDF from immutable sale snapshot fields", () => {
    const bytes = buildInvoicePdfBytes({
      receipt_number: "INV-100",
      shop_name: "MDX Store",
      buyer_name: "Rahul",
      total_amount: 870,
      paid_amount: 500,
      items: [{
        productNameSnapshot: "Rice Bag",
        hsnSacSnapshot: "1006",
        quantity: 1,
        selectedUnit: "bag",
        pricePerUnitAtSale: 870,
        totalAmount: 870,
      }],
    }, { amountInWords: "Eight Hundred Seventy Rupees Only" });
    const document = new TextDecoder().decode(bytes);
    expect(document.startsWith("%PDF-1.4")).toBe(true);
    expect(document).toContain("INV-100");
    expect(document).toContain("Rice Bag");
    expect(document).toContain("Balance");
  });
});
