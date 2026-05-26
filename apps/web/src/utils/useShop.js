import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { applyTheme } from "@/utils/theme";

async function fetchShop() {
  const res = await fetch("/api/shop");
  if (!res.ok) throw new Error("Failed to load shop");
  return res.json();
}

export default function useShop({ enabled = true } = {}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["shop"],
    queryFn: fetchShop,
    enabled,
    staleTime: 1000 * 60 * 2,
  });

  // Sync theme + accent to DOM whenever shop loads/changes
  useEffect(() => {
    const shop = query.data?.shop;
    if (shop) {
      applyTheme(shop.theme || "glass", shop.accent_color || "#8b5cf6");
    }
  }, [query.data?.shop?.theme, query.data?.shop?.accent_color]);

  const update = useMutation({
    mutationFn: async (patch) => {
      const res = await fetch("/api/shop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      return res.json();
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["shop"] });
      const prev = qc.getQueryData(["shop"]);
      qc.setQueryData(["shop"], (old) => {
        if (!old?.shop) return old;
        const next = { ...old.shop };
        if (typeof patch.shopName === "string") next.shop_name = patch.shopName;
        if (typeof patch.shopDescription === "string")
          next.shop_description = patch.shopDescription;
        if (typeof patch.shopLogo === "string") next.shop_logo = patch.shopLogo;
        if (typeof patch.address === "string") next.address = patch.address;
        if (typeof patch.phone === "string") next.phone = patch.phone;
        if (typeof patch.receiptPrefix === "string")
          next.receipt_prefix = patch.receiptPrefix;
        if (typeof patch.taxPercent === "number")
          next.tax_percent = patch.taxPercent;
        if (typeof patch.currency === "string") next.currency = patch.currency;
        if (typeof patch.thankYouMessage === "string")
          next.thank_you_message = patch.thankYouMessage;
        if (typeof patch.theme === "string") next.theme = patch.theme;
        if (typeof patch.accentColor === "string")
          next.accent_color = patch.accentColor;
        return { ...old, shop: next };
      });
      // immediate UI update for theme changes
      if (patch.theme || patch.accentColor) {
        const current = qc.getQueryData(["shop"])?.shop;
        applyTheme(
          patch.theme || current?.theme || "glass",
          patch.accentColor || current?.accent_color || "#8b5cf6",
        );
      }
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(["shop"], ctx.prev);
    },
    onSuccess: (data) => {
      qc.setQueryData(["shop"], data);
    },
  });

  return {
    shop: query.data?.shop || null,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    update: update.mutate,
    updateAsync: update.mutateAsync,
    saving: update.isPending,
  };
}
