export function selectAccessibleShop(shops, requestedShopId) {
  if (!Array.isArray(shops) || shops.length === 0) {
    return null;
  }

  if (!requestedShopId) {
    return shops.find((shop) => shop.access_role === "owner") ?? shops[0];
  }

  return shops.find((shop) => String(shop.shop_id) === String(requestedShopId)) ?? null;
}
