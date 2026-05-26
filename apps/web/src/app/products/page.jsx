import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import DashboardShell from "@/components/DashboardShell";
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
} from "@/components/ui";
import CartPanel from "@/components/CartPanel";

function ProductForm({ open, onClose, initial, onSaved }) {
  const [upload, { loading: uploading }] = useUpload();
  const [form, setForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    sellingPrice: "",
    costPrice: "",
    stock: "",
    category: "",
    sku: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title || "",
        description: initial.description || "",
        imageUrl: initial.image_url || "",
        sellingPrice: String(initial.selling_price || ""),
        costPrice: String(initial.cost_price || ""),
        stock: String(initial.stock || ""),
        category: initial.category || "",
        sku: initial.sku || "",
      });
    } else {
      setForm({
        title: "",
        description: "",
        imageUrl: "",
        sellingPrice: "",
        costPrice: "",
        stock: "",
        category: "",
        sku: "",
      });
    }
    setError("");
  }, [initial, open]);

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
        sellingPrice: Number(form.sellingPrice) || 0,
        costPrice: Number(form.costPrice) || 0,
        stock: parseInt(form.stock) || 0,
        category: form.category,
        sku: form.sku,
      };
      const res = await fetch(
        initial ? `/api/products/${initial.product_id}` : "/api/products",
        {
          method: initial ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
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

  return (
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block t-muted text-xs mb-1">Selling price</label>
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
          <div>
            <label className="block t-muted text-xs mb-1">Cost price</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block t-muted text-xs mb-1">Stock</label>
            <Input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Category</label>
            <Input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
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
  );
}

function ProductInfo({ product, onClose, onEdit, currency }) {
  if (!product) return null;
  const sp = Number(product.selling_price);
  const cp = Number(product.cost_price);
  const profit = sp - cp;
  const margin = sp > 0 ? (profit / sp) * 100 : 0;
  const fmt = (n) => formatMoney(n, currency);
  return (
    <Modal open={!!product} onClose={onClose} title="Product Details">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.title}
          className="w-full h-48 rounded-2xl object-cover mb-4 border t-border"
        />
      ) : (
        <div className="w-full h-48 rounded-2xl t-elev flex items-center justify-center mb-4">
          <Package className="w-12 h-12 t-dim2" />
        </div>
      )}
      <h3 className="t-text text-lg font-bold">{product.title}</h3>
      <p className="t-muted text-sm mt-1">
        {product.description || "No description"}
      </p>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="rounded-xl t-elev px-3 py-2">
          <div className="t-dim text-[10px]">Selling</div>
          <div className="t-text font-semibold text-sm">{fmt(sp)}</div>
        </div>
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
        <div className="rounded-xl t-elev px-3 py-2 col-span-2">
          <div className="t-dim text-[10px]">Stock</div>
          <div className="t-text font-semibold text-sm">
            {product.stock} units
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" className="flex-1" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </Modal>
  );
}

function ProductCard({ product, currency, onInfo, onEdit, onDelete }) {
  const [qty, setQty] = useState(1);
  const sp = Number(product.selling_price);
  const cp = Number(product.cost_price);
  const margin = sp > 0 ? ((sp - cp) / sp) * 100 : 0;
  const outOfStock = product.stock <= 0;
  const fmt = (n) => formatMoney(n, currency);

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
        ) : product.stock < 5 ? (
          <div className="absolute top-2 left-2">
            <Badge tone="warning">Low stock</Badge>
          </div>
        ) : null}
        <div className="absolute top-2 right-2">
          <Badge tone="neutral">{product.stock} left</Badge>
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
            <div className="t-accent-text text-[10px] font-medium">
              {margin.toFixed(0)}% margin
            </div>
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
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [infoProduct, setInfoProduct] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { count: cartCount } = useCart();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("search")) setSearch(params.get("search"));
  }, []);

  const productsQuery = useQuery({
    queryKey: ["products", search],
    queryFn: async () => {
      const url = `/api/products${search ? `?search=${encodeURIComponent(search)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!user,
    keepPreviousData: true,
    staleTime: 30000,
  });

  const products = productsQuery.data?.products || [];

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
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

  const checkout = () => {
    if (typeof window !== "undefined") window.location.href = "/billing";
  };

  return (
    <DashboardShell currentPath="/products">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">
                Products
              </h1>
              <p className="t-muted text-sm">Manage your inventory</p>
            </div>
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

          <div className="mb-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search products by name or description..."
            />
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
              {!search ? (
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

      <ProductForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["analytics"] });
        }}
      />

      <ProductInfo
        product={infoProduct}
        currency={currency}
        onClose={() => setInfoProduct(null)}
        onEdit={() => {
          setEditing(infoProduct);
          setInfoProduct(null);
          setModalOpen(true);
        }}
      />

      <ConfirmDialog
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
      />
    </DashboardShell>
  );
}
