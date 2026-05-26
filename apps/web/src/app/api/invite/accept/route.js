import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  listAccessibleShops,
  requireAuthenticatedUser,
  writeAuditEvent,
} from "@/app/api/utils/shopAccess";
import { normalizeEmail } from "@/app/api/utils/email";

function cleanToken(value) {
  const token = String(value || "").trim();
  return /^[a-f0-9]{64}$/i.test(token) ? token : "";
}

async function expireOldInvites() {
  await sql`
    UPDATE team_invitations
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' AND expires_at <= NOW()
  `;
}

async function loadInvite(token) {
  const rows = await sql`
    SELECT ti.invite_id, ti.shop_id, ti.invited_email, ti.invited_name, ti.role,
      ti.status, ti.expires_at, ti.created_at,
      s.shop_name, s.shop_logo, s.shop_description,
      inviter.name AS inviter_name,
      inviter.email AS inviter_email
    FROM team_invitations ti
    JOIN shops s ON s.shop_id = ti.shop_id
    LEFT JOIN auth_users inviter ON inviter.id = ti.invited_by
    WHERE ti.token = ${token}
    LIMIT 1
  `;
  return rows[0] || null;
}

function publicInvite(invite) {
  if (!invite) return null;
  return {
    inviteId: invite.invite_id,
    invitedEmail: invite.invited_email,
    invitedName: invite.invited_name,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expires_at,
    shopId: invite.shop_id,
    shopName: invite.shop_name,
    shopLogo: invite.shop_logo,
    shopDescription: invite.shop_description,
    inviterName: invite.inviter_name || invite.inviter_email,
  };
}

export async function GET(request) {
  try {
    await ensureBusinessFeatureSchema();
    await expireOldInvites();
    const token = cleanToken(new URL(request.url).searchParams.get("token"));
    if (!token) return Response.json({ error: "Invalid invitation link" }, { status: 400 });

    const invite = await loadInvite(token);
    if (!invite) return Response.json({ error: "Invitation not found" }, { status: 404 });

    const session = await auth();
    return Response.json({
      invite: publicInvite(invite),
      currentUser: session?.user
        ? {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image,
          }
        : null,
    });
  } catch (error) {
    console.error("GET /api/invite/accept", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { session, userId } = await requireAuthenticatedUser();
    await ensureBusinessFeatureSchema();
    await expireOldInvites();
    const body = await request.json().catch(() => ({}));
    const token = cleanToken(body.token || new URL(request.url).searchParams.get("token"));
    if (!token) return Response.json({ error: "Invalid invitation link" }, { status: 400 });

    const invite = await loadInvite(token);
    if (!invite || invite.status !== "pending") {
      return Response.json({ error: "Invitation is expired or no longer pending" }, { status: 400 });
    }

    const users = await sql`
      SELECT id, email, name
      FROM auth_users
      WHERE id = ${userId}
      LIMIT 1
    `;
    const user = users[0] || session.user;
    const userEmail = normalizeEmail(user?.email || session.user?.email);
    if (userEmail !== normalizeEmail(invite.invited_email)) {
      return Response.json(
        {
          error: `This invitation is for ${invite.invited_email}. Please login using that email.`,
        },
        { status: 403 },
      );
    }

    const activeMembers = await sql`
      SELECT membership_id
      FROM shop_memberships
      WHERE shop_id = ${invite.shop_id}
        AND user_id = ${userId}
        AND status = 'active'
      LIMIT 1
    `;
    if (activeMembers[0]) {
      return Response.json({ error: "You already have active access to this shop." }, { status: 409 });
    }

    const membershipRows = await sql.transaction([
      sql`
        INSERT INTO shop_memberships (shop_id, user_id, role, status, invited_by)
        SELECT shop_id, ${userId}, role, 'active', invited_by
        FROM team_invitations
        WHERE invite_id = ${invite.invite_id}
          AND token = ${token}
          AND status = 'pending'
          AND expires_at > NOW()
        ON CONFLICT (shop_id, user_id)
        DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()
        RETURNING membership_id, shop_id, user_id, role, status
      `,
      sql`
        UPDATE team_invitations
        SET status = 'accepted',
            accepted_by = ${userId},
            accepted_at = NOW(),
            updated_at = NOW()
        WHERE invite_id = ${invite.invite_id}
          AND token = ${token}
          AND status = 'pending'
        RETURNING invite_id
      `,
    ]);
    const member = membershipRows[0]?.[0];
    if (!member) {
      return Response.json({ error: "Invitation is expired or no longer pending" }, { status: 400 });
    }

    await writeAuditEvent(
      {
        userId,
        role: member.role,
        shopId: invite.shop_id,
      },
      "team.invite.accept",
      "team_invitation",
      invite.invite_id,
      { email: userEmail },
    );

    const shops = await listAccessibleShops(userId);
    const redirectTo = shops.length > 1 ? "/select-shop" : member.role === "cashier" ? "/billing" : "/dashboard";
    return Response.json({
      ok: true,
      shopId: member.shop_id,
      role: member.role,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("POST /api/invite/accept", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
