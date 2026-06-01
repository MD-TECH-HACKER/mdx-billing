import { readPlatformSettings, savePlatformSettings } from "@/app/api/utils/platformSettings";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json({ settings: await readPlatformSettings() });
  } catch (error) {
    console.error("GET /api/admin/settings", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const settings = await savePlatformSettings(body.settings || {});
    return Response.json({ settings });
  } catch (error) {
    console.error("POST /api/admin/settings", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
