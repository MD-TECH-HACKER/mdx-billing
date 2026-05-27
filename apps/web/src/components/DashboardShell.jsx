// Themed dashboard shell — sidebar (desktop) + bottom nav (mobile) + top bar.
// Reacts to theme tokens, supports prefetching, and works as a single shared layout.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  BarChart3,
  Settings,
  Users,
  ContactRound,
  Truck,
  ClipboardList,
  Wallet,
  ShieldCheck,
  LogOut,
  FileText,
  Menu,
  X,
  Store,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import useCart from "@/utils/useCart";
import ThemeStyles from "@/components/ThemeStyles";
import ToastHost from "@/components/Toast";
import { initTheme } from "@/utils/theme";
import { AppLoader, Badge, Card } from "@/components/ui";
import { shopHeaders } from "@/utils/shopContext";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", roles: ["owner", "manager"] },
  { label: "Products", icon: Package, href: "/products", roles: ["owner", "manager"] },
  { label: "Billing", icon: ShoppingCart, href: "/billing" },
  { label: "Estimate", icon: FileText, href: "/estimate", roles: ["owner", "manager"] },
  { label: "Stock Estimate", icon: FileText, href: "/stock-estimate", roles: ["owner", "manager"] },
  { label: "Sales", icon: Receipt, href: "/sales" },
  { label: "Customers", icon: ContactRound, href: "/customers" },
  { label: "Suppliers", icon: Truck, href: "/suppliers", roles: ["owner", "manager"] },
  { label: "Purchases", icon: ClipboardList, href: "/purchases", roles: ["owner", "manager"] },
  { label: "Expenses", icon: Wallet, href: "/expenses", roles: ["owner", "manager"] },
  { label: "Analytics", icon: BarChart3, href: "/analytics", roles: ["owner", "manager"] },
  { label: "AI Assistant", icon: Sparkles, href: "/ai", roles: ["owner", "manager"] },
  { label: "Team", icon: Users, href: "/team", roles: ["owner"] },
  { label: "Audit Log", icon: ShieldCheck, href: "/audit-log", roles: ["owner"] },
  { label: "Settings", icon: Settings, href: "/settings" },
];

// Prefetch fetch helpers for snappy nav
function prefetchRoute(qc, href, shopId) {
  const headers = shopHeaders();
  if (href === "/dashboard" || href === "/analytics") {
    qc.prefetchQuery({
      queryKey: ["analytics", shopId],
      queryFn: async () => (await fetch("/api/analytics", { headers })).json(),
      staleTime: 30000,
    });
  }
  if (href === "/products") {
    qc.prefetchQuery({
      queryKey: ["products", "", shopId],
      queryFn: async () => (await fetch("/api/products", { headers })).json(),
      staleTime: 30000,
    });
  }
  if (href === "/sales") {
    qc.prefetchQuery({
      queryKey: ["sales", shopId, "", "", "", "all", "newest"],
      queryFn: async () => (await fetch("/api/sales", { headers })).json(),
      staleTime: 30000,
    });
  }
}

const BASE_TITLE = "\u232C \uD835\uDE48\uD835\uDE3F\uD835\uDE53 \uD835\uDDD5\uD835\uDDDC\uD835\uDDDF\uD835\uDDDF\uD835\uDDDC\uD835\uDDE1\uD835\uDDDA \uD835\uDDD4\uD835\uDDE3\uD835\uDDE3 \u232C";

