import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("stock movement route contracts", () => {
  test("new products persist opening stock in the selected product unit", () => {
    const productsRoute = read("../products/route.js");

    expect(productsRoute).toContain("openingStockUnit");
    expect(productsRoute).toContain("toBaseQuantity(openingStock, openingStockUnit");
  });

  test("sales movements preserve each sold line selected unit", () => {
    const salesRoute = read("../sales/route.js");

    expect(salesRoute).toContain("sale_lines AS (");
    expect(salesRoute).toContain('item."selectedUnit" AS unit');
    expect(salesRoute).not.toContain("d.quantity_base_unit, 'base'");
  });

  test("purchase movements preserve each inward line selected unit", () => {
    const purchasesRoute = read("../purchases/route.js");

    expect(purchasesRoute).toContain("purchase_lines AS (");
    expect(purchasesRoute).toContain('item."selectedUnit" AS unit');
    expect(purchasesRoute).not.toContain("received.quantity_base_unit, 'base'");
  });

  test("cancelled sale return movements restore the original selected unit", () => {
    const saleDetailRoute = read("../sales/[id]/route.js");

    expect(saleDetailRoute).toContain("return_lines AS (");
    expect(saleDetailRoute).toContain('item."selectedUnit" AS unit');
    expect(saleDetailRoute).not.toContain("quantity_base_unit, 'base'");
  });
});
