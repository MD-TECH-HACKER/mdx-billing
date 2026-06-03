import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, PackagePlus, Plus, TrendingUp, X } from "lucide-react";
import { Badge, Button, Card, Input, Modal, Select, Textarea } from "@/components/ui";
import { showToast } from "@/components/Toast";
import useShop from "@/utils/useShop";
import useUser from "@/utils/useUser";
import { formatMoney } from "@/utils/currency";
import { shopHeaders } from "@/utils/shopContext";
import { availableSaleUnits, formatMovementQuantity, getUnitModel } from "@/utils/productUnits";

const EMPTY_LINE = { productId: "", quantity: "1", selectedUnit: "piece", unitCost: "", sellingPrice: "" };
const EMPTY_FORM = {
  supplierId: "",
  billNumber: "",
  purchaseDate: "",
  taxAmount: "",
  paymentStatus: "paid",
  paidAmount: "",
  paymentMethod: "cash",
  notes: "",
  items: [{ ...EMPTY_LINE }],
};
const PAYMENT_STATUS = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "credit", label: "Credit" },
];
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank" },
];

export default function PurchasesPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const currency = shop?.currency || "INR";

  const purchasesQuery = useQuery({
    queryKey: ["purchases", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/purchases", { headers: shopHeaders() });
      if (!response.ok) throw new Error("Failed to load purchases");
      return response.json();
    },
    enabled: !!user && !!shop?.shop_id,
  });
  const productsQuery = useQuery({
    queryKey: ["products", "purchase-select", shop?.shop_id],
    queryFn: async () => (await fetch("/api/products", { headers: shopHeaders() })).json(),
    enabled: !!user && !!shop?.shop_id,
  });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "purchase-select", shop?.shop_id],
    queryFn: async () => (await fetch("/api/suppliers", { headers: shopHeaders() })).json(),
    enabled: !!user && !!shop?.shop_id,
  });
  const movementsQuery = useQuery({
    queryKey: ["inventory-movements", shop?.shop_id],
    queryFn: async () => (await fetch("/api/inventory/movements", { headers: shopHeaders() })).json(),
    enabled: !!user && !!shop?.shop_id,
  });

  const products = productsQuery.data?.products || [];
  const suppliers = suppliersQuery.data?.suppliers || [];
  const purchases = purchasesQuery.data?.purchases || [];
  const movements = movementsQuery.data?.movements || [];
  const productOptions = products.map((product) => ({
    value: String(product.product_id),
    label: product.title,
  }));
  const supplierOptions = [
    { value: "", label: "No supplier selected" },
    ...suppliers.map((supplier) => ({
      value: String(supplier.supplier_id),
      label: supplier.name,
    })),
  ];

  const subtotal = useMemo(
    () => form.items.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0),
    [form.items],
  );
  const total = subtotal + (Number(form.taxAmount) || 0);

  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save purchase");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setOpen(false);
      setForm(EMPTY_FORM);
      showToast("Purchase added and stock updated");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const updateLine = (index, patch) => {
    const items = form.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    setForm({ ...form, items });
  };

  const chooseProduct = (index, productId) => {
    const product = products.find((entry) => String(entry.product_id) === productId);
    updateLine(index, {
      productId,
      unitCost: product ? String(product.cost_price || "") : "",
      sellingPrice: product ? String(product.selling_price || "") : "",
      selectedUnit: product ? getUnitModel(product).primaryUnit : "piece",
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Purchases & Stock In</h1>
          <p className="t-muted text-sm">Receive vendor stock and maintain an inventory trail.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <PackagePlus className="w-4 h-4" /> New Purchase
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div>
          {purchases.length === 0 ? (
            <Card className="py-12 text-center">
              <ClipboardList className="w-11 h-11 t-dim2 mx-auto mb-3" />
              <div className="t-text font-semibold">No purchase records</div>
              <div className="t-muted text-sm mt-1">Record inventory received from a supplier.</div>
            </Card>
          ) : (
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <Card key={purchase.purchase_id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="t-text font-semibold">
                        {purchase.bill_number || `Purchase #${purchase.purchase_id}`}
                      </div>
                      <div className="t-dim text-xs">
                        {purchase.supplier_name || "No supplier"} / {new Date(purchase.purchase_date).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge tone={purchase.payment_status === "paid" ? "success" : "warning"}>{purchase.payment_status}</Badge>
                      <div className="t-text font-bold mt-1">{formatMoney(purchase.total_amount, currency)}</div>
                      {Number(purchase.balance_amount) > 0 ? <div className="t-dim text-xs">Due {formatMoney(purchase.balance_amount, currency)}</div> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(purchase.items || []).map((item) => (
                      <span key={item.productId} className="t-elev rounded-xl px-3 py-1.5 text-xs t-muted">
                        {item.productNameSnapshot || item.title} x {item.quantity} {item.selectedUnit || ""}
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 t-accent-text" />
            <h2 className="t-text font-semibold text-sm">Recent Stock Movements</h2>
          </div>
          <div className="space-y-2">
            {movements.slice(0, 8).map((movement) => (
              <div key={movement.movement_id} className="t-elev rounded-xl p-3 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="t-text font-medium truncate">{movement.product_title}</span>
                  <span className={movement.quantity_change > 0 ? "text-emerald-400" : "text-rose-400"}>
                    {movement.quantity_change > 0 ? "+" : ""}{formatMovementQuantity(movement, movement)}
                  </span>
                </div>
                <div className="t-dim mt-1">{movement.movement_type.replace("_", " ")} / {new Date(movement.created_at).toLocaleString("en-IN")}</div>
              </div>
            ))}
            {movements.length === 0 ? <div className="t-dim text-sm py-4 text-center">No movements yet</div> : null}
          </div>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Receive purchase stock" maxWidth="max-w-2xl">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} options={supplierOptions} placeholder="Supplier" />
            <Input placeholder="Bill number" value={form.billNumber} onChange={(event) => setForm({ ...form, billNumber: event.target.value })} />
            <Input type="date" value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} />
          </div>

          <div className="space-y-2">
            {form.items.map((line, index) => (
              <div key={index} className="grid grid-cols-2 sm:grid-cols-[1fr_80px_100px_105px_105px_38px] gap-2 items-center">
                <Select value={line.productId} onChange={(productId) => chooseProduct(index, productId)} options={productOptions} placeholder="Product" />
                <Input required min="0.001" step="0.001" type="number" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                <Select
                  value={line.selectedUnit}
                  onChange={(selectedUnit) => updateLine(index, { selectedUnit })}
                  options={(availableSaleUnits(products.find((product) => String(product.product_id) === line.productId) || {}).map((unit) => ({ value: unit, label: unit })))}
                  placeholder="Unit"
                />
                <Input required min="0" step="0.01" type="number" value={line.unitCost} placeholder="Cost" onChange={(event) => updateLine(index, { unitCost: event.target.value })} />
                <Input min="0" step="0.01" type="number" value={line.sellingPrice} placeholder="New sale price" onChange={(event) => updateLine(index, { sellingPrice: event.target.value })} />
                <button
                  type="button"
                  className="t-btn-danger h-10 rounded-xl flex items-center justify-center disabled:opacity-40"
                  disabled={form.items.length === 1}
                  onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_LINE }] })}>
              <Plus className="w-3.5 h-3.5" /> Add Line
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Select value={form.paymentStatus} onChange={(paymentStatus) => setForm({ ...form, paymentStatus })} options={PAYMENT_STATUS} />
            <Select value={form.paymentMethod} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} options={PAYMENT_METHODS} />
            <Input type="number" step="0.01" min="0" placeholder="Amount paid" value={form.paidAmount} onChange={(event) => setForm({ ...form, paidAmount: event.target.value })} />
            <Input type="number" step="0.01" min="0" placeholder="Tax amount" value={form.taxAmount} onChange={(event) => setForm({ ...form, taxAmount: event.target.value })} />
          </div>
          <div className="t-elev rounded-xl px-3 py-2 flex justify-between">
            <div><div className="t-dim text-[10px]">Total</div><div className="t-text font-semibold">{formatMoney(total, currency)}</div></div>
            <div className="text-right"><div className="t-dim text-[10px]">Balance Due</div><div className="t-text font-semibold">{formatMoney(Math.max(0, total - (Number(form.paidAmount) || (form.paymentStatus === "paid" ? total : 0))), currency)}</div></div>
          </div>
          <Textarea rows={2} placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <Button type="submit" className="w-full" disabled={create.isPending || products.length === 0}>
            {create.isPending ? "Receiving..." : "Save purchase and update stock"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
