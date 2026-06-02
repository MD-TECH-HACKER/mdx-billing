import {
  buildMobileLoginUrl,
  buildMobileSuccessCallback,
  getReturnToFromGoogleAuthUrl,
  normalizeReturnTo,
} from "./mobileGoogleAuth";

const WEB_APP_URL = "https://billing.example";

describe("mobile Google auth URLs", () => {
  test("normalizes unsafe return URLs back to root", () => {
    expect(normalizeReturnTo("https://evil.example/dashboard", WEB_APP_URL)).toBe("/");
    expect(normalizeReturnTo("//evil.example/dashboard", WEB_APP_URL)).toBe("/");
  });

  test("preserves same-origin and relative return URLs", () => {
    expect(normalizeReturnTo("/dashboard?shop=1", WEB_APP_URL)).toBe("/dashboard?shop=1");
    expect(normalizeReturnTo("https://billing.example/select-shop#top", WEB_APP_URL)).toBe("/select-shop#top");
  });

  test("extracts the original callback from a raw Auth.js Google sign-in URL", () => {
    const rawAuthUrl = "https://billing.example/api/auth/signin/google?callbackUrl=%2Fselect-shop%3Fshop%3D1";
    expect(getReturnToFromGoogleAuthUrl(rawAuthUrl, WEB_APP_URL)).toBe("/select-shop?shop=1");
  });

  test("opens Chrome on the mobile-login page instead of the raw Auth.js sign-in endpoint", () => {
    const url = buildMobileLoginUrl(WEB_APP_URL, "/select-shop");
    expect(url).toBe(
      "https://billing.example/account/mobile-login?callbackUrl=mdxbilling%3A%2F%2Fauth&returnTo=%2Fselect-shop",
    );
    expect(url).not.toContain("/api/auth/signin/google");
  });

  test("uses the server mobile-success endpoint as the Auth.js callback", () => {
    expect(buildMobileSuccessCallback("/select-shop")).toBe("/api/auth/mobile-success?returnTo=%2Fselect-shop");
  });
});

