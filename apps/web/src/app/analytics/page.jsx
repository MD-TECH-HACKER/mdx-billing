import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Package,
  Award,
  Star,
  AlertTriangle,
  IndianRupee,
  Wallet,
  ClipboardList,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Activity,
  Target,
  Flame,
  Layers,
  PieChart as PieChartIcon,
  Eye,
  ShoppingCart,
  Box,
  Hash,
  Calendar,
  CalendarDays,
  Clock,
  Info,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BadgePercent,
  CircleDollarSign,
  DollarSign,
  Users,
  Zap,
  CreditCard,
  FileText,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Timer,
  Receipt as ReceiptIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
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
  ComposedChart,
  Scatter,
} from "recharts";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import { formatMoney } from "@/utils/currency";
import { Card, Skeleton, Button, Badge } from "@/components/ui";
import { shopHeaders } from "@/utils/shopContext";

/* ═══════════════════════════════════════════════════════════════════════
 * CONSTANTS & DESIGN TOKENS
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

const INFO = "#2563EB";
const INFO_BG = "rgba(37, 99, 235, 0.1)";

const PURPLE = "#8B5CF6";
const PURPLE_BG = "rgba(139, 92, 246, 0.1)";

const CYAN = "#06B6D4";
const CYAN_BG = "rgba(6, 182, 212, 0.1)";

const PINK = "#EC4899";
const PINK_BG = "rgba(236, 72, 153, 0.1)";

const CHART_COLORS = [
  ACCENT, "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#06B6D4", "#F43F5E",
  "#14B8A6", "#6366F1", "#EF4444", "#22C55E",
];

const CATEGORY_COLORS = {
  Uncategorized: "var(--text-dim2)",
};


/* ═══════════════════════════════════════════════════════════════════════
 * HELPER: ANIMATED COUNTER
 * ═══════════════════════════════════════════════════════════════════════ */
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


/* ═══════════════════════════════════════════════════════════════════════
 * CUSTOM TOOLTIP COMPONENT
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
        boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        fontSize: "12px",
        minWidth: "160px",
      }}
    >
      <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "8px", fontSize: "13px" }}>
        {label}
      </div>
      {payload.map((entry, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "3px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: entry.color,
              }}
            />
            <span style={{ color: "var(--text-dim)" }}>{entry.name || entry.dataKey}</span>
          </div>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>
            {typeof entry.value === "number" && entry.value >= 100
              ? fmt(entry.value)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * STAT CARD (Glassmorphic style for analytics)
 * ═══════════════════════════════════════════════════════════════════════ */
function AnalyticsStat({
  icon: Icon,
  label,
  value,
  trend,
  trendValue,
  color = ACCENT,
  bgColor = ACCENT_BG,
  borderColor = ACCENT_BORDER,
  loading = false,
  delay = 0,
}) {
  if (loading) {
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "16px",
          padding: "20px",
          border: "1px solid var(--border)",
        }}
      >
        <Skeleton className="w-10 h-10 mb-3" style={{ borderRadius: "12px" }} />
        <Skeleton className="w-20 h-3 mb-2" style={{ borderRadius: "4px" }} />
        <Skeleton className="w-28 h-6" style={{ borderRadius: "6px" }} />
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        borderRadius: "16px",
        padding: "20px",
        border: `1px solid ${borderColor}`,
        transition: "all 0.3s ease",
        cursor: "default",
        animation: `fadeInUp 0.5s ease ${delay}ms both`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 4px 20px ${color}15, 0 0 0 1px ${color}20`;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            background: bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon style={{ width: "20px", height: "20px", color }} />
        </div>
        {trend && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              fontSize: "11px",
              fontWeight: 600,
              color: trend === "up" ? SUCCESS : DANGER,
              background: trend === "up" ? SUCCESS_BG : DANGER_BG,
              padding: "3px 8px",
              borderRadius: "20px",
            }}
          >
            {trend === "up" ? (
              <ArrowUpRight style={{ width: "12px", height: "12px" }} />
            ) : (
              <ArrowDownRight style={{ width: "12px", height: "12px" }} />
            )}
            {trendValue}
          </div>
        )}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-dim2)", fontWeight: 500, marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
        {value}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * SECTION CARD WRAPPER
 * ═══════════════════════════════════════════════════════════════════════ */
function SectionCard({
  title,
  subtitle,
  children,
  headerRight,
  className = "",
  loading = false,
  noPadding = false,
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
              <p style={{ fontSize: "12px", color: "var(--text-dim2)", margin: "2px 0 0", fontWeight: 400 }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * PRODUCT STOCK CARD (with image, stock bar, and category)
 * ═══════════════════════════════════════════════════════════════════════ */
function ProductStockCard({ product, maxStock, currency = "INR", index = 0 }) {
  const fmt = (n) => formatMoney(n, currency);
  const stockPercent = maxStock > 0 ? (product.stock / maxStock) * 100 : 0;
  const stockColor =
    product.stock <= 0 ? DANGER :
    product.stock < 5 ? WARNING :
    product.stock < 20 ? ACCENT :
    SUCCESS;

  const stockLabel =
    product.stock <= 0 ? "Out of Stock" :
    product.stock < 5 ? "Critical" :
    product.stock < 20 ? "Low" :
    "In Stock";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "14px 16px",
        borderRadius: "14px",
        border: "1px solid var(--border)",
        background: "var(--bg-elev)",
        transition: "all 0.25s ease",
        cursor: "default",
        animation: `fadeInUp 0.4s ease ${index * 50}ms both`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)";
        e.currentTarget.style.borderColor = `${stockColor}44`;
        e.currentTarget.style.boxShadow = `0 4px 16px ${stockColor}11`;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-elev)";
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Product Image */}
      <div
        style={{
          width: "48px",
          height: "48px",
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
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box style={{ width: "20px", height: "20px", color: "var(--text-dim2)" }} />
        )}
      </div>

      {/* Product Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
            {product.title}
          </div>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "20px",
              color: stockColor,
              background: stockColor === DANGER ? DANGER_BG : stockColor === WARNING ? WARNING_BG : stockColor === ACCENT ? ACCENT_BG : SUCCESS_BG,
            }}
          >
            {stockLabel}
          </div>
        </div>

        {/* Stock Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              flex: 1,
              height: "6px",
              borderRadius: "3px",
              background: "var(--border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(stockPercent, 100)}%`,
                borderRadius: "3px",
                background: `linear-gradient(90deg, ${stockColor}, ${stockColor}CC)`,
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: stockColor, minWidth: "40px", textAlign: "right" }}>
            {product.stock}
          </div>
        </div>

        {/* Category + Price */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-dim2)" }}>
            {product.category || "Uncategorized"}
          </div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-dim)" }}>
            {fmt(product.selling_price)}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * PRODUCT ANALYTICS ROW (table-like row with image)
 * ═══════════════════════════════════════════════════════════════════════ */
