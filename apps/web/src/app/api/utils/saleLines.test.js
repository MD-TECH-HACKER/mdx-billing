import { describe, expect, test } from "vitest";
import {
  buildManualSaleLine,
  buildProductSaleLine,
  customerNameError,
} from "./saleLines";

describe("billing sale lines", () => {
  test("requires a customer name even when no product line exists", () => {
    expect(customerNameError("   ")).toBe("Customer name is required.");
    expect(customerNameError("Rahul")).toBeNull();
  });

  test("snapshots a converted product sale in base units", () => {
    const line = buildProductSaleLine(
      {
        product_id: 4,
        title: "Rice",
        image_url: "/rice.png",
        hsn_sac: "1006",
        primary_unit: "bag",
        secondary_unit: "kg",
        conversion_rate: 50,
        selling_price: 870,
        cost_price: 600,
        stock_base_unit: 500,
      },
      { quantity: 25, selectedUnit: "kg", discount: 0, taxRate: 0 },
    );

    expect(line).toMatchObject({
      productId: 4,
      productNameSnapshot: "Rice",
      selectedUnit: "kg",
      primaryUnitSnapshot: "bag",
      secondaryUnitSnapshot: "kg",
      conversionRateSnapshot: 50,
      quantity: 25,
      quantityBaseUnit: 25,
      pricePerUnitAtSale: 17.4,
      costPerBaseUnitAtSale: 12,
      totalAmount: 435,
      totalCost: 300,
      totalProfit: 135,
    });
  });

  test("creates manual invoice lines without product stock consumption", () => {
    expect(
      buildManualSaleLine({
        name: "Delivery service",
        hsnSac: "9965",
        quantity: 1,
        unit: "service",
        price: 150,
        discount: 10,
        taxRate: 0,
      }),
    ).toMatchObject({
      productId: null,
      productNameSnapshot: "Delivery service",
      quantityBaseUnit: 0,
      totalAmount: 140,
      totalCost: 0,
      totalProfit: 140,
    });
  });
});
