// Themed dashboard shell — sidebar (desktop) + bottom nav (mobile) + top bar.
// Reacts to theme tokens, supports prefetching, and works as a single shared layout.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import useCart from "@/utils/useCart";
import ThemeStyles from "@/components/ThemeStyles";
import ToastHost from "@/components/Toast";
import { initTheme } from "@/utils/theme";
import { AppLoader } from "@/components/ui";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Products", icon: Package, href: "/products" },
  { label: "Billing", icon: ShoppingCart, href: "/billing" },
  { label: "Sales", icon: Receipt, href: "/sales" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

// Prefetch fetch helpers for snappy nav
function prefetchRoute(qc, href) {
  if (href === "/dashboard" || href === "/analytics") {
    qc.prefetchQuery({
      queryKey: ["analytics"],
      queryFn: async () => (await fetch("/api/analytics")).json(),
      staleTime: 30000,
    });
  }
  if (href === "/products") {
    qc.prefetchQuery({
      queryKey: ["products", ""],
      queryFn: async () => (await fetch("/api/products")).json(),
      staleTime: 30000,
    });
  }
  if (href === "/sales") {
    qc.prefetchQuery({
      queryKey: ["sales", {}],
      queryFn: async () => (await fetch("/api/sales")).json(),
      staleTime: 30000,
    });
  }
}

export default function DashboardShell({
  children,
  currentPath = "",
  requireShop = true,
}) {
  const { data: user, loading: userLoading } = useUser();
  const { shop, loading: shopLoading } = useShop({ enabled: !!user });
  const { count: cartCount } = useCart();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      if (typeof window !== "undefined") localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  // initial theme paint from localStorage (before shop loads)
  useEffect(() => {
    initTheme();
  }, []);

  // gate
  useEffect(() => {
    if (!userLoading && !user && typeof window !== "undefined") {
      navigate("/", { replace: true });
    }
  }, [user, userLoading, navigate]);

  // shop check redirect (only when explicitly required by page)
  useEffect(() => {
    if (!user || !requireShop) return;
    if (shopLoading) return; // wait until fetch resolved
    if (shop === null && typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/setup-shop")) {
        navigate("/setup-shop", { replace: true });
      }
    }
  }, [user, shop, shopLoading, requireShop, navigate]);

  if (userLoading) {
    return <AppLoader fullScreen label="Checking your secure session..." />;
  }

  if (!user) {
    return <AppLoader fullScreen label="Redirecting to MDX Billing..." />;
  }

  if (requireShop && shopLoading) {
    return <AppLoader fullScreen label="Loading your shop..." />;
  }

  if (requireShop && shop === null) {
    return <AppLoader fullScreen label="Opening shop setup..." />;
  }

  const isActive = (href) =>
    currentPath === href ||
    (href !== "/dashboard" && currentPath.startsWith(href));

  const linkClass = (active) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
      active
        ? "t-accent-soft"
        : "t-muted hover:bg-[var(--bg-elev)] hover:t-text"
    }`;

  return (
    <div className="min-h-screen w-full relative font-inter">
      <ThemeStyles />
      <div className="prism-bg" />
      <ToastHost />

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className={`hidden lg:flex flex-col fixed h-screen p-4 z-30 no-print transition-all duration-300 ${collapsed ? "w-[96px]" : "w-64"}`}>
          <div className={`flex-1 t-card flex flex-col ${collapsed ? "px-2 py-4" : "p-4"}`}>
            <Link to="/dashboard" className={`flex items-center mb-7 ${collapsed ? "justify-center px-0" : "gap-3 px-2"}`}>
              <div
                className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent), var(--accent-dark))",
                }}
              >
                <Store className="w-5 h-5 text-white" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="t-text font-semibold text-base leading-tight truncate">
                    MDX Billing
                  </div>
                  <div className="t-dim text-[10px] uppercase tracking-wider truncate">
                    Premium
                  </div>
                </div>
              )}
            </Link>

            <nav className="flex-1 space-y-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onMouseEnter={() => prefetchRoute(qc, item.href)}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center rounded-xl transition-all text-sm font-medium ${
                      collapsed ? "justify-center w-12 h-12 mx-auto" : "gap-3 px-3 py-2.5"
                    } ${
                      active
                        ? "t-accent-soft"
                        : "t-muted hover:bg-[var(--bg-elev)] hover:t-text"
                    }`}
                    style={
                      active
                        ? {
                            color: "var(--accent)",
                            background: "rgba(var(--accent-rgb), 0.14)",
                            border: "1px solid rgba(var(--accent-rgb), 0.25)",
                          }
                        : {}
                    }
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.href === "/billing" && cartCount > 0 ? (
                      <span
                        className="ml-auto text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: "var(--accent)" }}
                      >
                        {cartCount}
                      </span>
                    ) : null}
                    {collapsed && item.href === "/billing" && cartCount > 0 ? (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-2 space-y-1">
              <a
                href="/account/logout"
                title={collapsed ? "Logout" : undefined}
                className={`flex items-center rounded-xl t-muted hover:text-[var(--danger)] transition text-sm ${
                  collapsed ? "justify-center w-12 h-12 mx-auto" : "gap-3 px-3 py-2.5"
                }`}
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="font-medium">Logout</span>}
              </a>
              <button
                onClick={toggleSidebar}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={`w-full flex items-center rounded-xl t-muted hover:bg-[var(--bg-elev)] hover:t-text transition text-sm ${
                  collapsed ? "justify-center w-12 h-12 mx-auto" : "gap-3 px-3 py-2.5"
                }`}
              >
                {collapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
                {!collapsed && <span className="font-medium">Collapse Sidebar</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="lg:hidden fixed inset-0 z-50 no-print">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-72 p-4">
              <div className="h-full t-card t-card-strong p-4 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--accent), var(--accent-dark))",
                      }}
                    >
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <span className="t-text font-semibold">MDX Billing</span>
                  </div>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="w-9 h-9 rounded-xl t-elev flex items-center justify-center t-text"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="flex-1 space-y-1">
                  {NAV.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={linkClass(active)}
                        style={
                          active
                            ? {
                                color: "var(--accent)",
                                background: "rgba(var(--accent-rgb), 0.14)",
                                border:
                                  "1px solid rgba(var(--accent-rgb), 0.25)",
                              }
                            : {}
                        }
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <a
                  href="/account/logout"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl t-muted hover:text-[var(--danger)] text-sm"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Logout</span>
                </a>
              </div>
            </aside>
          </div>
        ) : null}

        {/* Main */}
        <main className={`flex-1 min-h-screen pb-28 lg:pb-8 transition-all duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
          {/* Top bar */}
          <header className="sticky top-0 z-20 py-3 md:py-4 no-print">
            <div className="mx-3 md:mx-6 t-card px-3 md:px-5 py-2.5 flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden w-9 h-9 rounded-xl t-elev flex items-center justify-center t-text"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
                {shop?.shop_logo ? (
                  <img
                    src={shop.shop_logo}
                    alt={shop.shop_name}
                    className="w-9 h-9 rounded-xl object-cover border t-border"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--accent), var(--accent-dark))",
                    }}
                  >
                    {shop?.shop_name?.[0]?.toUpperCase() || "S"}
                  </div>
                )}
                <div className="hidden sm:block min-w-0">
                  <div className="t-text font-semibold text-sm truncate">
                    {shop?.shop_name || "Your Shop"}
                  </div>
                  {shop?.shop_description ? (
                    <div className="t-dim text-xs truncate max-w-[180px]">
                      {shop.shop_description}
                    </div>
                  ) : null}
                </div>
              </Link>

              <div className="flex-1" />

              <Link
                to="/billing"
                className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl t-elev hover:bg-[var(--bg-input-focus)] t-text"
                title="Cart"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="text-xs font-semibold">{cartCount}</span>
              </Link>
              <Link
                to="/settings"
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-[var(--bg-elev)] transition"
              >
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--accent), var(--accent-dark))",
                    }}
                  >
                    {(user?.name || user?.email || "U")?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="hidden md:block text-left max-w-[140px]">
                  <div className="t-text text-xs font-medium leading-tight truncate">
                    {user?.name || "User"}
                  </div>
                  <div className="t-dim text-[10px] leading-tight truncate">
                    {user?.email}
                  </div>
                </div>
              </Link>
            </div>
          </header>

          <div className="px-3 md:px-6 mt-2">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-30 no-print">
        <div className="t-card px-2 py-2 flex items-center justify-around">
          {NAV.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className="relative flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl"
                style={
                  active
                    ? {
                        background: "rgba(var(--accent-rgb), 0.14)",
                        border: "1px solid rgba(var(--accent-rgb), 0.25)",
                      }
                    : {}
                }
              >
                <Icon
                  className="w-5 h-5"
                  style={{
                    color: active ? "var(--accent)" : "var(--text-muted)",
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: active ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {item.label}
                </span>
                {item.href === "/billing" && cartCount > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 text-white text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: "var(--accent)" }}
                  >
                    {cartCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
