import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Store, Upload, ArrowRight, Globe2, ArrowLeft } from "lucide-react";
import useUser from "@/utils/useUser";
import useUpload from "@/utils/useUpload";
import usePlatformSettings from "@/utils/usePlatformSettings";
import { AppLoader, Select } from "@/components/ui";
import { setActiveShopId, shopHeaders } from "@/utils/shopContext";
import { CURRENCIES } from "@/utils/currency";
import { TIMEZONE_OPTIONS } from "@/utils/timezones";

export default function SetupShopPage() {
  const { data: user, loading: userLoading } = useUser();
  const { settings: platformSettings } = usePlatformSettings();
  const [upload, { loading: uploading }] = useUpload();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewShop = searchParams.get("new") === "true";
  const [displayName, setDisplayName] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [shopLogo, setShopLogo] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [shopChecking, setShopChecking] = useState(!isNewShop);

  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/account/signin?callbackUrl=/setup-shop";
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (platformSettings?.currencyDefault) setCurrency(platformSettings.currencyDefault);
    if (platformSettings?.timezoneDefault) setTimezone(platformSettings.timezoneDefault);
  }, [platformSettings?.currencyDefault, platformSettings?.timezoneDefault]);

  useEffect(() => {
    if (!user) return;
    if (!isNewShop) {
      // Only check existing shops if not explicitly creating a new one
      fetch("/api/shop/active", { headers: shopHeaders() })
        .then((r) => r.json())
        .then((d) => {
          const shops = d.shops || [];
          if (shops.length > 0) {
            navigate("/select-shop", { replace: true });
            return;
          }
          setShopChecking(false);
        })
        .catch(() => setShopChecking(false));
    }
    // also fetch profile to prefill display name
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile)
          setDisplayName(d.profile.displayName || d.profile.name || "");
      })
      .catch(() => {});
  }, [user, navigate, isNewShop]);

  const handleLogo = async (e) => {
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
    setShopLogo(url);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!shopName.trim()) {
      setError("Shop name is required");
      return;
    }
    setSaving(true);
    try {
      const promises = [
        fetch("/api/shop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopName,
            shopDescription,
            shopLogo,
            address,
            phone,
            currency,
            timezone,
          }),
        }),
      ];
      if (displayName.trim()) {
        promises.push(
          fetch("/api/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName: displayName.trim() }),
          }),
        );
      }
      const results = await Promise.all(promises);
      if (!results[0].ok) throw new Error("Failed to save shop");
      const shopData = await results[0].json();
      // Set the newly created shop as active
      if (shopData.shop?.shop_id) {
        setActiveShopId(shopData.shop.shop_id);
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Could not save shop. Try again.");
      setSaving(false);
    }
  };

  if (userLoading || !user || shopChecking) {
    return <AppLoader fullScreen label="Checking your shop..." />;
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center px-4 py-10 font-inter">
      <div className="prism-bg" />

      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg p-6 md:p-8 t-card relative z-10"
      >
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-xl mb-4">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="t-text text-2xl font-bold font-poppins">
            {isNewShop ? "Create a new shop" : "Setup your shop"}
          </h1>
          <p className="t-muted text-sm mt-1">
            {isNewShop ? "Add another shop to your account" : "Just a few details to get you started"}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs t-dim t-elev t-border border px-2.5 py-1 rounded-full">
            <Globe2 className="w-3 h-3" />
            Defaults: {currency} / {timezone}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col items-center">
            <label className="cursor-pointer group">
              <div className="w-24 h-24 rounded-2xl t-elev border-2 border-dashed t-border flex items-center justify-center overflow-hidden hover:border-[var(--accent)] transition">
                {shopLogo ? (
                  <img
                    src={shopLogo}
                    alt="logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Upload className="w-6 h-6 t-dim group-hover:text-[var(--accent)]" />
                )}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogo}
              />
            </label>
            <span className="t-dim text-xs mt-2">
              {uploading ? "Uploading..." : "Optional shop logo"}
            </span>
          </div>

          <div>
            <label className="block t-text text-xs mb-1.5">
              Your name *
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              className="w-full px-4 py-3 t-input"
              placeholder="How should we call you?"
            />
          </div>

          <div>
            <label className="block t-text text-xs mb-1.5">
              Shop name *
            </label>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              maxLength={100}
              className="w-full px-4 py-3 t-input"
              placeholder="My Awesome Shop"
            />
          </div>

          <div>
            <label className="block t-text text-xs mb-1.5">
              Shop description
            </label>
            <textarea
              value={shopDescription}
              onChange={(e) => setShopDescription(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full px-4 py-3 t-input resize-none"
              placeholder="What's your shop about?"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block t-text text-xs mb-1.5">
                Currency
              </label>
              <Select
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES.map((entry) => ({
                  value: entry.code,
                  label: `${entry.name} (${entry.code})`,
                }))}
              />
            </div>
            <div>
              <label className="block t-text text-xs mb-1.5">
                Timezone
              </label>
              <Select
                value={timezone}
                onChange={setTimezone}
                options={TIMEZONE_OPTIONS}
              />
            </div>
            <div>
              <label className="block t-text text-xs mb-1.5">
                Address
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={300}
                className="w-full px-4 py-3 t-input"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block t-text text-xs mb-1.5">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={50}
                className="w-full px-4 py-3 t-input"
                placeholder="Optional"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-xl t-danger-bg px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full t-btn-primary rounded-2xl px-4 py-3.5 font-semibold flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Continue to Dashboard"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
