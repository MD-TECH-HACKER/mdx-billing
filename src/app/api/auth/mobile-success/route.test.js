import { describe, expect, test } from "vitest";
import { createMobileRedirectResponse } from "./route";

describe("mobile auth success callback", () => {
  test("returns HTML that actively opens the mobile app deep link", async () => {
    const response = createMobileRedirectResponse("mdxbilling://auth?token=abc&returnTo=%2Fselect-shop");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const html = await response.text();
    expect(html).toContain('window.location.replace("mdxbilling://auth?token=abc&returnTo=%2Fselect-shop")');
    expect(html).toContain('href="mdxbilling://auth?token=abc&amp;returnTo=%2Fselect-shop"');
  });
});
