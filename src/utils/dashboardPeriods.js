const SUPPORTED_PERIODS = new Set(["week", "month", "quarter", "year"]);

export function normalizeChartPeriod(value) {
  return SUPPORTED_PERIODS.has(value) ? value : "week";
}

export function formatTrendLabel(value, period) {
  const date = new Date(value);
  const normalizedPeriod = normalizeChartPeriod(period);

  if (normalizedPeriod === "year") {
    return date.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
  }
  if (normalizedPeriod === "week") {
    return date.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
  }
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function createEmptyTrendData(period) {
  const normalizedPeriod = normalizeChartPeriod(period);
  const labels = normalizedPeriod === "year"
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    : normalizedPeriod === "quarter"
      ? ["Month 1", "Month 2", "Month 3"]
      : normalizedPeriod === "month"
        ? ["Week 1", "Week 2", "Week 3", "Week 4"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return labels.map((day) => ({ day, revenue: 0, profit: 0 }));
}
