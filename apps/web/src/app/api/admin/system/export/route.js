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
    const type = body.type || 'full'; // 'users', 'shops', 'products', 'sales', 'full'
    
    let data = {};

    if (type === 'users' || type === 'full') {
      data.users = await sql`SELECT * FROM auth_users`;
    }
    if (type === 'shops' || type === 'full') {
      data.shops = await sql`SELECT * FROM shops`;
    }
    if (type === 'products' || type === 'full') {
      data.products = await sql`SELECT * FROM products LIMIT 5000`; // safeguard
    }
    if (type === 'sales' || type === 'full') {
      data.sales = await sql`SELECT * FROM sales LIMIT 5000`; // safeguard
    }

    // Log the export action (if audit log table exists, we could write to it, but standard logging works)
    console.log(`[ADMIN EXPORT] User ${session.user.email} exported ${type} data.`);

    return Response.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("POST /api/admin/system/export error:", err);
    return Response.json({ error: "Export failed", details: err.message }, { status: 500 });
  }
}
