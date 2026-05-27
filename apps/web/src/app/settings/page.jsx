import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  User,
  Store,
  Receipt as ReceiptIcon,
  Palette,
  Shield,
  Upload,
  LogOut,
  Download,
  Save,
  IndianRupee,
  ArrowRightLeft,
  Plus,
  Check as CheckIcon,
  Trash2,
  Mail,
} from "lucide-react";
import useUser from "@/utils/useUser";
import useUpload from "@/utils/useUpload";
import useShop from "@/utils/useShop";
import useProfile from "@/utils/useProfile";
import { showToast } from "@/components/Toast";
import {
  Card,
  Input,
  Textarea,
  Button,
  Select,
  Tabs,
  ColorSwatch,
  Skeleton,
  Toggle,
} from "@/components/ui";
import { ACCENTS, applyTheme } from "@/utils/theme";
import { CURRENCIES, getCurrencyInfo } from "@/utils/currency";
import { shopHeaders } from "@/utils/shopContext";

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <Card>
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--accent), var(--accent-dark))",
            color: "white",
          }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="t-text font-semibold">{title}</h2>
          {subtitle ? <p className="t-dim text-xs mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const { data: user } = useUser();
  const {
    profile,
    update: updateProfile,
    saving: savingProfile,
  } = useProfile({ enabled: !!user });
  const { shop, role, update: updateShop, allShops, switchShop, activeShopId } = useShop({ enabled: !!user });
  const [upload, { loading: uploading }] = useUpload();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const importInputRef = useRef(null);

  // Initialize form from shop
  useEffect(() => {
    if (!shop) return;
    setForm({
      shopName: shop.shop_name || "",
      shopDescription: shop.shop_description || "",
      shopLogo: shop.shop_logo || "",
      address: shop.address || "",
      phone: shop.phone || "",
      email: shop.email || "",
      receiptPrefix: shop.receipt_prefix || "INV",
      taxPercent: Number(shop.tax_percent) || 0,
      currency: shop.currency || "INR",
      thankYouMessage: shop.thank_you_message || "",
      theme: shop.theme || "glass",
      accentColor: shop.accent_color || "#8b5cf6",
      gstin: shop.gstin || "",
      gstBillingEnabled: !!shop.gst_billing_enabled,
      businessLegalName: shop.business_legal_name || "",
      businessAddress: shop.business_address || "",
      state: shop.state || "",
      stateCode: shop.state_code || "",
      defaultGstRate: Number(shop.default_gst_rate) || 18,
      taxMode: shop.tax_mode || "exclusive",
      stockSellingMethod: shop.stock_selling_method || "fifo",
      defaultInvoiceType: shop.default_invoice_type === "tax_invoice"
        ? "gst_invoice"
        : shop.default_invoice_type || "invoice",
      defaultPaymentMethod: shop.default_payment_method || "cash",
      defaultTerms: shop.default_terms || "",
      receiptSize: shop.receipt_size || "a4",
      printMode: shop.print_mode || "color",
      sendReceiptEmail: !!shop.send_receipt_email,
      customUnits: Array.isArray(shop.custom_units) ? shop.custom_units : [],
    });
  }, [shop]);

  useEffect(() => {
    if (profile) setDisplayName(profile.displayName || profile.name || "");
  }, [profile]);

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      showToast("Only PNG, JPG, WEBP allowed", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Max 5MB", "error");
      return;
    }
    const { url, error } = await upload({ file });
    if (error) {
      showToast(error, "error");
      return;
    }
    setForm((f) => ({ ...f, shopLogo: url }));
    updateShop({ shopLogo: url });
    showToast("Logo updated");
  };

  const saveField = (patch) => updateShop(patch);

  const addCustomUnit = () => {
    const value = newUnit.trim().slice(0, 30);
    if (!value || form.customUnits.some((unit) => unit.toLowerCase() === value.toLowerCase())) return;
    const customUnits = [...form.customUnits, value];
    setForm({ ...form, customUnits });
    setNewUnit("");
    saveField({ customUnits });
  };

  const removeCustomUnit = (value) => {
    const customUnits = form.customUnits.filter((unit) => unit !== value);
    setForm({ ...form, customUnits });
    saveField({ customUnits });
  };

  const saveProfileName = async () => {
    if (!displayName.trim()) {
      showToast("Display name required", "error");
      return;
    }
    try {
      await new Promise((resolve, reject) => {
        updateProfile(
          { displayName: displayName.trim() },
          {
            onSuccess: () => {
              showToast("Profile updated");
              resolve();
            },
            onError: (e) => {
              showToast(e?.message || "Failed to save", "error");
              reject(e);
            },
          },
        );
      });
    } catch {}
  };

  const exportData = async () => {
    try {
      const [sales, products, shopRes] = await Promise.all([
        fetch("/api/sales", { headers: shopHeaders() }).then((r) => r.json()),
        fetch("/api/products", { headers: shopHeaders() }).then((r) => r.json()),
        fetch("/api/shop", { headers: shopHeaders() }).then((r) => r.json()),
      ]);
      const blob = new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              shop: shopRes.shop,
              products: products.products,
              sales: sales.sales,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mdx-billing-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Backup downloaded");
    } catch {
      showToast("Failed to export", "error");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // For now, restore is a stub — only show what was found
      const counts = {
        products: data?.products?.length || 0,
        sales: data?.sales?.length || 0,
      };
      showToast(
        `Backup parsed: ${counts.products} products, ${counts.sales} sales (restore coming soon)`,
        "info",
      );
    } catch {
      showToast("Invalid backup file", "error");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  if (!form) {
    return (
      <>
        <div className="space-y-4 max-w-3xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </>
    );
  }

  const themeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "glass", label: "Glass" },
  ];
  const currencyOptions = CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.name} (${c.code})`,
    prefix: c.symbol,
  }));
  const currentCur = getCurrencyInfo(form.currency);
  const invoiceTypeOptions = [
    { value: "invoice", label: "Invoice" },
    { value: "gst_invoice", label: "GST invoice" },
    { value: "estimate", label: "Estimate / quotation" },
    { value: "receipt", label: "Receipt" },
  ];
  const paymentMethodOptions = [
    { value: "cash", label: "Cash" },
    { value: "credit", label: "Credit" },
    { value: "upi", label: "UPI" },
    { value: "bank", label: "Bank" },
    { value: "card", label: "Card" },
  ];
  const receiptSizeOptions = [
    { value: "a4", label: "A4 invoice" },
    { value: "thermal", label: "Thermal receipt" },
    { value: "small", label: "Small receipt" },
  ];
  const printModeOptions = [
    { value: "color", label: "Color" },
    { value: "bw", label: "Black and white" },
  ];
  const isOwner = role === "owner";

  return (
    <>
      <div className="mb-5">
        <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">
          Settings
        </h1>
        <p className="t-muted text-sm">
          Manage your account, shop and preferences
        </p>
      </div>

      <div className="space-y-4 max-w-3xl">
        {/* Profile */}
        <Section
          icon={User}
          title="Profile"
          subtitle={
            profile?.provider === "google"
              ? "Signed in with Google"
              : "Signed in with email"
          }
        >
          <div className="flex items-center gap-4 mb-4">
            {profile?.image || user?.image ? (
              <img
                src={profile?.image || user?.image}
                alt={profile?.name || user?.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 t-border"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent), var(--accent-dark))",
                }}
              >
                {(displayName || user?.email || "U")?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="t-text font-semibold">
                {displayName || profile?.name || "—"}
              </div>
              <div className="t-muted text-sm truncate">{profile?.email}</div>
              <div className="t-dim text-xs mt-0.5">
                Provider:{" "}
                <span className="capitalize">
                  {profile?.provider || "email"}
                </span>
              </div>
            </div>
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Display name</label>
            <div className="flex gap-2">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
              />
              <Button
                variant="primary"
                onClick={saveProfileName}
                disabled={savingProfile}
              >
                <Save className="w-4 h-4" />
                Save
              </Button>
            </div>
          </div>
        </Section>

        {/* Switch Shop */}
        {allShops.length > 0 && (
          <Section
            icon={ArrowRightLeft}
            title="Switch Shop"
            subtitle={`You have ${allShops.length} shop${allShops.length > 1 ? "s" : ""}`}
          >
            <div className="space-y-2 mb-3">
              {allShops.map((s) => {
                const isActive = String(s.shop_id) === String(shop?.shop_id);
                return (
                  <button
                    key={s.shop_id}
                    onClick={() => {
                      if (!isActive) {
                        switchShop(s.shop_id);
                        showToast(`Switched to ${s.shop_name}`);
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      isActive
                        ? "t-accent-soft"
                        : "t-elev hover:bg-[var(--bg-input-focus)]"
                    }`}
                    style={
                      isActive
                        ? {
                            background: "rgba(var(--accent-rgb), 0.12)",
                            border: "1.5px solid rgba(var(--accent-rgb), 0.35)",
                          }
                        : { border: "1.5px solid transparent" }
                    }
                  >
                    {s.shop_logo ? (
                      <img
                        src={s.shop_logo}
                        alt={s.shop_name}
                        className="w-11 h-11 rounded-xl object-cover border t-border flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--accent), var(--accent-dark))",
                        }}
                      >
                        {(s.shop_name || "S")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="t-text font-medium text-sm truncate">
                        {s.shop_name}
                      </div>
                      {s.shop_description && (
                        <div className="t-dim text-xs truncate">
                          {s.shop_description}
                        </div>
                      )}
                    </div>
                    {isActive && (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: "var(--accent)",
                          color: "white",
                        }}
                      >
                        <CheckIcon className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {isOwner ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate("/setup-shop?new=true")}
              >
                <Plus className="w-4 h-4" />
                Create new shop
              </Button>
            ) : null}
          </Section>
        )}

        {!isOwner ? (
          <Section
            icon={Shield}
            title="Staff account"
            subtitle="Shop settings, team access and security controls are managed by the owner."
          >
            <a
              href="/account/logout"
              className="w-full flex items-center justify-between t-btn px-4 py-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Sign out
              </span>
            </a>
          </Section>
        ) : (
          <>
        {/* Shop */}
        <Section icon={Store} title="Shop">
          <div className="flex items-center gap-3 mb-3">
            <label className="cursor-pointer">
              <div className="w-16 h-16 rounded-2xl t-elev border-2 border-dashed t-border flex items-center justify-center overflow-hidden hover:border-[var(--accent)] transition">
                {form.shopLogo ? (
                  <img
                    src={form.shopLogo}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Upload className="w-5 h-5 t-dim2" />
                )}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogo}
              />
            </label>
            <div className="flex-1">
              <div className="t-text text-sm font-medium">Shop logo</div>
              <div className="t-dim text-xs">
                {uploading ? "Uploading..." : "PNG, JPG, WEBP up to 5MB"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block t-muted text-xs mb-1">Shop name</label>
              <Input
                value={form.shopName}
                onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                onBlur={() => saveField({ shopName: form.shopName })}
              />
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">Description</label>
              <Textarea
                value={form.shopDescription}
                onChange={(e) =>
                  setForm({ ...form, shopDescription: e.target.value })
                }
                onBlur={() =>
                  saveField({ shopDescription: form.shopDescription })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block t-muted text-xs mb-1">Address</label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  onBlur={() => saveField({ address: form.address })}
                />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  onBlur={() => saveField({ phone: form.phone })}
                />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">Shop email (optional)</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onBlur={() => saveField({ email: form.email })}
                  placeholder="shop@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">GSTIN (optional)</label>
              <Input
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                onBlur={() => saveField({ gstin: form.gstin })}
                placeholder="GST identification number"
              />
            </div>
          </div>
        </Section>

        {/* Billing */}
        <Section icon={ReceiptIcon} title="Billing & Currency">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block t-muted text-xs mb-1">
                Receipt prefix
              </label>
              <Input
                value={form.receiptPrefix}
                onChange={(e) =>
                  setForm({ ...form, receiptPrefix: e.target.value })
                }
                onBlur={() => saveField({ receiptPrefix: form.receiptPrefix })}
              />
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">Tax %</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.taxPercent}
                onChange={(e) =>
                  setForm({ ...form, taxPercent: Number(e.target.value) })
                }
                onBlur={() => saveField({ taxPercent: form.taxPercent })}
              />
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">
                <IndianRupee className="inline w-3 h-3 -mt-0.5" /> Currency
              </label>
              <Select
                value={form.currency}
                onChange={(v) => {
                  setForm({ ...form, currency: v });
                  saveField({ currency: v });
                }}
                options={currencyOptions}
              />
            </div>
          </div>
          <div className="mt-3 rounded-xl t-elev px-3 py-2 flex items-center justify-between">
            <span className="t-dim text-xs">Default symbol</span>
            <span className="t-accent-text font-bold text-lg">
              {currentCur.symbol}
            </span>
          </div>
          <div className="mt-3 rounded-2xl t-elev border t-border p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <div className="t-text text-sm font-semibold">GST Settings</div>
                <p className="t-muted text-xs mt-1">Configure legal GST invoice fields and tax behavior per shop.</p>
              </div>
              <Toggle
                checked={!!form.gstBillingEnabled}
                onChange={(checked) => {
                  setForm({ ...form, gstBillingEnabled: checked });
                  saveField({ gstBillingEnabled: checked });
                }}
                label={form.gstBillingEnabled ? "ON" : "OFF"}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block t-muted text-xs mb-1">Business legal name</label>
                <Input
                  value={form.businessLegalName}
                  onChange={(e) => setForm({ ...form, businessLegalName: e.target.value })}
                  onBlur={() => saveField({ businessLegalName: form.businessLegalName })}
                />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">Default GST rate</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.defaultGstRate}
                  onChange={(e) => setForm({ ...form, defaultGstRate: Number(e.target.value) })}
                  onBlur={() => saveField({ defaultGstRate: form.defaultGstRate })}
                />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">State</label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  onBlur={() => saveField({ state: form.state })}
                />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">State code</label>
                <Input
                  value={form.stateCode}
                  onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
                  onBlur={() => saveField({ stateCode: form.stateCode })}
                  placeholder="33"
                />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">Tax mode</label>
                <Select
                  value={form.taxMode}
                  onChange={(taxMode) => {
                    setForm({ ...form, taxMode });
                    saveField({ taxMode });
                  }}
                  options={[
                    { value: "exclusive", label: "Tax exclusive" },
                    { value: "inclusive", label: "Tax inclusive" },
                  ]}
                />
              </div>
              <div>
                <label className="block t-muted text-xs mb-1">Stock selling method</label>
                <Select
                  value={form.stockSellingMethod}
                  onChange={(stockSellingMethod) => {
                    setForm({ ...form, stockSellingMethod });
                    saveField({ stockSellingMethod });
                  }}
                  options={[
                    { value: "fifo", label: "FIFO (old stock first)" },
                    { value: "manual_batch", label: "Manual batch selection" },
                    { value: "weighted_average", label: "Weighted average later" },
                  ]}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block t-muted text-xs mb-1">Business address for GST invoice</label>
              <Textarea
                rows={2}
                value={form.businessAddress}
                onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                onBlur={() => saveField({ businessAddress: form.businessAddress })}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block t-muted text-xs mb-1">
              Thank you message
            </label>
            <Input
              value={form.thankYouMessage}
              onChange={(e) =>
                setForm({ ...form, thankYouMessage: e.target.value })
              }
              onBlur={() =>
                saveField({ thankYouMessage: form.thankYouMessage })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block t-muted text-xs mb-1">Default invoice type</label>
              <Select
                value={form.defaultInvoiceType}
                onChange={(value) => {
                  setForm({ ...form, defaultInvoiceType: value });
                  saveField({ defaultInvoiceType: value });
                }}
                options={invoiceTypeOptions}
              />
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">Default payment method</label>
              <Select
                value={form.defaultPaymentMethod}
                onChange={(value) => {
                  setForm({ ...form, defaultPaymentMethod: value });
                  saveField({ defaultPaymentMethod: value });
                }}
                options={paymentMethodOptions}
              />
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">Receipt size</label>
              <Select
                value={form.receiptSize}
                onChange={(value) => {
                  setForm({ ...form, receiptSize: value });
                  saveField({ receiptSize: value });
                }}
                options={receiptSizeOptions}
              />
            </div>
            <div>
              <label className="block t-muted text-xs mb-1">Print mode</label>
              <Select
                value={form.printMode}
                onChange={(value) => {
                  setForm({ ...form, printMode: value });
                  saveField({ printMode: value });
                }}
                options={printModeOptions}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block t-muted text-xs mb-1">Default terms and conditions</label>
            <Textarea
              value={form.defaultTerms}
              onChange={(e) => setForm({ ...form, defaultTerms: e.target.value })}
              onBlur={() => saveField({ defaultTerms: form.defaultTerms })}
              rows={3}
              placeholder="Payment terms, return policy or tax terms shown on invoices"
            />
          </div>
          <div className="mt-3 rounded-2xl t-elev border t-border p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl t-accent-soft flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="t-text text-sm font-semibold">Receipt Email Settings</div>
                  <p className="t-muted text-xs mt-1">
                    Automatically email the receipt to the customer when customer email is available.
                  </p>
                </div>
              </div>
              <Toggle
                checked={!!form.sendReceiptEmail}
                onChange={(checked) => {
                  setForm({ ...form, sendReceiptEmail: checked });
                  saveField({ sendReceiptEmail: checked });
                }}
                label={form.sendReceiptEmail ? "ON" : "OFF"}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block t-muted text-xs mb-1">Custom units</label>
            <div className="flex gap-2">
              <Input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomUnit();
                  }
                }}
                placeholder="Add unit, e.g. Carton"
              />
              <Button variant="secondary" onClick={addCustomUnit}>
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
            {form.customUnits.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.customUnits.map((unit) => (
                  <span key={unit} className="t-elev t-text rounded-xl px-3 py-1.5 text-xs flex items-center gap-2">
                    {unit}
                    <button type="button" onClick={() => removeCustomUnit(unit)} aria-label={`Remove ${unit}`}>
                      <Trash2 className="w-3.5 h-3.5 t-muted" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </Section>

        {/* Theme */}
        <Section icon={Palette} title="Theme & Appearance">
          <div className="space-y-4">
            <div>
              <div className="t-muted text-xs mb-2">Mode</div>
              <Tabs
                value={form.theme}
                onChange={(v) => {
                  setForm({ ...form, theme: v });
                  applyTheme(v, form.accentColor);
                  saveField({ theme: v });
                }}
                options={themeOptions}
              />
            </div>
            <div>
              <div className="t-muted text-xs mb-2">Accent color</div>
              <ColorSwatch
                colors={ACCENTS}
                value={form.accentColor}
                onChange={(c) => {
                  setForm({ ...form, accentColor: c });
                  applyTheme(form.theme, c);
                  saveField({ accentColor: c });
                }}
              />
            </div>
            <div className="rounded-xl p-3 t-elev t-border border flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent), var(--accent-dark))",
                }}
              />
              <div>
                <div className="t-text text-sm font-medium">Preview</div>
                <div className="t-dim text-xs">
                  Theme persists across devices.
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section icon={Shield} title="Access & Audit" subtitle="Owner-only security controls">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="secondary" className="w-full" onClick={() => navigate("/team")}>
              Manage staff roles
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => navigate("/audit-log")}>
              View audit log
            </Button>
          </div>
        </Section>

        {/* Security / Data */}
        <Section icon={Shield} title="Backup & Security">
          <div className="space-y-2">
            <button
              onClick={exportData}
              className="w-full flex items-center justify-between t-btn px-4 py-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4" /> Download backup (JSON)
              </span>
              <span className="t-dim text-xs">Recommended weekly</span>
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              className="w-full flex items-center justify-between t-btn px-4 py-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4" /> Import backup
              </span>
              <span className="t-dim text-xs">.json</span>
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImport}
            />
            <a
              href="/account/logout"
              className="w-full flex items-center justify-between t-btn px-4 py-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Sign out
              </span>
            </a>
            <div className="rounded-xl t-danger-bg px-4 py-3 text-xs">
              <strong className="block mb-0.5">Delete account</strong>
              Account deletion is not yet supported in-app. Contact support to
              permanently remove your data.
            </div>
          </div>
        </Section>
          </>
        )}
      </div>
    </>
  );
}
