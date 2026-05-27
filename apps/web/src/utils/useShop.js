import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useState } from "react";
import { applyTheme } from "@/utils/theme";
import { getActiveShopId, setActiveShopId, shopHeaders } from "@/utils/shopContext";
import useUser from "@/utils/useUser";

async function fetchShop(activeShopId) {
  const res = await fetch("/api/shop", {
    headers: shopHeaders({}, activeShopId),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load shop");
  }
  return res.json();
}

async function fetchAllShops(activeShopId) {
  const res = await fetch("/api/shop/active", {
    headers: shopHeaders({}, activeShopId),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load shops");
  }
  return res.json();
}

export default function useShop({ enabled = true } = {}) {
  const qc = useQueryClient();
  const { data: user, loading: userLoading } = useUser();
  const [activeShopId, setActiveShopIdState] = useState(() => getActiveShopId());
  const queryEnabled = enabled && !!user?.id && !userLoading;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncActiveShop = () => setActiveShopIdState(getActiveShopId());
    window.addEventListener("shop-changed", syncActiveShop);
    window.addEventListener("storage", syncActiveShop);
    return () => {
      window.removeEventListener("shop-changed", syncActiveShop);
      window.removeEventListener("storage", syncActiveShop);
    };
  }, []);

  const query = useQuery({
    queryKey: ["shop", user?.id || "anonymous", activeShopId || "default"],
    queryFn: () => fetchShop(activeShopId),
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 2,
  });

  const allShopsQuery = useQuery({
    queryKey: ["allShops", user?.id || "anonymous", activeShopId || "default"],
    queryFn: () => fetchAllShops(activeShopId),
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    const loadedShopId = query.data?.shop?.shop_id;
    if (!activeShopId && loadedShopId) {
      setActiveShopId(loadedShopId);
    }
  }, [activeShopId, query.data?.shop?.shop_id]);

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
        headers: shopHeaders({ "Content-Type": "application/json" }, activeShopId),
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      return res.json();
    },
    onMutate: async (patch) => {
      const shopQueryKey = ["shop", user?.id || "anonymous", activeShopId || "default"];
      await qc.cancelQueries({ queryKey: shopQueryKey });
      const prev = qc.getQueryData(shopQueryKey);
      qc.setQueryData(shopQueryKey, (old) => {
        if (!old?.shop) return old;
        const next = { ...old.shop };
        if (typeof patch.shopName === "string") next.shop_name = patch.shopName;
        if (typeof patch.shopDescription === "string")
          next.shop_description = patch.shopDescription;
        if (typeof patch.shopLogo === "string") next.shop_logo = patch.shopLogo;
        if (typeof patch.address === "string") next.address = patch.address;
        if (typeof patch.phone === "string") next.phone = patch.phone;
        if (typeof patch.email === "string") next.email = patch.email;
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
        if (typeof patch.sendReceiptEmail === "boolean")
          next.send_receipt_email = patch.sendReceiptEmail;
        if (typeof patch.gstBillingEnabled === "boolean")
          next.gst_billing_enabled = patch.gstBillingEnabled;
        if (typeof patch.businessLegalName === "string")
          next.business_legal_name = patch.businessLegalName;
        if (typeof patch.businessAddress === "string")
          next.business_address = patch.businessAddress;
        if (typeof patch.state === "string") next.state = patch.state;
        if (typeof patch.stateCode === "string") next.state_code = patch.stateCode;
        if (typeof patch.defaultGstRate === "number")
          next.default_gst_rate = patch.defaultGstRate;
        if (typeof patch.taxMode === "string") next.tax_mode = patch.taxMode;
        if (typeof patch.defaultInvoiceType === "string")
          next.default_invoice_type = patch.defaultInvoiceType;
        if (typeof patch.defaultPaymentMethod === "string")
          next.default_payment_method = patch.defaultPaymentMethod;
        if (typeof patch.receiptSize === "string") next.receipt_size = patch.receiptSize;
        if (typeof patch.printMode === "string") next.print_mode = patch.printMode;
        if (Array.isArray(patch.customUnits)) next.custom_units = patch.customUnits;
        return { ...old, role: old.role, shop: next };
      });
      // immediate UI update for theme changes
      if (patch.theme || patch.accentColor) {
        const current = qc.getQueryData(shopQueryKey)?.shop;
        applyTheme(
          patch.theme || current?.theme || "glass",
          patch.accentColor || current?.accent_color || "#8b5cf6",
        );
      }
      return { prev, shopQueryKey };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev && ctx?.shopQueryKey) qc.setQueryData(ctx.shopQueryKey, ctx.prev);
    },
    onSuccess: (data) => {
      const shopQueryKey = ["shop", user?.id || "anonymous", activeShopId || "default"];
      qc.setQueryData(shopQueryKey, (old) => ({
        ...data,
        role: data.role || old?.role || null,
      }));
      qc.invalidateQueries({ queryKey: ["allShops", user?.id || "anonymous"] });
    },
  });

  /**
   * Switch the active shop. Updates localStorage and refetches all shop-scoped data.
   */
  const switchShop = useCallback(
    (shopId) => {
      setActiveShopId(shopId);
      setActiveShopIdState(shopId ? String(shopId) : null);
      // Invalidate all shop-scoped queries so they refetch with new X-Shop-Id
      qc.removeQueries({ queryKey: ["shop"] });
      qc.invalidateQueries({ queryKey: ["allShops"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
    [qc],
  );

  return {
    shop: query.data?.shop || null,
    role: query.data?.role || null,
    loading: queryEnabled ? query.isLoading : enabled,
    error: query.error,
    refetch: query.refetch,
    update: update.mutate,
    updateAsync: update.mutateAsync,
    saving: update.isPending,
    // Multi-shop
    allShops: allShopsQuery.data?.shops || [],
    allShopsLoading: allShopsQuery.isLoading,
    shopCount: allShopsQuery.data?.count || 0,
    switchShop,
    activeShopId,
  };
}
