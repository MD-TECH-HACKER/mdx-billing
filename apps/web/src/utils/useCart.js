import { useEffect, useState, useCallback } from "react";
import { getCart } from "@/utils/cartStore";

export default function useCart() {
  const [cart, setCart] = useState(() =>
    typeof window === "undefined" ? [] : getCart(),
  );

  const refresh = useCallback(() => setCart(getCart()), []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    const onStorage = (e) => {
      if (e.key?.startsWith("mdx_cart_v3:")) refresh();
    };
    const onShopChange = () => refresh();
    window.addEventListener("cart-changed", onChange);
    window.addEventListener("shop-changed", onShopChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cart-changed", onChange);
      window.removeEventListener("shop-changed", onShopChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const count = cart.reduce((a, c) => a + c.quantity, 0);
  const totalAmount = cart.reduce(
    (a, c) => a + Number(c.selling_price ?? c.sellingPrice ?? c.price ?? c.unitPrice ?? 0) * c.quantity,
    0,
  );
  return { cart, count, totalAmount, refresh };
}
