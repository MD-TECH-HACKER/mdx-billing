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

function readProductId(item) {
  return item?.product_id ?? item?.productId ?? item?.id ?? null;
}

function readSellingPrice(item) {
  return item?.selling_price ?? item?.sellingPrice ?? item?.price ?? item?.unitPrice ?? 0;
}

function normalizeCartItem(item) {
  const productId = readProductId(item);
  if (!productId) return null;
  const stock = Number(item.stock) || Number(item.stock_base_unit) || 0;
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const primaryUnit = sanitizeProductUnit(item.primary_unit || item.primaryUnit, {
    fallback: "piece",
  });
  const secondaryUnit = sanitizeProductUnit(item.secondary_unit || item.secondaryUnit, {
    fallback: null,
  });

  return {
    ...item,
    product_id: productId,
    title: item.title || item.name || item.productNameSnapshot || "",
    image_url: item.image_url || item.imageUrl || null,
    selling_price: Number(readSellingPrice(item)) || 0,
    stock,
    quantity: stock > 0 ? Math.min(quantity, stock) : quantity,
    primary_unit: primaryUnit,
    secondary_unit: secondaryUnit,
    conversion_rate: Number(item.conversion_rate ?? item.conversionRate) || null,
    stock_base_unit: Number(item.stock_base_unit ?? item.stockBaseUnit) || stock,
    hsn_sac: item.hsn_sac || item.hsnSac || null,
    tax_rate: Number(item.tax_rate ?? item.taxRate) || 0,
  };
}

export function getCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeCartItem).filter(Boolean) : [];
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
  const productId = readProductId(product);
  if (!product || !productId) return { ok: false, reason: "invalid" };
  const stock = Number(product.stock) || 0;
  if (stock <= 0) return { ok: false, reason: "out_of_stock" };
  const primaryUnit = sanitizeProductUnit(product.primary_unit, {
    fallback: "piece",
  });
  const secondaryUnit = sanitizeProductUnit(product.secondary_unit, {
    fallback: null,
  });

  const cart = getCart();
  const existing = cart.find((c) => String(c.product_id) === String(productId));
  const wantQty = Math.max(1, parseInt(qty) || 1);

  if (existing) {
    const newQty = Math.min(existing.quantity + wantQty, stock);
    const exceeded = existing.quantity + wantQty > stock;
    existing.quantity = newQty;
    existing.stock = stock;
    existing.selling_price = Number(readSellingPrice(product));
    existing.primary_unit = primaryUnit;
    existing.secondary_unit = secondaryUnit;
    existing.conversion_rate = Number(product.conversion_rate) || null;
    existing.stock_base_unit = Number(product.stock_base_unit) || stock;
    existing.hsn_sac = product.hsn_sac || null;
    existing.tax_rate = Number(product.tax_rate) || 0;
    setCart(cart);
    return { ok: true, exceeded, quantity: newQty };
  }

  const finalQty = Math.min(wantQty, stock);
  cart.push({
    product_id: productId,
    title: product.title,
    description: product.description,
    image_url: product.image_url,
    selling_price: Number(readSellingPrice(product)),
    stock,
    quantity: finalQty,
    primary_unit: primaryUnit,
    secondary_unit: secondaryUnit,
    conversion_rate: Number(product.conversion_rate) || null,
    stock_base_unit: Number(product.stock_base_unit) || stock,
    hsn_sac: product.hsn_sac || null,
    tax_rate: Number(product.tax_rate) || 0,
  });
  setCart(cart);
  return { ok: true, exceeded: wantQty > stock, quantity: finalQty };
}

export function updateQuantity(productId, qty) {
  const cart = getCart();
  const item = cart.find((c) => String(c.product_id) === String(productId));
  if (!item) return;
  const next = parseInt(qty);
  if (!Number.isFinite(next) || next <= 0) {
    setCart(cart.filter((c) => String(c.product_id) !== String(productId)));
    return;
  }
  item.quantity = Math.min(next, item.stock || next);
  setCart(cart);
}

export function removeFromCart(productId) {
  setCart(getCart().filter((c) => String(c.product_id) !== String(productId)));
}

export function clearCart() {
  setCart([]);
}

export function getCartCount() {
  return getCart().reduce((a, c) => a + Number(c.quantity || 0), 0);
}
