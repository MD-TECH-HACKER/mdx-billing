const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length > 3 && EMAIL_PATTERN.test(email);
}

export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://mdx-billing.app").replace(/\/+$/, "");
}

export async function sendResendEmail({ from, to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email service is not configured");
  }
  if (!from || !isValidEmail(to) || !subject || !html) {
    throw new Error("Valid email sender, recipient, subject, and HTML are required");
  }

  const payload = {
    from,
    to: [normalizeEmail(to)],
    subject,
    html,
  };
  if (replyTo && isValidEmail(replyTo)) {
    payload.reply_to = normalizeEmail(replyTo);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || data?.error || `Resend email failed with ${response.status}`;
    throw new Error(String(message).slice(0, 500));
  }

  return data;
}
