const ROLE_PERMISSIONS = Object.freeze({
  owner: Object.freeze(["*"]),
  manager: Object.freeze([
    "shop.read",
    "product.read",
    "product.write",
    "sale.read",
    "sale.write",
    "sale.delete",
    "customer.read",
    "customer.write",
    "supplier.read",
    "supplier.write",
    "purchase.read",
    "purchase.write",
    "expense.read",
    "expense.write",
    "analytics.read",
    "analytics.profit",
  ]),
  cashier: Object.freeze([
    "shop.read",
    "product.read",
    "sale.read",
    "sale.write",
    "customer.read",
    "customer.write",
  ]),
});

const ANALYTICS_METRICS = Object.freeze([
  "revenue",
  "cost",
  "grossProfit",
  "netProfit",
  "expenses",
  "stockValue",
]);

export function canAccess(role, permission) {
  const permissions = ROLE_PERMISSIONS[role];

  if (!permissions || !permission) {
    return false;
  }

  return permissions.includes("*") || permissions.includes(permission);
}

export function visibleAnalyticsMetrics(role) {
  if (!canAccess(role, "analytics.read")) {
    return [];
  }

  return canAccess(role, "analytics.profit")
    ? [...ANALYTICS_METRICS]
    : ["revenue"];
}

export { ROLE_PERMISSIONS };
