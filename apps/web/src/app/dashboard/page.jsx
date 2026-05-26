import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Percent,
  Calendar,
  CalendarDays,
  AlertTriangle,
  Star,
  Award,
  IndianRupee,
  ArrowRight,
  Receipt as ReceiptIcon,
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
} from "recharts";
import DashboardShell from "@/components/DashboardShell";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import useProfile from "@/utils/useProfile";
import { formatMoney } from "@/utils/currency";
import { Card, Skeleton, Button } from "@/components/ui";

const COLORS = [
  "var(--accent)",
  "#f0abfc",
  "#60a5fa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
];

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="t-card p-4 md:p-5 transition">
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, var(--accent), var(--accent-dark))",
            color: "white",
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        {sub ? (
          <span className="t-dim2 text-[10px] font-medium uppercase">
            {sub}
          </span>
        ) : null}
      </div>
      <div className="t-muted text-xs mb-1">{label}</div>
      <div className="t-text text-xl md:text-2xl font-bold font-poppins">
        {value}
      </div>
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`t-card p-4 md:p-5 ${className}`}>
      {title ? (
        <h3 className="t-text font-semibold mb-4 text-sm md:text-base">
          {title}
        </h3>
      ) : null}
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: "var(--bg-surface-strong)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--text)",
};
const axisColor = "var(--text-dim)";

export default function DashboardPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const { profile } = useProfile({ enabled: !!user });

  const analyticsQuery = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const recentSalesQuery = useQuery({
    queryKey: ["sales", { recent: true }],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const analytics = analyticsQuery.data;
  const currency = shop?.currency || "INR";
  const fmt = (n) => formatMoney(n, currency);

  const salesByDay = useMemo(
    () =>
      (analytics?.salesByDay || []).map((s) => ({
        day: new Date(s.day).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        }),
        revenue: Number(s.revenue),
        profit: Number(s.profit),
      })),
    [analytics],
  );
  const topProducts = useMemo(
    () =>
      (analytics?.productAnalytics || [])
        .slice()
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 5)
        .map((p) => ({
          name: (p.title || "").slice(0, 12),
          sold: p.quantitySold,
        })),
    [analytics],
  );
  const categoryData = useMemo(
    () =>
      (analytics?.categoryBreakdown || []).map((c) => ({
        name: c.name,
        value: c.count,
      })),
    [analytics],
  );
  const marginData = useMemo(
    () =>
      (analytics?.productAnalytics || []).slice(0, 6).map((p) => ({
        name: (p.title || "").slice(0, 10),
        margin: Number((p.margin || 0).toFixed(1)),
      })),
    [analytics],
  );

  const stats = analytics?.stats || {};
  const loading = analyticsQuery.isLoading;
  const firstName = (profile?.displayName || user?.name || "").split(" ")[0];

  const recentSales = (recentSalesQuery.data?.sales || []).slice(0, 5);

  return (
    <DashboardShell currentPath="/dashboard">
      <div className="mb-6">
        <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">
          Hello{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="t-muted text-sm mt-1">
          Here&apos;s how your shop is doing today.
        </p>
      </div>

      {/* Stat grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <StatCard
            icon={Package}
            label="Total Products"
            value={stats.totalProducts || 0}
          />
          <StatCard
            icon={ShoppingCart}
            label="Total Sales"
            value={stats.totalSales || 0}
          />
          <StatCard
            icon={IndianRupee}
            label="Total Revenue"
            value={fmt(stats.totalRevenue)}
          />
          <StatCard
            icon={TrendingUp}
            label="Total Profit"
            value={fmt(stats.totalProfit)}
          />
          <StatCard
            icon={Percent}
            label="Avg Margin"
            value={`${(stats.avgMargin || 0).toFixed(1)}%`}
          />
          <StatCard
            icon={Calendar}
            label="Today's Sales"
            value={fmt(stats.todayRevenue)}
            sub={`${stats.todayCount || 0} orders`}
          />
          <StatCard
            icon={CalendarDays}
            label="Monthly Sales"
            value={fmt(stats.monthRevenue)}
            sub={`${stats.monthCount || 0} orders`}
          />
          <StatCard
            icon={AlertTriangle}
            label="Low Stock"
            value={stats.lowStockCount || 0}
            sub="< 5 units"
          />
        </div>
      )}

      {/* Best products row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Star className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="t-dim text-xs">Best Selling</div>
              <div className="t-text font-semibold truncate">
                {analytics?.bestSelling?.title || "—"}
              </div>
              <div className="t-dim text-xs">
                {analytics?.bestSelling
                  ? `${analytics.bestSelling.quantitySold} units sold`
                  : "No sales yet"}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="t-dim text-xs">Highest Margin</div>
              <div className="t-text font-semibold truncate">
                {analytics?.highestMargin?.title || "—"}
              </div>
              <div className="t-dim text-xs">
                {analytics?.highestMargin
                  ? `${(analytics.highestMargin.margin).toFixed(1)}% margin`
                  : "—"}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-6">
        <ChartCard title="Revenue (last 30 days)">
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={salesByDay}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--accent)"
                      stopOpacity={0.7}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--accent)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="day" stroke={axisColor} fontSize={10} />
                <YAxis stroke={axisColor} fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--accent)"
                  fill="url(#rev)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Revenue vs Profit">
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={salesByDay}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="day" stroke={axisColor} fontSize={10} />
                <YAxis stroke={axisColor} fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ color: "var(--text)", fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Top Products">
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={topProducts}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="name" stroke={axisColor} fontSize={10} />
                <YAxis stroke={axisColor} fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar
                  dataKey="sold"
                  fill="var(--accent)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Categories">
          <div style={{ width: "100%", height: 240 }}>
            {categoryData.length === 0 ? (
              <div className="flex items-center justify-center h-full t-dim2 text-sm">
                No categories yet
              </div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={4}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    wrapperStyle={{ color: "var(--text)", fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Recent sales */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="t-text font-semibold text-sm md:text-base">
            Recent Sales
          </h3>
          <Link to="/sales">
            <Button variant="secondary" size="sm">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
        {recentSales.length === 0 ? (
          <div className="text-center py-8">
            <ReceiptIcon className="w-10 h-10 t-dim2 mx-auto mb-2" />
            <p className="t-muted text-sm">No sales yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentSales.map((s) => (
              <Link
                key={s.sale_id}
                to={`/sales/${s.sale_id}`}
                className="flex items-center gap-3 rounded-xl t-elev p-3 hover:bg-[var(--bg-input-focus)] transition"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent), var(--accent-dark))",
                  }}
                >
                  <ReceiptIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="t-text font-medium text-sm truncate">
                    {s.buyer_name || "Walk-in customer"}
                  </div>
                  <div className="t-dim text-xs">
                    {s.receipt_number} ·{" "}
                    {new Date(s.created_at).toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="t-text font-bold text-sm">
                    {fmt(s.total_amount)}
                  </div>
                  <div className="t-dim text-[10px]">
                    {s.total_quantity} units
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}
