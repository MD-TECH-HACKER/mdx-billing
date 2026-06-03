import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, Loader2, Package, PackagePlus, Plus, Receipt, Trash2 } from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import useCart from "@/utils/useCart";
import { clearCart, readCartSellingPrice } from "@/utils/cartStore";
import { showToast } from "@/components/Toast";
import { formatMoney } from "@/utils/currency";
import { Button, Card, Input, Modal, Select, Textarea } from "@/components/ui";
import {
  availableSaleUnits,
  priceForUnit,
  PRODUCT_UNITS,
} from "@/utils/productUnits";
import { shopHeaders } from "@/utils/shopContext";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
];
const BILLING_TYPES = [
  { value: "invoice", label: "Invoice", help: "Normal sale invoice, stock reduces" },
  { value: "estimate", label: "Estimate / Quotation", help: "Quote only, no stock out" },
  { value: "receipt", label: "Receipt", help: "Simple paid or balance receipt" },
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeBillingType(value) {
  if (value === "tax_invoice" || value === "gst_invoice") return "invoice";
  return BILLING_TYPES.some((type) => type.value === value) ? value : "invoice";
}

function lineId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readProductId(item) {
  return item?.product_id ?? item?.productId ?? item?.id ?? null;
}

function readSellingPrice(item) {
  return readCartSellingPrice(item);
}

function productLine(item, quotedUnitPrice = null) {
  const productId = readProductId(item);
  const snapshotPrice = Number(readSellingPrice(item)) || 0;
  return {
    id: lineId(),
    type: "product",
    productId: String(productId),
    product: { ...item, product_id: productId, selling_price: snapshotPrice },
    quantity: Number(item.quantity) || 1,
    selectedUnit: item.primary_unit || item.primaryUnit || "piece",
    discount: "",
    taxRate: String(item.tax_rate ?? item.taxRate ?? ""),
    quotedUnitPrice: quotedUnitPrice ?? (snapshotPrice > 0 ? snapshotPrice : null),
  };
}

function cartSignature(cart) {
  return cart
    .map((item) =>
      [
        readProductId(item),
        item.quantity,
        readSellingPrice(item),
        item.primary_unit || item.primaryUnit,
        item.secondary_unit || item.secondaryUnit,
        item.conversion_rate || item.conversionRate,
        item.stock,
        item.stock_base_unit || item.stockBaseUnit,
      ].join(":"),
    )
    .join("|");
}

function newManualLine() {
  return {
    id: lineId(),
    type: "manual",
    name: "",
    hsnSac: "",
    quantity: 1,
    selectedUnit: "pcs",
    price: "",
    discount: "",
    taxRate: "",
  };
}

export default function BillingPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const { cart } = useCart();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const hydratedEstimateId = useRef(null);
  const syncedCartSignature = useRef("");
  const [items, setItems] = useState(() => cart.map(item => productLine(item)));
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [customerStateCode, setCustomerStateCode] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [billingType, setBillingType] = useState("invoice");
  const [pendingBillingType, setPendingBillingType] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [sourceEstimate, setSourceEstimate] = useState(null);
  const [discountAmount, setDiscountAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [itemsError, setItemsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftProductId, setDraftProductId] = useState("");

  const currency = shop?.currency || "INR";
  const fmt = (amount) => formatMoney(amount, currency);
  const date = new Date().toLocaleDateString("en-IN");
  const invoiceNo = `${shop?.receipt_prefix || "INV"}-NEW`;
  const manualUnitOptions = [
    ...PRODUCT_UNITS.map((unit) => ({ value: unit.value, label: unit.label })),
    ...(Array.isArray(shop?.custom_units) ? shop.custom_units : [])
      .filter((unit) => !PRODUCT_UNITS.some((commonUnit) => commonUnit.value === String(unit).trim().toLowerCase()))
      .map((unit) => ({ value: String(unit).trim().toLowerCase(), label: String(unit).trim() })),
  ];

  useEffect(() => {
    setPaymentMethod(shop?.default_payment_method || "cash");
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    setBillingType(normalizeBillingType(params?.get("type") || shop?.default_invoice_type || "invoice"));
  }, [shop?.shop_id]);

  useEffect(() => {
    if (sourceEstimate) return;
    const signature = cartSignature(cart);
    if (signature === syncedCartSignature.current) return;
    syncedCartSignature.current = signature;
    setItems(cart.map(item => productLine(item)));
    setItemsError("");
  }, [cart, sourceEstimate]);

  const customersQuery = useQuery({
    queryKey: ["customers", "billing-select", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/customers", { headers: shopHeaders() });
      if (!response.ok) return { customers: [] };
      return response.json();
    },
    enabled: !!user && !!shop?.shop_id,
  });
  const productsQuery = useQuery({
    queryKey: ["products", "billing-select", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/products", { headers: shopHeaders() });
      if (!response.ok) return { products: [] };
      return response.json();
    },
    enabled: !!user && !!shop?.shop_id,
  });
  const customers = customersQuery.data?.customers || [];
  const products = productsQuery.data?.products || [];
  const customerOptions = [
    { value: "", label: "New customer" },
    ...customers.map((customer) => ({ value: String(customer.customer_id), label: customer.name })),
  ];
  const productOptions = products.map((product) => ({
    value: String(product.product_id),
    label: product.title,
  }));

  useEffect(() => {
    const estimate = location.state?.fromEstimate;
    if (!estimate || !productsQuery.isFetched || hydratedEstimateId.current === estimate.estimate_id) return;
    hydratedEstimateId.current = estimate.estimate_id;
    setSourceEstimate(estimate);
    setBillingType(normalizeBillingType(location.state?.targetType || "invoice"));
    setCustomerName(estimate.customer_name || "");
    setPhone(estimate.customer_phone || "");
    setCustomerEmail(estimate.customer_email || "");
    setCustomerGstin(estimate.customer_gstin || "");
    setBillingAddress(estimate.billing_address || "");
    setPlaceOfSupply(estimate.place_of_supply || "");
    setDiscountAmount(String(estimate.discount_amount || ""));
    setNotes(estimate.notes || "");
    setValidUntil(estimate.valid_until ? String(estimate.valid_until).slice(0, 10) : "");
    setItems(
      (Array.isArray(estimate.items) ? estimate.items : []).map((item) => {
        const product = products.find((record) => String(record.product_id) === String(item.productId));
        if (product) {
          return {
            ...productLine(product, Number(item.pricePerUnitAtSale ?? item.unitPrice) || 0),
            quantity: Number(item.quantity) || 1,
            selectedUnit: item.selectedUnit || product.primary_unit || "piece",
            discount: String(item.discountAmount || ""),
            taxRate: String(item.gstRateAtSale ?? item.taxRate ?? ""),
          };
        }
        return {
          ...newManualLine(),
          name: item.productNameSnapshot || item.title || "",
          hsnSac: item.hsnSacSnapshot || "",
          quantity: Number(item.quantity) || 1,
          selectedUnit: item.selectedUnit || "pcs",
          price: String(item.pricePerUnitAtSale ?? item.unitPrice ?? ""),
          discount: String(item.discountAmount || ""),
          taxRate: String(item.gstRateAtSale ?? item.taxRate ?? ""),
        };
      }),
    );
  }, [location.state, products, productsQuery.isFetched]);

  const calculated = useMemo(
    () =>
      items.map((line) => {
        const product =
          line.type === "product"
            ? products.find((record) => String(record.product_id) === String(line.productId)) || line.product
            : null;
        const quantity = Math.max(0, Number(line.quantity) || 0);
        const price =
          line.type === "product"
            ? line.quotedUnitPrice !== null && line.quotedUnitPrice !== undefined
              ? Math.max(0, Number(line.quotedUnitPrice) || 0)
              : priceForUnit(product?.selling_price, line.selectedUnit, product)
            : Math.max(0, Number(line.price) || 0);
        const discount = Math.min(quantity * price, Math.max(0, Number(line.discount) || 0));
        const grossAfterDiscount = quantity * price - discount;
        const taxRate = Math.max(0, Math.min(100, Number(line.taxRate) || 0));
        const taxMode =
          billingType === "gst_invoice"
            ? line.product?.tax_mode || shop?.tax_mode || "exclusive"
            : "exclusive";
        const taxable =
          taxMode === "inclusive" && taxRate > 0
            ? grossAfterDiscount / (1 + taxRate / 100)
            : grossAfterDiscount;
        const tax =
          taxMode === "inclusive" && taxRate > 0
            ? grossAfterDiscount - taxable
            : taxable * taxRate / 100;
        return { ...line, product, quantity, price, discount, taxable, tax, total: taxable + tax };
      }),
    [items, products, billingType, shop?.tax_mode],
  );
  const subtotal = calculated.reduce((total, item) => total + item.taxable, 0);
  const taxTotal = calculated.reduce((total, item) => total + item.tax, 0);
  const isInterState =
    billingType === "gst_invoice" &&
    shop?.state_code &&
    customerStateCode &&
    String(shop.state_code).trim() !== String(customerStateCode).trim();
  const cgstTotal = billingType === "gst_invoice" && !isInterState ? taxTotal / 2 : 0;
  const sgstTotal = billingType === "gst_invoice" && !isInterState ? taxTotal / 2 : 0;
  const igstTotal = billingType === "gst_invoice" && isInterState ? taxTotal : 0;
  const billDiscount = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0));
  const totalAmount = Math.max(0, subtotal - billDiscount + taxTotal);
  const defaultReceived = paymentMethod === "credit" ? 0 : totalAmount;
  const received = Math.min(totalAmount, Math.max(0, receivedAmount === "" ? defaultReceived : Number(receivedAmount) || 0));
  const balance = Math.max(0, totalAmount - received);
  const cleanEmailPreview = customerEmail.trim().toLowerCase();
  const hasValidCustomerEmail = !!cleanEmailPreview && EMAIL_PATTERN.test(cleanEmailPreview);
  const paymentState =
    totalAmount <= 0
      ? { label: "Pending", className: "bg-slate-100 text-slate-700 border-slate-200" }
      : balance <= 0
        ? { label: "Paid", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
        : received > 0
          ? { label: "Partial", className: "bg-amber-50 text-amber-700 border-amber-200" }
          : {
              label: paymentMethod === "credit" ? "Credit" : "Pending",
              className: "bg-rose-50 text-rose-700 border-rose-200",
            };
  const receiptEmailState = !cleanEmailPreview
    ? { label: "No customer email", className: "bg-slate-100 text-slate-600 border-slate-200" }
    : !hasValidCustomerEmail
      ? { label: "Invalid email", className: "bg-rose-50 text-rose-700 border-rose-200" }
      : shop?.send_receipt_email
        ? { label: "Will auto-send", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
        : { label: "Auto email off", className: "bg-amber-50 text-amber-700 border-amber-200" };

  const updateLine = (id, patch) => {
    setItems((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addProduct = () => {
    const product = products.find((record) => String(record.product_id) === draftProductId);
    if (!product) return;
    setItems((current) => [...current, productLine(product)]);
    setDraftProductId("");
    setAddOpen(false);
    setItemsError("");
  };

  const addManual = () => {
    setItems((current) => [...current, newManualLine()]);
    setAddOpen(false);
    setItemsError("");
  };
  const requestBillingType = (nextType) => {
    if (nextType === billingType) return;
    if (calculated.length > 0) {
      setPendingBillingType(nextType);
      return;
    }
    setBillingType(nextType);
  };

  const save = async (saveAndNew) => {
    if (!calculated.length) {
      setItemsError("Add at least one product or manual bill item.");
      return;
    }
    if (calculated.some((line) => line.quantity <= 0 || (line.type === "manual" && !String(line.name).trim()))) {
      setItemsError("Complete item names and quantities before saving.");
      return;
    }
    const cleanCustomerEmail = customerEmail.trim().toLowerCase();
    if (cleanCustomerEmail && !EMAIL_PATTERN.test(cleanCustomerEmail)) {
      showToast("Enter a valid customer email", "error");
      return;
    }
    setItemsError("");
    setSubmitting(true);
    try {
      const checkoutSessionId = lineId();
      const endpoint = billingType === "estimate" ? "/api/estimates" : "/api/sales";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          invoiceType: billingType,
          buyerName: customerName,
          buyerPhone: phone,
          customerEmail: cleanCustomerEmail,
          customerGstin,
          billingAddress,
          customerStateCode,
          placeOfSupply,
          customerId: customerId || null,
          paymentMethod,
          receivedAmount: received,
          dueDate,
          validUntil,
          sourceEstimateId: billingType === "estimate" ? null : sourceEstimate?.estimate_id || null,
          discountAmount: billDiscount,
          notes,
          checkoutSessionId,
          items: calculated.map((line) =>
            line.type === "product"
              ? {
                  productId: line.productId,
                  quantity: line.quantity,
                  selectedUnit: line.selectedUnit,
                  discount: line.discount,
                  taxRate: line.taxRate,
                  taxMode: billingType === "gst_invoice" ? (line.product?.tax_mode || shop?.tax_mode || "exclusive") : "exclusive",
                }
              : {
                  name: line.name,
                  hsnSac: line.hsnSac,
                  quantity: line.quantity,
                  unit: line.selectedUnit,
                  price: line.price,
                  discount: line.discount,
                  taxRate: line.taxRate,
                  taxMode: billingType === "gst_invoice" ? (shop?.tax_mode || "exclusive") : "exclusive",
                },
          ),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save bill");
      clearCart();
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      if (billingType === "estimate") {
        showToast("Estimate saved. Stock was not reduced.");
      } else if (result.receiptEmail?.sent) {
        showToast("Receipt created and emailed to customer.");
      } else if (result.receiptEmail?.attempted) {
        showToast("Receipt created, but email could not be sent.", "info");
      } else {
        showToast("Invoice saved");
      }
      if (saveAndNew) {
        setItems([]);
        setCustomerName("");
        setPhone("");
        setCustomerEmail("");
        setCustomerGstin("");
        setBillingAddress("");
        setCustomerStateCode("");
        setPlaceOfSupply("");
        setCustomerId("");
        setReceivedAmount("");
        setDueDate("");
        setValidUntil("");
        setDiscountAmount("");
        setNotes("");
        setSourceEstimate(null);
      } else if (billingType === "estimate") {
        navigate("/estimate");
      } else {
        navigate(`/sales/${result.sale.sale_id}`);
      }
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="lg:hidden mb-3 t-btn px-3 py-2 rounded-xl flex items-center gap-2 t-text text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="mb-4">
        <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Billing</h1>
        <p className="t-muted text-sm">Create product or manual invoices with payment balance tracking.</p>
      </div>
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          {BILLING_TYPES.map((type) => {
            const active = billingType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => requestBillingType(type.value)}
                className={`flex-1 min-w-[140px] rounded-2xl px-3 py-3 text-left border transition ${
                  active ? "t-accent-soft border-[rgba(var(--accent-rgb),0.35)]" : "t-elev t-border hover:bg-[var(--bg-elev)]"
                }`}
              >
                <div className="t-text text-sm font-bold">{type.label}</div>
                <div className="t-dim text-[10px] mt-0.5">{type.help}</div>
              </button>
            );
          })}
        </div>
      </Card>
      {sourceEstimate ? (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="t-text text-sm font-semibold">
              Converting estimate {sourceEstimate.estimate_number}
            </div>
            <div className="t-muted text-xs">
              Quoted item prices are preserved. Stock reduces only after this bill is saved.
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => {
            setSourceEstimate(null);
            hydratedEstimateId.current = null;
            navigate("/billing", { replace: true });
          }}>
            Clear Estimate
          </Button>
        </Card>
      ) : null}
      <Card className="mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <SummaryField label="Invoice No." value={invoiceNo} />
          <SummaryField label="Date" value={date} />
          <div>
            <label className="block t-muted text-xs mb-1">Payment type</label>
            <Select value={paymentMethod} onChange={setPaymentMethod} options={PAYMENT_METHODS} />
          </div>
          <div className="flex items-end">
            <Button variant="secondary" className="w-full" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" /> Add Items
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block t-muted text-xs mb-1">Saved customer</label>
            <Select
              value={customerId}
              options={customerOptions}
              onChange={(value) => {
                setCustomerId(value);
                const customer = customers.find((entry) => String(entry.customer_id) === value);
                if (customer) {
                  setCustomerName(customer.name || "");
                  setPhone(customer.phone || "");
                  setCustomerEmail(customer.email || "");
                } else {
                  setCustomerEmail("");
                }
              }}
            />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Customer name (optional)</label>
            <Input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Optional customer name"
            />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Phone number</label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Customer Email Optional</label>
            <Input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Optional customer email" />
          </div>
          {billingType === "gst_invoice" ? (
            <>
              <div>
                <label className="block t-muted text-xs mb-1">Customer GSTIN optional</label>
                <Input value={customerGstin} onChange={(event) => setCustomerGstin(event.target.value)} placeholder="Customer GSTIN" />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">Customer state code</label>
                <Input value={customerStateCode} onChange={(event) => setCustomerStateCode(event.target.value)} placeholder={shop?.state_code || "State code"} />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">Place of supply</label>
                <Input value={placeOfSupply} onChange={(event) => setPlaceOfSupply(event.target.value)} placeholder="Place of supply" />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">Billing address</label>
                <Input value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} placeholder="Billing address" />
              </div>
            </>
          ) : null}
          <div>
            <label className="block t-muted text-xs mb-1">Invoice discount</label>
            <Input type="number" min="0" step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} />
          </div>
          {paymentMethod === "credit" || balance > 0 ? (
            <div>
              <label className="block t-muted text-xs mb-1">Due date for credit sale</label>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
          ) : null}
          {billingType === "estimate" ? (
            <div>
              <label className="block t-muted text-xs mb-1">Valid until date</label>
              <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="t-text font-semibold">Invoice items</h2>
          <button className="t-accent-text text-sm font-medium" onClick={() => setAddOpen(true)}>+ Add item</button>
        </div>
        {calculated.length === 0 ? (
          <div className="py-8 text-center t-muted text-sm">
            Add a product or a manual item such as service, delivery or custom charge.
          </div>
        ) : (
          <div className="space-y-3">
            {calculated.map((line) => (
              <InvoiceLine key={line.id} line={line} currency={currency} manualUnitOptions={manualUnitOptions} update={updateLine} remove={() => setItems((current) => current.filter((item) => item.id !== line.id))} />
            ))}
          </div>
        )}
        {itemsError ? <p className="text-xs mt-3" style={{ color: "var(--danger)" }}>{itemsError}</p> : null}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 pb-24 lg:pb-0">
        <Card>
          <label className="block t-muted text-xs mb-1">Notes / Terms</label>
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional invoice note" />
        </Card>
        <Card>
          <div className="space-y-2 text-sm">
            <Row label="Subtotal" value={fmt(subtotal)} />
            {billDiscount > 0 ? <Row label="Discount" value={`- ${fmt(billDiscount)}`} /> : null}
            <Row label="Tax total" value={fmt(taxTotal)} />
            {billingType === "gst_invoice" ? (
              <>
                <Row label="CGST" value={fmt(cgstTotal)} />
                <Row label="SGST" value={fmt(sgstTotal)} />
                <Row label="IGST" value={fmt(igstTotal)} />
              </>
            ) : null}
            <Row strong label="Total Amount" value={fmt(totalAmount)} />
            <PillRow label="Payment Status" pill={paymentState} />
            <PillRow label="Receipt Email" pill={receiptEmailState} />
            <div>
              <label className="block t-muted text-xs mb-1 mt-3">Received Amount</label>
              <Input type="number" min="0" step="0.01" value={receivedAmount} onChange={(event) => setReceivedAmount(event.target.value)} placeholder={String(defaultReceived.toFixed(2))} />
            </div>
            <Row strong label="Balance Amount" value={fmt(balance)} />
          </div>
          <div className="hidden lg:flex gap-2 mt-4">
            <Button variant="secondary" className="flex-1" disabled={submitting} onClick={() => save(true)}>Save & New</Button>
            <Button className="flex-1" disabled={submitting} onClick={() => save(false)}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} {billingType === "estimate" ? "Save Estimate" : "Save"}
            </Button>
          </div>
        </Card>
      </div>

      <div className="lg:hidden fixed bottom-20 left-3 right-3 z-20 t-card t-card-strong p-3 flex gap-2 no-print">
        <Button variant="secondary" className="flex-1" disabled={submitting} onClick={() => save(true)}>Save & New</Button>
        <Button className="flex-1" disabled={submitting} onClick={() => save(false)}>{billingType === "estimate" ? "Save Estimate" : "Save"}</Button>
      </div>
      <Modal open={!!pendingBillingType} onClose={() => setPendingBillingType(null)} title="Change billing type?">
        <div className="space-y-4">
          <p className="t-muted text-sm">
            Changing type can change tax and stock behavior. Estimate will not reduce stock until converted.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPendingBillingType(null)}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={() => {
                setBillingType(pendingBillingType);
                setPendingBillingType(null);
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Item">
        <div className="space-y-4">
          <div>
            <div className="t-muted text-xs mb-2">Product item</div>
            <div className="flex gap-2">
              <Select value={draftProductId} onChange={setDraftProductId} options={productOptions} placeholder="Choose product" />
              <Button onClick={addProduct} disabled={!draftProductId}>Add</Button>
            </div>
          </div>
          <div className="t-divider pt-4">
            <Button variant="secondary" className="w-full" onClick={addManual}>
              <PackagePlus className="w-4 h-4" /> Add manual bill item
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function InvoiceLine({ line, currency, manualUnitOptions, update, remove }) {
  const unitOptions =
    line.type === "product"
      ? availableSaleUnits(line.product).map((value) => ({ value, label: value }))
      : manualUnitOptions;
  const fmt = (amount) => formatMoney(amount, currency);
  return (
    <div className="rounded-2xl t-elev border t-border p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(80px,.7fr)_minmax(105px,.9fr)_minmax(105px,1fr)_minmax(82px,.75fr)_minmax(82px,.75fr)_minmax(130px,1.2fr)] gap-2 items-end min-w-0 max-w-full overflow-hidden">
      <div className="sm:col-span-2 lg:col-span-1 min-w-0">
        <label className="block t-dim text-[10px] mb-1">Item Name</label>
        {line.type === "product" ? (
          <div className="flex items-center gap-2 py-1 min-w-0">
            <div className="w-10 h-10 rounded-lg t-elev overflow-hidden flex-shrink-0 flex items-center justify-center">
              {line.product?.image_url ? (
                <img src={line.product.image_url} alt={line.product.title} className="w-full h-full object-cover" />
              ) : (
                <Package className="w-5 h-5 t-dim2" />
              )}
            </div>
            <span className="t-text text-sm font-medium truncate">{line.product?.title}</span>
          </div>
        ) : (
          <Input value={line.name} onChange={(event) => update(line.id, { name: event.target.value })} placeholder="Manual item" />
        )}
      </div>
      <div className="min-w-0">
        <label className="block t-dim text-[10px] mb-1">Qty</label>
        <Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => update(line.id, { quantity: event.target.value })} />
      </div>
      <div className="min-w-0">
        <label className="block t-dim text-[10px] mb-1">Unit</label>
        <Select
          value={line.selectedUnit}
          onChange={(value) => update(line.id, {
            selectedUnit: value,
            quotedUnitPrice: value === line.selectedUnit ? line.quotedUnitPrice : null,
          })}
          options={unitOptions}
        />
      </div>
      <div className="min-w-0">
        <label className="block t-dim text-[10px] mb-1">Price / Unit</label>
        {line.type === "product" ? <div className="t-text text-sm py-2 break-words">{fmt(line.price)}</div> : <Input type="number" min="0" step="0.01" value={line.price} onChange={(event) => update(line.id, { price: event.target.value })} />}
      </div>
      <div className="min-w-0">
        <label className="block t-dim text-[10px] mb-1">Discount</label>
        <Input type="number" min="0" step="0.01" value={line.discount} onChange={(event) => update(line.id, { discount: event.target.value })} />
      </div>
      <div className="min-w-0">
        <label className="block t-dim text-[10px] mb-1">Tax %</label>
        <Input type="number" min="0" max="100" step="0.01" value={line.taxRate} onChange={(event) => update(line.id, { taxRate: event.target.value })} />
      </div>
      <div className="flex items-end justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="t-dim text-[10px]">Amount</div>
          <div className="t-text text-sm font-bold break-words">{fmt(line.total)}</div>
        </div>
        <button onClick={remove} className="t-btn-danger w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" aria-label="Remove item"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function SummaryField({ label, value }) {
  return <div><div className="t-muted text-xs mb-1">{label}</div><div className="t-text text-sm font-semibold py-2">{value}</div></div>;
}

function Row({ label, value, strong = false }) {
  return <div className={`flex justify-between pt-2 ${strong ? "t-text text-base font-bold t-divider" : "t-muted"}`}><span>{label}</span><span className={strong ? "" : "t-text"}>{value}</span></div>;
}

function PillRow({ label, pill }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2 t-muted">
      <span>{label}</span>
      <span className={`border rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${pill.className}`}>
        {pill.label}
      </span>
    </div>
  );
}
