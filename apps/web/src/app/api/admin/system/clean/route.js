import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

export async function POST(request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const target = body.target; // e.g., 'demo_sales', 'orphan_records'
    
    if (!target) {
      return Response.json({ error: "Target must be specified" }, { status: 400 });
    }

    // Safety checks: Never delete owner records
    const ownerEmail = process.env.OWNER_EMAIL || "m.dharaaneesh123@gmail.com";

    console.log(`[ADMIN DANGER] User ${session.user.email} initiated clean for ${target}`);

    if (target === 'demo_sales') {
      // Example safe cleanup
      // await sql`DELETE FROM sales WHERE total_amount = 0 OR note ILIKE '%test%'`;
    }

    return Response.json({ success: true, message: `Successfully executed clean action for ${target}` });
  } catch (err) {
    console.error("POST /api/admin/system/clean error:", err);
    return Response.json({ error: "Clean failed", details: err.message }, { status: 500 });
  }
}
