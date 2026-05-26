import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Percent,
  Package,
  Award,
  Star,
  TrendingDown,
  AlertTriangle,
  IndianRupee,
  Wallet,
  ClipboardList,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import DashboardShell from "@/components/DashboardShell";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import { formatMoney } from "@/utils/currency";
import { Card, Skeleton } from "@/components/ui";
import { shopHeaders } from "@/utils/shopContext";

const tooltipStyle = {
  background: "var(--bg-surface-strong)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--text)",
};
const axisColor = "var(--text-dim)";

function MiniStat({ icon: Icon, label, value }) {
  return (
    <Card>
      <Icon className="w-5 h-5 mb-2" style={{ color: "var(--accent)" }} />
      <div className="t-dim text-xs">{label}</div>
      <div className="t-text text-xl font-bold">{value}</div>
    </Card>
  );
}

function HighlightCard({ icon: Icon, label, title, sub, tone }) {
  const colors = {
    yellow: "bg-gradient-to-br from-yellow-400 to-orange-500",
    emerald: "bg-gradient-to-br from-emerald-400 to-cyan-500",
    rose: "bg-gradient-to-br from-rose-400 to-pink-500",
  };
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl ${colors[tone]} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="t-dim text-xs">{label}</div>
          <div className="t-text font-semibold truncate">{title || "—"}</div>
          <div className="t-dim text-xs">{sub || "—"}</div>
        </div>
      </div>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });

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

  const data = query.data;
  const stats = data?.stats || {};
  const currency = shop?.currency || "INR";
  const fmt = (n) => formatMoney(n, currency);

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
  const productAnalytics = data?.productAnalytics || [];
  const expensesByCategory = (data?.expensesByCategory || []).map((expense) => ({
    category: expense.category,
    total: Number(expense.total),
  }));

  return (
    <DashboardShell currentPath="/analytics" allowedRoles={["owner", "manager"]}>
      <div className="mb-5">
        <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">
          Analytics
        </h1>
        <p className="t-muted text-sm">Complete business performance</p>
      </div>

      {query.isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <MiniStat
            icon={Package}
            label="Products sold"
            value={stats.totalProductsSold || 0}
          />
          <MiniStat
            icon={IndianRupee}
            label="Total revenue"
            value={fmt(stats.totalRevenue)}
          />
          <MiniStat
            icon={TrendingUp}
            label="Total profit"
            value={fmt(stats.totalProfit)}
          />
          <MiniStat
            icon={Percent}
            label="Avg margin"
            value={`${(stats.avgMargin || 0).toFixed(1)}%`}
          />
          <MiniStat
            icon={Wallet}
            label="Month expenses"
            value={fmt(stats.monthExpenses)}
          />
          <MiniStat
            icon={TrendingUp}
            label="Month net profit"
            value={fmt(stats.netProfit)}
          />
          <MiniStat
            icon={ClipboardList}
            label="Month purchases"
            value={fmt(stats.monthPurchases)}
          />
          <MiniStat
            icon={Package}
            label="Purchase entries"
            value={stats.monthPurchaseCount || 0}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <HighlightCard
          icon={Star}
          label="Best Selling"
          title={data?.bestSelling?.title}
          sub={
            data?.bestSelling
              ? `${data.bestSelling.quantitySold} sold`
              : "No sales yet"
          }
          tone="yellow"
        />
        <HighlightCard
          icon={Award}
          label="Highest Margin"
          title={data?.highestMargin?.title}
          sub={
            data?.highestMargin
              ? `${data.highestMargin.margin.toFixed(1)}% margin`
              : "—"
          }
          tone="emerald"
        />
        <HighlightCard
          icon={TrendingDown}
          label="Lowest Margin"
          title={data?.lowestMargin?.title}
          sub={
            data?.lowestMargin
              ? `${data.lowestMargin.margin.toFixed(1)}% margin`
              : "—"
          }
          tone="rose"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <Card>
          <h3 className="t-text font-semibold mb-3 text-sm">Daily sales</h3>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={salesByDay}>
                <defs>
                  <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#rev2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="t-text font-semibold mb-3 text-sm">
            Revenue vs Profit
          </h3>
          <div style={{ width: "100%", height: 220 }}>
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
        </Card>
      </div>

      <Card className="mb-4">
        <h3 className="t-text font-semibold mb-3 text-sm">Expenses by category this month</h3>
        {expensesByCategory.length === 0 ? (
          <div className="t-dim text-sm text-center py-8">No monthly expenses recorded</div>
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={expensesByCategory}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="category" stroke={axisColor} fontSize={10} />
                <YAxis stroke={axisColor} fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="total" fill="var(--accent)" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <h3 className="t-text font-semibold mb-3 text-sm">
          Product margin table
        </h3>
        {productAnalytics.length === 0 ? (
          <div className="t-dim text-sm text-center py-8">
            No sales data yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="t-dim text-[10px] uppercase tracking-wide">
                  <th className="text-left py-2 px-2">Product</th>
                  <th className="text-right py-2 px-2">Cost</th>
                  <th className="text-right py-2 px-2">Price</th>
                  <th className="text-right py-2 px-2">Profit/unit</th>
                  <th className="text-right py-2 px-2">Margin</th>
                  <th className="text-right py-2 px-2">Sold</th>
                  <th className="text-right py-2 px-2">Revenue</th>
                  <th className="text-right py-2 px-2">Total profit</th>
                </tr>
              </thead>
              <tbody>
                {productAnalytics.map((p) => {
                  const perUnit =
                    Number(p.sellingPrice || 0) - Number(p.costPrice || 0);
                  return (
                    <tr
                      key={p.productId}
                      className="t-muted"
                      style={{
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg t-elev overflow-hidden flex items-center justify-center flex-shrink-0">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-3 h-3 t-dim2" />
                            )}
                          </div>
                          <span className="truncate max-w-[150px] t-text">
                            {p.title}
                          </span>
                        </div>
                      </td>
                      <td className="text-right py-2 px-2">
                        {fmt(p.costPrice)}
                      </td>
                      <td className="text-right py-2 px-2">
                        {fmt(p.sellingPrice)}
                      </td>
                      <td
                        className="text-right py-2 px-2"
                        style={{ color: "var(--success)" }}
                      >
                        {fmt(perUnit)}
                      </td>
                      <td className="text-right py-2 px-2">
                        {(p.margin || 0).toFixed(1)}%
                      </td>
                      <td className="text-right py-2 px-2">{p.quantitySold}</td>
                      <td className="text-right py-2 px-2 t-text font-semibold">
                        {fmt(p.revenue)}
                      </td>
                      <td
                        className="text-right py-2 px-2 font-semibold"
                        style={{ color: "var(--success)" }}
                      >
                        {fmt(p.profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data?.lowStock?.length > 0 ? (
        <div className="t-card p-4 t-danger-bg">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="font-semibold text-sm">Low stock alert</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {data.lowStock.map((p) => (
              <div
                key={p.product_id}
                className="rounded-xl p-2 flex items-center gap-2"
                style={{ background: "rgba(0,0,0,0.15)" }}
              >
                <div className="w-9 h-9 rounded-lg t-elev overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-4 h-4 t-dim2" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{p.title}</div>
                  <div className="text-[10px]">{p.stock} left</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
