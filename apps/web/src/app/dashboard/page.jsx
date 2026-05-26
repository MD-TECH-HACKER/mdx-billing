import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Percent,
  Calendar,
  CalendarDays,
  AlertTriangle,
  Star,
  Award,
  IndianRupee,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Receipt as ReceiptIcon,
  Eye,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Bell,
  Search,
  Clock,
  BarChart3,
  DollarSign,
  Users,
  Box,
  Zap,
  Target,
  Activity,
  PieChart as PieChartIcon,
  FileText,
  CreditCard,
  Wallet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Sparkles,
  Flame,
  Layers,
  BadgePercent,
  CircleDollarSign,
  Hash,
  Timer,
  ShoppingBag,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import useProfile from "@/utils/useProfile";
import { formatMoney } from "@/utils/currency";
import { Card, Skeleton, Button, Badge } from "@/components/ui";
import { shopHeaders } from "@/utils/shopContext";

/* ═══════════════════════════════════════════════════════════════════════
 * CONSTANTS & HELPERS
 * ═══════════════════════════════════════════════════════════════════════ */

const ACCENT = "#F97316";
const ACCENT_DARK = "#EA580C";
const ACCENT_LIGHT = "#FDBA74";
const ACCENT_BG = "rgba(249, 115, 22, 0.1)";
const ACCENT_SOFT = "rgba(249, 115, 22, 0.08)";
const ACCENT_BORDER = "rgba(249, 115, 22, 0.2)";

const SUCCESS = "#059669";
const SUCCESS_BG = "rgba(5, 150, 105, 0.1)";
const SUCCESS_LIGHT = "#10B981";
const SUCCESS_BORDER = "rgba(5, 150, 105, 0.2)";

const DANGER = "#DC2626";
const DANGER_BG = "rgba(220, 38, 38, 0.1)";
const DANGER_LIGHT = "#F87171";
const DANGER_BORDER = "rgba(220, 38, 38, 0.2)";

const WARNING = "#D97706";
const WARNING_BG = "rgba(217, 119, 6, 0.1)";
const WARNING_LIGHT = "#FBBF24";
const WARNING_BORDER = "rgba(217, 119, 6, 0.2)";

const INFO_BG = "rgba(37, 99, 235, 0.1)";
const INFO = "#2563EB";

const CHART_COLORS = [
  ACCENT,
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#06B6D4",
  "#F43F5E",
];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Animation helper for counting up numbers
function useCountUp(target, duration = 1200, enabled = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!enabled || !target) {
      setValue(target || 0);
      return;
    }

    let startTime = null;
    const startValue = 0;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (target - startValue) * eased);

      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, enabled]);

  return value;
}

// Format large numbers with Indian notation
function formatIndianNumber(num) {
  if (num === undefined || num === null) return "0";
  const n = Number(num);
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}

// Generate sparkline data
function generateSparkline(length = 7, min = 10, max = 50) {
  return Array.from({ length }, () => ({
    v: Math.floor(Math.random() * (max - min) + min),
  }));
}

// Get relative time string
function getRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ═══════════════════════════════════════════════════════════════════════
 * STAT CARD COMPONENT
 * Matches the preview: icon top-left, label, large value, trend badge
 * ═══════════════════════════════════════════════════════════════════════ */
