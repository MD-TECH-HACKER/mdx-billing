import { verifyTurnstileToken } from "@/app/api/utils/turnstile";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const result = await verifyTurnstileToken(token, request);
    if (!result.ok) {
      return Response.json({ error: result.error || "Security check failed" }, { status: 400 });
    }
    return Response.json({ ok: true, protected: result.protected });
  } catch (error) {
    console.error("POST /api/security/turnstile", error);
    return Response.json({ error: "Security check failed" }, { status: 500 });
  }
}
