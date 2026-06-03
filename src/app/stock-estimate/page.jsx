import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Package, Printer } from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import { Button, Card, Skeleton } from "@/components/ui";
import { formatMoney } from "@/utils/currency";
import {
  formatStockQuantity,
  fromBaseQuantity,
  getStockBaseQuantity,
  getUnitModel,
} from "@/utils/productUnits";
import { shopHeaders } from "@/utils/shopContext";

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function StockEstimatePage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const query = useQuery({
    queryKey: ["products", "stock-estimate", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/products", { headers: shopHeaders() });
      if (!response.ok) throw new Error("Could not load stock valuation");
      return response.json();
    },
    enabled: !!user && !!shop?.shop_id,
  });
  const currency = shop?.currency || "INR";
  const rows = useMemo(
    () =>
      (query.data?.products || []).map((product) => {
        const model = getUnitModel(product);
        const baseQuantity = getStockBaseQuantity(product);
        const quantityForPrice = fromBaseQuantity(baseQuantity, model.primaryUnit, product);
        const costValue = quantityForPrice * Number(product.cost_price || 0);
        const salesValue = quantityForPrice * Number(product.selling_price || 0);
        return {
          product,
          category: product.category || "Uncategorized",
          quantityForPrice,
          costValue,
          salesValue,
          expectedProfit: salesValue - costValue,
        };
      }),
    [query.data?.products],
  );
  const totals = useMemo(
    () =>
      rows.reduce(
        (total, row) => ({
          cost: total.cost + row.costValue,
          sales: total.sales + row.salesValue,
          profit: total.profit + row.expectedProfit,
        }),
        { cost: 0, sales: 0, profit: 0 },
      ),
    [rows],
  );
  const categories = useMemo(() => {
    const values = new Map();
    rows.forEach((row) => {
      const existing = values.get(row.category) || { name: row.category, products: 0, cost: 0, sales: 0, profit: 0 };
      existing.products += 1;
      existing.cost += row.costValue;
      existing.sales += row.salesValue;
      existing.profit += row.expectedProfit;
      values.set(row.category, existing);
    });
    return [...values.values()].sort((a, b) => b.sales - a.sales);
  }, [rows]);

  const downloadCsv = () => {
    const heading = ["Product", "Category", "Current Stock", "Unit", "Cost Price", "Selling Price", "Stock Cost Value", "Stock Selling Value", "Expected Profit"];
    const data = rows.map(({ product, category, costValue, salesValue, expectedProfit }) => [
      product.title,
      category,
      formatStockQuantity(getStockBaseQuantity(product), product),
      getUnitModel(product).primaryUnit,
      Number(product.cost_price || 0),
      Number(product.selling_price || 0),
      costValue.toFixed(2),
      salesValue.toFixed(2),
      expectedProfit.toFixed(2),
    ]);
    const csv = [heading, ...data].map((line) => line.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-estimate-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5 no-print">
        <div>
          <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Shop Stock Estimate</h1>
          <p className="t-muted text-sm">Current inventory value at cost and selling price. This report does not change stock.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button onClick={downloadCsv} disabled={!rows.length}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>
      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-72" />
        </div>
      ) : query.isError ? (
        <Card className="py-12 text-center">
          <FileSpreadsheet className="w-11 h-11 mx-auto mb-3 t-dim2" />
          <div className="t-text font-semibold">Could not load stock estimate</div>
          <Button variant="secondary" className="mt-4" onClick={() => query.refetch()}>Retry</Button>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="py-12 text-center">
          <Package className="w-11 h-11 mx-auto mb-3 t-dim2" />
          <div className="t-text font-semibold">No products to value</div>
          <p className="t-muted text-sm mt-1">Add products and stock to generate the estimate.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Metric label="Stock cost value" value={formatMoney(totals.cost, currency)} />
            <Metric label="Stock selling value" value={formatMoney(totals.sales, currency)} />
            <Metric label="Expected profit" value={formatMoney(totals.profit, currency)} accent />
          </div>
          <Card className="mb-4">
            <h2 className="t-text font-semibold mb-3">Category Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {categories.map((category) => (
                <div key={category.name} className="rounded-2xl t-elev border t-border px-3 py-3 min-w-0">
                  <div className="t-text font-semibold truncate">{category.name}</div>
                  <div className="t-muted text-xs mt-1">{category.products} products</div>
                  <div className="t-text text-sm font-bold mt-2">{formatMoney(category.sales, currency)}</div>
                  <div className="t-muted text-xs">Cost {formatMoney(category.cost, currency)} | Profit {formatMoney(category.profit, currency)}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="overflow-x-auto max-w-full">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="t-elev t-muted text-xs">
                  <tr>
                    <th className="text-left px-3 py-2">Product</th>
                    <th className="text-left px-3 py-2">Category</th>
                    <th className="text-left px-3 py-2">Current stock</th>
                    <th className="text-right px-3 py-2">Cost price</th>
                    <th className="text-right px-3 py-2">Selling price</th>
                    <th className="text-right px-3 py-2">Cost value</th>
                    <th className="text-right px-3 py-2">Selling value</th>
                    <th className="text-right px-3 py-2">Expected profit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ product, category, costValue, salesValue, expectedProfit }) => (
                    <tr key={product.product_id} className="t-divider">
                      <td className="t-text font-medium px-3 py-2">{product.title}</td>
                      <td className="t-muted px-3 py-2">{category}</td>
                      <td className="t-text px-3 py-2">{formatStockQuantity(getStockBaseQuantity(product), product)}</td>
                      <td className="t-text text-right px-3 py-2">{formatMoney(product.cost_price, currency)}</td>
                      <td className="t-text text-right px-3 py-2">{formatMoney(product.selling_price, currency)}</td>
                      <td className="t-text text-right px-3 py-2">{formatMoney(costValue, currency)}</td>
                      <td className="t-text text-right px-3 py-2">{formatMoney(salesValue, currency)}</td>
                      <td className="t-text font-semibold text-right px-3 py-2">{formatMoney(expectedProfit, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function Metric({ label, value, accent = false }) {
  return (
    <Card>
      <div className="t-muted text-xs">{label}</div>
      <div className={`text-xl font-bold mt-2 ${accent ? "t-accent-text" : "t-text"}`}>{value}</div>
    </Card>
  );
}
