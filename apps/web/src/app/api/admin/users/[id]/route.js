import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const userId = params.id;
    if (!userId) {
      return Response.json({ error: "User ID required" }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action; // "ban" or "unban"

    if (action === "ban") {
      await sql`UPDATE auth_users SET banned = 1 WHERE id = ${userId}`;
      // Also delete active sessions for this user so they get logged out
      await sql`DELETE FROM auth_sessions WHERE userId = ${userId}`;
      return Response.json({ success: true, banned: true });
    } else if (action === "unban") {
      await sql`UPDATE auth_users SET banned = 0 WHERE id = ${userId}`;
      return Response.json({ success: true, banned: false });
    } else {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error("POST /api/admin/users/[id] error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
