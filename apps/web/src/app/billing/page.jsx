import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import {
  Trash2,
  ShoppingCart,
  Receipt as ReceiptIcon,
  Loader2,
  Package,
  ArrowRight,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import useCart from "@/utils/useCart";
import { updateQuantity, removeFromCart, clearCart } from "@/utils/cartStore";
import { showToast } from "@/components/Toast";
import { formatMoney } from "@/utils/currency";
import {
  Button,
  Card,
  Input,
  Textarea,
  Select,
  QtyStepper,
} from "@/components/ui";
import { getProductUnitLabel } from "@/utils/productUnits";
import { shopHeaders } from "@/utils/shopContext";

const PAYMENT_METHODS = [
  { value: "cash", label: "💵 Cash" },
  { value: "card", label: "💳 Card" },
  { value: "upi", label: "📱 UPI" },
  { value: "bank_transfer", label: "🏦 Bank Transfer" },
  { value: "other", label: "✨ Other" },
];

const PAYMENT_STATUSES = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
];

export default function BillingPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const {
    cart,
    totalAmount,
    count: totalQuantity,
  } = useCart();
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [discountAmount, setDiscountAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currency = shop?.currency || "INR";
  const taxPercent = Number(shop?.tax_percent) || 0;
  const discount = Math.min(totalAmount, Math.max(0, Number(discountAmount) || 0));
  const taxableAmount = totalAmount - discount;
  const taxAmount = taxableAmount * (taxPercent / 100);
  const grandTotal = taxableAmount + taxAmount;
  const fmt = (n) => formatMoney(n, currency);
  const customersQuery = useQuery({
    queryKey: ["customers", "billing-select"],
    queryFn: async () => {
      const response = await fetch("/api/customers", { headers: shopHeaders() });
      if (!response.ok) return { customers: [] };
      return response.json();
    },
    enabled: !!user,
  });
  const customers = customersQuery.data?.customers || [];
  const customerOptions = [
    { value: "", label: "Walk-in customer" },
    ...customers.map((customer) => ({ value: String(customer.customer_id), label: customer.name })),
  ];

  const checkout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          buyerName,
          buyerPhone,
          customerId: customerId || null,
          paymentMethod,
          paymentStatus,
          discountAmount: discount,
          paidAmount: Number(paidAmount) || 0,
          dueDate: dueDate || null,
          notes,
          items: cart.map((c) => ({
            productId: c.product_id,
            quantity: c.quantity,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Checkout failed");
      }
      const data = await res.json();
      // Only clear cart on success — failure preserves it
      clearCart();
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      showToast("Receipt generated!");
      navigate(`/sales/${data.sale.sale_id}`);
    } catch (e) {
      console.error(e);
      showToast(e.message || "Checkout failed", "error");
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell currentPath="/billing">
      <div className="mb-5">
        <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">
          Billing & Checkout
        </h1>
        <p className="t-muted text-sm">
          Review cart, capture buyer details and generate the receipt.
        </p>
      </div>

      {cart.length === 0 ? (
        <Card className="text-center py-12">
          <ShoppingCart className="w-12 h-12 t-dim2 mx-auto mb-3" />
          <h3 className="t-text font-semibold mb-1">Your cart is empty</h3>
          <p className="t-muted text-sm mb-4">
            Add products from the Products page to start a sale.
          </p>
          <Link to="/products" className="inline-block">
            <Button variant="primary">
              Browse Products <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Card>
              <h3 className="t-text font-semibold mb-3 text-sm">
                Customer info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  value={customerId}
                  options={customerOptions}
                  placeholder="Saved customer"
                  onChange={(value) => {
                    setCustomerId(value);
                    const customer = customers.find((entry) => String(entry.customer_id) === value);
                    if (customer) {
                      setBuyerName(customer.name || "");
                      setBuyerPhone(customer.phone || "");
                    }
                  }}
                />
                <Input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Buyer name"
                />
                <Input
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="Buyer phone (optional)"
                />
                <Select
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={PAYMENT_METHODS}
                  placeholder="Payment method"
                />
                <Select
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  options={PAYMENT_STATUSES}
                  placeholder="Payment status"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="Discount amount"
                />
                {paymentStatus !== "paid" ? (
                  <>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder="Amount received"
                    />
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </>
                ) : null}
              </div>
              <div className="mt-3">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Notes (optional)"
                />
              </div>
            </Card>

            <Card>
              <h3 className="t-text font-semibold mb-3 text-sm">
                Cart items ({cart.length})
              </h3>
              <div className="space-y-2">
                {cart.map((item) => {
                  const unit = Number(item.selling_price);
                  const subtotal = unit * item.quantity;
                  const unitLabel = getProductUnitLabel(item);
                  return (
                    <div
                      key={item.product_id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl t-elev border t-border p-3"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-14 h-14 rounded-xl t-elev overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 t-dim2" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="t-text font-medium text-sm truncate">
                            {item.title}
                          </div>
                          <div className="t-dim text-xs truncate">
                            {item.description || "—"}
                          </div>
                          <div className="t-muted text-xs mt-0.5">
                            {fmt(unit)} / {unitLabel}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <QtyStepper
                          value={item.quantity}
                          onChange={(v) => updateQuantity(item.product_id, v)}
                          min={1}
                          max={item.stock}
                          size="sm"
                        />
                        <div className="text-right min-w-[80px]">
                          <div className="t-text font-bold text-sm">
                            {fmt(subtotal)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="w-8 h-8 rounded-lg t-btn-danger flex items-center justify-center"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div>
            <Card className="sticky top-24">
              <h3 className="t-text font-semibold mb-3 text-sm">Summary</h3>
              <div className="space-y-2 text-sm">
                <Row label="Total products" value={cart.length} />
                <Row label="Total quantity" value={totalQuantity} />
                <Row label="Subtotal" value={fmt(totalAmount)} />
                {discount > 0 ? <Row label="Discount" value={`- ${fmt(discount)}`} /> : null}
                {taxPercent > 0 ? (
                  <Row label={`Tax (${taxPercent}%)`} value={fmt(taxAmount)} />
                ) : null}
                <div className="flex justify-between t-text text-lg font-bold pt-2 t-divider">
                  <span>Total</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
              </div>

              <Button
                variant="primary"
                className="w-full mt-4"
                onClick={checkout}
                disabled={submitting || cart.length === 0}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ReceiptIcon className="w-4 h-4" />
                )}
                {submitting ? "Processing..." : "Generate Receipt"}
              </Button>

              <button
                onClick={() => clearCart()}
                className="w-full mt-2 t-btn px-4 py-2 text-xs"
              >
                Clear cart
              </button>
            </Card>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function Row({ label, value, subtle }) {
  return (
    <div className={`flex justify-between ${subtle ? "t-dim" : "t-muted"}`}>
      <span>{label}</span>
      <span className={subtle ? "" : "t-text"}>{value}</span>
    </div>
  );
}
