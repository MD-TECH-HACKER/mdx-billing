import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  Plus,
  Package,
  Edit2,
  Trash2,
  Info,
  ShoppingCart,
  Upload,
  ShoppingBag,
} from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import useUpload from "@/utils/useUpload";
import { addToCart } from "@/utils/cartStore";
import useCart from "@/utils/useCart";
import { showToast } from "@/components/Toast";
import { formatMoney } from "@/utils/currency";
import {
  Button,
  Card,
  Input,
  Textarea,
  SearchInput,
  QtyStepper,
  Modal,
  ConfirmDialog,
  Badge,
  Skeleton,
  Select,
  Toggle,
} from "@/components/ui";
import CartPanel from "@/components/CartPanel";
import {
  convertUnitPrice,
  formatMovementQuantity,
  formatStockQuantity,
  getProductUnitLabel,
  getStockBaseQuantity,
  priceForUnit,
  PRODUCT_UNITS,
  toBaseQuantity,
} from "@/utils/productUnits";
import { shopHeaders } from "@/utils/shopContext";

const EMPTY_SUPPLIER = {
  name: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  upiId: "",
  notes: "",
  qrImageUrl: "",
};

const EMPTY_CATEGORY = {
  name: "",
  description: "",
  icon: "",
  color: "#F97316",
};

