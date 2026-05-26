import { sanitizeProductUnit } from "@/utils/productUnits";
import { getActiveShopId } from "@/utils/shopContext";

// Cart contents are shop-specific and never cache cost or margin data.
const KEY_PREFIX = "mdx_cart_v3";
const EVENT = "cart-changed";

function storageKey() {
  return `${KEY_PREFIX}:${getActiveShopId() || "unselected"}`;
}

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function getCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCart(items) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(items));
  } catch {}
  emit();
}

// Add `qty` units of `product`. If already in cart, increase the quantity
// (do NOT create a duplicate row). Clamp to available stock.
export function addToCart(product, qty = 1) {
  if (!product || !product.product_id) return { ok: false, reason: "invalid" };
  const stock = Number(product.stock) || 0;
  if (stock <= 0) return { ok: false, reason: "out_of_stock" };
  const primaryUnit = sanitizeProductUnit(product.primary_unit, {
    fallback: "piece",
  });
  const secondaryUnit = sanitizeProductUnit(product.secondary_unit, {
    fallback: null,
  });

  const cart = getCart();
  const existing = cart.find((c) => c.product_id === product.product_id);
  const wantQty = Math.max(1, parseInt(qty) || 1);

  if (existing) {
    const newQty = Math.min(existing.quantity + wantQty, stock);
    const exceeded = existing.quantity + wantQty > stock;
    existing.quantity = newQty;
    existing.stock = stock;
    existing.selling_price = Number(product.selling_price);
    existing.primary_unit = primaryUnit;
    existing.secondary_unit = secondaryUnit;
    setCart(cart);
    return { ok: true, exceeded, quantity: newQty };
  }

  const finalQty = Math.min(wantQty, stock);
  cart.push({
    product_id: product.product_id,
    title: product.title,
    description: product.description,
    image_url: product.image_url,
    selling_price: Number(product.selling_price),
    stock,
    quantity: finalQty,
    primary_unit: primaryUnit,
    secondary_unit: secondaryUnit,
  });
  setCart(cart);
  return { ok: true, exceeded: wantQty > stock, quantity: finalQty };
}

export function updateQuantity(productId, qty) {
  const cart = getCart();
  const item = cart.find((c) => c.product_id === productId);
  if (!item) return;
  const next = parseInt(qty);
  if (!Number.isFinite(next) || next <= 0) {
    setCart(cart.filter((c) => c.product_id !== productId));
    return;
  }
  item.quantity = Math.min(next, item.stock || next);
  setCart(cart);
}

export function removeFromCart(productId) {
  setCart(getCart().filter((c) => c.product_id !== productId));
}

export function clearCart() {
  setCart([]);
}

export function getCartCount() {
  return getCart().reduce((a, c) => a + c.quantity, 0);
}
