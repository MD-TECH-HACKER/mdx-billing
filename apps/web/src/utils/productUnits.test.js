import { describe, expect, test } from "vitest";
import { getProductUnitLabel, sanitizeProductUnit } from "./productUnits";

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
});
