import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { getAppUrl, isValidEmail, normalizeEmail, sendResendEmail } from "@/app/api/utils/email";
import { teamInviteEmailTemplate } from "@/app/api/utils/emailTemplates";

const STAFF_ROLES = new Set(["manager", "cashier"]);
const INVITE_FROM = "MDX Billing <info@mdx-billing.app>";
const INVITE_DAYS = 7;

function inviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

function inviteExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + INVITE_DAYS);
  return date.toISOString();
}

async function inviterName(context) {
  const rows = await sql`
    SELECT name, email
    FROM auth_users
    WHERE id = ${context.userId}
    LIMIT 1
  `;
  return rows[0]?.name || context.session?.user?.name || rows[0]?.email || "Shop owner";
}

async function sendInvitationEmail(context, invite) {
  const inviteUrl = `${getAppUrl()}/invite/accept?token=${encodeURIComponent(invite.token)}`;
  const name = await inviterName(context);
  const data = await sendResendEmail({
    from: INVITE_FROM,
    to: invite.invited_email,
    subject: `You are invited to join ${context.shop.shop_name || "MDX Billing"}`,
    html: teamInviteEmailTemplate({
      shop: context.shop,
      invitedName: invite.invited_name,
      role: invite.role,
      inviterName: name,
      inviteUrl,
    }),
  });
  return data?.id || null;
}

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "team.manage");
    await ensureBusinessFeatureSchema();
    await sql`
      UPDATE team_invitations
      SET status = 'expired', updated_at = NOW()
      WHERE shop_id = ${context.shopId}
        AND status = 'pending'
        AND expires_at <= NOW()
    `;
    const members = await sql`
      SELECT sm.membership_id, sm.role, sm.status, sm.created_at, u.id AS user_id, u.name, u.display_name, u.email, u.image
      FROM shop_memberships sm
      JOIN auth_users u ON u.id = sm.user_id
      WHERE sm.shop_id = ${context.shopId}
      ORDER BY sm.created_at DESC
    `;
    const invitations = await sql`
      SELECT ti.invite_id, ti.invited_email, ti.invited_name, ti.role, ti.status,
        ti.expires_at, ti.created_at, ti.updated_at,
        inviter.name AS invited_by_name,
        inviter.email AS invited_by_email
      FROM team_invitations ti
      LEFT JOIN auth_users inviter ON inviter.id = ti.invited_by
      WHERE ti.shop_id = ${context.shopId}
        AND ti.status IN ('pending', 'expired')
      ORDER BY ti.created_at DESC
      LIMIT 100
    `;
    return Response.json({ members, invitations });
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
    const email = normalizeEmail(body.email);
    const staffName = String(body.name || body.staffName || "").trim().slice(0, 120);
    const role = (body.role || "").toString().trim().toLowerCase();

    if (!staffName || !isValidEmail(email) || !STAFF_ROLES.has(role)) {
      return Response.json({ error: "Staff name, valid email, and role are required" }, { status: 400 });
    }

    const ownerRows = await sql`
      SELECT id, email
      FROM auth_users
      WHERE id = ${context.shopOwnerId}
      LIMIT 1
    `;
    if (normalizeEmail(ownerRows[0]?.email) === email) {
      return Response.json({ error: "The owner already has full access" }, { status: 400 });
    }

    const activeMembers = await sql`
      SELECT sm.membership_id
      FROM shop_memberships sm
      JOIN auth_users u ON u.id = sm.user_id
      WHERE sm.shop_id = ${context.shopId}
        AND sm.status = 'active'
        AND LOWER(u.email) = ${email}
      LIMIT 1
    `;
    if (activeMembers[0]) {
      return Response.json({ error: "This staff member already has active access" }, { status: 409 });
    }

    await sql`
      UPDATE team_invitations
      SET status = 'expired', updated_at = NOW()
      WHERE shop_id = ${context.shopId}
        AND invited_email = ${email}
        AND status = 'pending'
        AND expires_at <= NOW()
    `;
    const pending = await sql`
      SELECT invite_id
      FROM team_invitations
      WHERE shop_id = ${context.shopId}
        AND invited_email = ${email}
        AND status = 'pending'
        AND expires_at > NOW()
      LIMIT 1
    `;
    if (pending[0]) {
      return Response.json({ error: "Invitation already pending. Use Resend invite." }, { status: 409 });
    }

    const rows = await sql`
      INSERT INTO team_invitations
        (shop_id, invited_email, invited_name, role, token, status, invited_by, expires_at)
      VALUES
        (${context.shopId}, ${email}, ${staffName}, ${role}, ${inviteToken()}, 'pending', ${context.userId}, ${inviteExpiresAt()})
      RETURNING invite_id, shop_id, invited_email, invited_name, role, token, status, expires_at, created_at
    `;
    const invite = rows[0];
    let emailSent = false;
    let emailError = null;
    try {
      await sendInvitationEmail(context, invite);
      emailSent = true;
    } catch (error) {
      emailError = "Invitation saved, but email could not be sent";
      console.error("team invite email failed", error);
    }

    await writeAuditEvent(context, "team.invite.create", "team_invitation", invite.invite_id, {
      role,
      email,
      emailSent,
    });
    const { token: _token, ...publicInvite } = invite;
    return Response.json({ invitation: publicInvite, emailSent, emailError }, { status: 201 });
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
