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
      if (e.key === "mdx_cart_v2") refresh();
    };
    window.addEventListener("cart-changed", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cart-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const count = cart.reduce((a, c) => a + c.quantity, 0);
  const totalAmount = cart.reduce(
    (a, c) => a + Number(c.selling_price) * c.quantity,
    0,
  );
  const totalCost = cart.reduce(
    (a, c) => a + Number(c.cost_price) * c.quantity,
    0,
  );
  const totalProfit = totalAmount - totalCost;

  return { cart, count, totalAmount, totalCost, totalProfit, refresh };
}
