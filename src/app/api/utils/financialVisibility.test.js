import { describe, expect, test } from "vitest";
import { sanitizeSaleForRole } from "./financialVisibility";

const sale = {
  sale_id: 1,
  total_amount: 120,
  total_cost: 80,
  total_profit: 40,
  items: [{ productId: 5, unitPrice: 120, costPrice: 80, subtotal: 120 }],
};

describe("financial visibility", () => {
  test("retains margin data for manager reporting", () => {
    expect(sanitizeSaleForRole(sale, "manager")).toEqual(sale);
  });

  test("removes costs and profit from cashier receipt data", () => {
    expect(sanitizeSaleForRole(sale, "cashier")).toEqual({
      sale_id: 1,
      total_amount: 120,
      items: [{ productId: 5, unitPrice: 120, subtotal: 120 }],
    });
  });
});
