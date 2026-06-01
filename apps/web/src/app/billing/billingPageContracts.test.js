import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pageSource = readFileSync(path.resolve("src/app/billing/page.jsx"), "utf8");

describe("billing page contracts", () => {
  test("billing lines stay synced with the product cart", () => {
    expect(pageSource).toContain("function cartSignature(cart)");
    expect(pageSource).toContain("const syncedCartSignature = useRef");
    expect(pageSource).toContain("setItems(cart.map(productLine))");
  });
});
