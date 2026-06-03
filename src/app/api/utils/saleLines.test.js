import { describe, expect, test } from "vitest";
import {
  buildManualSaleLine,
  buildProductSaleLine,
  customerNameError,
} from "./saleLines";

describe("billing sale lines", () => {
  test("allows billing without a customer name", () => {
    expect(customerNameError("   ")).toBeNull();
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

  test("preserves quoted product unit price when an estimate is converted", () => {
    const line = buildProductSaleLine(
      {
        product_id: 9,
        title: "Paint",
        primary_unit: "box",
        selling_price: 650,
        cost_price: 400,
        stock_base_unit: 10,
      },
      {
        quantity: 2,
        selectedUnit: "box",
        unitPriceOverride: 575,
        discount: 0,
        taxRate: 0,
      },
    );

    expect(line).toMatchObject({
      productId: 9,
      pricePerUnitAtSale: 575,
      totalAmount: 1150,
      totalCost: 800,
      totalProfit: 350,
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
