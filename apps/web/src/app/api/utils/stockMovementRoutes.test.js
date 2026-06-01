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

    expect(salesRoute).toContain("'sale_stock_out'");
    expect(salesRoute).toContain("${line.quantity}, ${line.selectedUnit}");
    expect(salesRoute).not.toContain("d.quantity_base_unit, 'base'");
  });

  test("sales stock decrements keep product ids in MySQL parameters", () => {
    const salesRoute = read("../sales/route.js");

    expect(salesRoute).toContain("for (const req of stockRequests)");
    expect(salesRoute).toContain("Invalid product line. Refresh billing and try again.");
    expect(salesRoute).not.toContain("Object.values(Object.fromEntries(requiredByProduct))");
  });

  test("purchase movements preserve each inward line selected unit", () => {
    const purchasesRoute = read("../purchases/route.js");

    expect(purchasesRoute).toContain("'purchase_stock_in'");
    expect(purchasesRoute).toContain("${line.quantity}, ${line.selectedUnit}");
    expect(purchasesRoute).not.toContain("received.quantity_base_unit, 'base'");
  });

  test("cancelled sale return movements restore the original selected unit", () => {
    const saleDetailRoute = read("../sales/[id]/route.js");

    expect(saleDetailRoute).toContain("'sale_cancel_return'");
    expect(saleDetailRoute).toContain("${item.quantity}, ${item.selectedUnit}");
    expect(saleDetailRoute).not.toContain("quantity_base_unit, 'base'");
  });
});
