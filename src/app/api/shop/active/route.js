import { ensureCoreBusinessSchema } from "@/app/api/utils/businessSchema";
import {
  accessErrorResponse,
  AccessError,
  listAccessibleShops,
  requireAuthenticatedUser,
} from "@/app/api/utils/shopAccess";
import { selectAccessibleShop } from "@/app/api/utils/shopSelection";

export async function GET(request) {
  try {
    const { userId } = await requireAuthenticatedUser();
    await ensureCoreBusinessSchema();

    const shops = await listAccessibleShops(userId);
    const selectedId = request.headers.get("x-shop-id");
    const activeShop = selectAccessibleShop(shops, selectedId);

    return Response.json({
      shops,
      activeShop,
      count: shops.length,
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("GET /api/shop/active", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
