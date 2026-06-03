import { beforeEach, describe, expect, test, vi } from "vitest";
import sql from "./sql";
import { getTurnstileConfig, verifyTurnstileToken } from "./turnstile";

vi.mock("./sql", () => ({
  default: vi.fn(),
}));

describe("turnstile settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    global.fetch = vi.fn();
  });

  test("disables Turnstile verification when the admin setting is off", async () => {
    sql.mockResolvedValue([{ setting_value: "false" }]);

    await expect(getTurnstileConfig()).resolves.toMatchObject({
      enabled: false,
      settingEnabled: false,
    });

    await expect(verifyTurnstileToken("", new Request("http://localhost"))).resolves.toEqual({
      ok: true,
      protected: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("hides Turnstile when no secret key is configured", async () => {
    sql.mockResolvedValue([{ setting_value: "true" }]);

    await expect(getTurnstileConfig()).resolves.toMatchObject({
      enabled: false,
      configured: false,
      settingEnabled: true,
    });
  });
});
