import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pageSource = readFileSync(path.resolve("src/app/billing/page.jsx"), "utf8");
const settingsSource = readFileSync(path.resolve("src/app/settings/page.jsx"), "utf8");

describe("billing page contracts", () => {
  test("billing lines stay synced with the product cart", () => {
    expect(pageSource).toContain("function cartSignature(cart)");
    expect(pageSource).toContain("const syncedCartSignature = useRef");
    expect(pageSource).toMatch(/setItems\(\s*cart\.map\(\s*(?:productLine|item\s*=>\s*productLine\(item\))\s*\)\s*\)/);
  });

  test("billing product lines preserve cart snapshot prices before product queries finish", () => {
    expect(pageSource).toContain("function readProductId(item)");
    expect(pageSource).toContain("readCartSellingPrice");
    expect(pageSource).toContain("quotedUnitPrice: quotedUnitPrice ?? (snapshotPrice > 0 ? snapshotPrice : null)");
  });

  test("GST invoice is no longer exposed as a billing or settings option", () => {
    expect(pageSource).not.toContain('label: "GST Invoice"');
    expect(settingsSource).not.toContain('label: "GST invoice"');
    expect(settingsSource).not.toContain("GST Settings");
  });
});
