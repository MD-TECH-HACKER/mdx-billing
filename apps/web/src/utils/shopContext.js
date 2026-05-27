/**
 * Active shop selection stored in localStorage.
 * The server still validates access for every shop-scoped request.
 */

const STORAGE_KEY = "mdx_active_shop_id";

/**
 * Get the active shop ID from localStorage.
 * @returns {string|null}
 */
export function getActiveShopId() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Set the active shop ID in localStorage.
 * @param {string|number} shopId
 */
export function setActiveShopId(shopId) {
  if (typeof window === "undefined") return;
  try {
    if (shopId) {
      localStorage.setItem(STORAGE_KEY, String(shopId));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
  window.dispatchEvent(new Event("shop-changed"));
}

/**
 * Clear the active shop ID from localStorage.
 */
export function clearActiveShopId() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new Event("shop-changed"));
}

/**
 * Build headers object including X-Shop-Id if an active shop is set.
 * @param {object} [extra] - Additional headers to merge.
 * @returns {object}
 */
export function shopHeaders(extra = {}, shopIdOverride = undefined) {
  const shopId = shopIdOverride === undefined ? getActiveShopId() : shopIdOverride;
  const headers = { ...extra };
  if (shopId) {
    headers["X-Shop-Id"] = shopId;
  }
  return headers;
}
