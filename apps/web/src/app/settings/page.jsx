import { useEffect, useRef, useState } from "react";
import {
  User,
  Store,
  Receipt as ReceiptIcon,
  Palette,
  Shield,
  Upload,
  LogOut,
  Download,
  Cloud,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Save,
  IndianRupee,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
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
  Toggle,
  Tabs,
  ColorSwatch,
  Skeleton,
} from "@/components/ui";
import { ACCENTS, applyTheme } from "@/utils/theme";
import { CURRENCIES, getCurrencyInfo } from "@/utils/currency";

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
  const { shop, update: updateShop } = useShop({ enabled: !!user });
  const [upload, { loading: uploading }] = useUpload();
  const [form, setForm] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [driveSyncing, setDriveSyncing] = useState(false);
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
      receiptPrefix: shop.receipt_prefix || "INV",
      taxPercent: Number(shop.tax_percent) || 0,
      currency: shop.currency || "INR",
      thankYouMessage: shop.thank_you_message || "",
      theme: shop.theme || "glass",
      accentColor: shop.accent_color || "#8b5cf6",
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
        fetch("/api/sales").then((r) => r.json()),
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/shop").then((r) => r.json()),
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

  const toggleDrive = (next) => {
    if (next) {
      // Stub connect — pretend we connected as the user's email
      saveField({ driveConnected: true, driveEmail: user?.email || null });
      showToast("Drive sync stub enabled — full OAuth coming soon", "info");
    } else {
      saveField({
        driveConnected: false,
        driveEmail: null,
        driveLastSynced: null,
      });
      showToast("Drive disconnected");
    }
  };

  const syncNow = async () => {
    if (!shop?.drive_connected) return;
    setDriveSyncing(true);
    try {
      // Stub sync: trigger an export + mark last_synced
      await exportData();
      await new Promise((resolve, reject) => {
        updateShop(
          { driveLastSynced: "now" },
          {
            onSuccess: () => resolve(),
            onError: reject,
          },
        );
      });
      showToast("Synced (local backup downloaded)");
    } catch {
      showToast("Sync failed", "error");
    } finally {
      setDriveSyncing(false);
    }
  };

  if (!form) {
    return (
      <DashboardShell currentPath="/settings">
        <div className="space-y-4 max-w-3xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </DashboardShell>
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

  return (
    <DashboardShell currentPath="/settings">
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

        {/* Google Drive (stub) */}
        <Section
          icon={Cloud}
          title="Google Drive Sync"
          subtitle="Backup your shop data to Drive (full OAuth coming soon)"
        >
          <div className="flex items-center justify-between rounded-xl t-elev p-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: shop?.drive_connected
                    ? "rgba(16,185,129,0.15)"
                    : "var(--bg-input)",
                  color: shop?.drive_connected
                    ? "var(--success)"
                    : "var(--text-dim)",
                }}
              >
                {shop?.drive_connected ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="t-text font-medium text-sm">
                  {shop?.drive_connected ? "Connected" : "Not connected"}
                </div>
                <div className="t-dim text-xs truncate">
                  {shop?.drive_connected
                    ? shop.drive_email || "Google account"
                    : "Connect to backup data to Drive"}
                </div>
              </div>
            </div>
            <Toggle checked={!!shop?.drive_connected} onChange={toggleDrive} />
          </div>
          {shop?.drive_connected ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="t-dim">Last synced</span>
                <span className="t-text">
                  {shop.drive_last_synced
                    ? new Date(shop.drive_last_synced).toLocaleString("en-IN")
                    : "Never"}
                </span>
              </div>
              <Button
                variant="primary"
                className="w-full"
                onClick={syncNow}
                disabled={driveSyncing}
              >
                <RefreshCw
                  className={`w-4 h-4 ${driveSyncing ? "animate-spin" : ""}`}
                />
                {driveSyncing ? "Syncing..." : "Sync now"}
              </Button>
              <p className="t-dim text-[11px] leading-relaxed">
                ⓘ This currently downloads a local JSON backup. Full Drive
                upload requires Google OAuth approval and will be enabled in a
                future update — your data structure is ready.
              </p>
            </div>
          ) : null}
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
      </div>
    </DashboardShell>
  );
}