function ProductAnalyticsRow({ product, maxRevenue, currency = "INR", index = 0 }) {
  const fmt = (n) => formatMoney(n, currency);
  const revenuePercent = maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;
  const marginColor = product.margin >= 50 ? SUCCESS : product.margin >= 20 ? ACCENT : DANGER;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr",
        gap: "12px",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.2s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elev)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Product */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        <div
          style={{
            width: "36px",
            height: "36px",
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
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Box style={{ width: "16px", height: "16px", color: "var(--text-dim2)" }} />
          )}
        </div>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
          {product.title}
        </div>
      </div>

      {/* Quantity Sold */}
      <div style={{ textAlign: "center", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
        {product.quantitySold}
      </div>

      {/* Revenue */}
      <div style={{ textAlign: "right", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
        {fmt(product.revenue)}
      </div>

      {/* Margin */}
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: "20px",
            color: marginColor,
            background: marginColor === SUCCESS ? SUCCESS_BG : marginColor === ACCENT ? ACCENT_BG : DANGER_BG,
          }}
        >
          {(product.margin || 0).toFixed(1)}%
        </span>
      </div>

      {/* Revenue Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            flex: 1,
            height: "8px",
            borderRadius: "4px",
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${revenuePercent}%`,
              borderRadius: "4px",
              background: `linear-gradient(90deg, ${CHART_COLORS[index % CHART_COLORS.length]}, ${CHART_COLORS[index % CHART_COLORS.length]}BB)`,
              transition: "width 0.8s ease",
            }}
          />
        </div>
        <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-dim2)", minWidth: "35px", textAlign: "right" }}>
          {fmt(product.profit)}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * CATEGORY BREAKDOWN CARD
 * ═══════════════════════════════════════════════════════════════════════ */
function CategoryCard({ name, count, total, percentage, color, index = 0 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 14px",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        background: "var(--bg-elev)",
        transition: "all 0.25s ease",
        animation: `fadeInUp 0.4s ease ${index * 60}ms both`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-surface)";
        e.currentTarget.style.borderColor = `${color}44`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--bg-elev)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{name}</div>
        <div style={{ fontSize: "11px", color: "var(--text-dim2)" }}>{count} products</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
          {percentage.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * HIGHLIGHT CARD (Best Selling, Highest/Lowest Margin)
 * ═══════════════════════════════════════════════════════════════════════ */
function HighlightCard({
  icon: Icon,
  label,
  title,
  subtitle,
  imageUrl,
  color = ACCENT,
  bgColor = ACCENT_BG,
  loading = false,
}) {
  if (loading) {
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "16px",
          padding: "20px",
          border: "1px solid var(--border)",
        }}
      >
        <Skeleton className="w-full h-20" style={{ borderRadius: "12px" }} />
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        borderRadius: "16px",
        padding: "20px",
        border: `1px solid ${color}22`,
        transition: "all 0.3s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${color}55`;
        e.currentTarget.style.boxShadow = `0 4px 20px ${color}12`;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${color}22`;
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            background: bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon style={{ width: "14px", height: "14px", color }} />
        </div>
        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-dim2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--bg-elev)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Package style={{ width: "20px", height: "20px", color: "var(--text-dim2)" }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title || "No data"}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "2px" }}>
            {subtitle || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * PERFORMANCE METRIC BAR
 * ═══════════════════════════════════════════════════════════════════════ */
function MetricBar({ icon: Icon, label, value, color = "var(--text-dim)" }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "14px 18px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        flex: 1,
        minWidth: "180px",
        transition: "all 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${color}44`;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <Icon style={{ width: "18px", height: "18px", color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: "11px", color: "var(--text-dim2)", fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>{value}</div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * EXPENSE ROW
 * ═══════════════════════════════════════════════════════════════════════ */
function ExpenseRow({ category, total, maxTotal, currency, color, index = 0 }) {
  const fmt = (n) => formatMoney(n, currency);
  const percent = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 500, color: "var(--text)" }}>
        {category}
      </div>
      <div style={{ width: "120px" }}>
        <div
          style={{
            height: "6px",
            borderRadius: "3px",
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              borderRadius: "3px",
              background: color,
              transition: "width 0.6s ease",
            }}
          />
        </div>
      </div>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", minWidth: "80px", textAlign: "right" }}>
        {fmt(total)}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
 * GLOBAL ANIMATION KEYFRAMES
 * ═══════════════════════════════════════════════════════════════════════ */
const animationStyles = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
`;


/* ═══════════════════════════════════════════════════════════════════════
 * MAIN ANALYTICS PAGE
 * ═══════════════════════════════════════════════════════════════════════ */
export default function AnalyticsPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const [activeTab, setActiveTab] = useState("overview");

  const query = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("/api/analytics", { headers: shopHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });

  // Products query (for stock data)
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/products", { headers: shopHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const data = query.data;
  const stats = data?.stats || {};
  const currency = shop?.currency || "INR";
  const fmt = (n) => formatMoney(n, currency);
  const loading = query.isLoading;
  const products = productsQuery.data?.products || [];

  // Derived data
  const salesByDay = useMemo(
    () =>
      (data?.salesByDay || []).map((s) => ({
        day: new Date(s.day).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        revenue: Number(s.revenue),
        profit: Number(s.profit),
      })),
    [data],
  );

  const productAnalytics = useMemo(() => data?.productAnalytics || [], [data]);

  const expensesByCategory = useMemo(
    () =>
      (data?.expensesByCategory || []).map((e) => ({
        category: e.category,
        total: Number(e.total),
      })),
    [data],
  );

  const categoryBreakdown = useMemo(() => data?.categoryBreakdown || [], [data]);

  const totalCategoryProducts = useMemo(
    () => categoryBreakdown.reduce((sum, c) => sum + c.count, 0),
    [categoryBreakdown],
  );

  const maxExpense = useMemo(
    () => expensesByCategory.length > 0 ? Math.max(...expensesByCategory.map((e) => e.total)) : 0,
    [expensesByCategory],
  );

  const maxRevenue = useMemo(
    () => productAnalytics.length > 0 ? Math.max(...productAnalytics.map((p) => p.revenue)) : 0,
    [productAnalytics],
  );

  const maxStock = useMemo(
    () => products.length > 0 ? Math.max(...products.map((p) => Number(p.stock) || 0)) : 0,
    [products],
  );

  // Sort products by stock for the stock chart
  const productsByStock = useMemo(
    () =>
      [...products]
        .sort((a, b) => Number(a.stock) - Number(b.stock))
        .map((p) => ({
          ...p,
          stock: Number(p.stock) || 0,
          selling_price: Number(p.selling_price) || 0,
          cost_price: Number(p.cost_price) || 0,
        })),
    [products],
  );

  // Category pie chart data
  const pieData = useMemo(
    () =>
      categoryBreakdown.map((c, i) => ({
        name: c.name,
        value: c.count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [categoryBreakdown],
  );

  // Product stock chart data (for the big chart at the bottom)
  const stockChartData = useMemo(
    () =>
      [...products]
        .sort((a, b) => Number(b.stock) - Number(a.stock))
        .slice(0, 20)
        .map((p) => ({
          name: p.title?.length > 16 ? p.title.substring(0, 16) + "…" : p.title,
          fullName: p.title,
          stock: Number(p.stock) || 0,
          price: Number(p.selling_price) || 0,
          cost: Number(p.cost_price) || 0,
          image: p.image_url,
          category: p.category || "Uncategorized",
        })),
    [products],
  );

  // Revenue by product chart data
  const revenueByProduct = useMemo(
    () =>
      [...productAnalytics]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((p) => ({
          name: p.title?.length > 14 ? p.title.substring(0, 14) + "…" : p.title,
          fullName: p.title,
          revenue: p.revenue,
          profit: p.profit,
          cost: p.cost,
          sold: p.quantitySold,
          image: p.imageUrl,
        })),
    [productAnalytics],
  );

  // Margin scatter data
  const marginScatter = useMemo(
    () =>
      productAnalytics.map((p) => ({
        name: p.title,
        margin: p.margin || 0,
        revenue: p.revenue,
        sold: p.quantitySold,
        image: p.imageUrl,
      })),
    [productAnalytics],
  );

  // Animated counters
  const animRevenue = useCountUp(stats.totalRevenue || 0, 1400, !loading);
  const animProfit = useCountUp(stats.totalProfit || 0, 1400, !loading);
  const animProducts = useCountUp(stats.totalProducts || 0, 1000, !loading);
  const animSold = useCountUp(stats.totalProductsSold || 0, 1200, !loading);

  // Profit margin by product (for the big comprehensive chart)
  const profitMarginChart = useMemo(
    () =>
      productAnalytics
        .filter((p) => p.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 12)
        .map((p, i) => ({
          name: p.title?.length > 12 ? p.title.substring(0, 12) + "…" : p.title,
          fullName: p.title,
          revenue: p.revenue,
          profit: p.profit,
          margin: p.margin || 0,
          sold: p.quantitySold,
          color: CHART_COLORS[i % CHART_COLORS.length],
          image: p.imageUrl,
        })),
    [productAnalytics],
  );

  // Stock tooltip
  function StockTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "14px 18px",
          boxShadow: "0 8px 30px var(--shadow)",
          maxWidth: "220px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          {d?.image && (
            <img src={d.image} alt="" style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border)" }} />
          )}
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{d?.fullName || label}</div>
            <div style={{ fontSize: "11px", color: "var(--text-dim2)" }}>{d?.category}</div>
          </div>
        </div>
        {payload.map((entry, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "12px" }}>
            <span style={{ color: "var(--text-dim)" }}>{entry.name}</span>
            <span style={{ fontWeight: 600, color: entry.color || "var(--text)" }}>
              {entry.dataKey === "stock" ? entry.value : fmt(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Revenue tooltip
  function RevenueTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "14px 18px",
          boxShadow: "0 8px 30px var(--shadow)",
          maxWidth: "240px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          {d?.image && (
            <img src={d.image} alt="" style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border)" }} />
          )}
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{d?.fullName || label}</div>
            <div style={{ fontSize: "11px", color: "var(--text-dim2)" }}>{d?.sold} units sold</div>
          </div>
        </div>
        {payload.map((entry, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "12px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-dim)" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: entry.color, display: "inline-block" }} />
              {entry.name}
            </span>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * RENDER
   * ═══════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{animationStyles}</style>

      {/* ── Page Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "clamp(22px, 3vw, 30px)",
              fontWeight: 800,
              color: "var(--text)",
              margin: 0,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
            }}
          >
            Analytics
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-dim2)", margin: "4px 0 0", fontWeight: 400 }}>
            Complete business performance & product insights
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => query.refetch()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--text)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-elev)";
              e.currentTarget.style.borderColor = ACCENT;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-surface)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <RefreshCw style={{ width: "14px", height: "14px" }} />
            Refresh
          </button>
        </div>
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 1: KPI STAT CARDS (8 cards in 4-column grid)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        <AnalyticsStat
          icon={IndianRupee}
          label="Total Revenue"
          value={fmt(animRevenue)}
          color={ACCENT}
          bgColor={ACCENT_BG}
          borderColor={ACCENT_BORDER}
          loading={loading}
          delay={0}
        />
        <AnalyticsStat
          icon={TrendingUp}
          label="Total Profit"
          value={fmt(animProfit)}
          trend={stats.totalProfit > 0 ? "up" : undefined}
          trendValue={stats.avgMargin ? `${stats.avgMargin.toFixed(1)}%` : ""}
          color={SUCCESS}
          bgColor={SUCCESS_BG}
          borderColor={SUCCESS_BORDER}
          loading={loading}
          delay={80}
        />
        <AnalyticsStat
          icon={Package}
          label="Total Products"
          value={animProducts}
          color={INFO}
          bgColor={INFO_BG}
          borderColor="rgba(37, 99, 235, 0.2)"
          loading={loading}
          delay={160}
        />
        <AnalyticsStat
          icon={ShoppingCart}
          label="Products Sold"
          value={animSold}
          color={PURPLE}
          bgColor={PURPLE_BG}
          borderColor="rgba(139, 92, 246, 0.2)"
          loading={loading}
          delay={240}
        />
        <AnalyticsStat
          icon={Wallet}
          label="Month Expenses"
          value={fmt(stats.monthExpenses || 0)}
          color={DANGER}
          bgColor={DANGER_BG}
          borderColor={DANGER_BORDER}
          loading={loading}
          delay={320}
        />
        <AnalyticsStat
          icon={Activity}
          label="Net Profit (Month)"
          value={fmt(stats.netProfit || 0)}
          trend={stats.netProfit > 0 ? "up" : stats.netProfit < 0 ? "down" : undefined}
          color={stats.netProfit >= 0 ? SUCCESS : DANGER}
          bgColor={stats.netProfit >= 0 ? SUCCESS_BG : DANGER_BG}
          borderColor={stats.netProfit >= 0 ? SUCCESS_BORDER : DANGER_BORDER}
          loading={loading}
          delay={400}
        />
        <AnalyticsStat
          icon={ClipboardList}
          label="Month Purchases"
          value={fmt(stats.monthPurchases || 0)}
          color={CYAN}
          bgColor={CYAN_BG}
          borderColor="rgba(6, 182, 212, 0.2)"
          loading={loading}
          delay={480}
        />
        <AnalyticsStat
          icon={Percent}
          label="Avg Margin"
          value={`${(stats.avgMargin || 0).toFixed(1)}%`}
          color={ACCENT}
          bgColor={ACCENT_BG}
          borderColor={ACCENT_BORDER}
          loading={loading}
          delay={560}
        />
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 2: HIGHLIGHT CARDS (Best Selling, Highest/Lowest Margin)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        <HighlightCard
          icon={Flame}
          label="Best Selling"
          title={data?.bestSelling?.title}
          subtitle={data?.bestSelling ? `${data.bestSelling.quantitySold} sold · ${fmt(data.bestSelling.revenue)}` : "No sales yet"}
          imageUrl={data?.bestSelling?.imageUrl}
          color={ACCENT}
          bgColor={ACCENT_BG}
          loading={loading}
        />
        <HighlightCard
          icon={Award}
          label="Highest Margin"
          title={data?.highestMargin?.title}
          subtitle={data?.highestMargin ? `${data.highestMargin.margin.toFixed(1)}% margin · ${fmt(Number(data.highestMargin.selling_price))}` : "—"}
          imageUrl={data?.highestMargin?.image_url}
          color={SUCCESS}
          bgColor={SUCCESS_BG}
          loading={loading}
        />
        <HighlightCard
          icon={TrendingDown}
          label="Lowest Margin"
          title={data?.lowestMargin?.title}
          subtitle={data?.lowestMargin ? `${data.lowestMargin.margin.toFixed(1)}% margin · ${fmt(Number(data.lowestMargin.selling_price))}` : "—"}
          imageUrl={data?.lowestMargin?.image_url}
          color={DANGER}
          bgColor={DANGER_BG}
          loading={loading}
        />
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 3: DAILY SALES & REVENUE VS PROFIT CHARTS
       * ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {/* Daily Sales Area Chart */}
        <SectionCard title="Daily Sales Trend" subtitle="Revenue over the last 30 days" loading={loading}>
          <div style={{ width: "100%", height: "260px" }}>
            {salesByDay.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim2)" }}>
                <BarChart3 style={{ width: "40px", height: "40px", marginBottom: "8px", color: "var(--text-dim2)" }} />
                <p style={{ fontSize: "13px", fontWeight: 500 }}>No sales data yet</p>
                <p style={{ fontSize: "12px", color: "var(--text-dim2)" }}>Start billing to see your chart</p>
              </div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={salesByDay}>
                  <defs>
                    <linearGradient id="revenueGradAnalytics" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
                      <stop offset="50%" stopColor={ACCENT} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--border)" }} dy={8} />
                  <YAxis stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} dx={-6} />
                  <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ stroke: ACCENT, strokeWidth: 1, strokeDasharray: "4 4" }} />
                  <Area type="monotone" dataKey="revenue" stroke={ACCENT} fill="url(#revenueGradAnalytics)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: ACCENT, stroke: "var(--bg-surface)", strokeWidth: 2 }} name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        {/* Revenue vs Profit Line Chart */}
        <SectionCard title="Revenue vs Profit" subtitle="Comparing revenue and profit trends" loading={loading}>
          <div style={{ width: "100%", height: "260px" }}>
            {salesByDay.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-dim2)" }}>
                <Activity style={{ width: "40px", height: "40px", marginBottom: "8px", color: "var(--text-dim2)" }} />
                <p style={{ fontSize: "13px", fontWeight: 500 }}>No data available</p>
              </div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={salesByDay}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--border)" }} dy={8} />
                  <YAxis stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} dx={-6} />
                  <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ stroke: "var(--text-dim2)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                  <Line type="monotone" dataKey="revenue" stroke={ACCENT} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: ACCENT, stroke: "var(--bg-surface)", strokeWidth: 2 }} name="Revenue" />
                  <Line type="monotone" dataKey="profit" stroke={SUCCESS} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: SUCCESS, stroke: "var(--bg-surface)", strokeWidth: 2 }} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 4: REVENUE BY PRODUCT (Horizontal Bar + Revenue Chart)
       * ═══════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Revenue by Product"
        subtitle="Top products ranked by total revenue"
        loading={loading}
        className=""
      >
        {revenueByProduct.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-dim2)" }}>
            <BarChart3 style={{ width: "40px", height: "40px", margin: "0 auto 8px", color: "var(--text-dim2)" }} />
            <p style={{ fontSize: "13px", fontWeight: 500 }}>No revenue data yet</p>
          </div>
        ) : (
          <div style={{ width: "100%", height: `${Math.max(revenueByProduct.length * 50, 200)}px` }}>
            <ResponsiveContainer>
              <BarChart data={revenueByProduct} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" horizontal={false} />
                <XAxis type="number" stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <YAxis type="category" dataKey="name" stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={false} width={100} />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(249, 115, 22, 0.04)" }} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]} barSize={24}>
                  {revenueByProduct.map((entry, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
                <Bar dataKey="profit" name="Profit" radius={[0, 4, 4, 0]} barSize={16} fill={SUCCESS} opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <div style={{ height: "20px" }} />


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 5: PRODUCT ANALYTICS TABLE (with images)
       * ═══════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Product Performance"
        subtitle={`${productAnalytics.length} products analyzed`}
        loading={loading}
        headerRight={
          <Link
            to="/products"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: ACCENT,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 12px",
              borderRadius: "8px",
              background: ACCENT_SOFT,
              border: `1px solid ${ACCENT_BORDER}`,
            }}
          >
            View All <ArrowRight style={{ width: "12px", height: "12px" }} />
          </Link>
        }
      >
        {productAnalytics.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-dim2)" }}>
            <Package style={{ width: "40px", height: "40px", margin: "0 auto 8px", color: "var(--text-dim2)" }} />
            <p style={{ fontSize: "13px", fontWeight: 500 }}>No sales data yet</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 2fr",
                gap: "12px",
                padding: "10px 16px",
                borderBottom: "2px solid var(--border)",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-dim2)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <div>Product</div>
              <div style={{ textAlign: "center" }}>Sold</div>
              <div style={{ textAlign: "right" }}>Revenue</div>
              <div style={{ textAlign: "center" }}>Margin</div>
              <div>Revenue Bar / Profit</div>
            </div>
            {/* Table Rows */}
            {productAnalytics
              .slice()
              .sort((a, b) => b.revenue - a.revenue)
              .map((product, i) => (
                <ProductAnalyticsRow
                  key={product.productId}
                  product={product}
                  maxRevenue={maxRevenue}
                  currency={currency}
                  index={i}
                />
              ))}
          </>
        )}
      </SectionCard>

      <div style={{ height: "20px" }} />


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 6: EXPENSES + CATEGORIES SIDE BY SIDE
       * ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {/* Expenses by Category */}
        <SectionCard title="Expenses by Category" subtitle="Monthly expense breakdown" loading={loading}>
          {expensesByCategory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim2)" }}>
              <Wallet style={{ width: "36px", height: "36px", margin: "0 auto 8px", color: "var(--text-dim2)" }} />
              <p style={{ fontSize: "13px", fontWeight: 500 }}>No monthly expenses recorded</p>
            </div>
          ) : (
            <div>
              {expensesByCategory.map((e, i) => (
                <ExpenseRow
                  key={e.category}
                  category={e.category}
                  total={e.total}
                  maxTotal={maxExpense}
                  currency={currency}
                  color={CHART_COLORS[i % CHART_COLORS.length]}
                  index={i}
                />
              ))}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 0 0",
                  marginTop: "8px",
                  borderTop: "2px solid var(--border)",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                <span>Total</span>
                <span>{fmt(expensesByCategory.reduce((s, e) => s + e.total, 0))}</span>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Category Breakdown with Pie Chart */}
        <SectionCard title="Product Categories" subtitle="Distribution across categories" loading={loading}>
          {categoryBreakdown.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-dim2)" }}>
              <Layers style={{ width: "36px", height: "36px", margin: "0 auto 8px", color: "var(--text-dim2)" }} />
              <p style={{ fontSize: "13px", fontWeight: 500 }}>No products yet</p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {/* Pie Chart */}
              <div style={{ width: "140px", height: "140px", flexShrink: 0 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div style={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "10px",
                            padding: "8px 14px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                            fontSize: "12px",
                          }}>
                            <div style={{ fontWeight: 600, color: "var(--text)" }}>{payload[0].name}</div>
                            <div style={{ color: "var(--text-dim)" }}>{payload[0].value} products</div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Category List */}
              <div style={{ flex: 1, minWidth: "180px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {categoryBreakdown.map((c, i) => (
                  <CategoryCard
                    key={c.name}
                    name={c.name}
                    count={c.count}
                    total={totalCategoryProducts}
                    percentage={totalCategoryProducts > 0 ? (c.count / totalCategoryProducts) * 100 : 0}
                    color={CHART_COLORS[i % CHART_COLORS.length]}
                    index={i}
                  />
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 7: PRODUCT STOCK INVENTORY (Cards with images + stock bars)
       * ═══════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Inventory Status"
        subtitle={`${products.length} products · ${products.filter((p) => Number(p.stock) < 5).length} low stock`}
        loading={loading || productsQuery.isLoading}
        headerRight={
          <Link
            to="/products"
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: ACCENT,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "6px 12px",
              borderRadius: "8px",
              background: ACCENT_SOFT,
              border: `1px solid ${ACCENT_BORDER}`,
            }}
          >
            Manage <ArrowRight style={{ width: "12px", height: "12px" }} />
          </Link>
        }
      >
        {products.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-dim2)" }}>
            <Box style={{ width: "40px", height: "40px", margin: "0 auto 8px", color: "var(--text-dim2)" }} />
            <p style={{ fontSize: "13px", fontWeight: 500 }}>No products yet</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "10px",
            }}
          >
            {productsByStock.map((product, i) => (
              <ProductStockCard
                key={product.product_id}
                product={product}
                maxStock={maxStock}
                currency={currency}
                index={i}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <div style={{ height: "20px" }} />


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 8: LOW STOCK ALERTS
       * ═══════════════════════════════════════════════════════════════════ */}
      {data?.lowStock?.length > 0 && (
        <SectionCard
          title="⚠️ Low Stock Alerts"
          subtitle={`${data.lowStock.length} products need restocking`}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "10px",
            }}
          >
            {data.lowStock.map((p, i) => (
              <div
                key={p.product_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: Number(p.stock) <= 0 ? DANGER_BG : WARNING_BG,
                  border: `1px solid ${Number(p.stock) <= 0 ? DANGER_BORDER : WARNING_BORDER}`,
                  animation: `fadeInUp 0.4s ease ${i * 60}ms both`,
                }}
              >
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
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <AlertTriangle style={{ width: "18px", height: "18px", color: Number(p.stock) <= 0 ? DANGER : WARNING }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: "11px", color: Number(p.stock) <= 0 ? DANGER : WARNING, fontWeight: 600 }}>
                    {Number(p.stock) <= 0 ? "Out of Stock" : `${p.stock} remaining`}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 800,
                    color: Number(p.stock) <= 0 ? DANGER : WARNING,
                  }}
                >
                  {p.stock}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div style={{ height: "20px" }} />


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 9: BIG STOCK CHART (Products with stock levels - bar chart)
       * This is the large comprehensive chart at the bottom
       * ═══════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Product Stock Overview"
        subtitle="Stock levels across all products — visual inventory overview"
        loading={loading || productsQuery.isLoading}
      >
        {stockChartData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim2)" }}>
            <BarChart3 style={{ width: "48px", height: "48px", margin: "0 auto 12px", color: "var(--text-dim2)" }} />
            <p style={{ fontSize: "14px", fontWeight: 500 }}>Add products to see the stock chart</p>
          </div>
        ) : (
          <div style={{ width: "100%", height: `${Math.max(stockChartData.length * 45, 300)}px` }}>
            <ResponsiveContainer>
              <BarChart data={stockChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" horizontal={false} />
                <XAxis type="number" stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={false} width={120} />
                <Tooltip content={<StockTooltip />} cursor={{ fill: "rgba(249, 115, 22, 0.04)" }} />
                <Bar dataKey="stock" name="Stock" radius={[0, 8, 8, 0]} barSize={22}>
                  {stockChartData.map((entry, i) => {
                    const color =
                      entry.stock <= 0 ? DANGER :
                      entry.stock < 5 ? WARNING :
                      entry.stock < 20 ? ACCENT :
                      SUCCESS;
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <div style={{ height: "20px" }} />


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 10: COMPREHENSIVE PRODUCT ANALYSIS CHART
       * Revenue + Profit + Margin combined bar chart
       * ═══════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Comprehensive Product Analysis"
        subtitle="Revenue, profit, and margin comparison across top products"
        loading={loading}
      >
        {profitMarginChart.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim2)" }}>
            <Target style={{ width: "48px", height: "48px", margin: "0 auto 12px", color: "var(--text-dim2)" }} />
            <p style={{ fontSize: "14px", fontWeight: 500 }}>Sell products to see the analysis</p>
          </div>
        ) : (
          <div style={{ width: "100%", height: "420px" }}>
            <ResponsiveContainer>
              <ComposedChart data={profitMarginChart} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--border)" }} angle={-30} textAnchor="end" height={60} />
                <YAxis yAxisId="left" stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill={ACCENT} radius={[4, 4, 0, 0]} barSize={28} opacity={0.9} />
                <Bar yAxisId="left" dataKey="profit" name="Profit" fill={SUCCESS} radius={[4, 4, 0, 0]} barSize={28} opacity={0.7} />
                <Line yAxisId="right" type="monotone" dataKey="margin" name="Margin %" stroke={PURPLE} strokeWidth={2.5} dot={{ r: 4, fill: PURPLE, stroke: "var(--bg-surface)", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <div style={{ height: "20px" }} />


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 12: MARGIN VS REVENUE SCATTER
       * ═══════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Margin vs Revenue Analysis"
        subtitle="Each dot represents a product — position reveals profitability"
        loading={loading}
      >
        {marginScatter.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim2)" }}>
            <PieChartIcon style={{ width: "48px", height: "48px", margin: "0 auto 12px", color: "var(--text-dim2)" }} />
            <p style={{ fontSize: "14px", fontWeight: 500 }}>Sell products to see scatter analysis</p>
          </div>
        ) : (
          <div style={{ width: "100%", height: "360px" }}>
            <ResponsiveContainer>
              <ComposedChart data={marginScatter} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis dataKey="margin" stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--border)" }} label={{ value: "Margin %", position: "insideBottom", offset: -10, style: { fontSize: "11px", fill: "var(--text-dim2)" } }} />
                <YAxis dataKey="revenue" stroke="var(--text-dim2)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} label={{ value: "Revenue", angle: -90, position: "insideLeft", offset: 0, style: { fontSize: "11px", fill: "var(--text-dim2)" } }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "14px 18px", boxShadow: "0 8px 30px var(--shadow)", maxWidth: "220px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                          {d?.image && <img src={d.image} alt="" style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border)" }} />}
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{d?.name}</div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
                          <span style={{ color: "var(--text-dim)" }}>Margin</span>
                          <span style={{ fontWeight: 600, color: ACCENT }}>{d?.margin?.toFixed(1)}%</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
                          <span style={{ color: "var(--text-dim)" }}>Revenue</span>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>{fmt(d?.revenue || 0)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}>
                          <span style={{ color: "var(--text-dim)" }}>Units</span>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>{d?.sold || 0}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter dataKey="revenue" fill={ACCENT} stroke="var(--bg-surface)" strokeWidth={2} r={8} name="Products" opacity={0.8} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {marginScatter.length > 0 && (
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", marginTop: "16px", padding: "12px 16px", background: "var(--bg-elev)", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-dim)" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: SUCCESS }} />
              <span>High Margin (≥50%)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-dim)" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: ACCENT }} />
              <span>Medium (20-50%)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-dim)" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: DANGER }} />
              <span>Low (&lt;20%)</span>
            </div>
          </div>
        )}
      </SectionCard>

      <div style={{ height: "20px" }} />


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 13: MONTHLY PERFORMANCE SUMMARY
       * ═══════════════════════════════════════════════════════════════════ */}
      <SectionCard title="Monthly Performance Summary" subtitle="Key business metrics for the current month" loading={loading}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
          <div style={{ padding: "20px", borderRadius: "14px", background: `linear-gradient(135deg, ${ACCENT_BG}, var(--bg-surface))`, border: `1px solid ${ACCENT_BORDER}`, transition: "transform 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <IndianRupee style={{ width: "16px", height: "16px", color: ACCENT }} />
              <span style={{ fontSize: "12px", color: "var(--text-dim2)", fontWeight: 500 }}>Month Revenue</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)" }}>{fmt(stats.monthRevenue || 0)}</div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>{stats.monthCount || 0} transactions</div>
          </div>

          <div style={{ padding: "20px", borderRadius: "14px", background: `linear-gradient(135deg, ${SUCCESS_BG}, var(--bg-surface))`, border: `1px solid ${SUCCESS_BORDER}`, transition: "transform 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <TrendingUp style={{ width: "16px", height: "16px", color: SUCCESS }} />
              <span style={{ fontSize: "12px", color: "var(--text-dim2)", fontWeight: 500 }}>Month Profit</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)" }}>{fmt(stats.monthProfit || 0)}</div>
            <div style={{ fontSize: "12px", color: SUCCESS, fontWeight: 600, marginTop: "4px" }}>
              {stats.monthRevenue > 0 ? `${((stats.monthProfit / stats.monthRevenue) * 100).toFixed(1)}% margin` : "\u2014"}
            </div>
          </div>

          <div style={{ padding: "20px", borderRadius: "14px", background: `linear-gradient(135deg, ${DANGER_BG}, var(--bg-surface))`, border: `1px solid ${DANGER_BORDER}`, transition: "transform 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Wallet style={{ width: "16px", height: "16px", color: DANGER }} />
              <span style={{ fontSize: "12px", color: "var(--text-dim2)", fontWeight: 500 }}>Month Expenses</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)" }}>{fmt(stats.monthExpenses || 0)}</div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>Deducted from profit</div>
          </div>

          <div style={{ padding: "20px", borderRadius: "14px", background: `linear-gradient(135deg, ${(stats.netProfit || 0) >= 0 ? SUCCESS_BG : DANGER_BG}, var(--bg-surface))`, border: `1px solid ${(stats.netProfit || 0) >= 0 ? SUCCESS_BORDER : DANGER_BORDER}`, transition: "transform 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Activity style={{ width: "16px", height: "16px", color: (stats.netProfit || 0) >= 0 ? SUCCESS : DANGER }} />
              <span style={{ fontSize: "12px", color: "var(--text-dim2)", fontWeight: 500 }}>Net Profit</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: (stats.netProfit || 0) >= 0 ? SUCCESS : DANGER }}>{fmt(stats.netProfit || 0)}</div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>Revenue - Expenses</div>
          </div>

          <div style={{ padding: "20px", borderRadius: "14px", background: `linear-gradient(135deg, ${INFO_BG}, var(--bg-surface))`, border: "1px solid rgba(37, 99, 235, 0.2)", transition: "transform 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Calendar style={{ width: "16px", height: "16px", color: INFO }} />
              <span style={{ fontSize: "12px", color: "var(--text-dim2)", fontWeight: 500 }}>Today Revenue</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)" }}>{fmt(stats.todayRevenue || 0)}</div>
            <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "4px" }}>{stats.todayCount || 0} sales today</div>
          </div>

          <div style={{ padding: "20px", borderRadius: "14px", background: `linear-gradient(135deg, ${PURPLE_BG}, var(--bg-surface))`, border: "1px solid rgba(139, 92, 246, 0.2)", transition: "transform 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Sparkles style={{ width: "16px", height: "16px", color: PURPLE }} />
              <span style={{ fontSize: "12px", color: "var(--text-dim2)", fontWeight: 500 }}>Today Profit</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)" }}>{fmt(stats.todayProfit || 0)}</div>
            <div style={{ fontSize: "12px", color: PURPLE, fontWeight: 600, marginTop: "4px" }}>
              {stats.todayRevenue > 0 ? `${((stats.todayProfit / stats.todayRevenue) * 100).toFixed(1)}% margin` : "\u2014"}
            </div>
          </div>
        </div>
      </SectionCard>

      <div style={{ height: "20px" }} />


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 14: DETAILED MARGIN TABLE
       * ═══════════════════════════════════════════════════════════════════ */}
      <SectionCard title="Detailed Margin Table" subtitle="Complete product profitability breakdown" loading={loading}>
        {productAnalytics.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-dim2)" }}>
            <FileText style={{ width: "40px", height: "40px", margin: "0 auto 8px", color: "var(--text-dim2)" }} />
            <p style={{ fontSize: "13px", fontWeight: 500 }}>No sales data yet</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", fontSize: "11px", fontWeight: 600, color: "var(--text-dim2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Product</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Cost</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Price</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Profit/unit</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Margin</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Sold</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Revenue</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Total Profit</th>
                </tr>
              </thead>
              <tbody>
                {productAnalytics.map((p) => {
                  const perUnit = Number(p.sellingPrice || 0) - Number(p.costPrice || 0);
                  const mc = (p.margin || 0) >= 50 ? SUCCESS : (p.margin || 0) >= 20 ? ACCENT : DANGER;
                  return (
                    <tr key={p.productId} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elev)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-elev)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {p.imageUrl ? <img src={p.imageUrl} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Package style={{ width: "14px", height: "14px", color: "var(--text-dim2)" }} />}
                          </div>
                          <span style={{ fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px" }}>{p.title}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-dim)" }}>{fmt(p.costPrice)}</td>
                      <td style={{ textAlign: "right", padding: "10px 12px", color: "var(--text)" }}>{fmt(p.sellingPrice)}</td>
                      <td style={{ textAlign: "right", padding: "10px 12px", color: SUCCESS, fontWeight: 600 }}>{fmt(perUnit)}</td>
                      <td style={{ textAlign: "right", padding: "10px 12px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", color: mc, background: mc === SUCCESS ? SUCCESS_BG : mc === ACCENT ? ACCENT_BG : DANGER_BG }}>{(p.margin || 0).toFixed(1)}%</span>
                      </td>
                      <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600, color: "var(--text)" }}>{p.quantitySold}</td>
                      <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: "var(--text)" }}>{fmt(p.revenue)}</td>
                      <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700, color: SUCCESS }}>{fmt(p.profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td style={{ padding: "12px", fontWeight: 700, color: "var(--text)" }}>Total ({productAnalytics.length})</td>
                  <td colSpan={4} />
                  <td style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "var(--text)" }}>{productAnalytics.reduce((s, p) => s + p.quantitySold, 0)}</td>
                  <td style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: "var(--text)" }}>{fmt(productAnalytics.reduce((s, p) => s + p.revenue, 0))}</td>
                  <td style={{ textAlign: "right", padding: "12px", fontWeight: 700, color: SUCCESS }}>{fmt(productAnalytics.reduce((s, p) => s + p.profit, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      <div style={{ height: "20px" }} />


      {/* ═══════════════════════════════════════════════════════════════════
       * SECTION 15: PERFORMANCE METRICS BAR
       * ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
        <MetricBar icon={Hash} label="Total Orders" value={stats.totalSales || 0} color={ACCENT} />
        <MetricBar icon={Percent} label="Avg Margin" value={`${(stats.avgMargin || 0).toFixed(1)}%`} color={SUCCESS} />
        <MetricBar icon={AlertTriangle} label="Low Stock" value={stats.lowStockCount || 0} color={stats.lowStockCount > 0 ? DANGER : SUCCESS} />
        <MetricBar icon={Package} label="Active Products" value={stats.totalProducts || 0} color={INFO} />
      </div>


      {/* ═══════════════════════════════════════════════════════════════════
       * FOOTER
       * ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ textAlign: "center", padding: "20px 0", fontSize: "12px", color: "var(--text-dim2)" }}>
        Powered by <span style={{ color: ACCENT, fontWeight: 600 }}>MDX Billing</span> · Premium Shop Management
      </div>
    </>
  );
}
