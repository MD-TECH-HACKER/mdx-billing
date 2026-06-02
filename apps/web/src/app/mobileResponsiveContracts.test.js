import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("mobile responsive layout contracts", () => {
  test("dashboard wide content scrolls inside constrained cards", () => {
    const dashboard = read("./dashboard/page.jsx");
    const css = read("./global.css");

    expect(dashboard).toContain('className="dash-table-scroll scroll-card"');
    expect(dashboard).toContain("dashboard-card");
    expect(css).toContain(".dashboard-card");
    expect(css).toContain(".dash-bottom-grid > *");
  });

  test("product categories render as compact icon chips", () => {
    const products = read("./products/page.jsx");

    expect(products).toContain("product-category-strip scroll-card");
    expect(products).toContain("product-category-chip");
    expect(products).toContain("<Package");
  });

  test("product form explains primary and converted secondary pricing", () => {
    const products = read("./products/page.jsx");

    expect(products).toContain("Cost price / 1");
    expect(products).toContain("Selling price / 1");
    expect(products).toContain("Secondary selling price");
    expect(products).toContain("Expected sales value");
    expect(products).toContain("openingStockUnit");
    expect(products).toContain("Opening stock unit");
  });

  test("mobile bottom navigation skips Estimate and keeps Stock label compact", () => {
    const shell = read("../components/DashboardShell.jsx");

    expect(shell).toContain("const MOBILE_NAV_HREFS");
    expect(shell).toContain('"/stock-estimate"');
    expect(shell).toContain('mobileLabel: "Stock"');
    expect(shell).not.toContain("availableNav.slice(0, 5)");
  });
});
