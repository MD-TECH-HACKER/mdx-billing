import { describe, expect, test } from "vitest";
import { resolveAuthParentOrigin } from "./authParentOrigin";

describe("authentication bridge parent origin", () => {
  test("allows the callback's own origin", () => {
    expect(
      resolveAuthParentOrigin(
        "https://billing.example/api/auth/expo-web-success?parentOrigin=https%3A%2F%2Fbilling.example",
        [],
      ),
    ).toBe("https://billing.example");
  });

  test("allows a separately configured mobile web origin", () => {
    expect(
      resolveAuthParentOrigin(
        "https://billing.example/api/auth/expo-web-success?parentOrigin=https%3A%2F%2Fmobile.example",
        ["https://mobile.example"],
      ),
    ).toBe("https://mobile.example");
  });

  test("rejects omitted or attacker-controlled target origins", () => {
    expect(resolveAuthParentOrigin("https://billing.example/api/auth/expo-web-success", [])).toBeNull();
    expect(
      resolveAuthParentOrigin(
        "https://billing.example/api/auth/expo-web-success?parentOrigin=https%3A%2F%2Fevil.example",
        ["https://mobile.example"],
      ),
    ).toBeNull();
  });
});
