import { describe, expect, test } from "vitest";
import { allocateFifoBatches } from "./productBatches";

describe("FIFO product batch allocation", () => {
  test("allocates sale quantity from oldest remaining stock first", () => {
    const result = allocateFifoBatches({
      quantityBaseUnit: 8,
      sellingPricePerBaseUnit: 15,
      batches: [
        {
          batch_id: 1,
          quantity_remaining: 6,
          cost_price: 10,
          selling_price: 15,
          purchase_date: "2026-05-01",
        },
        {
          batch_id: 2,
          quantity_remaining: 5,
          cost_price: 12,
          selling_price: 20,
          purchase_date: "2026-05-10",
        },
      ],
    });

    expect(result.allocations).toEqual([
      expect.objectContaining({
        batchId: 1,
        quantityBaseUnit: 6,
        totalCost: 60,
        profitAmount: 30,
      }),
      expect.objectContaining({
        batchId: 2,
        quantityBaseUnit: 2,
        totalCost: 24,
        profitAmount: 6,
      }),
    ]);
    expect(result.totalCost).toBe(84);
    expect(result.totalProfit).toBe(36);
  });

  test("throws when batches cannot cover requested quantity", () => {
    expect(() =>
      allocateFifoBatches({
        quantityBaseUnit: 12,
        sellingPricePerBaseUnit: 15,
        batches: [{ batch_id: 1, quantity_remaining: 6, cost_price: 10 }],
      }),
    ).toThrow("Not enough batch stock");
  });
});
