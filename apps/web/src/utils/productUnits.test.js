import { describe, expect, test } from "vitest";
import {
  PRODUCT_UNITS,
  formatStockQuantity,
  getProductUnitLabel,
  priceForUnit,
  sanitizeProductUnit,
  toBaseQuantity,
} from "./productUnits";

describe("product unit helpers", () => {
  test("defaults invalid primary units to piece", () => {
    expect(sanitizeProductUnit("invalid", { fallback: "piece" })).toBe("piece");
    expect(sanitizeProductUnit("", { fallback: "piece" })).toBe("piece");
    expect(sanitizeProductUnit(null, { fallback: "piece" })).toBe("piece");
  });

  test("normalizes allowed unit values", () => {
    expect(sanitizeProductUnit(" KG ", { fallback: "piece" })).toBe("kg");
    expect(sanitizeProductUnit("Liter", { fallback: "piece" })).toBe("liter");
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
});
