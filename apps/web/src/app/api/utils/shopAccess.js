import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { ensureCoreBusinessSchema } from "./businessSchema";
import { canAccess } from "./permissions";
import { selectAccessibleShop } from "./shopSelection";

export class AccessError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}

export function accessErrorResponse(error) {
  if (!(error instanceof AccessError)) {
    throw error;
  }

  return Response.json({ error: error.message }, { status: error.status });
}

export async function requireAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AccessError(401, "Unauthorized");
  }

  return { session, userId: session.user.id };
}

export async function listAccessibleShops(userId) {
  return sql`
    SELECT
      s.*,
      CASE WHEN s.owner_id = ${userId} THEN 'owner' ELSE sm.role END AS access_role
    FROM shops s
    LEFT JOIN shop_memberships sm
      ON sm.shop_id = s.shop_id
      AND sm.user_id = ${userId}
      AND sm.status = 'active'
    WHERE s.owner_id = ${userId}
       OR sm.user_id IS NOT NULL
    ORDER BY s.created_at ASC
  `;
}

export async function requireShopAccess(request, permission) {
  const { session, userId } = await requireAuthenticatedUser();
  await ensureCoreBusinessSchema();

  const requestedShopId = request.headers.get("x-shop-id");
  const shops = await listAccessibleShops(userId);
  const shop = selectAccessibleShop(shops, requestedShopId);

  if (!shop) {
    throw new AccessError(
      requestedShopId ? 403 : 404,
      requestedShopId ? "Shop access denied" : "Set up your shop first",
    );
  }

  const role = shop.access_role === "owner" ? "owner" : shop.access_role;

  if (!canAccess(role, permission)) {
    throw new AccessError(403, "Insufficient permission");
  }

  return {
    session,
    userId,
    role,
    shop,
    shopId: shop.shop_id,
    shopOwnerId: shop.owner_id,
  };
}

export async function writeAuditEvent(
  context,
  action,
  resourceType,
  resourceId,
  metadata = {},
) {
  await sql`
    INSERT INTO audit_events
      (shop_id, actor_id, actor_role, action, resource_type, resource_id, metadata)
    VALUES
      (${context.shopId}, ${context.userId}, ${context.role}, ${action}, ${resourceType}, ${resourceId ? String(resourceId) : null}, ${JSON.stringify(metadata)})
  `;
}
