import { describe, expect, test } from "vitest";
import { canAccess, visibleAnalyticsMetrics } from "./permissions";

describe("billing role permissions", () => {
  test("owner can manage sensitive configuration and staff", () => {
    expect(canAccess("owner", "shop.update")).toBe(true);
    expect(canAccess("owner", "team.manage")).toBe(true);
    expect(canAccess("owner", "analytics.profit")).toBe(true);
  });

  test("manager operates the shop without owner-only security settings", () => {
    expect(canAccess("manager", "product.write")).toBe(true);
    expect(canAccess("manager", "sale.delete")).toBe(true);
    expect(canAccess("manager", "purchase.write")).toBe(true);
    expect(canAccess("manager", "shop.update")).toBe(false);
    expect(canAccess("manager", "team.manage")).toBe(false);
  });

  test("cashier can invoice and help customers but cannot see margins", () => {
    expect(canAccess("cashier", "sale.write")).toBe(true);
    expect(canAccess("cashier", "customer.write")).toBe(true);
    expect(canAccess("cashier", "product.write")).toBe(false);
    expect(canAccess("cashier", "analytics.read")).toBe(false);
    expect(canAccess("cashier", "analytics.profit")).toBe(false);
  });

  test("analytics fields are role filtered", () => {
    expect(visibleAnalyticsMetrics("owner")).toContain("netProfit");
    expect(visibleAnalyticsMetrics("manager")).toContain("netProfit");
    expect(visibleAnalyticsMetrics("cashier")).toEqual([]);
  });

  test("unknown roles never receive permissions", () => {
    expect(canAccess("admin", "shop.update")).toBe(false);
    expect(canAccess(null, "sale.read")).toBe(false);
  });
});
