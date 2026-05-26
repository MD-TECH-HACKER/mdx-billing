# MDX Billing Business Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved secure billing-suite core: authentication repair, tenant-safe multi-shop and staff permissions, customers/suppliers/purchases/expenses workflows, stronger analytics/settings, and a verified security baseline.

**Architecture:** Build one authoritative server-side shop-access boundary and route all financial APIs through it; client-selected shop IDs remain UI preferences, not authorization. Extend the existing React Router/TanStack Query UI in the established dashboard style with focused pages and shared request/query behavior, preserving the already in-progress product-unit and multi-shop changes.

**Tech Stack:** React Router 7, React 18, TanStack Query, Hono API routes, Auth.js/CreateAuth, Neon Postgres, Vitest, Recharts, Tailwind-style global CSS.

---

## File Structure

- Create `apps/web/src/app/api/utils/permissions.js`: fixed role permission map and pure `canAccess` helper.
- Create `apps/web/src/app/api/utils/permissions.test.js`: authorization contract tests.
- Create `apps/web/src/app/api/utils/businessSchema.js`: idempotent migrations for memberships, parties, purchases, expenses, inventory movements and sales/product fields.
- Create `apps/web/src/app/api/utils/shopAccess.js`: authenticated shop resolution and permission enforcement.
- Create `apps/web/src/utils/shopRequest.js`: active-shop-aware browser fetch and query-key helpers.
- Modify existing `apps/web/src/app/api/{shop,shop/active,products,products/[id],sales,sales/[id],analytics}/route.js`: enforce shared access context and shop filters.
- Modify `apps/web/src/{components/DashboardShell.jsx,app/{products,billing,sales,analytics,dashboard,settings}/page.jsx}`: use shop-aware requests and role-aware navigation.
- Modify `apps/web/__create/index.ts` and `apps/web/src/utils/useAuth.js`: secure real Google login behavior and remove insecure shortcuts.
- Modify `apps/web/src/global.d.ts`: permit JSX route page imports in generated route types.
- Create `apps/web/src/app/api/team/route.js` and `apps/web/src/app/team/page.jsx`: fixed-role team management.
- Create `apps/web/src/app/api/{customers,suppliers,expenses,purchases}/route.js` plus `[id]` routes where edit/delete/detail is needed.
- Create `apps/web/src/app/{customers,suppliers,expenses,purchases}/page.jsx`: operational pages in the existing UI system.
- Modify `apps/web/src/app/api/analytics/route.js` and `apps/web/src/app/analytics/page.jsx`: net results, purchases, expenses, collections and inventory alerts.
- Modify `apps/web/src/app/settings/page.jsx`: security/team/tax/invoice/backup grouping and owner-only state.
- Modify `apps/web/db/init-db.js`: persistent base schema equivalent to lazy migrations.

## Task 1: Security Scan Baseline And Authorization Contract

**Files:**
- Create outside repository: `/tmp/codex-security-scans/MDX BILLING APP/<scan-id>/artifacts/*.md`
- Create: `apps/web/src/app/api/utils/permissions.test.js`
- Create: `apps/web/src/app/api/utils/permissions.js`

- [ ] **Step 1: Run repository security threat-model and frontier scan**

Create the Codex Security artifacts required for a repository-wide review, covering web API routes, auth configuration, database boundaries, mobile auth handoff and in-progress multi-shop changes. Promote observed issues for validation: unsafe tenant fallback/filtering, automatic OAuth email linking, global CSRF bypass, dev-provider selection, and cross-shop mutation paths.

- [ ] **Step 2: Write the failing permission tests**

```js
import { describe, expect, test } from "vitest";
import { canAccess } from "./permissions";

describe("shop roles", () => {
  test("owner can manage security and team", () => {
    expect(canAccess("owner", "team.manage")).toBe(true);
    expect(canAccess("owner", "settings.security")).toBe(true);
  });

  test("manager can operate inventory but cannot manage owners", () => {
    expect(canAccess("manager", "purchase.write")).toBe(true);
    expect(canAccess("manager", "team.manage")).toBe(false);
  });

  test("cashier cannot see costs, expenses, or reports", () => {
    expect(canAccess("cashier", "sale.write")).toBe(true);
    expect(canAccess("cashier", "expense.read")).toBe(false);
    expect(canAccess("cashier", "analytics.profit")).toBe(false);
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `npx vitest run src/app/api/utils/permissions.test.js`

Expected: FAIL because `./permissions` does not exist.

- [ ] **Step 4: Implement fixed role permissions**

```js
export const ROLE_PERMISSIONS = {
  owner: ["*"],
  manager: [
    "shop.read", "product.read", "product.write", "sale.read", "sale.write",
    "customer.read", "customer.write", "supplier.read", "supplier.write",
    "purchase.read", "purchase.write", "expense.read", "expense.write",
    "analytics.read", "analytics.profit",
  ],
  cashier: ["shop.read", "product.read", "sale.read", "sale.write", "customer.read"],
};