function StatCard({
  icon: Icon,
  iconBg = ACCENT,
  iconColor = "var(--bg-surface)",
  label,
  value,
  trend,
  trendLabel,
  trendUp = true,
  sub,
  loading = false,
  delay = 0,
  prefix = "",
  suffix = "",
  sparkData,
  onClick,
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (loading) {
    return (
      <div
        className="t-card overflow-hidden"
        style={{
          padding: "20px 24px",
          borderRadius: "16px",
          minHeight: "140px",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="w-11 h-11" style={{ borderRadius: "14px" }} />
          <Skeleton className="w-16 h-5" style={{ borderRadius: "8px" }} />
        </div>
        <Skeleton
          className="w-24 h-4 mb-2"
          style={{ borderRadius: "6px" }}
        />
        <Skeleton className="w-32 h-8" style={{ borderRadius: "8px" }} />
      </div>
    );
  }

  return (
    <div
      className="group relative overflow-hidden cursor-pointer"
      onClick={onClick}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "20px 24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: visible ? "translateY(0)" : "translateY(16px)",
        opacity: visible ? 1 : 0,
        minHeight: "140px",
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          "0 4px 12px rgba(0,0,0,0.06), 0 12px 28px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = ACCENT_BORDER;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* Subtle gradient overlay on hover */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "40%",
          background: `linear-gradient(135deg, transparent 0%, ${ACCENT_BG} 100%)`,
          opacity: 0,
          transition: "opacity 0.35s ease",
          pointerEvents: "none",
        }}
        className="group-hover:!opacity-60"
      />

      {/* Header row: icon + trend */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "14px",
            background: `linear-gradient(135deg, ${iconBg}, ${iconBg}dd)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 12px ${iconBg}33`,
            transition: "transform 0.3s ease, box-shadow 0.3s ease",
          }}
        >
          <Icon style={{ width: "20px", height: "20px", color: iconColor }} />
        </div>

        {trend !== undefined && trend !== null && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: 600,
              background: trendUp ? SUCCESS_BG : DANGER_BG,
              color: trendUp ? SUCCESS : DANGER,
              border: `1px solid ${trendUp ? SUCCESS_BORDER : DANGER_BORDER}`,
            }}
          >
            {trendUp ? (
              <ArrowUpRight style={{ width: "12px", height: "12px" }} />
            ) : (
              <ArrowDownRight style={{ width: "12px", height: "12px" }} />
            )}
            {trend}
          </div>
        )}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: "12.5px",
          fontWeight: 500,
          color: "var(--text-dim)",
          marginBottom: "4px",
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: "26px",
          fontWeight: 700,
          color: "var(--text)",
          fontFamily: "'Poppins', sans-serif",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        {prefix}
        {value}
        {suffix}
      </div>

      {/* Sub label / trend description */}
      {(trendLabel || sub) && (
        <div
          style={{
            fontSize: "11.5px",
            color: trendUp ? SUCCESS : "var(--text-dim2)",
            marginTop: "6px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {trendUp && trendLabel && (
            <TrendingUp style={{ width: "12px", height: "12px" }} />
          )}
          {trendLabel || sub}
        </div>
      )}

      {/* Mini sparkline */}
      {sparkData && sparkData.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            right: "16px",
            width: "80px",
            height: "32px",
            opacity: 0.4,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={iconBg} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={iconBg} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={iconBg}
                fill={`url(#spark-${label})`}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * CHART CARD COMPONENT
 * Clean white card with title, optional action button, and chart content
 * ═══════════════════════════════════════════════════════════════════════ */
function ChartCard({
  title,
  subtitle,
  action,
  actionLabel = "View All",
  actionHref,
  children,
  className = "",
  headerRight,
  noPadding = false,
  minHeight = "auto",
  loading = false,
}) {
  if (loading) {
    return (
      <div
        className={className}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
          minHeight,
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="w-32 h-5" style={{ borderRadius: "6px" }} />
          <Skeleton className="w-20 h-7" style={{ borderRadius: "8px" }} />
        </div>
        <Skeleton className="w-full" style={{ height: "200px", borderRadius: "12px" }} />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: noPadding ? "0" : "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
        minHeight,
        transition: "border-color 0.3s ease",
      }}
    >
      {title && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
            padding: noPadding ? "24px 24px 0" : "0",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-dim2)",
                  margin: "2px 0 0",
                  fontWeight: 400,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {headerRight}
            {actionHref && (
              <Link
                to={actionHref}
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: ACCENT,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  borderRadius: "10px",
                  background: ACCENT_SOFT,
                  border: `1px solid ${ACCENT_BORDER}`,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = ACCENT;
                  e.currentTarget.style.color = "var(--bg-surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = ACCENT_SOFT;
                  e.currentTarget.style.color = ACCENT;
                }}
              >
                {actionLabel}
                <ArrowRight style={{ width: "12px", height: "12px" }} />
              </Link>
            )}
          </div>
        </div>
      )}
      <div style={{ padding: noPadding ? "0 24px 24px" : "0" }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * PERIOD SELECTOR DROPDOWN
 * "This Week" dropdown matching the preview image
 * ═══════════════════════════════════════════════════════════════════════ */
function PeriodSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options = [
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
  ];

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 14px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          background: "var(--bg-elev)",
          fontSize: "12.5px",
          fontWeight: 500,
          color: "var(--text)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = ACCENT;
          e.currentTarget.style.background = ACCENT_BG;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.background = "var(--bg-elev)";
        }}
      >
        {selected.label}
        <ChevronDown
          style={{
            width: "14px",
            height: "14px",
            color: "var(--text-dim2)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 50,
            minWidth: "160px",
            padding: "6px",
            animation: "fadeInDown 0.15s ease",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background:
                  opt.value === value ? ACCENT_SOFT : "transparent",
                color: opt.value === value ? ACCENT : "var(--text)",
                fontSize: "12.5px",
                fontWeight: opt.value === value ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (opt.value !== value) {
                  e.currentTarget.style.background = "var(--bg-elev)";
                }
              }}
              onMouseLeave={(e) => {
                if (opt.value !== value) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {opt.label}
              {opt.value === value && (
                <CheckCircle2
                  style={{
                    width: "14px",
                    height: "14px",
                    marginLeft: "auto",
                    color: ACCENT,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * PRODUCT HIGHLIGHT CARD
 * Used for "Top Selling Product" and "Highest Margin" sections
 * ═══════════════════════════════════════════════════════════════════════ */
function ProductHighlight({
  title,
  productName,
  productImage,
  stat1Label,
  stat1Value,
  stat2Label,
  stat2Value,
  accentColor = ACCENT,
  icon: Icon = Star,
  loading = false,
}) {
  if (loading) {
    return (
      <div
        style={{
          padding: "16px",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          background: "var(--bg-elev)",
        }}
      >
        <Skeleton className="w-20 h-4 mb-3" style={{ borderRadius: "6px" }} />
        <div className="flex items-center gap-3">
          <Skeleton className="w-14 h-14" style={{ borderRadius: "12px" }} />
          <div className="flex-1">
            <Skeleton className="w-28 h-4 mb-2" style={{ borderRadius: "6px" }} />
            <Skeleton className="w-20 h-3" style={{ borderRadius: "4px" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group"
      style={{
        padding: "18px",
        borderRadius: "14px",
        border: "1px solid var(--border)",
        background: "var(--bg-elev)",
        transition: "all 0.3s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)";
        e.currentTarget.style.borderColor = `${accentColor}33`;
        e.currentTarget.style.boxShadow = `0 4px 16px ${accentColor}11`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-elev)";
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Section title */}
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <Icon
          style={{ width: "14px", height: "14px", color: accentColor }}
        />
        {title}
      </div>

      {/* Product info */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Product image or placeholder */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {productImage ? (
            <img
              src={productImage}
              alt={productName}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Box
              style={{
                width: "24px",
                height: "24px",
                color: "var(--text-dim2)",
              }}
            />
          )}
        </div>

        {/* Product details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {productName || "—"}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-dim)",
              display: "flex",
              flexDirection: "column",
              gap: "1px",
            }}
          >
            <span>
              {stat1Label}: <strong style={{ color: "var(--text)" }}>{stat1Value}</strong>
            </span>
            <span>
              {stat2Label}: <strong style={{ color: accentColor }}>{stat2Value}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * INVOICE ROW COMPONENT
 * Single row in the Recent Invoices table matching preview
 * ═══════════════════════════════════════════════════════════════════════ */
function InvoiceRow({ sale, currency, index }) {
  const fmt = (n) => formatMoney(n, currency);
  const isPaid = !sale.is_pending;
  const statusColors = isPaid
    ? { bg: SUCCESS_BG, text: SUCCESS, border: SUCCESS_BORDER, label: "Paid" }
    : { bg: WARNING_BG, text: WARNING, border: WARNING_BORDER, label: "Pending" };

  return (
    <tr
      className="group"
      style={{
        borderBottom: "1px solid var(--border)",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elev)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Invoice ID */}
      <td
        style={{
          padding: "14px 16px",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text)",
          fontFamily: "'Poppins', monospace",
          letterSpacing: "-0.01em",
        }}
      >
        {sale.receipt_number || `INV-${String(sale.sale_id).slice(-5).padStart(5, "0")}`}
      </td>

      {/* Customer */}
      <td
        style={{
          padding: "14px 16px",
          fontSize: "13px",
          color: "var(--text)",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: `linear-gradient(135deg, ${CHART_COLORS[index % CHART_COLORS.length]}22, ${CHART_COLORS[index % CHART_COLORS.length]}44)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
              color: CHART_COLORS[index % CHART_COLORS.length],
            }}
          >
            {(sale.buyer_name || "W")?.[0]?.toUpperCase()}
          </div>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sale.buyer_name || "Walk-in Customer"}
          </span>
        </div>
      </td>

      {/* Amount */}
      <td
        style={{
          padding: "14px 16px",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text)",
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {fmt(sale.total_amount)}
      </td>

      {/* Status badge */}
      <td style={{ padding: "14px 16px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: 600,
            background: statusColors.bg,
            color: statusColors.text,
            border: `1px solid ${statusColors.border}`,
          }}
        >
          {isPaid ? (
            <CheckCircle2 style={{ width: "11px", height: "11px" }} />
          ) : (
            <Clock style={{ width: "11px", height: "11px" }} />
          )}
          {statusColors.label}
        </span>
      </td>

      {/* Date */}
      <td
        style={{
          padding: "14px 16px",
          fontSize: "12.5px",
          color: "var(--text-dim)",
          fontWeight: 400,
          whiteSpace: "nowrap",
        }}
      >
        {new Date(sale.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </td>

      {/* Action */}
      <td style={{ padding: "14px 16px", textAlign: "right" }}>
        <Link
          to={`/sales/${sale.sale_id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "30px",
            borderRadius: "8px",
            background: "transparent",
            color: "var(--text-dim2)",
            transition: "all 0.15s ease",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = ACCENT_SOFT;
            e.currentTarget.style.color = ACCENT;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-dim2)";
          }}
        >
          <Eye style={{ width: "15px", height: "15px" }} />
        </Link>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * LOW STOCK ITEM COMPONENT
 * Matches the preview: product image, name, stock count in red
 * ═══════════════════════════════════════════════════════════════════════ */
function LowStockItem({ product, currency }) {
  const stock = product.stock ?? product.quantity ?? 0;
  const isVeryLow = stock <= 2;
  const isCritical = stock === 0;

  const stockColor = isCritical
    ? DANGER
    : isVeryLow
      ? DANGER_LIGHT
      : WARNING;

  const stockBg = isCritical
    ? DANGER_BG
    : isVeryLow
      ? DANGER_BG
      : WARNING_BG;

  return (
    <div
      className="group"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 14px",
        borderRadius: "12px",
        transition: "all 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elev)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Product image */}
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Package
            style={{ width: "18px", height: "18px", color: "var(--text-dim2)" }}
          />
        )}
      </div>

      {/* Product name */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {product.title}
      </div>

      {/* Stock count */}
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: stockColor,
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "8px",
            background: stockBg,
          }}
        >
          Stock: {stock}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * QUICK ACTION BUTTON
 * ═══════════════════════════════════════════════════════════════════════ */
function QuickAction({ icon: Icon, label, href, color = ACCENT }) {
  return (
    <Link
      to={href}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        padding: "16px 12px",
        borderRadius: "14px",
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        textDecoration: "none",
        transition: "all 0.25s ease",
        cursor: "pointer",
        minWidth: "90px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = `0 4px 16px ${color}15`;
        e.currentTarget.style.borderColor = `${color}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "12px",
          background: `${color}12`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.25s ease",
        }}
      >
        <Icon style={{ width: "20px", height: "20px", color }} />
      </div>
      <span
        style={{
          fontSize: "11.5px",
          fontWeight: 500,
          color: "var(--text-dim)",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * CUSTOM TOOLTIP FOR CHARTS
 * ═══════════════════════════════════════════════════════════════════════ */
function CustomTooltip({ active, payload, label, currency = "INR" }) {
  if (!active || !payload?.length) return null;
  const fmt = (n) => formatMoney(n, currency);

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "12px 16px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        fontSize: "12px",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: "6px",
          fontSize: "13px",
        }}
      >
        {label}
      </div>
      {payload.map((entry, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "3px 0",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: entry.color,
            }}
          />
          <span style={{ color: "var(--text-dim)", textTransform: "capitalize" }}>
            {entry.dataKey}:
          </span>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>
            {typeof entry.value === "number" && entry.value > 100
              ? fmt(entry.value)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * CATEGORY BREAKDOWN MINI CARD
 * ═══════════════════════════════════════════════════════════════════════ */
function CategoryItem({ name, count, total, color, index }) {
  const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "3px",
          background: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          fontSize: "12.5px",
          fontWeight: 500,
          color: "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text)",
          minWidth: "32px",
          textAlign: "right",
        }}
      >
        {count}
      </span>
      <div
        style={{
          width: "60px",
          height: "6px",
          borderRadius: "3px",
          background: "var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            borderRadius: "3px",
            background: color,
            transition: "width 0.8s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "var(--text-dim2)",
          minWidth: "30px",
          textAlign: "right",
        }}
      >
        {percentage}%
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * MARGIN PRODUCT ROW
 * Shows product with its margin percentage
 * ═══════════════════════════════════════════════════════════════════════ */
function MarginProductRow({ product, rank, maxMargin = 100 }) {
  const margin = Number(product.margin || 0);
  const barWidth = maxMargin > 0 ? (margin / maxMargin) * 100 : 0;
  const barColor = margin >= 40 ? SUCCESS : margin >= 20 ? ACCENT : WARNING;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 0",
      }}
    >
      <span
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "6px",
          background: "var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          fontWeight: 700,
          color: "var(--text-dim2)",
          flexShrink: 0,
        }}
      >
        {rank}
      </span>
      <span
        style={{
          flex: 1,
          fontSize: "12.5px",
          fontWeight: 500,
          color: "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {(product.title || "").slice(0, 20)}
      </span>
      <div
        style={{
          width: "60px",
          height: "6px",
          borderRadius: "3px",
          background: "var(--border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: "100%",
            borderRadius: "3px",
            background: barColor,
            transition: "width 1s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: barColor,
          minWidth: "40px",
          textAlign: "right",
        }}
      >
        {margin.toFixed(1)}%
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 *
 *   ██████╗  █████╗ ███████╗██╗  ██╗██████╗  ██████╗  █████╗ ██████╗ ██████╗
 *   ██╔══██╗██╔══██╗██╔════╝██║  ██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗
 *   ██║  ██║███████║███████╗███████║██████╔╝██║   ██║███████║██████╔╝██║  ██║
 *   ██║  ██║██╔══██║╚════██║██╔══██║██╔══██╗██║   ██║██╔══██║██╔══██╗██║  ██║
 *   ██████╔╝██║  ██║███████║██║  ██║██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
 *   ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝
 *
 *   MAIN DASHBOARD PAGE COMPONENT
 *
 * ═══════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const { profile } = useProfile({ enabled: !!user });
  const [chartPeriod, setChartPeriod] = useState("week");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  /* ─── Data queries ──────────────────────────────────────────────── */
  const analyticsQuery = useQuery({
    queryKey: ["analytics", shop?.shop_id],
    queryFn: async () => {
      const res = await fetch("/api/analytics", { headers: shopHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!user && !!shop?.shop_id,
    staleTime: 30000,
  });

  const recentSalesQuery = useQuery({
    queryKey: ["sales", shop?.shop_id, "recent"],
    queryFn: async () => {
      const res = await fetch("/api/sales", { headers: shopHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!user && !!shop?.shop_id,
    staleTime: 30000,
  });

  const productsQuery = useQuery({
    queryKey: ["products", "", shop?.shop_id],
    queryFn: async () => {
      const res = await fetch("/api/products", { headers: shopHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!user && !!shop?.shop_id,
    staleTime: 30000,
  });

  /* ─── Computed data ─────────────────────────────────────────────── */
  const analytics = analyticsQuery.data;
  const currency = shop?.currency || "INR";
  const fmt = (n) => formatMoney(n, currency);

  const stats = analytics?.stats || {};
  const loading = analyticsQuery.isLoading;
  const firstName = (profile?.displayName || user?.name || "").split(" ")[0];

  const recentSales = (recentSalesQuery.data?.sales || []).slice(0, 6);
  const allProducts = productsQuery.data?.products || [];

  // Low stock products (stock < 10)
  const lowStockProducts = useMemo(
    () =>
      allProducts
        .filter((p) => (p.stock ?? p.quantity ?? 999) < 10)
        .sort(
          (a, b) =>
            (a.stock ?? a.quantity ?? 0) - (b.stock ?? b.quantity ?? 0),
        )
        .slice(0, 6),
    [allProducts],
  );

  // Sales by day for chart
  const salesByDay = useMemo(
    () =>
      (analytics?.salesByDay || []).map((s) => ({
        day: new Date(s.day).toLocaleDateString("en-IN", {
          weekday: "short",
        }),
        revenue: Number(s.revenue),
        profit: Number(s.profit),
      })),
    [analytics],
  );

  // Weekly sales data (last 7 days) for matching preview chart
  const weeklyChartData = useMemo(() => {
    if (salesByDay.length > 0) return salesByDay.slice(-7);
    // Fallback placeholder for empty state
    return DAYS_OF_WEEK.map((day) => ({ day, revenue: 0, profit: 0 }));
  }, [salesByDay]);

  // Top products by quantity sold
  const topProducts = useMemo(
    () =>
      (analytics?.productAnalytics || [])
        .slice()
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 5)
        .map((p) => ({
          name: (p.title || "").slice(0, 14),
          sold: p.quantitySold,
        })),
    [analytics],
  );

  // Category breakdown
  const categoryData = useMemo(
    () =>
      (analytics?.categoryBreakdown || []).map((c) => ({
        name: c.name,
        value: c.count,
      })),
    [analytics],
  );

  const totalCategoryItems = categoryData.reduce((s, c) => s + c.value, 0);

  // Margin data
  const marginData = useMemo(
    () =>
      (analytics?.productAnalytics || [])
        .slice()
        .sort((a, b) => (b.margin || 0) - (a.margin || 0))
        .slice(0, 5),
    [analytics],
  );

  const maxMargin = marginData.length > 0 ? Math.max(...marginData.map((p) => p.margin || 0)) : 100;

  // Best selling product info
  const bestSelling = analytics?.bestSelling;
  const highestMargin = analytics?.highestMargin;

  // Animated stat values
  const animatedRevenue = useCountUp(stats.totalRevenue || 0, 1400, !loading);
  const animatedProfit = useCountUp(stats.totalProfit || 0, 1400, !loading);
  const animatedProducts = useCountUp(stats.totalProducts || 0, 1000, !loading);
  const animatedTodayRevenue = useCountUp(stats.todayRevenue || 0, 1200, !loading);

  // Greeting based on time
  const hour = currentTime.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const dateString = currentTime.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* ═══════════════════════════════════════════════════════════════════
   * RENDER
   * ═══════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Keyframe animation styles */}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .dash-fade-in { animation: fadeIn 0.5s ease forwards; }
        .dash-fade-up { animation: fadeInUp 0.5s ease forwards; }
        .dash-slide-right { animation: slideInRight 0.5s ease forwards; }

        /* Custom scrollbar for table */
        .dash-table-scroll::-webkit-scrollbar { height: 4px; }
        .dash-table-scroll::-webkit-scrollbar-track { background: transparent; }
        .dash-table-scroll::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 2px;
        }
        .dash-table-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--border-strong);
        }

        /* Table responsive */
        .dash-table th {
          position: sticky;
          top: 0;
          background: #FAFAFA;
          z-index: 1;
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
       * SECTION 1: WELCOME HEADER
       * ═══════════════════════════════════════════════════════════════ */}
      <div
        className="dash-fade-up"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "26px",
              fontWeight: 700,
              color: "var(--text)",
              fontFamily: "'Poppins', sans-serif",
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {greeting}
            {firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p
            style={{
              fontSize: "13.5px",
              color: "var(--text-dim)",
              margin: "4px 0 0",
              fontWeight: 400,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Calendar style={{ width: "14px", height: "14px", color: "var(--text-dim2)" }} />
            {dateString}
          </p>
        </div>

        {/* Quick actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Link
            to="/billing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 20px",
              borderRadius: "12px",
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
              color: "var(--bg-surface)",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: `0 4px 14px ${ACCENT}44`,
              transition: "all 0.25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = `0 6px 20px ${ACCENT}55`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = `0 4px 14px ${ACCENT}44`;
            }}
          >
            <ShoppingCart style={{ width: "15px", height: "15px" }} />
            New Bill
          </Link>
          <Link
            to="/products"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 20px",
              borderRadius: "12px",
              background: "var(--bg-surface)",
              color: "var(--text)",
              fontSize: "13px",
              fontWeight: 500,
              textDecoration: "none",
              border: "1px solid var(--border)",
              transition: "all 0.25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = ACCENT;
              e.currentTarget.style.color = ACCENT;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text)";
            }}
          >
            <Package style={{ width: "15px", height: "15px" }} />
            Add Product
          </Link>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       * SECTION 2: STAT CARDS (4 columns — matching preview)
       * Total Sales | Total Profit | Total Products | Today's Sales
       * ═══════════════════════════════════════════════════════════════ */}
      {analyticsQuery.isError ? (
        <div
          className="t-card flex flex-wrap items-center justify-between gap-3"
          style={{ padding: "14px 18px", marginBottom: "18px", borderColor: DANGER_BORDER }}
        >
          <div>
            <div className="t-text text-sm font-semibold">Dashboard summary could not be loaded</div>
            <div className="t-muted text-xs mt-1">
              Invoice records are available, but totals are unavailable until the summary reloads.
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => analyticsQuery.refetch()}>
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
        className="dash-stat-grid"
      >
        <style>{`
          @media (max-width: 1024px) {
            .dash-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          }
          @media (max-width: 640px) {
            .dash-stat-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        <StatCard
          icon={ShoppingCart}
          iconBg={ACCENT}
          label="Total Sales"
          value={fmt(animatedRevenue)}
          trend="12.5%"
          trendLabel="↑ 12.5% this month"
          trendUp={true}
          loading={loading}
          delay={0}
          sparkData={generateSparkline(7, 20, 60)}
        />
        <StatCard
          icon={TrendingUp}
          iconBg={SUCCESS}
          label="Total Profit"
          value={fmt(animatedProfit)}
          trend="8.7%"
          trendLabel="↑ 8.7% this month"
          trendUp={true}
          loading={loading}
          delay={80}
          sparkData={generateSparkline(7, 15, 45)}
        />
        <StatCard
          icon={Package}
          iconBg="#3B82F6"
          label="Total Products"
          value={animatedProducts.toLocaleString("en-IN")}
          sub="Active products"
          loading={loading}
          delay={160}
        />
        <StatCard
          icon={Calendar}
          iconBg="#8B5CF6"
          label="Today's Sales"
          value={fmt(animatedTodayRevenue)}
          trend="15.3%"
          trendLabel="↑ 15.3% today"
          trendUp={true}
          loading={loading}
          delay={240}
          sparkData={generateSparkline(7, 10, 40)}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       * SECTION 3: CHARTS ROW
       * Left: Sales Overview (weekly line chart)
       * Right: Top Selling Product + Highest Margin
       * ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 380px)",
          gap: "16px",
          marginBottom: "24px",
          alignItems: "start",
        }}
        className="dash-chart-grid"
      >
        <style>{`
          @media (max-width: 1200px) {
            .dash-chart-grid { grid-template-columns: 1fr !important; }
          }
          .dash-chart-area { height: 320px; }
          @media (max-width: 1024px) { .dash-chart-area { height: 260px; } }
          @media (max-width: 640px) { .dash-chart-area { height: 220px; } }
        `}</style>

        {/* ── Sales Overview Line Chart ── */}
        <ChartCard
          title="Sales Overview"
          subtitle="Revenue trend for the selected period"
          headerRight={
            <PeriodSelector value={chartPeriod} onChange={setChartPeriod} />
          }
          loading={loading}
          minHeight="auto"
        >
          <div className="dash-chart-area" style={{ width: "100%" }}>
            {weeklyChartData.every((d) => d.revenue === 0) ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--text-dim2)",
                }}
              >
                <BarChart3
                  style={{ width: "40px", height: "40px", marginBottom: "8px", color: "var(--text-dim2)" }}
                />
                <p style={{ fontSize: "13px", fontWeight: 500 }}>No sales data yet</p>
                <p style={{ fontSize: "12px", color: "var(--text-dim2)" }}>
                  Start billing to see your chart
                </p>
              </div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={weeklyChartData}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SUCCESS} stopOpacity={0.25} />
                      <stop offset="50%" stopColor={SUCCESS} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={SUCCESS} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    stroke="var(--text-dim2)"
                    fontSize={12}
                    fontWeight={500}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    dy={8}
                  />
                  <YAxis
                    stroke="var(--text-dim2)"
                    fontSize={11}
                    fontWeight={400}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                      return v;
                    }}
                    dx={-6}
                  />
                  <Tooltip
                    content={<CustomTooltip currency={currency} />}
                    cursor={{
                      stroke: ACCENT,
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={SUCCESS}
                    fill="url(#salesGradient)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: SUCCESS,
                      stroke: "var(--bg-surface)",
                      strokeWidth: 2,
                    }}
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        {/* ── Top Selling Product + Highest Margin ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Top Selling Product */}
          <ProductHighlight
            title="Top Selling Product"
            productName={bestSelling?.title || "No products sold yet"}
            productImage={bestSelling?.imageUrl || bestSelling?.image_url}
            stat1Label="Sold"
            stat1Value={
              bestSelling
                ? `${bestSelling.quantitySold} units`
                : "—"
            }
            stat2Label="Revenue"
            stat2Value={
              bestSelling
                ? fmt(bestSelling.revenue || bestSelling.quantitySold * (bestSelling.price || 0))
                : "—"
            }
            accentColor={ACCENT}
            icon={Flame}
            loading={loading}
          />

          {/* Highest Margin */}
          <ProductHighlight
            title="Highest Margin"
            productName={highestMargin?.title || "No margin data yet"}
            productImage={highestMargin?.image_url}
            stat1Label="Margin"
            stat1Value={
              highestMargin
                ? `${highestMargin.margin.toFixed(1)}%`
                : "—"
            }
            stat2Label="Profit"
            stat2Value={
              highestMargin
                ? fmt(highestMargin.totalProfit || 0)
                : "—"
            }
            accentColor={SUCCESS}
            icon={Target}
            loading={loading}
          />

          {/* Top Products Bar Chart */}
          <ChartCard title="Top Products" loading={loading}>
            <div style={{ width: "100%", height: "160px" }}>
              {topProducts.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--text-dim2)",
                    fontSize: "13px",
                  }}
                >
                  No product data yet
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={topProducts} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="4 4"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="var(--text-dim2)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--text-dim2)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      content={<CustomTooltip currency={currency} />}
                    />
                    <Bar
                      dataKey="sold"
                      fill={ACCENT}
                      radius={[0, 6, 6, 0]}
                      barSize={14}
                    >
                      {topProducts.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       * SECTION 4: BOTTOM ROW
       * Left: Recent Invoices table
       * Right: Low Stock Alert + Categories
       * ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: "16px",
          marginBottom: "24px",
        }}
        className="dash-bottom-grid"
      >
        <style>{`
          @media (max-width: 1200px) {
            .dash-bottom-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        {/* ── Recent Invoices Table ── */}
        <ChartCard
          title="Recent Invoices"
          subtitle="Latest transactions from your shop"
          actionLabel="View All"
          actionHref="/sales"
          loading={recentSalesQuery.isLoading}
          noPadding
        >
          {recentSales.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 24px",
                color: "var(--text-dim2)",
              }}
            >
              <ReceiptIcon
                style={{
                  width: "40px",
                  height: "40px",
                  marginBottom: "12px",
                  color: "var(--text-dim2)",
                }}
              />
              <p style={{ fontSize: "14px", fontWeight: 500, margin: 0 }}>
                No sales yet
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-dim2)", margin: "4px 0 0" }}>
                Create your first bill to see invoices here
              </p>
              <Link
                to="/billing"
                style={{
                  marginTop: "16px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 18px",
                  borderRadius: "10px",
                  background: ACCENT,
                  color: "var(--bg-surface)",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <ShoppingCart style={{ width: "14px", height: "14px" }} />
                Create Bill
              </Link>
            </div>
          ) : (
            <div className="dash-table-scroll" style={{ overflowX: "auto" }}>
              <table
                className="dash-table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Invoice ID", "Customer", "Amount", "Status", "Date", ""].map(
                      (h, i) => (
                        <th
                          key={i}
                          style={{
                            padding: "12px 16px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            color: "var(--text-dim)",
                            textAlign: i === 5 ? "right" : "left",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            whiteSpace: "nowrap",
                            background: "var(--bg-elev)",
                          }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale, i) => (
                    <InvoiceRow
                      key={sale.sale_id}
                      sale={sale}
                      currency={currency}
                      index={i}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        {/* ── Right column: Low Stock + Categories ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Low Stock Alert */}
          <ChartCard
            title="Low Stock Alert"
            subtitle={`${lowStockProducts.length} products below 10 units`}
            actionLabel="View All"
            actionHref="/products"
            loading={productsQuery.isLoading}
          >
            {lowStockProducts.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "32px 16px",
                  color: "var(--text-dim2)",
                }}
              >
                <CheckCircle2
                  style={{
                    width: "32px",
                    height: "32px",
                    marginBottom: "8px",
                    color: SUCCESS,
                  }}
                />
                <p style={{ fontSize: "13px", fontWeight: 500, margin: 0, color: SUCCESS }}>
                  All products well stocked!
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-dim2)", margin: "4px 0 0" }}>
                  No items are running low
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {lowStockProducts.map((product, i) => (
                  <LowStockItem
                    key={product.product_id || i}
                    product={product}
                    currency={currency}
                  />
                ))}
              </div>
            )}
          </ChartCard>

          {/* Category Breakdown */}
          <ChartCard
            title="Categories"
            subtitle={`${categoryData.length} categories`}
            loading={loading}
          >
            {categoryData.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px",
                  color: "var(--text-dim2)",
                  fontSize: "13px",
                }}
              >
                No categories yet
              </div>
            ) : (
              <div>
                {categoryData.slice(0, 5).map((cat, i) => (
                  <CategoryItem
                    key={cat.name}
                    name={cat.name}
                    count={cat.value}
                    total={totalCategoryItems}
                    color={CHART_COLORS[i % CHART_COLORS.length]}
                    index={i}
                  />
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       * SECTION 5: ADDITIONAL ANALYTICS ROW
       * Revenue vs Profit chart + Margin Leaderboard + Quick Actions
       * ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "24px",
        }}
        className="dash-analytics-grid"
      >
        <style>{`
          @media (max-width: 1024px) {
            .dash-analytics-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        {/* Revenue vs Profit Line Chart */}
        <ChartCard
          title="Revenue vs Profit"
          subtitle="Comparing revenue and profit trends"
          loading={loading}
          minHeight="auto"
        >
          <div style={{ width: "100%", height: "240px" }}>
            {salesByDay.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "var(--text-dim2)",
                  fontSize: "13px",
                }}
              >
                No data available
              </div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={salesByDay}>
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    stroke="var(--text-dim2)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    stroke="var(--text-dim2)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                      return v;
                    }}
                  />
                  <Tooltip content={<CustomTooltip currency={currency} />} />
                  <Legend
                    wrapperStyle={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--text-dim)",
                      paddingTop: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={ACCENT}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: ACCENT,
                      stroke: "var(--bg-surface)",
                      strokeWidth: 2,
                    }}
                    name="Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke={SUCCESS}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: SUCCESS,
                      stroke: "var(--bg-surface)",
                      strokeWidth: 2,
                    }}
                    name="Profit"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        {/* Margin Leaderboard */}
        <ChartCard
          title="Margin Leaderboard"
          subtitle="Products ranked by profit margin"
          loading={loading}
          minHeight="auto"
        >
          {marginData.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "200px",
                color: "var(--text-dim2)",
                fontSize: "13px",
              }}
            >
              No margin data available
            </div>
          ) : (
            <div>
              {marginData.map((product, i) => (
                <MarginProductRow
                  key={product.title || i}
                  product={product}
                  rank={i + 1}
                  maxMargin={maxMargin}
                />
              ))}

              {/* Average margin summary */}
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: ACCENT_BG,
                  border: `1px solid ${ACCENT_BORDER}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <BadgePercent
                    style={{ width: "16px", height: "16px", color: ACCENT }}
                  />
                  <span
                    style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--text)" }}
                  >
                    Average Margin
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: ACCENT,
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  {(stats.avgMargin || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       * SECTION 6: QUICK ACTIONS + SUMMARY ROW
       * ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "16px",
          marginBottom: "24px",
        }}
        className="dash-summary-grid"
      >
        <style>{`
          @media (max-width: 768px) {
            .dash-summary-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        {/* Monthly Summary */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <CalendarDays style={{ width: "16px", height: "16px", color: ACCENT }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
              Monthly Summary
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "var(--bg-elev)",
              }}
            >
              <span style={{ fontSize: "12.5px", color: "var(--text-dim)", fontWeight: 500 }}>
                Revenue
              </span>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text)",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {fmt(stats.monthRevenue)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "var(--bg-elev)",
              }}
            >
              <span style={{ fontSize: "12.5px", color: "var(--text-dim)", fontWeight: 500 }}>
                Orders
              </span>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text)",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {stats.monthCount || 0}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "10px",
                background: SUCCESS_BG,
              }}
            >
              <span style={{ fontSize: "12.5px", color: SUCCESS, fontWeight: 500 }}>
                Avg. Order Value
              </span>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: SUCCESS,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {fmt(
                  stats.monthCount > 0
                    ? (stats.monthRevenue || 0) / stats.monthCount
                    : 0,
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Today's Summary */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <Clock style={{ width: "16px", height: "16px", color: "#8B5CF6" }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
              Today&apos;s Summary
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "var(--bg-elev)",
              }}
            >
              <span style={{ fontSize: "12.5px", color: "var(--text-dim)", fontWeight: 500 }}>
                Revenue
              </span>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text)",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {fmt(stats.todayRevenue)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "var(--bg-elev)",
              }}
            >
              <span style={{ fontSize: "12.5px", color: "var(--text-dim)", fontWeight: 500 }}>
                Orders
              </span>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text)",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {stats.todayCount || 0}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "10px",
                background: `${ACCENT_BG}`,
              }}
            >
              <span style={{ fontSize: "12.5px", color: ACCENT, fontWeight: 500 }}>
                Avg. Order Value
              </span>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: ACCENT,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {fmt(
                  stats.todayCount > 0
                    ? (stats.todayRevenue || 0) / stats.todayCount
                    : 0,
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <Zap style={{ width: "16px", height: "16px", color: WARNING }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
              Quick Actions
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <QuickAction
              icon={ShoppingCart}
              label="New Bill"
              href="/billing"
              color={ACCENT}
            />
            <QuickAction
              icon={Package}
              label="Products"
              href="/products"
              color="#3B82F6"
            />
            <QuickAction
              icon={ReceiptIcon}
              label="Sales"
              href="/sales"
              color={SUCCESS}
            />
            <QuickAction
              icon={BarChart3}
              label="Analytics"
              href="/analytics"
              color="#8B5CF6"
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       * SECTION 7: PERFORMANCE METRICS BAR
       * Small info cards at bottom
       * ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "16px",
        }}
        className="dash-perf-grid"
      >
        <style>{`
          @media (max-width: 1024px) {
            .dash-perf-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 640px) {
            .dash-perf-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        {/* Total Sales Count */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: `${ACCENT}12`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Hash style={{ width: "18px", height: "18px", color: ACCENT }} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-dim2)", fontWeight: 500, marginBottom: "2px" }}>
              Total Orders
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--text)",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {stats.totalSales || 0}
            </div>
          </div>
        </div>

        {/* Avg Margin */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: `${SUCCESS}12`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Percent style={{ width: "18px", height: "18px", color: SUCCESS }} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-dim2)", fontWeight: 500, marginBottom: "2px" }}>
              Avg Margin
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--text)",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {(stats.avgMargin || 0).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Low Stock Items */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: `1px solid ${lowStockProducts.length > 0 ? DANGER_BORDER : "var(--border)"}`,
            borderRadius: "14px",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: lowStockProducts.length > 0 ? DANGER_BG : "var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle
              style={{
                width: "18px",
                height: "18px",
                color: lowStockProducts.length > 0 ? DANGER : "var(--text-dim2)",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-dim2)", fontWeight: 500, marginBottom: "2px" }}>
              Low Stock
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: lowStockProducts.length > 0 ? DANGER : "var(--text)",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {stats.lowStockCount || lowStockProducts.length || 0}
            </div>
          </div>
        </div>

        {/* Active Products */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: INFO_BG,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Layers style={{ width: "18px", height: "18px", color: "#3B82F6" }} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-dim2)", fontWeight: 500, marginBottom: "2px" }}>
              Active Products
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--text)",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              {stats.totalProducts || allProducts.length || 0}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       * FOOTER POWERED BY
       * ═══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          textAlign: "center",
          padding: "24px 0 8px",
          fontSize: "11px",
          color: "var(--text-dim2)",
          fontWeight: 400,
        }}
      >
        Powered by{" "}
        <span style={{ fontWeight: 600, color: ACCENT }}>MDX Billing</span>{" "}
        · Premium Shop Management
      </div>
    </>
  );
}
