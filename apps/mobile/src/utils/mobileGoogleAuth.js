const MOBILE_AUTH_CALLBACK = "mdxbilling://auth";

export function normalizeReturnTo(callbackUrl, webAppUrl) {
  if (!callbackUrl) return "/";
  try {
    if (callbackUrl.startsWith("/")) return callbackUrl.startsWith("//") ? "/" : callbackUrl;
    const parsed = new URL(callbackUrl);
    const appOrigin = new URL(webAppUrl).origin;
    return parsed.origin === appOrigin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "/";
  } catch {
    return "/";
  }
}

export function getReturnToFromGoogleAuthUrl(url, webAppUrl) {
  try {
    const parsed = new URL(url);
    const appOrigin = new URL(webAppUrl).origin;
    if (parsed.origin !== appOrigin || parsed.pathname !== "/api/auth/signin/google") {
      return "/";
    }
    return normalizeReturnTo(parsed.searchParams.get("callbackUrl"), webAppUrl);
  } catch {
    return "/";
  }
}

export function buildMobileLoginUrl(webAppUrl, returnTo = "/") {
  const normalizedReturnTo = normalizeReturnTo(returnTo, webAppUrl);
  const url = new URL("/account/mobile-login", webAppUrl);
  url.searchParams.set("callbackUrl", MOBILE_AUTH_CALLBACK);
  url.searchParams.set("returnTo", normalizedReturnTo);
  return url.toString();
}

export function buildMobileSuccessCallback(returnTo = "/") {
  const url = new URL("/api/auth/mobile-success", "https://mobile-auth.local");
  url.searchParams.set("returnTo", returnTo || "/");
  return `${url.pathname}${url.search}`;
}

