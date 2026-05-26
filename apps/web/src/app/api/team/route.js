import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";

const STAFF_ROLES = new Set(["manager", "cashier"]);

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "team.manage");
    await ensureBusinessFeatureSchema();
    const members = await sql`
      SELECT sm.membership_id, sm.role, sm.status, sm.created_at, u.id AS user_id, u.name, u.display_name, u.email, u.image
      FROM shop_memberships sm
      JOIN auth_users u ON u.id = sm.user_id
      WHERE sm.shop_id = ${context.shopId}
      ORDER BY sm.created_at DESC
    `;
    return Response.json({ members });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/team", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const context = await requireShopAccess(request, "team.manage");
    await ensureBusinessFeatureSchema();
    const body = await request.json();
    const email = (body.email || "").toString().trim().toLowerCase().slice(0, 254);
    const role = (body.role || "").toString().trim().toLowerCase();

    if (!email || !STAFF_ROLES.has(role)) {
      return Response.json({ error: "Valid email and role are required" }, { status: 400 });
    }

    const users = await sql`
      SELECT id, email FROM auth_users
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `;
    const user = users[0];
    if (!user) {
      return Response.json(
        { error: "That user must create an account before joining the shop" },
        { status: 404 },
      );
    }
    if (String(user.id) === String(context.shopOwnerId)) {
      return Response.json({ error: "The owner already has full access" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO shop_memberships (shop_id, user_id, role, status, invited_by)
      VALUES (${context.shopId}, ${user.id}, ${role}, 'active', ${context.userId})
      ON CONFLICT (shop_id, user_id)
      DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()
      RETURNING membership_id, user_id, role, status, created_at
    `;
    await writeAuditEvent(context, "team.member.add", "membership", rows[0].membership_id, {
      role,
      email,
    });
    return Response.json({ member: rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/team", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const context = await requireShopAccess(request, "team.manage");
    await ensureBusinessFeatureSchema();
    const body = await request.json();
    const membershipId = (body.membershipId || "").toString();
    const role = (body.role || "").toString().trim().toLowerCase();
    const status = body.status === "disabled" ? "disabled" : "active";

    if (!membershipId || !STAFF_ROLES.has(role)) {
      return Response.json({ error: "Valid member and role are required" }, { status: 400 });
    }

    const rows = await sql`
      UPDATE shop_memberships
      SET role = ${role}, status = ${status}, updated_at = NOW()
      WHERE membership_id = ${membershipId} AND shop_id = ${context.shopId}
      RETURNING membership_id, user_id, role, status
    `;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await writeAuditEvent(context, "team.member.update", "membership", membershipId, {
      role,
      status,
    });
    return Response.json({ member: rows[0] });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("PUT /api/team", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const context = await requireShopAccess(request, "team.manage");
    await ensureBusinessFeatureSchema();
    const membershipId = new URL(request.url).searchParams.get("id");
    if (!membershipId) {
      return Response.json({ error: "Member id is required" }, { status: 400 });
    }

    const rows = await sql`
      DELETE FROM shop_memberships
      WHERE membership_id = ${membershipId} AND shop_id = ${context.shopId}
      RETURNING membership_id
    `;
    if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
    await writeAuditEvent(context, "team.member.remove", "membership", membershipId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/team", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
