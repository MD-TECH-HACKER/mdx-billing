// Cart store backed by localStorage with stock-safe operations.
const KEY = "mdx_cart_v2";
const EVENT = "cart-changed";

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function getCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCart(items) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  emit();
}

// Add `qty` units of `product`. If already in cart, increase the quantity
// (do NOT create a duplicate row). Clamp to available stock.
export function addToCart(product, qty = 1) {
  if (!product || !product.product_id) return { ok: false, reason: "invalid" };
  const stock = Number(product.stock) || 0;
  if (stock <= 0) return { ok: false, reason: "out_of_stock" };

  const cart = getCart();
  const existing = cart.find((c) => c.product_id === product.product_id);
  const wantQty = Math.max(1, parseInt(qty) || 1);

  if (existing) {
    const newQty = Math.min(existing.quantity + wantQty, stock);
    const exceeded = existing.quantity + wantQty > stock;
    existing.quantity = newQty;
    existing.stock = stock;
    existing.selling_price = Number(product.selling_price);
    existing.cost_price = Number(product.cost_price);
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
    cost_price: Number(product.cost_price),
    stock,
    quantity: finalQty,
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
