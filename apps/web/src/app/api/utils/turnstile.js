const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function getSecret() {
  return process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY || "";
}

function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

export async function verifyTurnstileToken(token, request) {
  const secret = getSecret();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Turnstile secret is not configured; security check bypassed in this environment.");
    }
    return { ok: true, protected: false };
  }

  if (!token) {
    return { ok: false, protected: true, error: "Complete the security check first." };
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const ip = getClientIp(request);
  if (ip) form.set("remoteip", ip);

  const response = await fetch(VERIFY_URL, {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    return {
      ok: false,
      protected: true,
      error: "Security check failed. Please try again.",
      codes: data["error-codes"] || [],
    };
  }

  return { ok: true, protected: true };
}
