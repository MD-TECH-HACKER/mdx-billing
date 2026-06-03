import { readPlatformSettings, publicPlatformSettings } from "@/app/api/utils/platformSettings";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

export async function GET() {
  try {
    const session = await auth().catch(() => null);
    const settings = await readPlatformSettings();
    return Response.json({
      settings: publicPlatformSettings(settings),
      currentUserIsAdmin: isAdmin(session),
    });
  } catch (error) {
    console.error("GET /api/platform/settings", error);
    return Response.json(
      {
        settings: publicPlatformSettings({
          platformName: "MDX Billing App",
          supportEmail: "support@mdx-billing.app",
          allowNewSignups: true,
          maintenanceMode: false,
          currencyDefault: "INR",
          timezoneDefault: "Asia/Kolkata",
          enableGstFeatures: true,
        }),
        currentUserIsAdmin: false,
      },
      { status: 200 },
    );
  }
}
