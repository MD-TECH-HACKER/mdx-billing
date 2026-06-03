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

    if (target === 'demo_data') {
      await sql`DELETE FROM products WHERE title LIKE '%Demo%' OR title LIKE '%Test%'`;
      await sql`DELETE FROM shops WHERE shop_name LIKE '%Demo%' OR shop_name LIKE '%Test%'`;
      await sql`DELETE FROM sales WHERE notes LIKE '%Demo%' OR notes LIKE '%Test%'`;
    } else if (target === 'invalid_sessions') {
      await sql`DELETE FROM auth_sessions WHERE userId NOT IN (SELECT id FROM auth_users WHERE email = ${ownerEmail})`;
    } else if (target === 'old_logs') {
      await sql`DELETE FROM audit_events WHERE created_at < NOW() - INTERVAL 90 DAY`;
    } else if (target === 'factory_reset') {
      // Wipes everything except users. Deleting shops usually cascades to all,
      // but we do this explicitly to be safe and thorough.
      await sql`DELETE FROM payments`;
      await sql`DELETE FROM estimates`;
      await sql`DELETE FROM purchases`;
      await sql`DELETE FROM expenses`;
      await sql`DELETE FROM sales`;
      await sql`DELETE FROM products`;
      await sql`DELETE FROM suppliers`;
      await sql`DELETE FROM customers`;
      await sql`DELETE FROM categories`;
      await sql`DELETE FROM audit_events`;
      await sql`DELETE FROM shops`;
    }

    return Response.json({ success: true, message: `Successfully executed clean action for ${target}` });
  } catch (err) {
    console.error("POST /api/admin/system/clean error:", err);
    return Response.json({ error: "Clean failed", details: err.message }, { status: 500 });
  }
}
