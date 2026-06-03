import { describe, expect, test } from "vitest";
import {
  PRODUCT_UNITS,
  convertUnitPrice,
  formatMovementQuantity,
  formatStockQuantity,
  getProductUnitLabel,
  priceForUnit,
  sanitizeProductUnit,
  toBaseQuantity,
} from "./productUnits";

describe("product unit helpers", () => {
  test("defaults unsafe or empty primary units to piece", () => {
    expect(sanitizeProductUnit("<invalid>", { fallback: "piece" })).toBe("piece");
    expect(sanitizeProductUnit("", { fallback: "piece" })).toBe("piece");
    expect(sanitizeProductUnit(null, { fallback: "piece" })).toBe("piece");
  });

  test("normalizes allowed unit values", () => {
    expect(sanitizeProductUnit(" KG ", { fallback: "piece" })).toBe("kg");
    expect(sanitizeProductUnit("Liter", { fallback: "piece" })).toBe("liter");
  });

  test("keeps bounded custom units created in settings", () => {
    expect(sanitizeProductUnit("Carton", { fallback: "piece" })).toBe("carton");
    expect(sanitizeProductUnit("crate-20", { fallback: "piece" })).toBe("crate-20");
    expect(sanitizeProductUnit("not<script>", { fallback: "piece" })).toBe("piece");
  });

  test("formats product unit labels from product rows", () => {
    expect(getProductUnitLabel({ primary_unit: "kg" })).toBe("kg");
    expect(getProductUnitLabel({ primary_unit: "liter", secondary_unit: "ml" })).toBe("liter / ml");
    expect(getProductUnitLabel({})).toBe("piece");
  });

  test("includes the common billing unit catalogue", () => {
    const units = PRODUCT_UNITS.map((unit) => unit.value);
    expect(units).toEqual(expect.arrayContaining([
      "pcs",
      "box",
      "pack",
      "bag",
      "kg",
      "gram",
      "liter",
      "ml",
      "meter",
      "feet",
      "dozen",
      "set",
      "bottle",
      "roll",
    ]));
  });

  test("converts Bag and Kg quantities into secondary base stock", () => {
    const rice = {
      primary_unit: "bag",
      secondary_unit: "kg",
      conversion_rate: 50,
    };
    expect(toBaseQuantity(2, "bag", rice)).toBe(100);
    expect(toBaseQuantity(25, "kg", rice)).toBe(25);
  });

  test("prices secondary unit sales from the primary unit price", () => {
    const rice = {
      primary_unit: "bag",
      secondary_unit: "kg",
      conversion_rate: 50,
    };
    expect(priceForUnit(870, "bag", rice)).toBe(870);
    expect(priceForUnit(870, "kg", rice)).toBe(17.4);
  });

  test("converts stock-entry prices when switching between product units", () => {
    const rice = {
      primary_unit: "bag",
      secondary_unit: "kg",
      conversion_rate: 50,
    };
    expect(convertUnitPrice(1200, "bag", "kg", rice)).toBe(24);
    expect(convertUnitPrice(24, "kg", "bag", rice)).toBe(1200);
  });

  test("formats remaining base stock in both units when conversion exists", () => {
    expect(
      formatStockQuantity(440, {
        primary_unit: "bag",
        secondary_unit: "kg",
        conversion_rate: 50,
      }),
    ).toBe("8.8 bag / 440 kg");
    expect(formatStockQuantity(45, { primary_unit: "kg" })).toBe("45 kg");
  });

  test("renders movement history using the entered unit without mislabelling base quantity", () => {
    const rice = {
      primary_unit: "bag",
      secondary_unit: "kg",
      conversion_rate: 50,
    };

    expect(
      formatMovementQuantity(
        { quantity_base_unit: 250, display_quantity: 5, unit: "bag" },
        rice,
      ),
    ).toBe("5 bag / 250 kg");
    expect(
      formatMovementQuantity(
        { quantity_base_unit: 10, display_quantity: 10, unit: "kg" },
        rice,
      ),
    ).toBe("10 kg");
    expect(
      formatMovementQuantity(
        { quantity_base_unit: -10, display_quantity: 10, unit: "base" },
        rice,
      ),
    ).toBe("-0.2 bag / 10 kg");
  });
});