export default function DashboardShell({
  children,
  requireShop = true,
  allowedRoles,
}) {
  const location = useLocation();
  const currentPath = location.pathname;
  const { data: user, loading: userLoading } = useUser();
  const { shop, role, loading: shopLoading } = useShop({ enabled: !!user });
  const { count: cartCount } = useCart();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const currentNavItem = NAV.find(
    (n) => currentPath === n.href || (n.href !== "/dashboard" && currentPath.startsWith(n.href)),
  );
  const roleConfirmed = !requireShop || !!role;
  const roleDenied = !!(
    roleConfirmed &&
    role &&
    ((allowedRoles && !allowedRoles.includes(role)) ||
      (currentNavItem?.roles && !currentNavItem.roles.includes(role)))
  );

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

  // Dynamic page title
  useEffect(() => {
    document.title = currentNavItem
      ? `${BASE_TITLE} | ${currentNavItem.label}`
      : BASE_TITLE;
  }, [currentNavItem]);

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

  if (requireShop && !role) {
    return <AppLoader fullScreen label="Loading your shop role..." />;
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
  const availableNav = role === "owner" ? NAV : NAV.filter((item) => !item.roles || item.roles.includes(role));
  const homePath = role === "cashier" ? "/billing" : "/dashboard";

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip relative font-inter">
      <ThemeStyles />
      <div className="prism-bg" />
      <ToastHost />

      <div className="min-h-screen">
        <aside className={`hidden lg:flex flex-col fixed h-screen z-30 no-print transition-all duration-300 ${collapsed ? "w-[96px]" : "w-64"}`}>
          <div className={`flex-1 t-card flex flex-col overflow-hidden m-4 ${collapsed ? "px-2 py-4" : "p-3"}`}>
            {/* Logo — fixed top */}
            <div className="shrink-0">
              <Link to={homePath} className={`flex items-center mb-4 ${collapsed ? "justify-center px-0" : "gap-3 px-2"}`}>
                <img src="/logo.png" alt="MDX" className="w-9 h-9 shrink-0 rounded-full shadow-lg object-cover" />
                {!collapsed && (
                  <div className="min-w-0">
                    <div className="t-text font-semibold text-[15px] leading-tight truncate">
                      MDX Billing
                    </div>
                    <div className="t-dim text-[9px] uppercase tracking-wider truncate mt-0.5">
                      Premium
                    </div>
                  </div>
                )}
              </Link>
            </div>

            {/* Nav — scrollable middle, scrollbar hidden */}
            <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden min-h-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
              {availableNav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onMouseEnter={() => prefetchRoute(qc, item.href, shop?.shop_id)}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center rounded-[10px] transition-all text-[13px] font-semibold ${
                      collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2"
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
                        : { border: "1px solid transparent" }
                    }
                  >
                    <Icon className={`${collapsed ? "w-5 h-5" : "w-4 h-4"} shrink-0`} />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.href === "/billing" && cartCount > 0 ? (
                      <span
                        className="ml-auto text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold"
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

            {/* Bottom actions — always visible, never hidden */}
            <div className="shrink-0 mt-2 pt-2 space-y-0.5" style={{ borderTop: '1px solid var(--border)' }}>
              <a
                href="/account/logout"
                title={collapsed ? "Logout" : undefined}
                className={`flex items-center rounded-[10px] t-muted hover:text-[var(--danger)] transition text-[13px] ${
                  collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2"
                }`}
              >
                <LogOut className={`${collapsed ? "w-5 h-5" : "w-4 h-4"} shrink-0`} />
                {!collapsed && <span className="font-semibold">Logout</span>}
              </a>
              <button
                onClick={toggleSidebar}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={`w-full flex items-center rounded-[10px] t-muted hover:bg-[var(--bg-elev)] hover:t-text transition text-[13px] ${
                  collapsed ? "justify-center w-10 h-10 mx-auto" : "gap-3 px-3 py-2"
                }`}
              >
                {collapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
                {!collapsed && <span className="font-semibold">Collapse Sidebar</span>}
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
                    <img src="/logo.png" alt="MDX" className="w-10 h-10 rounded-full object-cover" />
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
                  {availableNav.map((item) => {
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
        <main
          className={`min-w-0 max-w-full overflow-x-clip min-h-screen pb-32 lg:pb-8 transition-all duration-300 ${
            collapsed
              ? "lg:ml-24 lg:w-[calc(100%-6rem)]"
              : "lg:ml-64 lg:w-[calc(100%-16rem)]"
          }`}
        >
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

              <Link to={homePath} className="flex items-center gap-2 min-w-0">
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

              {role !== "cashier" ? (
                <Link
                  to="/ai"
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl t-elev hover:bg-[var(--bg-input-focus)] t-text"
                  title="AI Assistant"
                >
                  <Sparkles className="w-4 h-4 t-accent-text" />
                  <span className="text-xs font-semibold">AI</span>
                </Link>
              ) : null}
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
                <div className="hidden md:block text-left max-w-[190px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="t-text text-xs font-medium leading-tight truncate">
                      {user?.name || "User"}
                    </span>
                    {role ? (
                      <Badge tone={role === "owner" ? "accent" : role === "manager" ? "success" : "neutral"}>
                        {role[0].toUpperCase() + role.slice(1)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="t-dim text-[10px] leading-tight truncate">
                    {user?.email}
                  </div>
                  {shop?.shop_name ? (
                    <div className="t-dim text-[10px] leading-tight truncate">
                      {shop.shop_name}
                    </div>
                  ) : null}
                </div>
              </Link>
            </div>
          </header>

          <div className="px-3 md:px-6 mt-2 max-w-full min-w-0">
            {roleDenied ? (
              <Card className="max-w-xl mx-auto text-center py-10">
                <ShieldCheck className="w-12 h-12 t-dim2 mx-auto mb-3" />
                <h1 className="t-text text-xl font-bold">Access denied</h1>
                <p className="t-muted text-sm mt-2">
                  Your current role ({role}) does not have permission to open this page.
                </p>
                <Link to={homePath} className="t-btn-primary inline-flex rounded-xl px-4 py-2 mt-5 text-sm font-semibold">
                  Go to your workspace
                </Link>
              </Card>
            ) : children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-30 no-print" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="t-card px-2 py-2 flex items-center justify-start gap-1 overflow-x-auto max-w-full">
          {availableNav.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className="relative flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl min-w-[64px]"
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
      {import.meta.env.DEV ? (
        <div className="fixed right-3 bottom-24 z-[60] no-print max-w-[280px] rounded-2xl border t-border t-card p-3 text-[10px] t-muted shadow-xl">
          <div className="t-text font-bold text-xs mb-1">MDX Dev Debug</div>
          <div>route: {currentPath}</div>
          <div>uid: {user?.id || "none"}</div>
          <div>shopId: {shop?.shop_id || "none"}</div>
          <div>role: {role || "loading"}</div>
          <div>userLoading: {String(userLoading)}</div>
          <div>shopLoading: {String(shopLoading)}</div>
          <div>roleDenied: {String(roleDenied)}</div>
        </div>
      ) : null}
    </div>
  );
}
