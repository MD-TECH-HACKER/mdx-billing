import { describe, expect, test } from "vitest";
import {
  createEmptyTrendData,
  formatTrendLabel,
  normalizeChartPeriod,
} from "./dashboardPeriods";

describe("dashboard chart periods", () => {
  test("only permits supported dashboard periods", () => {
    expect(normalizeChartPeriod("year")).toBe("year");
    expect(normalizeChartPeriod("invalid")).toBe("week");
    expect(normalizeChartPeriod(null)).toBe("week");
  });

  test("year trend uses month labels instead of weekday labels", () => {
    expect(formatTrendLabel("2026-05-01T00:00:00.000Z", "year")).toBe("May");
    expect(formatTrendLabel("2026-05-27T00:00:00.000Z", "week")).toBe("Wed");
  });

  test("empty series displays labels that match the selected period", () => {
    expect(createEmptyTrendData("year").map((entry) => entry.day)).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
  });
});
