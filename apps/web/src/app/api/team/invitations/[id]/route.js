import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { getAppUrl, sendResendEmail } from "@/app/api/utils/email";
import { teamInviteEmailTemplate } from "@/app/api/utils/emailTemplates";

const INVITE_FROM = "MDX Billing <info@mdx-billing.app>";
const INVITE_DAYS = 7;

function parseInviteId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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
  const data = await sendResendEmail({
    from: INVITE_FROM,
    to: invite.invited_email,
    subject: `You are invited to join ${context.shop.shop_name || "MDX Billing"}`,
    html: teamInviteEmailTemplate({
      shop: context.shop,
      invitedName: invite.invited_name,
      role: invite.role,
      inviterName: await inviterName(context),
      inviteUrl,
    }),
  });
  return data?.id || null;
}

export async function POST(request, { params }) {
  try {
    const context = await requireShopAccess(request, "team.manage");
    await ensureBusinessFeatureSchema();
    const id = parseInviteId(params.id);
    if (!id) return Response.json({ error: "Invalid invite id" }, { status: 400 });

    const existing = await sql`
      SELECT *
      FROM team_invitations
      WHERE invite_id = ${id} AND shop_id = ${context.shopId}
      LIMIT 1
    `;
    if (!existing[0]) return Response.json({ error: "Invitation not found" }, { status: 404 });
    if (["accepted", "cancelled"].includes(existing[0].status)) {
      return Response.json({ error: "This invitation cannot be resent" }, { status: 400 });
    }

    const rows = await sql`
      UPDATE team_invitations
      SET token = ${inviteToken()},
          status = 'pending',
          expires_at = ${inviteExpiresAt()},
          updated_at = NOW()
      WHERE invite_id = ${id} AND shop_id = ${context.shopId}
      RETURNING invite_id, shop_id, invited_email, invited_name, role, token, status, expires_at, created_at, updated_at
    `;
    const invite = rows[0];
    let emailSent = false;
    let emailError = null;
    try {
      await sendInvitationEmail(context, invite);
      emailSent = true;
    } catch (error) {
      emailError = "Invitation updated, but email could not be sent";
      console.error("team invite resend failed", error);
    }

    await writeAuditEvent(context, "team.invite.resend", "team_invitation", id, {
      email: invite.invited_email,
      emailSent,
    });
    const { token: _token, ...publicInvite } = invite;
    return Response.json({ invitation: publicInvite, emailSent, emailError });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/team/invitations/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const context = await requireShopAccess(request, "team.manage");
    await ensureBusinessFeatureSchema();
    const id = parseInviteId(params.id);
    if (!id) return Response.json({ error: "Invalid invite id" }, { status: 400 });

    const rows = await sql`
      UPDATE team_invitations
      SET status = 'cancelled', updated_at = NOW()
      WHERE invite_id = ${id}
        AND shop_id = ${context.shopId}
        AND status IN ('pending', 'expired')
      RETURNING invite_id, invited_email
    `;
    if (!rows[0]) return Response.json({ error: "Invitation not found" }, { status: 404 });
    await writeAuditEvent(context, "team.invite.cancel", "team_invitation", id, {
      email: rows[0].invited_email,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("DELETE /api/team/invitations/[id]", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
