// Reusable cart panel — used as a sticky sidebar on desktop Products page
// and as a bottom-sheet drawer on mobile.
import { Package, ShoppingCart, Trash2, ArrowRight, X } from "lucide-react";
import { QtyStepper, Button } from "@/components/ui";
import { formatMoney } from "@/utils/currency";
import { updateQuantity, removeFromCart, clearCart } from "@/utils/cartStore";
import useCart from "@/utils/useCart";

export default function CartPanel({
  currency = "INR",
  taxPercent = 0,
  onCheckout,
  variant = "sidebar", // "sidebar" | "drawer"
  onClose,
}) {
  const { cart, count, totalAmount } = useCart();
  const taxAmount = totalAmount * (taxPercent / 100);
  const grandTotal = totalAmount + taxAmount;
  const fmt = (n) => formatMoney(n, currency);

  const Inner = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "rgba(var(--accent-rgb), 0.18)",
              color: "var(--accent)",
            }}
          >
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <div className="t-text font-semibold text-sm">Current Cart</div>
            <div className="t-dim text-xs">
              {count} {count === 1 ? "item" : "items"}
            </div>
          </div>
        </div>
        {variant === "drawer" ? (
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl t-elev flex items-center justify-center t-text"
            aria-label="Close cart"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
          <div
            className="w-14 h-14 rounded-2xl t-elev flex items-center justify-center mb-3"
            style={{ color: "var(--text-dim)" }}
          >
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div className="t-text font-medium text-sm mb-1">
            Your cart is empty
          </div>
          <div className="t-dim text-xs">
            Set quantity and tap “Add to cart” on any product.
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
            {cart.map((item) => {
              const subtotal =
                Number(item.selling_price) * Number(item.quantity);
              return (
                <div
                  key={item.product_id}
                  className="flex gap-2 rounded-2xl t-elev border t-border p-2"
                >
                  <div className="w-12 h-12 rounded-xl t-elev overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-5 h-5 t-dim2" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="t-text text-sm font-medium truncate">
                      {item.title}
                    </div>
                    <div className="t-dim text-[11px] mb-1">
                      {fmt(item.selling_price)} each
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <QtyStepper
                        value={item.quantity}
                        onChange={(v) => updateQuantity(item.product_id, v)}
                        min={1}
                        max={item.stock}
                        size="sm"
                      />
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{
                          background: "rgba(244,63,94,0.12)",
                          color: "var(--danger)",
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="t-dim text-[10px]">Subtotal</div>
                    <div className="t-text font-bold text-sm">
                      {fmt(subtotal)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 t-divider pt-3 space-y-1 text-sm">
            <div className="flex justify-between t-muted">
              <span>Subtotal</span>
              <span className="t-text">{fmt(totalAmount)}</span>
            </div>
            {taxPercent > 0 ? (
              <div className="flex justify-between t-muted">
                <span>Tax ({taxPercent}%)</span>
                <span className="t-text">{fmt(taxAmount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-baseline pt-1 t-divider mt-1">
              <span className="t-text font-semibold">Total</span>
              <span className="t-text font-bold text-lg">
                {fmt(grandTotal)}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <Button
              variant="primary"
              className="w-full"
              onClick={onCheckout}
              disabled={cart.length === 0}
            >
              Proceed to Billing
              <ArrowRight className="w-4 h-4" />
            </Button>
            <button
              onClick={() => clearCart()}
              className="w-full t-btn px-4 py-2 text-xs"
            >
              Clear cart
            </button>
          </div>
        </>
      )}
    </div>
  );

  if (variant === "drawer") {
    return (
      <div className="fixed inset-0 z-50 flex items-end no-print">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative w-full t-card t-card-strong rounded-t-3xl p-4 max-h-[85vh] flex flex-col">
          {Inner}
        </div>
      </div>
    );
  }

  // sidebar (sticky on desktop)
  return (
    <div
      className="t-card p-4 sticky top-24 flex flex-col"
      style={{ maxHeight: "calc(100vh - 7rem)" }}
    >
      {Inner}
    </div>
  );
}
