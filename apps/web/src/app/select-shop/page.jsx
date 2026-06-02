import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Store, Plus, ArrowRight, Sparkles, Ban } from "lucide-react";
import useUser from "@/utils/useUser";
import { setActiveShopId, shopHeaders } from "@/utils/shopContext";
import { AppLoader } from "@/components/ui";

const SUPPORT_EMAIL = "support@mdx-billing.app";

function roleLabel(role) {
  return role === "owner" ? "Owner" : role === "manager" ? "Manager" : "Cashier";
}

function isShopSuspended(shop) {
  return String(shop?.status || "active").toLowerCase() === "suspended";
}

export default function SelectShopPage() {
  const { data: user, loading: userLoading } = useUser();
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);

  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/account/signin?callbackUrl=/select-shop";
    }
  }, [user, userLoading]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/shop/active", { headers: shopHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!d.shops || d.shops.length === 0) {
          navigate("/setup-shop", { replace: true });
          return;
        }
        setShops(d.shops);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, navigate]);

  const handleSelectShop = (shop) => {
    if (isShopSuspended(shop)) return;
    setSelecting(shop.shop_id);
    setActiveShopId(shop.shop_id);
    // Small delay for visual feedback
    setTimeout(() => {
      navigate(shop.access_role === "cashier" ? "/billing" : "/dashboard", { replace: true });
    }, 300);
  };

  const handleCreateNew = () => {
    navigate("/setup-shop?new=true");
  };

  if (userLoading || !user || loading) {
    return <AppLoader fullScreen label="Loading your shops..." />;
  }

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden flex items-center justify-center px-4 py-10 font-inter"
    >
      {/* Background */}
      <div className="prism-bg" />

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl mb-5">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="t-text text-2xl sm:text-3xl font-bold font-poppins">
            Select your shop
          </h1>
          <p className="t-muted text-sm mt-2">
            {shops.length === 1
              ? "Choose your shop to continue."
              : `You have ${shops.length} shops. Choose one to continue.`}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs t-dim t-elev t-border border px-3 py-1 rounded-full">
            <Sparkles className="w-3 h-3 text-yellow-300" />
            Switch anytime from Settings
          </div>
        </div>

        {/* Shop cards */}
        <div className="space-y-3 mb-5">
          {shops.map((shop) => {
            const isSelecting = selecting === shop.shop_id;
            const suspended = isShopSuspended(shop);
            const isDisabled = !!selecting || suspended;
            return (
              <button
                key={shop.shop_id}
                onClick={() => handleSelectShop(shop)}
                disabled={isDisabled}
                className={`
                  w-full flex items-center gap-4 p-4 rounded-2xl
                  t-card
                  ${suspended ? "opacity-55 grayscale cursor-not-allowed border-red-200 bg-slate-100/80" : "hover:border-[var(--accent)] hover:shadow-lg"}
                  transition-all duration-300 text-left
                  disabled:opacity-60 disabled:cursor-wait
                  ${isSelecting ? "ring-2 ring-[var(--accent)] scale-[0.98]" : ""}
                `}
              >
                {/* Shop logo/avatar */}
                {shop.shop_logo ? (
                  <img
                    src={shop.shop_logo}
                    alt={shop.shop_name}
                    className="w-14 h-14 rounded-xl object-cover border-2 border-white/20 flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <span className="text-white font-bold text-xl">
                      {(shop.shop_name || "S")[0].toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Shop info */}
                <div className="flex-1 min-w-0">
                  <div className="t-text font-semibold text-base truncate">
                    {shop.shop_name}
                  </div>
                  <div className="mt-1 inline-flex items-center rounded-full bg-orange-100 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                    {roleLabel(shop.access_role)}
                  </div>
                  {suspended ? (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <Ban className="w-3 h-3" /> Shop suspended
                    </div>
                  ) : null}
                  {shop.shop_description ? (
                    <div className="t-dim text-xs mt-0.5 truncate">
                      {shop.shop_description}
                    </div>
                  ) : null}
                  {suspended ? (
                    <div className="text-red-700 text-xs mt-2">
                      Contact {SUPPORT_EMAIL} to unlock this shop.
                    </div>
                  ) : null}
                  {shop.address ? (
                    <div className="t-dim2 text-[11px] mt-0.5 truncate">
                      📍 {shop.address}
                    </div>
                  ) : null}
                </div>

                {/* Arrow */}
                <div className={`flex-shrink-0 transition-transform duration-300 ${isSelecting ? "translate-x-1" : ""}`}>
                  {suspended ? (
                    <div className="w-8 h-8 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                      <Ban className="w-4 h-4 text-red-600" />
                    </div>
                  ) : isSelecting ? (
                    <div className="w-8 h-8 rounded-full bg-violet-500/30 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full t-elev flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 t-muted" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Create new shop */}
        <button
          onClick={handleCreateNew}
          disabled={!!selecting}
          className="
            w-full flex items-center justify-center gap-2 p-4 rounded-2xl
            border-2 border-dashed t-border
            hover:border-[var(--accent)] hover:t-accent-soft
            t-muted hover:t-text
            transition-all duration-300
            disabled:opacity-50
          "
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium text-sm">Create a new shop</span>
        </button>

        {/* Footer */}
        <p className="text-center t-dim2 text-xs mt-6">
          © {new Date().getFullYear()} MDX Billing · Premium Shop Management
        </p>
      </div>
    </div>
  );
}
