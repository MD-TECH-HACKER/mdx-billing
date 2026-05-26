import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Store, Plus, ArrowRight, Sparkles } from "lucide-react";
import useUser from "@/utils/useUser";
import { setActiveShopId, shopHeaders } from "@/utils/shopContext";
import { AppLoader } from "@/components/ui";

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
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full bg-violet-600/30 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-blue-500/15 blur-3xl" />
      </div>

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl mb-5">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-2xl sm:text-3xl font-bold font-poppins">
            Select your shop
          </h1>
          <p className="text-white/60 text-sm mt-2">
            {shops.length === 1
              ? "Choose your shop to continue."
              : `You have ${shops.length} shops. Choose one to continue.`}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/50 bg-white/10 border border-white/15 px-3 py-1 rounded-full">
            <Sparkles className="w-3 h-3 text-yellow-300" />
            Switch anytime from Settings
          </div>
        </div>

        {/* Shop cards */}
        <div className="space-y-3 mb-5">
          {shops.map((shop) => {
            const isSelecting = selecting === shop.shop_id;
            return (
              <button
                key={shop.shop_id}
                onClick={() => handleSelectShop(shop)}
                disabled={!!selecting}
                className={`
                  w-full flex items-center gap-4 p-4 rounded-2xl
                  bg-white/10 backdrop-blur-2xl border border-white/20
                  hover:bg-white/[0.18] hover:border-violet-400/50
                  hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)]
                  transition-all duration-300 text-left
                  disabled:opacity-60 disabled:cursor-wait
                  ${isSelecting ? "ring-2 ring-violet-400 bg-white/[0.18] scale-[0.98]" : ""}
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
                  <div className="text-white font-semibold text-base truncate">
                    {shop.shop_name}
                  </div>
                  {shop.shop_description ? (
                    <div className="text-white/50 text-xs mt-0.5 truncate">
                      {shop.shop_description}
                    </div>
                  ) : null}
                  {shop.address ? (
                    <div className="text-white/40 text-[11px] mt-0.5 truncate">
                      📍 {shop.address}
                    </div>
                  ) : null}
                </div>

                {/* Arrow */}
                <div className={`flex-shrink-0 transition-transform duration-300 ${isSelecting ? "translate-x-1" : ""}`}>
                  {isSelecting ? (
                    <div className="w-8 h-8 rounded-full bg-violet-500/30 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-white/60" />
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
            border-2 border-dashed border-white/25
            hover:border-violet-400/60 hover:bg-white/[0.06]
            text-white/70 hover:text-white
            transition-all duration-300
            disabled:opacity-50
          "
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium text-sm">Create a new shop</span>
        </button>

        {/* Footer */}
        <p className="text-center text-white/30 text-xs mt-6">
          © {new Date().getFullYear()} MDX Billing · Premium Shop Management
        </p>
      </div>
    </div>
  );
}
