import { describe, expect, test } from "vitest";
import { buildMobileSuccessCallback } from "./mobileAuthCallback";

describe("mobile Auth.js callback", () => {
  test("routes mobile Google OAuth through the server success endpoint", () => {
    expect(buildMobileSuccessCallback("/select-shop?shop=1")).toBe(
      "/api/auth/mobile-success?returnTo=%2Fselect-shop%3Fshop%3D1",
    );
  });

  test("defaults to the app root when returnTo is missing", () => {
    expect(buildMobileSuccessCallback()).toBe("/api/auth/mobile-success?returnTo=%2F");
  });
});

