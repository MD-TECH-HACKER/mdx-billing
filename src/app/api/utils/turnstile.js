import sql from "./sql";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_SETTING_KEY = "cloudflare_turnstile";

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

async function isTurnstileSettingEnabled() {
  try {
    const rows = await sql`
      SELECT setting_value
      FROM platform_settings
      WHERE setting_key = ${TURNSTILE_SETTING_KEY}
      LIMIT 1
    `;
    return (rows[0]?.setting_value ?? "true") === "true";
  } catch (error) {
    if (!["ER_NO_SUCH_TABLE", "ER_BAD_TABLE_ERROR"].includes(error?.code)) {
      console.error("Turnstile setting lookup failed:", error);
    }
    return true;
  }
}

export async function getTurnstileConfig() {
  const settingEnabled = await isTurnstileSettingEnabled();
  const configured = Boolean(getSecret());
  return {
    enabled: settingEnabled && configured,
    configured,
    settingEnabled,
  };
}

export async function verifyTurnstileToken(token, request) {
  const config = await getTurnstileConfig();
  if (!config.settingEnabled) {
    return { ok: true, protected: false };
  }

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