function SearchCreateSelect({
  value,
  onChange,
  options,
  placeholder,
  createLabel,
  onCreate,
  loading,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => String(option.value) === String(value));
  const filtered = options.filter((option) => {
    const haystack = `${option.label || ""} ${option.description || ""} ${option.meta || ""}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="t-input w-full px-3 py-2.5 text-sm flex items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="t-text font-medium truncate block">{selected.label}</span>
              {selected.description ? <span className="t-dim text-[10px] truncate block">{selected.description}</span> : null}
            </>
          ) : (
            <span className="t-dim2">{placeholder}</span>
          )}
        </span>
        <span className="t-dim text-xs">v</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] t-card t-card-strong p-2 shadow-2xl max-h-80 overflow-y-auto">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            autoFocus
            className="mb-2"
          />
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded-xl text-sm t-muted hover:bg-[var(--bg-elev)]"
          >
            Clear selection
          </button>
          {loading ? (
            <div className="px-3 py-4 text-sm t-muted">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm t-muted">No matches</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(String(option.value));
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-[var(--bg-elev)] ${
                  String(option.value) === String(value) ? "t-accent-soft" : "t-text"
                }`}
              >
                <span className="font-medium block truncate">{option.label}</span>
                {option.description ? <span className="t-dim text-[10px] block truncate">{option.description}</span> : null}
                {option.meta ? <span className="t-dim text-[10px] block truncate">{option.meta}</span> : null}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreate?.();
            }}
            className="w-full mt-2 px-3 py-2 rounded-xl text-sm font-semibold t-accent-soft text-left"
          >
            + {createLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ProductForm({ open, onClose, initial, onSaved, shop }) {
  const [upload, { loading: uploading }] = useUpload();
  const qc = useQueryClient();
  const unitOptions = [
    ...PRODUCT_UNITS,
    ...(Array.isArray(shop?.custom_units) ? shop.custom_units : [])
      .filter((unit) => !PRODUCT_UNITS.some((commonUnit) => commonUnit.value === String(unit).trim().toLowerCase()))
      .map((unit) => ({ value: String(unit).trim().toLowerCase(), label: String(unit).trim() })),
  ];
  const secondaryUnitOptions = [
    { value: "", label: "No secondary unit" },
    ...unitOptions,
  ];
  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "product-form", shop?.shop_id],
    queryFn: async () => (await fetch("/api/suppliers", { headers: shopHeaders() })).json(),
    enabled: open,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", "product-form", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/categories", { headers: shopHeaders() });
      if (!response.ok) return { categories: [] };
      return response.json();
    },
    enabled: open,
  });
  const supplierOptions = (suppliersQuery.data?.suppliers || []).map((supplier) => ({
    value: String(supplier.supplier_id),
    label: supplier.name,
    description: [supplier.phone, supplier.gstin ? `GSTIN ${supplier.gstin}` : null].filter(Boolean).join(" / "),
    meta: supplier.balance_due ? `Due ${formatMoney(supplier.balance_due, shop?.currency || "INR")}` : "",
  }));
  const categoryOptions = (categoriesQuery.data?.categories || []).map((category) => ({
    value: String(category.category_id),
    label: category.name,
    description: `${category.product_count || 0} products`,
    meta: category.stock_value ? `Stock ${formatMoney(category.stock_value, shop?.currency || "INR")}` : "",
  }));
  const [form, setForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    sellingPrice: "",
    costPrice: "",
    stock: "",
    openingStockUnit: "piece",
    conversionRate: "",
    hsnSac: "",
    lowStockAlertQuantity: "",
    taxRate: "",
    supplierId: "",
    categoryId: "",
    category: "",
    sku: "",
    primaryUnit: "piece",
    secondaryUnit: "",
    taxMode: "exclusive",
    gstExempt: false,
    cessRate: "",
    productStatus: "active",
  });
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingRelated, setCreatingRelated] = useState(false);
  const primaryUnitLabel = form.primaryUnit || "piece";
  const unitPriceModel = {
    primaryUnit: primaryUnitLabel,
    secondaryUnit: form.secondaryUnit || "",
    conversionRate: Number(form.conversionRate) || null,
  };
  const conversionEnabled = !!unitPriceModel.secondaryUnit && Number(unitPriceModel.conversionRate) > 0;
  const openingStockUnit =
    conversionEnabled && form.openingStockUnit === unitPriceModel.secondaryUnit
      ? unitPriceModel.secondaryUnit
      : primaryUnitLabel;
  const openingStockUnitOptions = [
    { value: primaryUnitLabel, label: primaryUnitLabel },
    ...(conversionEnabled ? [{ value: unitPriceModel.secondaryUnit, label: unitPriceModel.secondaryUnit }] : []),
  ];
  const secondaryCostPrice = conversionEnabled
    ? priceForUnit(form.costPrice, unitPriceModel.secondaryUnit, unitPriceModel)
    : 0;
  const secondarySellingPrice = conversionEnabled
    ? priceForUnit(form.sellingPrice, unitPriceModel.secondaryUnit, unitPriceModel)
    : 0;
  const openingStockQuantity = Math.max(0, Number(form.stock) || 0);
  const openingStockBaseQuantity = toBaseQuantity(openingStockQuantity, openingStockUnit, unitPriceModel);
  const openingCostValue = openingStockQuantity * priceForUnit(form.costPrice, openingStockUnit, unitPriceModel);
  const expectedSalesValue = openingStockQuantity * priceForUnit(form.sellingPrice, openingStockUnit, unitPriceModel);

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title || "",
        description: initial.description || "",
        imageUrl: initial.image_url || "",
        sellingPrice: String(initial.selling_price || ""),
        costPrice: String(initial.cost_price || ""),
        stock: String(initial.stock || ""),
        openingStockUnit: initial.primary_unit || "piece",
        category: initial.category || "",
        categoryId: String(initial.category_id || ""),
        sku: initial.sku || "",
        primaryUnit: initial.primary_unit || "piece",
        secondaryUnit: initial.secondary_unit || "",
        conversionRate: String(initial.conversion_rate || ""),
        hsnSac: initial.hsn_sac || "",
        lowStockAlertQuantity: String(initial.reorder_level || ""),
        taxRate: String(initial.gst_rate ?? initial.tax_rate ?? ""),
        taxMode: initial.tax_mode || "exclusive",
        gstExempt: !!initial.gst_exempt,
        cessRate: String(initial.cess_rate || ""),
        productStatus: initial.product_status || "active",
        supplierId: String(initial.supplier_id || ""),
      });
    } else {
      setForm({
        title: "",
        description: "",
        imageUrl: "",
        sellingPrice: "",
        costPrice: "",
        stock: "",
        openingStockUnit: "piece",
        category: "",
        sku: "",
        primaryUnit: "piece",
        secondaryUnit: "",
        conversionRate: "",
        hsnSac: "",
        lowStockAlertQuantity: "",
        taxRate: "",
        taxMode: shop?.tax_mode || "exclusive",
        gstExempt: false,
        cessRate: "",
        productStatus: "active",
        supplierId: "",
        categoryId: "",
      });
    }
    setError("");
  }, [initial, open, shop?.tax_mode]);

  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPG, WEBP allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Max 5MB");
      return;
    }
    const { url, error: upErr } = await upload({ file });
    if (upErr) {
      setError(upErr);
      return;
    }
    setForm((f) => ({ ...f, imageUrl: url }));
  };

  const handleSupplierQr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPG, WEBP allowed for QR image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Max QR image size is 5MB");
      return;
    }
    const { url, error: upErr } = await upload({ file });
    if (upErr) {
      setError(upErr);
      return;
    }
    setSupplierForm((current) => ({ ...current, qrImageUrl: url }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Title required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        imageUrl: form.imageUrl,
        category: form.category,
        categoryId: form.categoryId || null,
        sku: form.sku,
        primaryUnit: form.primaryUnit,
        secondaryUnit: form.secondaryUnit,
        conversionRate: Number(form.conversionRate) || null,
        hsnSac: form.hsnSac,
        lowStockAlertQuantity: Number(form.lowStockAlertQuantity) || 0,
        taxRate: Number(form.taxRate) || 0,
        gstRate: Number(form.taxRate) || 0,
        taxMode: form.taxMode,
        gstExempt: form.gstExempt,
        cessRate: Number(form.cessRate) || 0,
        productStatus: form.productStatus,
        supplierId: form.supplierId || null,
      };
      if (!initial) {
        payload.sellingPrice = Number(form.sellingPrice) || 0;
        payload.costPrice = Number(form.costPrice) || 0;
        payload.stock = Number(form.stock) || 0;
        payload.openingStock = Number(form.stock) || 0;
        payload.openingStockUnit = openingStockUnit;
      }
      const res = await fetch(
        initial ? `/api/products/${initial.product_id}` : "/api/products",
        {
          method: initial ? "PUT" : "POST",
          headers: shopHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      showToast(initial ? "Product updated" : "Product added");
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const createSupplier = async (event) => {
    event.preventDefault();
    if (!supplierForm.name.trim()) {
      setError("Supplier name required");
      return;
    }
    setCreatingRelated(true);
    try {
      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(supplierForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && data.supplier?.supplier_id) {
          setForm((current) => ({ ...current, supplierId: String(data.supplier.supplier_id) }));
          setSupplierModalOpen(false);
          showToast("Existing supplier selected.");
          return;
        }
        throw new Error(data.error || "Could not create supplier");
      }
      setForm((current) => ({ ...current, supplierId: String(data.supplier.supplier_id) }));
      setSupplierForm(EMPTY_SUPPLIER);
      setSupplierModalOpen(false);
      await suppliersQuery.refetch();
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      showToast("Supplier created and selected.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingRelated(false);
    }
  };

  const createCategory = async (event) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      setError("Category name required");
      return;
    }
    setCreatingRelated(true);
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(categoryForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && data.category?.category_id) {
          setForm((current) => ({
            ...current,
            categoryId: String(data.category.category_id),
            category: data.category.name,
          }));
          setCategoryModalOpen(false);
          showToast("Existing category selected.");
          return;
        }
        throw new Error(data.error || "Could not create category");
      }
      setForm((current) => ({
        ...current,
        categoryId: String(data.category.category_id),
        category: data.category.name,
      }));
      setCategoryForm(EMPTY_CATEGORY);
      setCategoryModalOpen(false);
      await categoriesQuery.refetch();
      qc.invalidateQueries({ queryKey: ["categories"] });
      showToast("Category created and selected.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingRelated(false);
    }
  };

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Product" : "Add Product"}
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="flex justify-center">
          <label className="cursor-pointer group">
            <div className="w-28 h-28 rounded-2xl t-elev border-2 border-dashed t-border flex items-center justify-center overflow-hidden hover:border-[var(--accent)] transition">
              {form.imageUrl ? (
                <img
                  src={form.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Upload className="w-6 h-6 t-dim2" />
              )}
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleImage}
            />
          </label>
        </div>
        {uploading ? (
          <div className="text-center t-dim text-xs">Uploading...</div>
        ) : null}

        <div>
          <label className="block t-muted text-xs mb-1">Product title *</label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Premium T-shirt"
          />
        </div>

        <div>
          <label className="block t-muted text-xs mb-1">Description</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="Short description"
          />
        </div>

        {!initial ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block t-muted text-xs mb-1">Opening stock quantity</label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">Opening stock unit</label>
              <Select
                value={openingStockUnit}
                onChange={(value) => setForm({ ...form, openingStockUnit: value })}
                options={openingStockUnitOptions}
              />
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">Cost price / 1 {primaryUnitLabel}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">Selling price / 1 {primaryUnitLabel}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.sellingPrice}
                onChange={(e) =>
                  setForm({ ...form, sellingPrice: e.target.value })
                }
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl t-accent-soft px-3 py-2 text-xs">
            Stock, cost price and selling price are managed from Add New Stock or Purchases, not Edit Product.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block t-muted text-xs mb-1">Category</label>
            <SearchCreateSelect
              value={form.categoryId}
              onChange={(categoryId) => {
                const category = categoryOptions.find((option) => String(option.value) === String(categoryId));
                setForm({ ...form, categoryId, category: category?.label || "" });
              }}
              options={categoryOptions}
              placeholder="Select category"
              createLabel="Create New Category"
              loading={categoriesQuery.isLoading}
              onCreate={() => setCategoryModalOpen(true)}
            />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">SKU</label>
            <Input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block t-muted text-xs mb-1">Primary unit</label>
            <Select
              value={form.primaryUnit}
              onChange={(value) => setForm((current) => ({
                ...current,
                primaryUnit: value,
                openingStockUnit: current.openingStockUnit === current.primaryUnit ? value : current.openingStockUnit,
              }))}
              options={unitOptions}
              placeholder="Primary unit"
            />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Secondary unit</label>
            <Select
              value={form.secondaryUnit}
              onChange={(value) => setForm((current) => ({
                ...current,
                secondaryUnit: value,
                openingStockUnit: current.openingStockUnit === current.secondaryUnit ? current.primaryUnit : current.openingStockUnit,
              }))}
              options={secondaryUnitOptions}
              placeholder="Secondary unit"
            />
          </div>
        </div>
        {form.secondaryUnit ? (
          <div>
            <label className="block t-muted text-xs mb-1">
              How many {form.secondaryUnit} are in 1 {form.primaryUnit}?
            </label>
            <Input
              type="number"
              min="0.001"
              step="0.001"
              value={form.conversionRate}
              onChange={(e) => setForm({ ...form, conversionRate: e.target.value })}
              placeholder={`Example: 50 for 1 ${form.primaryUnit} = 50 ${form.secondaryUnit}`}
            />
            {form.conversionRate ? (
              <div className="t-accent-soft rounded-xl px-3 py-2 text-xs mt-2">
                Stock rule: 1 {form.primaryUnit} contains {form.conversionRate} {form.secondaryUnit}.
                Quantities are tracked in {form.secondaryUnit} so partial {form.primaryUnit} sales remain accurate.
              </div>
            ) : null}
          </div>
        ) : null}
        {!initial ? (
          <div className="rounded-2xl t-elev border t-border p-3 text-xs space-y-2">
            <div className="t-text font-semibold">Price calculation</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-xl t-card px-3 py-2 flex justify-between gap-3">
                <span className="t-muted">Cost / 1 {primaryUnitLabel}</span>
                <span className="t-text font-semibold">{formatMoney(form.costPrice || 0, shop?.currency || "INR")}</span>
              </div>
              <div className="rounded-xl t-card px-3 py-2 flex justify-between gap-3">
                <span className="t-muted">Sell / 1 {primaryUnitLabel}</span>
                <span className="t-text font-semibold">{formatMoney(form.sellingPrice || 0, shop?.currency || "INR")}</span>
              </div>
              {conversionEnabled ? (
                <>
                  <div className="rounded-xl t-card px-3 py-2 flex justify-between gap-3">
                    <span className="t-muted">Secondary cost price / 1 {unitPriceModel.secondaryUnit}</span>
                    <span className="t-text font-semibold">{formatMoney(secondaryCostPrice, shop?.currency || "INR")}</span>
                  </div>
                  <div className="rounded-xl t-card px-3 py-2 flex justify-between gap-3">
                    <span className="t-muted">Secondary selling price / 1 {unitPriceModel.secondaryUnit}</span>
                    <span className="t-text font-semibold">{formatMoney(secondarySellingPrice, shop?.currency || "INR")}</span>
                  </div>
                </>
              ) : null}
              <div className="rounded-xl t-card px-3 py-2 flex justify-between gap-3">
                <span className="t-muted">Opening stock ({formatStockQuantity(openingStockBaseQuantity, unitPriceModel)}) cost value</span>
                <span className="t-text font-semibold">{formatMoney(openingCostValue, shop?.currency || "INR")}</span>
              </div>
              <div className="rounded-xl t-accent-soft px-3 py-2 flex justify-between gap-3">
                <span>Expected sales value</span>
                <span className="font-semibold">{formatMoney(expectedSalesValue, shop?.currency || "INR")}</span>
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block t-muted text-xs mb-1">HSN/SAC</label>
            <Input value={form.hsnSac} onChange={(e) => setForm({ ...form, hsnSac: e.target.value })} />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Low stock alert</label>
            <Input type="number" min="0" step="0.001" value={form.lowStockAlertQuantity} onChange={(e) => setForm({ ...form, lowStockAlertQuantity: e.target.value })} />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Tax / GST %</label>
            <Input type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block t-muted text-xs mb-1">Supplier</label>
          <SearchCreateSelect
            value={form.supplierId}
            onChange={(supplierId) => setForm({ ...form, supplierId })}
            options={supplierOptions}
            placeholder="Select supplier"
            createLabel="Create New Supplier"
            loading={suppliersQuery.isLoading}
            onCreate={() => setSupplierModalOpen(true)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block t-muted text-xs mb-1">Tax mode</label>
            <Select
              value={form.taxMode}
              onChange={(taxMode) => setForm({ ...form, taxMode })}
              options={[
                { value: "exclusive", label: "Tax exclusive" },
                { value: "inclusive", label: "Tax inclusive" },
              ]}
            />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Cess % optional</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.cessRate}
              onChange={(e) => setForm({ ...form, cessRate: e.target.value })}
            />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Status</label>
            <Select
              value={form.productStatus}
              onChange={(productStatus) => setForm({ ...form, productStatus })}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </div>
        </div>
        <Toggle
          checked={form.gstExempt}
          onChange={(gstExempt) => setForm({ ...form, gstExempt })}
          label="Exempted product"
        />

        {error ? (
          <div className="rounded-xl t-danger-bg text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Product"}
          </Button>
        </div>
      </form>
    </Modal>
    <Modal open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} title="Create New Supplier">
      <form onSubmit={createSupplier} className="space-y-3">
        <Input required value={supplierForm.name} placeholder="Supplier name *" onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input value={supplierForm.phone} placeholder="Phone optional" onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} />
          <Input type="email" value={supplierForm.email} placeholder="Email optional" onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input value={supplierForm.gstin} placeholder="GSTIN optional" onChange={(event) => setSupplierForm({ ...supplierForm, gstin: event.target.value })} />
          <Input value={supplierForm.upiId} placeholder="UPI ID optional" onChange={(event) => setSupplierForm({ ...supplierForm, upiId: event.target.value })} />
        </div>
        <Textarea rows={2} value={supplierForm.address} placeholder="Address optional" onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })} />
        <Textarea rows={2} value={supplierForm.notes} placeholder="Notes optional" onChange={(event) => setSupplierForm({ ...supplierForm, notes: event.target.value })} />
        <label className="block">
          <span className="block t-muted text-xs mb-1">Upload UPI QR optional</span>
          <div className="t-elev border t-border rounded-2xl px-3 py-3 text-sm t-muted flex items-center gap-3 cursor-pointer">
            {supplierForm.qrImageUrl ? (
              <img src={supplierForm.qrImageUrl} alt="Supplier QR" className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            <span>{supplierForm.qrImageUrl ? "QR uploaded" : "Choose QR image"}</span>
          </div>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSupplierQr} />
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setSupplierModalOpen(false)}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={creatingRelated}>{creatingRelated ? "Saving..." : "Save Supplier"}</Button>
        </div>
      </form>
    </Modal>
    <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title="Create New Category">
      <form onSubmit={createCategory} className="space-y-3">
        <Input required value={categoryForm.name} placeholder="Category name *" onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} />
        <Textarea rows={2} value={categoryForm.description} placeholder="Description optional" onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input value={categoryForm.icon} placeholder="Icon optional" onChange={(event) => setCategoryForm({ ...categoryForm, icon: event.target.value })} />
          <Input value={categoryForm.color} placeholder="Color" onChange={(event) => setCategoryForm({ ...categoryForm, color: event.target.value })} />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setCategoryModalOpen(false)}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={creatingRelated}>{creatingRelated ? "Saving..." : "Save Category"}</Button>
        </div>
      </form>
    </Modal>
    </>
  );
}

