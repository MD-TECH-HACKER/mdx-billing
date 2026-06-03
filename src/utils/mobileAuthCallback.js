export function buildMobileSuccessCallback(returnTo = "/") {
  const url = new URL("/api/auth/mobile-success", "https://mobile-auth.local");
  url.searchParams.set("returnTo", returnTo || "/");
  return `${url.pathname}${url.search}`;
}

