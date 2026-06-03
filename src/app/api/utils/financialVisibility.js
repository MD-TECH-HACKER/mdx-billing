import { canAccess } from "./permissions";

export function sanitizeSaleForRole(sale, role) {
  if (canAccess(role, "analytics.profit")) {
    return sale;
  }

  const { total_cost: _totalCost, total_profit: _totalProfit, ...visibleSale } = sale;
  return {
    ...visibleSale,
    items: Array.isArray(visibleSale.items)
      ? visibleSale.items.map((item) => {
          const { costPrice: _costPrice, ...visibleItem } = item;
          return visibleItem;
        })
      : visibleSale.items,
  };
}
