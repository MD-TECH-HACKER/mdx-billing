import sql from "@/app/api/utils/sql";
import { ensureBusinessFeatureSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  requireShopAccess,
} from "@/app/api/utils/shopAccess";

export async function GET(request) {
  try {
    const context = await requireShopAccess(request, "product.read");
    await ensureBusinessFeatureSchema();
    const movements = await sql`
      SELECT m.*, COALESCE(p.title, 'Deleted Product') AS product_title
      FROM stock_movements m
      LEFT JOIN products p ON p.product_id = m.product_id AND p.shop_id = m.shop_id
      WHERE m.shop_id = ${context.shopId}
      ORDER BY m.created_at DESC
      LIMIT 100
    `;
    return Response.json({ movements });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/inventory/movements", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