function ProductInfo({ product, onClose, onEdit, onAddStock, currency, canManage, canViewMargins }) {
  const detailQuery = useQuery({
    queryKey: ["product-detail", product?.product_id],
    queryFn: async () => {
      const response = await fetch(`/api/products/${product.product_id}`, { headers: shopHeaders() });
      if (!response.ok) throw new Error("Failed to load product detail");
      return response.json();
    },
    enabled: !!product?.product_id,
  });
  if (!product) return null;
  const detailProduct = detailQuery.data?.product || product;
  const batches = detailQuery.data?.batches || [];
  const movements = detailQuery.data?.stockMovements || [];
  const sp = Number(detailProduct.selling_price);
  const cp = Number(detailProduct.cost_price);
  const profit = sp - cp;
  const margin = sp > 0 ? (profit / sp) * 100 : 0;
  const fmt = (n) => formatMoney(n, currency);
  const unitLabel = getProductUnitLabel(detailProduct);
  const remainingStock = formatStockQuantity(getStockBaseQuantity(detailProduct), detailProduct);
  const soldStock = formatStockQuantity(Number(detailProduct.sold_base_unit) || 0, detailProduct);
  const openingStock = formatStockQuantity(Number(detailProduct.opening_stock_base_unit) || 0, detailProduct);
  return (
    <Modal open={!!product} onClose={onClose} title="Product Details">
      {detailProduct.image_url ? (
        <img
          src={detailProduct.image_url}
          alt={detailProduct.title}
          className="w-full h-48 rounded-2xl object-cover mb-4 border t-border"
        />
      ) : (
        <div className="w-full h-48 rounded-2xl t-elev flex items-center justify-center mb-4">
          <Package className="w-12 h-12 t-dim2" />
        </div>
      )}
      <h3 className="t-text text-lg font-bold">{detailProduct.title}</h3>
      <p className="t-muted text-sm mt-1">
        {detailProduct.description || "No description"}
      </p>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="rounded-xl t-elev px-3 py-2">
          <div className="t-dim text-[10px]">Selling</div>
          <div className="t-text font-semibold text-sm">{fmt(sp)}</div>
        </div>
        {canViewMargins ? (
          <>
            <div className="rounded-xl t-elev px-3 py-2">
              <div className="t-dim text-[10px]">Cost</div>
              <div className="t-text font-semibold text-sm">{fmt(cp)}</div>
            </div>
            <div className="rounded-xl t-success-bg px-3 py-2">
              <div className="text-[10px] opacity-80">Profit</div>
              <div className="font-semibold text-sm">{fmt(profit)}</div>
            </div>
            <div className="rounded-xl t-accent-soft px-3 py-2">
              <div className="text-[10px] opacity-80">Margin</div>
              <div className="font-semibold text-sm">{margin.toFixed(1)}%</div>
            </div>
          </>
        ) : null}
        <div className="rounded-xl t-elev px-3 py-2 col-span-2">
          <div className="t-dim text-[10px]">Stock</div>
          <div className="t-text font-semibold text-sm">
            {remainingStock}
          </div>
        </div>
        <div className="rounded-xl t-elev px-3 py-2 col-span-2">
          <div className="t-dim text-[10px]">Unit</div>
          <div className="t-text font-semibold text-sm">{unitLabel}</div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Close
        </Button>
        {canManage ? (
          <>
            <Button variant="secondary" className="flex-1" onClick={() => onAddStock(detailProduct)}>
              Add New Stock
            </Button>
            <Button variant="primary" className="flex-1" onClick={onEdit}>
              Edit
            </Button>
          </>
        ) : null}
      </div>
      <div className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between t-muted"><span>Opening stock</span><span className="t-text">{openingStock}</span></div>
        <div className="flex justify-between t-muted"><span>Sold quantity</span><span className="t-text">{soldStock}</span></div>
        <div className="flex justify-between t-muted"><span>Product added</span><span className="t-text">{detailProduct.product_created_at ? new Date(detailProduct.product_created_at).toLocaleString("en-IN") : "Not recorded"}</span></div>
        <div className="flex justify-between t-muted"><span>HSN/SAC</span><span className="t-text">{detailProduct.hsn_sac || "-"}</span></div>
        <div className="flex justify-between t-muted"><span>SKU</span><span className="t-text">{detailProduct.sku || "-"}</span></div>
        <div className="flex justify-between t-muted"><span>Category</span><span className="t-text">{detailProduct.category_name_snapshot || detailProduct.category || "-"}</span></div>
        <div className="flex justify-between t-muted"><span>GST</span><span className="t-text">{Number((detailProduct.gst_rate ?? detailProduct.tax_rate) || 0)}% / {detailProduct.tax_mode || "exclusive"}</span></div>
        <div className="flex justify-between t-muted"><span>Stock value</span><span className="t-text">{fmt((Number(detailProduct.stock) || 0) * cp)}</span></div>
        {detailProduct.conversion_rate ? <div className="flex justify-between t-muted"><span>Conversion</span><span className="t-text">1 {detailProduct.primary_unit} = {detailProduct.conversion_rate} {detailProduct.secondary_unit}</span></div> : null}
      </div>
      <div className="mt-4">
        <h4 className="t-text text-sm font-semibold mb-2">Batch History</h4>
        {detailQuery.isLoading ? (
          <Skeleton className="h-20" />
        ) : batches.length === 0 ? (
          <div className="t-elev rounded-2xl p-3 t-muted text-xs">No stock batches yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[620px]">
              <thead className="t-muted">
                <tr>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Purchased</th>
                  <th className="text-left py-2">Remaining</th>
                  <th className="text-left py-2">Cost</th>
                  <th className="text-left py-2">Selling</th>
                  <th className="text-left py-2">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {batches.slice(0, 8).map((batch) => (
                  <tr key={batch.batch_id} className="t-divider">
                    <td className="py-2">{new Date(batch.purchase_date).toLocaleDateString("en-IN")}</td>
                    <td className="py-2">{Number(batch.quantity_purchased)} {batch.unit}</td>
                    <td className="py-2">{Number(batch.quantity_remaining)} {batch.unit}</td>
                    <td className="py-2">{fmt(batch.cost_price)}</td>
                    <td className="py-2">{fmt(batch.selling_price)}</td>
                    <td className="py-2">{batch.supplier_name_snapshot || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="mt-4">
        <h4 className="t-text text-sm font-semibold mb-2">Stock Movements</h4>
        {movements.length === 0 ? (
          <div className="t-elev rounded-2xl p-3 t-muted text-xs">No movements recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {movements.slice(0, 6).map((movement) => (
              <div key={movement.movement_id} className="t-elev rounded-xl px-3 py-2 text-xs flex justify-between gap-3">
                <div>
                  <div className="t-text font-semibold">{movement.movement_type}</div>
                  <div className="t-dim">{new Date(movement.created_at).toLocaleString("en-IN")}</div>
                </div>
                <div className="t-text font-semibold">{formatMovementQuantity(movement, detailProduct)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ProductCard({ product, currency, onInfo, onEdit, onDelete, canManage, canViewMargins }) {
  const [qty, setQty] = useState(1);
  const sp = Number(product.selling_price);
  const cp = Number(product.cost_price);
  const margin = sp > 0 ? ((sp - cp) / sp) * 100 : 0;
  const stockBase = getStockBaseQuantity(product);
  const outOfStock = stockBase <= 0;
  const lowStock = stockBase <= Number(product.low_stock_base_unit ?? 5);
  const fmt = (n) => formatMoney(n, currency);
  const unitLabel = getProductUnitLabel(product);
  const remainingStock = formatStockQuantity(getStockBaseQuantity(product), product);

  const handleAdd = () => {
    const res = addToCart(product, qty);
    if (!res.ok) {
      showToast(
        res.reason === "out_of_stock" ? "Out of stock" : "Could not add",
        "error",
      );
      return;
    }
    if (res.exceeded) {
      showToast(`Only ${res.quantity} added — stock limit reached`, "info");
    } else {
      showToast(`Added ${qty} × ${product.title}`);
    }
    setQty(1);
  };

  return (
    <div className="t-card flex flex-col overflow-hidden">
      <div className="relative h-40 t-elev">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 t-dim2" />
          </div>
        )}
        {outOfStock ? (
          <div className="absolute top-2 left-2">
            <Badge tone="danger">Out of stock</Badge>
          </div>
        ) : lowStock ? (
          <div className="absolute top-2 left-2">
            <Badge tone="warning">Low stock</Badge>
          </div>
        ) : null}
        <div className="absolute top-2 right-2">
          <Badge tone="neutral">
            {remainingStock} left
          </Badge>
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="t-text font-semibold text-sm truncate">
          {product.title}
        </h3>
        <p className="t-dim text-xs mt-0.5 line-clamp-1">
          {product.description || "—"}
        </p>
        <div className="flex items-end justify-between mt-2">
          <div>
            <div className="t-text font-bold text-base">{fmt(sp)}</div>
            {canViewMargins ? (
              <div className="t-accent-text text-[10px] font-medium">
                {margin.toFixed(0)}% margin / {unitLabel}
              </div>
            ) : (
              <div className="t-dim text-[10px] font-medium">per {unitLabel}</div>
            )}
          </div>
          {product.category ? (
            <Badge tone="neutral">{product.category}</Badge>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <QtyStepper
            value={qty}
            onChange={setQty}
            min={1}
            max={Math.max(1, product.stock)}
            size="sm"
          />
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={handleAdd}
            disabled={outOfStock}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-1">
          <button
            onClick={() => onInfo(product)}
            className="flex-1 t-btn px-2 py-1.5 text-xs flex items-center justify-center gap-1"
          >
            <Info className="w-3 h-3" /> Info
          </button>
          {canManage ? (
            <>
              <button
                onClick={() => onEdit(product)}
                className="t-btn px-2 py-1.5 text-xs"
                aria-label="Edit"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete(product)}
                className="t-btn-danger px-2 py-1.5 text-xs"
                aria-label="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AddStockModal({ product, open, onClose, onSaved, shop }) {
  const [form, setForm] = useState({
    quantity: "",
    unit: product?.primary_unit || "piece",
    costPrice: "",
    sellingPrice: "",
    supplierId: "",
    purchaseInvoiceNo: "",
    notes: "",
    purchaseDate: "",
    paidAmount: "",
    paymentMethod: "cash",
    dueDate: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const suppliersQuery = useQuery({
    queryKey: ["suppliers", "add-stock", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/suppliers", { headers: shopHeaders() });
      if (!response.ok) return { suppliers: [] };
      return response.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (!product || !open) return;
    setForm({
      quantity: "",
      unit: product.primary_unit || "piece",
      costPrice: String(product.cost_price || ""),
      sellingPrice: String(product.selling_price || ""),
      supplierId: String(product.supplier_id || ""),
      purchaseInvoiceNo: "",
      notes: "",
      purchaseDate: new Date().toISOString().slice(0, 10),
      paidAmount: "",
      paymentMethod: "cash",
      dueDate: "",
    });
    setError("");
  }, [product, open]);

  if (!product) return null;
  const unitOptions = [
    { value: product.primary_unit || "piece", label: product.primary_unit || "piece" },
    ...(product.secondary_unit ? [{ value: product.secondary_unit, label: product.secondary_unit }] : []),
  ];
  const supplierOptions = [
    { value: "", label: "No supplier" },
    ...(suppliersQuery.data?.suppliers || []).map((supplier) => ({
      value: String(supplier.supplier_id),
      label: supplier.name,
    })),
  ];
  const hasConversion = !!product.secondary_unit && Number(product.conversion_rate) > 0;
  const quantityBaseUnit =
    Number(form.quantity) > 0 ? toBaseQuantity(Number(form.quantity), form.unit, product) : null;
  const conversionPreview = quantityBaseUnit === null
    ? null
    : `${form.quantity} ${form.unit} = ${Number(quantityBaseUnit).toLocaleString("en-IN", { maximumFractionDigits: 3 })} ${product.secondary_unit}`;

  const changeUnit = (unit) => {
    setForm({
      ...form,
      unit,
      costPrice: form.costPrice === "" ? "" : String(convertUnitPrice(form.costPrice, form.unit, unit, product)),
      sellingPrice: form.sellingPrice === "" ? "" : String(convertUnitPrice(form.sellingPrice, form.unit, unit, product)),
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!Number(form.quantity) || Number(form.quantity) <= 0) {
      setError("Quantity is required");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/products/${product.product_id}/stock`, {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          costPrice: Number(form.costPrice) || 0,
          sellingPrice: Number(form.sellingPrice) || 0,
          paidAmount: Number(form.paidAmount) || 0,
          supplierId: form.supplierId || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not add stock");
      showToast("New stock batch added.");
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Add New Stock - ${product.title}`} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-2xl t-elev px-3 py-2 text-xs t-muted">
          Date is auto-generated. Owner can edit purchase date for old inward stock.
        </div>
        {hasConversion ? (
          <div className="rounded-2xl t-accent-soft px-3 py-2 text-xs space-y-1">
            <div className="font-semibold">
              1 {product.primary_unit} contains {product.conversion_rate} {product.secondary_unit}
            </div>
            <div>
              {conversionPreview || `Enter stock in ${product.primary_unit} or ${product.secondary_unit}.`}
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block t-muted text-xs mb-1">Quantity</label>
            <Input type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Unit</label>
            <Select value={form.unit} onChange={changeUnit} options={unitOptions} />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Cost price / 1 {form.unit}</label>
            <Input type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Selling price / 1 {form.unit}</label>
            <Input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })} />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Supplier optional</label>
            <Select value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} options={supplierOptions} />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Purchase invoice no optional</label>
            <Input value={form.purchaseInvoiceNo} onChange={(event) => setForm({ ...form, purchaseInvoiceNo: event.target.value })} />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Purchase date</label>
            <Input type="date" value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Paid amount</label>
            <Input type="number" min="0" step="0.01" value={form.paidAmount} onChange={(event) => setForm({ ...form, paidAmount: event.target.value })} />
          </div>
        </div>
        <Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notes optional" />
        {error ? <div className="rounded-xl t-danger-bg px-3 py-2 text-xs">{error}</div> : null}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Adding..." : "Add Stock"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryManager({ open, categories, onClose, onSaved }) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_CATEGORY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setDeleting(null);
      setForm(EMPTY_CATEGORY);
      setError("");
    }
  }, [open]);

  const startEdit = (category) => {
    setEditing(category);
    setForm({
      name: category.name || "",
      description: category.description || "",
      icon: category.icon || "",
      color: category.color || "",
    });
    setError("");
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Category name required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editing ? `/api/categories/${editing.category_id}` : "/api/categories", {
        method: editing ? "PUT" : "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save category");
      showToast(editing ? "Category updated." : "Category created.");
      setEditing(null);
      setForm(EMPTY_CATEGORY);
      onSaved();
    } catch (categoryError) {
      setError(categoryError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async () => {
    if (!deleting) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/categories/${deleting.category_id}`, {
        method: "DELETE",
        headers: shopHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete category");
      showToast("Category deleted.");
      setDeleting(null);
      onSaved();
    } catch (categoryError) {
      setDeleting(null);
      setError(categoryError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Manage Categories" maxWidth="max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {categories.length === 0 ? (
              <div className="rounded-2xl t-elev p-5 text-sm t-muted text-center">No categories created.</div>
            ) : categories.map((category) => (
              <div key={category.category_id} className="rounded-2xl t-elev border t-border px-3 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="t-text text-sm font-semibold truncate">{category.name}</div>
                  <div className="t-muted text-xs">{category.product_count || 0} products</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(category)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleting(category)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={saveCategory} className="rounded-2xl t-elev border t-border p-3 space-y-3">
            <div className="t-text text-sm font-semibold">{editing ? "Edit Category" : "New Category"}</div>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Category name *" />
            <Textarea rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description optional" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} placeholder="Icon" />
              <Input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} placeholder="Color" />
            </div>
            {error ? <div className="rounded-xl t-danger-bg p-2 text-xs">{error}</div> : null}
            <div className="flex flex-wrap gap-2">
              {editing ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => { setEditing(null); setForm(EMPTY_CATEGORY); }}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving..." : "Save Category"}</Button>
            </div>
          </form>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        title="Delete category?"
        message={deleting?.product_count > 0 ? "This category has products. Move products before deleting." : `Delete ${deleting?.name || "this category"}?`}
        confirmText="Delete"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={deleteCategory}
      />
    </>
  );
}

export default function ProductsPage() {
  const { data: user } = useUser();
  const { shop, role } = useShop({ enabled: !!user });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [infoProduct, setInfoProduct] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const { count: cartCount } = useCart();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("search")) setSearch(params.get("search"));
  }, []);

  const categoriesQuery = useQuery({
    queryKey: ["categories", shop?.shop_id],
    queryFn: async () => {
      const res = await fetch("/api/categories", { headers: shopHeaders() });
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
    enabled: !!user && !!shop?.shop_id,
    staleTime: 30000,
  });

  const productsQuery = useQuery({
    queryKey: ["products", search, selectedCategoryId, shop?.shop_id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCategoryId !== "all") params.set("categoryId", selectedCategoryId);
      const url = `/api/products${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { headers: shopHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!user && !!shop?.shop_id,
    keepPreviousData: true,
    staleTime: 30000,
  });

  const products = productsQuery.data?.products || [];
  const categories = categoriesQuery.data?.categories || [];

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: shopHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      showToast("Product deleted");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: () => showToast("Failed to delete", "error"),
  });

  const currency = shop?.currency || "INR";
  const canManageInventory = role === "owner" || role === "manager";
  const canViewMargins = canManageInventory;

  const checkout = () => {
    navigate("/billing");
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">
                Products
              </h1>
              <p className="t-muted text-sm">Manage your inventory</p>
            </div>
            {canManageInventory ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setCategoryManagerOpen(true)}>
                  Categories
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> Add Product
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mb-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search products by name or description..."
            />
          </div>
          <div className="product-category-strip scroll-card mb-4 pb-1">
            <div className="flex gap-2 min-w-max">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("all")}
                className={`product-category-chip rounded-xl border t-border px-2.5 py-2 text-left min-w-[112px] ${
                  selectedCategoryId === "all" ? "t-accent-soft" : "t-card hover:bg-[var(--bg-elev)]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-7 w-7 shrink-0 rounded-lg t-accent-soft flex items-center justify-center">
                    <Package className="h-3.5 w-3.5 t-accent-text" />
                  </span>
                  <span className="min-w-0">
                    <span className="block t-text text-xs font-semibold truncate">All Products</span>
                    <span className="block t-dim text-[10px]">{productsQuery.data?.products?.length || 0} shown</span>
                  </span>
                </div>
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.category_id}
                  onClick={() => setSelectedCategoryId(String(category.category_id))}
                  className={`product-category-chip rounded-xl border t-border px-2.5 py-2 text-left min-w-[112px] max-w-[158px] ${
                    selectedCategoryId === String(category.category_id) ? "t-accent-soft" : "t-card hover:bg-[var(--bg-elev)]"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-7 w-7 shrink-0 rounded-lg t-accent-soft flex items-center justify-center">
                      <Package className="h-3.5 w-3.5 t-accent-text" />
                    </span>
                    <span className="min-w-0">
                      <span className="block t-text text-xs font-semibold truncate">{category.name}</span>
                      <span className="block t-dim text-[10px] truncate">{category.product_count || 0} products</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {productsQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="t-card p-3">
                  <Skeleton className="h-40 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card className="text-center py-12">
              <Package className="w-12 h-12 t-dim2 mx-auto mb-3" />
              <h3 className="t-text font-semibold mb-1">
                {search ? "No matches" : "No products yet"}
              </h3>
              <p className="t-muted text-sm mb-4">
                {search
                  ? "Try a different search."
                  : "Add your first product to start selling."}
              </p>
              {!search && canManageInventory ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> Add Product
                </Button>
              ) : null}
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {products.map((p) => (
                <ProductCard
                  key={p.product_id}
                  product={p}
                  currency={currency}
                  onInfo={setInfoProduct}
                  onEdit={(prod) => {
                    setEditing(prod);
                    setModalOpen(true);
                  }}
                  onDelete={setDeleting}
                  canManage={canManageInventory}
                  canViewMargins={canViewMargins}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop sidebar cart */}
        <aside className="hidden lg:block">
          <CartPanel
            currency={currency}
            taxPercent={Number(shop?.tax_percent) || 0}
            onCheckout={checkout}
          />
        </aside>
      </div>

      {/* Mobile floating cart button */}
      {cartCount > 0 ? (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="lg:hidden fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, var(--accent), var(--accent-dark))",
          }}
          aria-label="Open cart"
        >
          <ShoppingBag className="w-6 h-6" />
          <span
            className="absolute -top-1 -right-1 text-[10px] font-bold rounded-full px-1.5 py-0.5"
            style={{ background: "var(--danger)", color: "white" }}
          >
            {cartCount}
          </span>
        </button>
      ) : null}

      {mobileCartOpen ? (
        <CartPanel
          variant="drawer"
          currency={currency}
          taxPercent={Number(shop?.tax_percent) || 0}
          onCheckout={() => {
            setMobileCartOpen(false);
            checkout();
          }}
          onClose={() => setMobileCartOpen(false)}
        />
      ) : null}

      {canManageInventory ? <ProductForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        shop={shop}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["analytics"] });
          qc.invalidateQueries({ queryKey: ["categories"] });
        }}
      /> : null}
      {canManageInventory ? (
        <CategoryManager
          open={categoryManagerOpen}
          categories={categories}
          onClose={() => setCategoryManagerOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["categories"] });
            qc.invalidateQueries({ queryKey: ["products"] });
          }}
        />
      ) : null}

      <ProductInfo
        product={infoProduct}
        currency={currency}
        canManage={canManageInventory}
        canViewMargins={canViewMargins}
        onClose={() => setInfoProduct(null)}
        onEdit={() => {
          setEditing(infoProduct);
          setInfoProduct(null);
          setModalOpen(true);
        }}
        onAddStock={(product) => {
          setInfoProduct(null);
          setStockProduct(product);
        }}
      />
      {canManageInventory ? (
        <AddStockModal
          open={!!stockProduct}
          product={stockProduct}
          shop={shop}
          onClose={() => setStockProduct(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["product-detail"] });
            qc.invalidateQueries({ queryKey: ["purchases"] });
            qc.invalidateQueries({ queryKey: ["analytics"] });
            qc.invalidateQueries({ queryKey: ["categories"] });
          }}
        />
      ) : null}

      {canManageInventory ? <ConfirmDialog
        open={!!deleting}
        title="Delete product?"
        message={
          deleting ? `“${deleting.title}” will be permanently removed.` : ""
        }
        destructive
        confirmText="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.product_id);
          setDeleting(null);
        }}
      /> : null}
    </>
  );
}
