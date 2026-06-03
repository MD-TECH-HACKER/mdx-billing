import { describe, expect, test } from "vitest";
import { shouldUseDevSocialShim } from "./authMode";

describe("social authentication mode", () => {
  test("uses real OAuth by default even inside development pages", () => {
    expect(shouldUseDevSocialShim("google", "")).toBe(false);
    expect(shouldUseDevSocialShim("google", "?callbackUrl=%2Fdashboard")).toBe(false);
  });

  test("allows a deliberately requested simulated provider", () => {
    expect(shouldUseDevSocialShim("google", "?simulateAuth=google")).toBe(true);
    expect(shouldUseDevSocialShim("facebook", "?simulateAuth=google")).toBe(false);
  });
});
