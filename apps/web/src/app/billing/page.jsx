import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ArrowLeft, Loader2, PackagePlus, Plus, Receipt, Trash2 } from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import useCart from "@/utils/useCart";
import { clearCart } from "@/utils/cartStore";
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
];

function lineId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function productLine(item) {
  return {
    id: lineId(),
    type: "product",
    productId: String(item.product_id),
    product: item,
    quantity: Number(item.quantity) || 1,
    selectedUnit: item.primary_unit || "piece",
    discount: "",
    taxRate: String(item.tax_rate || ""),
  };
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
  const [items, setItems] = useState(() => cart.map(productLine));
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [customerError, setCustomerError] = useState("");
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
  }, [shop?.shop_id]);

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
            ? priceForUnit(product?.selling_price, line.selectedUnit, product)
            : Math.max(0, Number(line.price) || 0);
        const discount = Math.min(quantity * price, Math.max(0, Number(line.discount) || 0));
        const taxable = quantity * price - discount;
        const taxRate = Math.max(0, Math.min(100, Number(line.taxRate) || 0));
        const tax = taxable * taxRate / 100;
        return { ...line, product, quantity, price, discount, taxable, tax, total: taxable + tax };
      }),
    [items, products],
  );
  const subtotal = calculated.reduce((total, item) => total + item.taxable, 0);
  const taxTotal = calculated.reduce((total, item) => total + item.tax, 0);
  const billDiscount = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0));
  const totalAmount = Math.max(0, subtotal - billDiscount + taxTotal);
  const defaultReceived = paymentMethod === "credit" ? 0 : totalAmount;
  const received = Math.min(totalAmount, Math.max(0, receivedAmount === "" ? defaultReceived : Number(receivedAmount) || 0));
  const balance = Math.max(0, totalAmount - received);

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

  const save = async (saveAndNew) => {
    if (!customerName.trim()) {
      setCustomerError("Customer name is required.");
      return;
    }
    if (!calculated.length) {
      setItemsError("Add at least one product or manual bill item.");
      return;
    }
    if (calculated.some((line) => line.quantity <= 0 || (line.type === "manual" && !String(line.name).trim()))) {
      setItemsError("Complete item names and quantities before saving.");
      return;
    }
    setCustomerError("");
    setItemsError("");
    setSubmitting(true);
    try {
      const checkoutSessionId = lineId();
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          buyerName: customerName,
          buyerPhone: phone,
          customerId: customerId || null,
          paymentMethod,
          receivedAmount: received,
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
                }
              : {
                  name: line.name,
                  hsnSac: line.hsnSac,
                  quantity: line.quantity,
                  unit: line.selectedUnit,
                  price: line.price,
                  discount: line.discount,
                  taxRate: line.taxRate,
                },
          ),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save invoice");
      clearCart();
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      showToast("Invoice saved");
      if (saveAndNew) {
        setItems([]);
        setCustomerName("");
        setPhone("");
        setCustomerId("");
        setReceivedAmount("");
        setDiscountAmount("");
        setNotes("");
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
                  setCustomerError("");
                }
              }}
            />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Customer name *</label>
            <Input
              value={customerName}
              onChange={(event) => {
                setCustomerName(event.target.value);
                if (event.target.value.trim()) setCustomerError("");
              }}
              placeholder="Customer name"
            />
            {customerError ? <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{customerError}</p> : null}
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Phone number</label>
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Invoice discount</label>
            <Input type="number" min="0" step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="mb-4 overflow-x-auto">
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
            <Row strong label="Total Amount" value={fmt(totalAmount)} />
            <div>
              <label className="block t-muted text-xs mb-1 mt-3">Received Amount</label>
              <Input type="number" min="0" step="0.01" value={receivedAmount} onChange={(event) => setReceivedAmount(event.target.value)} placeholder={String(defaultReceived.toFixed(2))} />
            </div>
            <Row strong label="Balance Amount" value={fmt(balance)} />
          </div>
          <div className="hidden lg:flex gap-2 mt-4">
            <Button variant="secondary" className="flex-1" disabled={submitting} onClick={() => save(true)}>Save & New</Button>
            <Button className="flex-1" disabled={submitting} onClick={() => save(false)}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} Save
            </Button>
          </div>
        </Card>
      </div>

      <div className="lg:hidden fixed bottom-20 left-3 right-3 z-20 t-card t-card-strong p-3 flex gap-2 no-print">
        <Button variant="secondary" className="flex-1" disabled={submitting} onClick={() => save(true)}>Save & New</Button>
        <Button className="flex-1" disabled={submitting} onClick={() => save(false)}>Save</Button>
      </div>

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
    <div className="rounded-2xl t-elev border t-border p-3 grid grid-cols-2 sm:grid-cols-8 gap-2 items-end">
      <div className="col-span-2">
        <label className="block t-dim text-[10px] mb-1">Item Name</label>
        {line.type === "product" ? (
          <div className="t-text text-sm font-medium py-2">{line.product?.title}</div>
        ) : (
          <Input value={line.name} onChange={(event) => update(line.id, { name: event.target.value })} placeholder="Manual item" />
        )}
      </div>
      <div>
        <label className="block t-dim text-[10px] mb-1">Qty</label>
        <Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => update(line.id, { quantity: event.target.value })} />
      </div>
      <div>
        <label className="block t-dim text-[10px] mb-1">Unit</label>
        <Select value={line.selectedUnit} onChange={(value) => update(line.id, { selectedUnit: value })} options={unitOptions} />
      </div>
      <div>
        <label className="block t-dim text-[10px] mb-1">Price / Unit</label>
        {line.type === "product" ? <div className="t-text text-sm py-2">{fmt(line.price)}</div> : <Input type="number" min="0" step="0.01" value={line.price} onChange={(event) => update(line.id, { price: event.target.value })} />}
      </div>
      <div>
        <label className="block t-dim text-[10px] mb-1">Discount</label>
        <Input type="number" min="0" step="0.01" value={line.discount} onChange={(event) => update(line.id, { discount: event.target.value })} />
      </div>
      <div>
        <label className="block t-dim text-[10px] mb-1">Tax %</label>
        <Input type="number" min="0" max="100" step="0.01" value={line.taxRate} onChange={(event) => update(line.id, { taxRate: event.target.value })} />
      </div>
      <div className="flex items-center justify-between gap-1">
        <div>
          <div className="t-dim text-[10px]">Amount</div>
          <div className="t-text text-sm font-bold">{fmt(line.total)}</div>
        </div>
        <button onClick={remove} className="t-btn-danger w-8 h-8 rounded-lg flex items-center justify-center" aria-label="Remove item"><Trash2 className="w-4 h-4" /></button>
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
