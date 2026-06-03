import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";
import { createFullBackupZip, exportDatabaseData } from "@/app/api/utils/systemBackup";

export async function POST(request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type || "full";
    console.log(`[ADMIN EXPORT] User ${session.user.email} exported ${type} data.`);

    if (type === "full") {
      const zip = await createFullBackupZip();
      const fileName = `mdx_billing_full_backup_${Date.now()}.zip`;
      return new Response(zip, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "X-MDX-Export-Type": "zip",
        },
      });
    }

    const data = await exportDatabaseData(type);
    return Response.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("POST /api/admin/system/export error:", err);
    return Response.json({ error: "Export failed", details: err.message }, { status: 500 });
  }
}
