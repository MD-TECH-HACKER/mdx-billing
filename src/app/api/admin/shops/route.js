import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";

const ACTIVE = "active";
const SUSPENDED = "suspended";

let schemaReady;

async function ensureAdminShopsSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const queries = [
        "ALTER TABLE shops ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'",
        "ALTER TABLE shops ADD COLUMN suspended_at DATETIME NULL",
        "ALTER TABLE shops ADD COLUMN suspended_by VARCHAR(36) NULL",
      ];

      for (const query of queries) {
        try {
          await sql(query);
        } catch (error) {
          if (error.code !== "ER_DUP_FIELDNAME") {
            throw error;
          }
        }
      }
    })();
  }
  return schemaReady;
}

const ADMIN_SHOP_SELECT = `
  SELECT
    s.shop_id, s.shop_name, s.shop_logo, s.created_at, s.currency,
    s.status, s.suspended_at, s.suspended_by,
    u.name as owner_name, u.email as owner_email,
    (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.shop_id) as products_count,
    (SELECT COUNT(*) FROM sales sa WHERE sa.shop_id = s.shop_id) as sales_count,
    (SELECT SUM(total_amount) FROM sales sa WHERE sa.shop_id = s.shop_id) as total_revenue
  FROM shops s
  LEFT JOIN auth_users u ON u.id = s.owner_id
`;

async function getAdminShop(shopId) {
  const rows = await sql(`${ADMIN_SHOP_SELECT} WHERE s.shop_id = ? LIMIT 1`, [shopId]);
  return rows[0] || null;
}

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }
    await ensureAdminShopsSchema();

    const shops = await sql(`${ADMIN_SHOP_SELECT} ORDER BY s.created_at DESC LIMIT 200`);

    return Response.json({ shops });
  } catch (err) {
    console.error("GET /api/admin/shops error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }
    await ensureAdminShopsSchema();

    const body = await request.json();
    const shopId = String(body.shopId || "").trim();
    const action = String(body.action || "").trim();
    if (!shopId) {
      return Response.json({ error: "Shop ID required" }, { status: 400 });
    }
    if (!["suspend", "activate"].includes(action)) {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    const existing = await getAdminShop(shopId);
    if (!existing) {
      return Response.json({ error: "Shop not found" }, { status: 404 });
    }

    if (action === "suspend") {
      await sql`
        UPDATE shops
        SET status = ${SUSPENDED}, suspended_at = NOW(), suspended_by = ${session.user.id || null}, updated_at = NOW()
        WHERE shop_id = ${shopId}
      `;
    } else {
      await sql`
        UPDATE shops
        SET status = ${ACTIVE}, suspended_at = NULL, suspended_by = NULL, updated_at = NOW()
        WHERE shop_id = ${shopId}
      `;
    }

    const shop = await getAdminShop(shopId);
    return Response.json({ shop });
  } catch (err) {
    console.error("POST /api/admin/shops error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