export function canAccess(role, permission) {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes("*") || allowed.includes(permission);
}
```

- [ ] **Step 5: Verify GREEN**

Run: `npx vitest run src/app/api/utils/permissions.test.js`

Expected: PASS.

## Task 2: Shop-Access Boundary And Existing Route Isolation

**Files:**
- Create: `apps/web/src/app/api/utils/businessSchema.js`
- Create: `apps/web/src/app/api/utils/shopAccess.js`
- Modify: `apps/web/db/init-db.js`
- Modify: `apps/web/src/app/api/shop/route.js`
- Modify: `apps/web/src/app/api/shop/active/route.js`
- Modify: `apps/web/src/app/api/products/route.js`
- Modify: `apps/web/src/app/api/products/[id]/route.js`
- Modify: `apps/web/src/app/api/sales/route.js`
- Modify: `apps/web/src/app/api/sales/[id]/route.js`
- Modify: `apps/web/src/app/api/analytics/route.js`
- Test: `apps/web/src/app/api/utils/permissions.test.js`

- [ ] **Step 1: Add failing tenant-policy tests**

Extend `permissions.test.js` to require the action map used by routes:

```js
test("manager cannot alter shop security settings", () => {
  expect(canAccess("manager", "shop.update")).toBe(false);
  expect(canAccess("manager", "settings.security")).toBe(false);
});
test("cashier cannot void sales", () => {
  expect(canAccess("cashier", "sale.delete")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npx vitest run src/app/api/utils/permissions.test.js`

Expected: FAIL until permissions are expanded with explicit update/delete policy.

- [ ] **Step 3: Implement schema and access helpers**

`businessSchema.js` creates `shop_memberships`, `shop_invites`,
`audit_events`, `customers`, `suppliers`, `purchases`, `purchase_items`,
`expenses`, and `stock_movements` using `CREATE TABLE IF NOT EXISTS`, plus
idempotent extension columns on `products` and `sales`.

`shopAccess.js` exports:

```js
export async function requireShopAccess(request, permission) {
  // authenticate, run ensureBusinessSchema(), validate X-Shop-Id against
  // owned shop or active membership, deny invalid supplied IDs, check role,
  // and return { userId, shopId, shopOwnerId, shop, role }.
}
export function accessError(error) {
  return Response.json({ error: error.message }, { status: error.status });
}
export async function writeAuditEvent(context, action, entityType, entityId, metadata = {}) {}
```

- [ ] **Step 4: Replace owner-only/fallback data access**

All resource routes call `requireShopAccess` with a specific permission and
filter reads and writes by `shop_id = context.shopId`. When a manager creates a
row, legacy `owner_id` fields store `context.shopOwnerId`; they no longer store
the staff member as the owner. Sale creation/deletion and stock restoration
update only products in the same authorized shop.

- [ ] **Step 5: Verify unit tests and route build**

Run:

```powershell
npx vitest run src/app/api/utils/permissions.test.js src/utils/productUnits.test.js src/utils/cartStore.test.js
npm run build
```

Expected: tests pass and route modules compile.

## Task 3: Client Shop Context And Index/Auth Repairs

**Files:**
- Create: `apps/web/src/utils/shopRequest.js`
- Modify: `apps/web/src/utils/shopContext.js`
- Modify: `apps/web/src/utils/useShop.js`
- Modify: `apps/web/src/components/DashboardShell.jsx`
- Modify: `apps/web/src/app/page.jsx`
- Modify: `apps/web/src/app/products/page.jsx`
- Modify: `apps/web/src/app/billing/page.jsx`
- Modify: `apps/web/src/app/sales/page.jsx`
- Modify: `apps/web/src/app/sales/[id]/page.jsx`
- Modify: `apps/web/src/app/analytics/page.jsx`
- Modify: `apps/web/src/app/dashboard/page.jsx`
- Modify: `apps/web/src/global.d.ts`
- Modify: `apps/web/__create/index.ts`
- Modify: `apps/web/src/utils/useAuth.js`
- Test: `apps/web/src/utils/shopRequest.test.js`

- [ ] **Step 1: Write failing shop request tests**

```js
import { beforeEach, expect, test } from "vitest";
import { scopedQueryKey, withShopHeaders } from "./shopRequest";

beforeEach(() => localStorage.clear());
test("includes selected shop in requests and cache keys", () => {
  localStorage.setItem("mdx_active_shop_id", "shop-a");
  expect(withShopHeaders().get("X-Shop-Id")).toBe("shop-a");
  expect(scopedQueryKey("products", "search")).toEqual(["products", "shop-a", "search"]);
});
```

- [ ] **Step 2: Verify RED and implement helper**

Run: `npx vitest run src/utils/shopRequest.test.js`

Expected: FAIL because helper does not exist.

Implement `withShopHeaders(extra)` as a `Headers` builder and
`scopedQueryKey(...parts)` as `[..., activeShopId || "default", ...]`.

- [ ] **Step 3: Use scoped requests throughout existing pages**

Products, billing checkout, sales, receipt detail, analytics and dashboard
queries/mutations use shop headers and include the selected shop in query keys.
When the active shop changes, invalidated cached records cannot render from the
previous shop.

- [ ] **Step 4: Repair login selection and auth server defaults**

Real `signIn("google")` is the default whenever Google credentials are present;
the simulated development provider is only selected through explicit
`?simulateAuth=google`. In `apps/web/__create/index.ts`, remove global
`skipCSRFCheck`, remove `allowDangerousEmailAccountLinking`, and set cookie
`secure` according to `AUTH_URL` using HTTPS rather than unconditionally true.

- [ ] **Step 5: Repair typecheck declaration gap**

Add a JSX module declaration to `src/global.d.ts`:

```ts
declare module '*.jsx' {
  const Component: React.ComponentType<any>;
  export default Component;
}
```

- [ ] **Step 6: Verify tests, typecheck and local auth entry**

Run:

```powershell
npx vitest run src/utils/shopRequest.test.js src/app/api/utils/permissions.test.js
npm run typecheck
npm run build
```

Expected: PASS. Browser verification checks the landing page and that Google
button initiates real `/api/auth/signin/google` behavior when configured.

## Task 4: Staff Management

**Files:**
- Create: `apps/web/src/app/api/team/route.js`
- Create: `apps/web/src/app/team/page.jsx`
- Modify: `apps/web/src/components/DashboardShell.jsx`
- Test: `apps/web/src/app/api/utils/permissions.test.js`

- [ ] **Step 1: Add fixed-role access tests**

```js
test("only owner may manage team membership", () => {
  expect(canAccess("owner", "team.manage")).toBe(true);
  expect(canAccess("manager", "team.manage")).toBe(false);
  expect(canAccess("cashier", "team.manage")).toBe(false);
});
```

- [ ] **Step 2: Implement owner-only team API**

`GET /api/team` returns members for the active shop with no token material.
`POST /api/team` accepts `{ email, role }`, limiting `role` to `manager` or
`cashier`, and inserts an invitation/member record scoped to the shop.
`PUT /api/team` changes non-owner roles/status. All mutations call
`writeAuditEvent`.

- [ ] **Step 3: Implement Team page and role-aware navigation**

Add a Team navigation entry visible to owners only, with member table, invite
form, fixed-role explanation and suspend/change actions.

- [ ] **Step 4: Verify**

Run unit/build tests and browser-check owner visibility plus the forbidden
manager/cashier API state.

## Task 5: Customers And Suppliers

**Files:**
- Create: `apps/web/src/app/api/customers/route.js`
- Create: `apps/web/src/app/api/customers/[id]/route.js`
- Create: `apps/web/src/app/api/suppliers/route.js`
- Create: `apps/web/src/app/api/suppliers/[id]/route.js`
- Create: `apps/web/src/app/customers/page.jsx`
- Create: `apps/web/src/app/suppliers/page.jsx`
- Modify: `apps/web/src/components/DashboardShell.jsx`

- [ ] **Step 1: Implement permission- and shop-scoped APIs**

CRUD payload fields are sanitized as:

```js
{
  name: requiredString(120),
  phone: optionalString(40),
  email: optionalString(160),
  address: optionalString(400),
  gstin: optionalString(15).toUpperCase(),
  state: optionalString(80),
  notes: optionalString(500)
}
```

Every lookup and mutation includes authorized `shop_id`; writes record audit
events.

- [ ] **Step 2: Implement operational pages**

Each page uses the existing cards/buttons/input primitives with search, create
and edit forms and data tables. Customer rows show invoice/balance readiness;
supplier rows show purchase readiness.

- [ ] **Step 3: Verify**

Run build and perform browser interactions creating one customer and supplier
under a chosen shop; switching shops must not display those records.

## Task 6: Purchases, Expenses And Inventory Movements

**Files:**
- Create: `apps/web/src/app/api/purchases/route.js`
- Create: `apps/web/src/app/api/purchases/[id]/route.js`
- Create: `apps/web/src/app/api/expenses/route.js`
- Create: `apps/web/src/app/api/expenses/[id]/route.js`
- Create: `apps/web/src/app/purchases/page.jsx`
- Create: `apps/web/src/app/expenses/page.jsx`
- Modify: `apps/web/src/components/DashboardShell.jsx`

- [ ] **Step 1: Add server-computed financial writes**

Purchase POST receives supplier and product line inputs, resolves product
records within the authorized shop, computes totals on the server, inserts
purchase rows and atomically increments stock plus `stock_movements`.
Expense writes validate category, amount, date and payment method server-side.

- [ ] **Step 2: Implement pages**

Purchases includes supplier selection, line entry, payment status and receipt
history. Expenses includes filters, category/amount form and a totals panel.
Managers and owners see these navigation entries; cashiers do not.

- [ ] **Step 3: Verify**

Create a purchase and prove inventory increases; create an expense and prove
it appears only in its shop; verify denied cashier requests return `403`.

## Task 7: Analytics And Settings Expansion

**Files:**
- Modify: `apps/web/src/app/api/analytics/route.js`
- Modify: `apps/web/src/app/analytics/page.jsx`
- Modify: `apps/web/src/app/settings/page.jsx`

- [ ] **Step 1: Add shop-scoped aggregate API results**

Extend the response with `expenses`, `purchaseSpend`, `netProfit`,
`receivables`, `payables`, `expenseBreakdown` and reorder rows, computed only
from authorized `shop_id` records. Hide cost/profit fields from cashiers.

- [ ] **Step 2: Expand UI panels**

Analytics shows revenue, gross profit, expenses, net result, collection
status, purchase spend, expense distribution and stock alerts. Settings groups
business/tax/invoice, staff, security, backup and export controls, disabling
owner-only controls for non-owners.

- [ ] **Step 3: Verify**

Build, load analytics with known sales/purchases/expenses, and verify totals
against entered data and role visibility.

## Task 8: Security Closure And Browser QA

**Files:**
- Update outside repository: `/tmp/codex-security-scans/MDX BILLING APP/<scan-id>/artifacts/*.md`
- Modify prior task files only for validated fixes.

- [ ] **Step 1: Complete validation and attack-path security phases**

Close each discovered auth, tenant isolation, financial integrity, token,
upload and data exposure ledger row as reportable, suppressed, not applicable
or deferred with evidence. Fix validated high-impact issues and rerun affected
tests.

- [ ] **Step 2: Run automated verification**

```powershell
npx vitest run
npm run typecheck
npm run build
```

Expected: PASS, or an explicitly captured external blocker not caused by the
implemented changes.

- [ ] **Step 3: Run Browser QA**

Use the Browser plugin for:

- Landing page -> Google sign-in starts configured real auth path.
- Owner selects shop -> customers/suppliers/purchases/expenses/team pages load.
- Shop switch -> scoped data visibly changes with no leaked records.
- Manager/Cashier -> navigation and forbidden actions match permissions.
- Desktop and mobile viewport checks with no framework overlay or console error.

- [ ] **Step 4: Final security and delivery report**

Provide changed files, workflows verified, scan report path, unresolved
credential/compliance blockers, and the next advanced GST-ready billing slice.
