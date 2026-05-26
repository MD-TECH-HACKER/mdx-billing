import sql from "@/app/api/utils/sql";
import { ensureCoreBusinessSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
} from "@/app/api/utils/shopAccess";

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "team.manage");
    await ensureCoreBusinessSchema();
    const events = await sql`
      SELECT a.audit_id, a.actor_role, a.action, a.resource_type, a.resource_id,
             a.metadata, a.created_at, u.email AS actor_email, u.display_name AS actor_name
      FROM audit_events a
      LEFT JOIN auth_users u ON u.id = a.actor_id
      WHERE a.shop_id = ${context.shopId}
      ORDER BY a.created_at DESC
      LIMIT 200
    `;
    return Response.json({ events });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/audit", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
