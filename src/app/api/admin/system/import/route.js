import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";
import { importSystemBackup } from "@/app/api/utils/systemBackup";

export async function POST(request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    let importResult;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file.arrayBuffer !== "function") {
        return Response.json({ error: "No import file provided" }, { status: 400 });
      }
      const buffer = await file.arrayBuffer();
      if (String(file.name || "").toLowerCase().endsWith(".zip")) {
        importResult = await importSystemBackup({ buffer });
      } else {
        const text = Buffer.from(buffer).toString("utf8");
        importResult = await importSystemBackup({ json: JSON.parse(text) });
      }
    } else {
      const body = await request.json().catch(() => ({}));
      if (!body.data) {
        return Response.json({ error: "No data provided" }, { status: 400 });
      }
      importResult = await importSystemBackup({ json: body.data });
    }

    console.log(`[ADMIN IMPORT] User ${session.user.email} imported backup data.`);
    return Response.json({
      success: true,
      message: "Backup imported successfully.",
      results: importResult.results,
      restoredFiles: importResult.restoredFiles,
    });
  } catch (err) {
    console.error("POST /api/admin/system/import error:", err);
    return Response.json({ error: "Import failed", details: err.message }, { status: 500 });
  }
}
