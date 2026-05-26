# MDX Billing Business Suite Design

## Status

Approved in chat on 2026-05-26 for implementation in staged deliveries. This
spec extends, and does not replace, the committed MDX Billing upgrades design
covering SPA navigation, guarded loading, product units, Google Drive backup,
and mobile packaging.

## Product Goal

Turn the existing shop-owner billing app into a secure multi-shop business
suite with staff access, richer billing records, purchases and expenses,
customers and suppliers, operational analytics, business settings, and
India-ready invoice data. Fix the index/authentication problems and security
boundaries before exposing new financial data surfaces.

Large page files are not a goal. New functionality will be split into shared
API authorization helpers, data modules, feature pages, and reusable UI
components so that access control and calculations can be tested reliably.

## Approaches Considered

### A. Add Many Pages Directly to the Current APIs

This is fastest visually, but is unsafe. The working tree has partial
multi-shop support where `X-Shop-Id` is set by the browser and several
product/sales requests still omit or incompletely constrain shop context.
Building managers and financial pages on that boundary would increase the
chance of cross-shop access.

### B. Secure Core First, Then Expand Workflows - Selected

First stabilize index/auth behavior and create a server-side shop-access and
permission boundary. Then add manager/staff access plus customer, supplier,
purchase, expense, analytics, and settings modules through that boundary.
Finally add compliance-heavy and advanced billing capabilities. This is the
approved approach because it ships visible features while protecting tenant
data and keeping migrations manageable.

### C. Full Accounting/GST Platform Rewrite

This could make a comprehensive system eventually, but requires accounting
ledger design, GST integration validation, migration planning, and substantially
more regression risk than the existing billing application supports today.
It is unsuitable as the first implementation step.

## Existing Baseline

The web application uses React Router 7, React, TanStack Query, Hono API
routes, Auth.js/CreateAuth and Neon Postgres. Existing pages include home,
dashboard, products, billing, sales, analytics, setup/shop selection, and
settings.

There is ongoing, uncommitted work adding multi-shop selection and product
units. That work must be retained and completed rather than overwritten.

Known baseline issues to resolve as part of this effort:

- Active shop selection is browser-supplied; all APIs must independently
  validate access to the selected shop.
- Product detail/update/delete and sale detail/delete currently filter mainly
  by owner, which does not support staff membership and is not sufficient for
  shop isolation.
- Checkout and several page fetches do not consistently send or enforce active
  shop context.
- `/analytics` does not currently include active shop headers in its fetch.
- Google sign-in is redirected to a simulated development provider when the
  app is embedded, even when real Google OAuth credentials exist.
- The local server auth configuration sets secure cookies in a way that must be
  reconciled with registered `http://localhost` development OAuth callbacks.
- The server config currently enables dangerous automatic Google email account
  linking and bypasses CSRF checks; both require removal or tightly justified
  replacement before manager access is released.
- `npm run typecheck` currently fails in generated React Router declarations
  for JSX page modules and must become a usable verification gate.

## Delivery Sequence

### Delivery 0: Stabilize Existing Upgrade Work

- Complete tenant-safe multi-shop selection and shop-scoped queries.
- Complete product unit behavior through cart, checkout, receipts and reports.
- Fix the landing/index flow, protected navigation and outstanding runtime
  errors.
- Repair Google login behavior so real OAuth can be used during local
  development when correctly configured.
- Fix or explicitly isolate generated typecheck failures.
- Keep existing Drive backup/mobile-plan work compatible, without claiming
  completion until separately verified.

### Delivery 1: Secure Business Core

- Staff management with Owner, Manager and Cashier roles.
- Customers with contact details, GST fields, purchase history and balances.
- Suppliers with contact details, GST fields and purchasing history.
- Purchases that receive stock and record supplier/payable information.
- Expenses with categories, dates, payment modes and supporting notes.
- Expanded analytics and reports integrating sales, purchases, expenses,
  profit, receivables/payables, low-stock and team activity.
- Expanded settings for business profile, invoice defaults, tax/GST metadata,
  team access, security/session controls, backup visibility and data export.

### Delivery 2: Advanced Billing and India-Ready Records

- Quotations/estimates convertible into invoices.
- Discounts, payment tracking, pending balances and customer statements.
- Sales returns and credit notes with stock adjustment audit trails.
- Stock adjustments, reorder levels and supplier-linked replenishment.
- GST invoice fields including business/customer GSTIN, state/place of supply,
  HSN/SAC, taxable value and tax split data.
- Export payloads/reports suitable for later GST/e-invoice integration.

Actual submission to the GST Invoice Registration Portal is explicitly separate
from storing and exporting GST-ready invoice data. It requires eligible
business configuration, authoritative schema validation, credentials and a
tested integration before it can be represented as active e-invoice filing.

## Information Architecture

The dashboard navigation becomes:

- Dashboard
- Billing
- Sales
- Products
- Customers
- Suppliers
- Purchases
- Expenses
- Analytics
- Team
- Settings

Visibility is permission-driven. A Cashier primarily sees billing, permitted
products/customers, and own sales workflow. A Manager sees operational modules
and reports based on assigned permissions. An Owner manages business settings,
memberships, exports and security controls.

## Access Control And Tenant Isolation

### Core Rule

Every non-public API request resolves an authenticated user and an accessible
shop on the server. A browser `X-Shop-Id` header is a selection hint only; it
must never grant access.

Add a shared server helper, conceptually:

```js
const context = await requireShopAccess(request, "sales.create");
// context = { userId, shopId, role, permissions, shop }
```

It will:

1. Require a valid authenticated session.
2. Parse and validate the requested shop id.
3. Permit the shop owner or an active membership for that shop.
4. Enforce the requested action permission.
5. Return `401`, `403`, or `404` without leaking unrelated shop data.

All resource queries include `shop_id = context.shopId` in addition to
resource ids. Owner-wide data aggregation is permitted only through an
explicit owner-only reporting path.

### Roles

- `owner`: all permissions; cannot be removed by a manager.
- `manager`: operational control including sales, products, customers,
  suppliers, purchases, expenses and analytics; no ownership transfer or
  sensitive security management.
- `cashier`: create/view permitted sales and customer lookup; limited product
  visibility; no cost/profit, purchases, expenses, staff or sensitive
  settings by default.

The first implementation uses fixed, auditable role permission maps. Custom
role permission editing may be added after the fixed roles have tests and
audit coverage.

### Audit Trail

Sensitive actions write `audit_events` scoped to the shop: membership changes,
shop-setting edits, product/stock changes, purchases, expense changes, sale
void/return actions, exports and authentication/security actions where
available. The audit log avoids storing access tokens, passwords or full
payment secrets.

## Authentication And Development Google Login

Real Google sign-in must be available in development when credentials are
configured and the running URL matches a Google OAuth registered callback,
such as `http://localhost:8080/api/auth/callback/google`.

Required changes:

- Do not automatically replace real Google sign-in with the simulated
  development provider merely because the application is in an iframe.
- Retain simulation only behind an explicit test/development choice and label
  it as simulated authentication.
- Configure cookie security to support local HTTP loopback development while
  preserving secure cookies for HTTPS deployments.
- Verify callback URL construction against `AUTH_URL` and the actual local
  server port.
- Do not automatically link an OAuth identity to an existing credential
  account based only on matching email. Account linking must require an
  already authenticated user or another verified, deliberate flow.
- Restore normal CSRF/OAuth state protections unless the framework requires a
  documented narrowly scoped exception; do not globally waive auth request
  integrity for convenience.

## Data Model

Migrations are idempotent and preserve current shop/product/sales data.
Owner-created shops gain implicit owner access without requiring user action.

### Membership And Security

- `shop_memberships`: `shop_id`, `user_id`, `role`, `status`, `invited_by`,
  `created_at`, `updated_at`, unique `(shop_id, user_id)`.
- `shop_invites`: invitation email/token hash, target role, expiry, status.
- `audit_events`: `shop_id`, actor id, action, entity type/id, safe metadata,
  timestamp.

### Parties

- `customers`: shop-scoped identity, phone, email, address, GSTIN, state,
  opening balance, notes, timestamps.
- `suppliers`: shop-scoped identity, phone, email, address, GSTIN, state,
  notes, timestamps.

### Inventory And Expenses

- Extend `products` with reorder level, HSN/SAC, tax rate, preferred supplier
  where applicable, preserving unit columns already being introduced.
- `purchases` and `purchase_items`: supplier, reference number, dates,
  payment status, totals, tax, notes and stock-receipt items.
- `expenses`: category, amount, tax amount, payment method, expense date,
  vendor/reference and notes.
- `stock_movements`: append-only changes for sale, purchase, return and manual
  adjustment with actor and originating entity.

### Sales Extensions

Extend `sales` safely with optional customer id, discount values, paid/due
amount, due date, sale lifecycle state, GST snapshot fields and return/credit
references. Existing JSON line-item snapshots remain readable and gain unit
and tax metadata going forward.

## Feature Pages

### Customers

Search/filter customers, create/edit contacts, show outstanding amounts and
invoice timeline, and start billing prefilled for a customer. Customer GST
fields flow into GST-ready invoice snapshots.

### Suppliers And Purchases

Maintain supplier records and create purchase receipts with inventory line
items. Completing a purchase creates stock movements and updates inventory.
Paid, partial and pending states contribute to payable reporting.

### Expenses

Record categorized outflows with time filters and payment modes. Expenses
contribute to net profit reporting but never silently alter product margins.

### Team

Owners can invite, activate, suspend or change the fixed role of staff. The
page communicates what each role can access. Managers cannot promote users to
owner or change owner-level security controls.

### Analytics

Add date range filtering and views for:

- Revenue, gross profit, expenses and net result.
- Sales counts, average bill value and payment collection status.
- Receivables and supplier payables.
- Product performance, low stock and reorder queue.
- Purchase spend and expense category distribution.
- Cashier/manager activity available to owners/managers only.
- CSV/PDF-oriented export entry points where safe and supported.

### Settings

Group settings into business profile, invoice/tax defaults, appearance,
integrations/backup, data export, staff permissions, and security. Sensitive
settings require owner permission and record audit events.

## API And UI Architecture

Use existing React Router/TanStack Query and styling patterns. Introduce:

- Server utilities for authenticated shop context, role permissions, safe
  validation, audit writes and migrations.
- Page-level modules for each feature with small shared table/form/filter
  components rather than single very large page files.
- A single shop-aware client request helper so every scoped fetch sends the
  selected shop consistently; server checks remain authoritative.
- Query keys that include active shop id to prevent displaying cached data
  from another selected shop.
- Empty, loading, error and permission-denied states for each new page.

## Validation And Error Handling

- Validate string lengths, numeric ranges, dates, enums and GSTIN shape on the
  server before writes.
- Calculate sale, purchase, tax, discount and balance totals on the server
  from authoritative rows, never from browser totals.
- Make inventory movement and parent transaction writes atomic.
- Return permission-safe messages: unauthorized, forbidden, not found, or
  validation errors without exposing other-shop records.
- Preserve data on failed writes; surface actionable UI errors.

## Security Workstream

Before manager or financial modules ship, execute a repository-wide security
review focused on:

- Authentication, OAuth state/CSRF/cookies and development-provider exposure.
- Tenant isolation across shop, product, sales, analytics, upload and new API
  routes.
- Role escalation, invitation abuse and owner-only operations.
- SQL construction, mass assignment and financial-total tampering.
- Upload/storage, export/backup token handling and sensitive log exposure.
- Dependency and configuration risks that directly affect runtime behavior.

Security controls include server-side permission checks per request,
least-privilege roles, tenant-scoped lookups, audit logs, no client-exposed
tokens, and authorization/integration tests for cross-shop requests.

## Verification

For each implemented delivery:

- Run unit tests for calculation helpers, permissions and request scoping.
- Run `npm run typecheck` and `npm run build` after repairing the present
  generated-JSX declaration failure or document a framework-generated blocker.
- Verify index routing, protected pages and Google sign-in start/callback
  behavior at the configured local URL.
- Use browser testing on desktop and mobile layouts for the main workflows.
- Test two shops and multiple roles to prove reads/writes cannot cross shops.
- Test sales, purchases, expenses and analytics with deterministic records.
- Confirm audit events are written for sensitive operations.
- Run the defined security review and resolve validated high-impact findings
  before claiming the manager/financial functionality secure.

## Research Basis

Feature prioritization follows common accounting/POS capabilities documented
by current product and official platform references:

- Zoho Books feature inventory includes customers/vendors, invoicing,
  purchase orders, expenses, stock/reorder management, user roles and broad
  reports: https://www.zoho.com/books/accounting-software-features/
- Square POS documents multi-location inventory, team custom permissions,
  activity monitoring and sales reporting:
  https://squareup.com/gb/en/point-of-sale/features
- India's NIC describes GST e-invoice interoperability and its transfer to
  GST/e-way bill systems, which is why GST-ready data is separated from active
  IRP submission: https://www.nic.gov.in/project/gst-e-invoice/
- Google OAuth web-server guidance supports localhost callback URIs for local
  development while requiring secure server-side authorization flow:
  https://developers.google.com/identity/protocols/oauth2/web-server
- OWASP authorization and multi-tenant guidance requires deny-by-default,
  permission validation on every request, and tenant ownership validation:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
  and
  https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html

## Scope Decisions

- Implement the approved secure business core before compliance-heavy workflow
  integrations.
- Do not force arbitrary source-line counts; code quality, security and working
  workflows define completion.
- Do not expose Google/backup tokens in client responses.
- Do not claim live GST e-invoice filing without a validated IRP integration.
- Do not discard or overwrite the ongoing working-tree upgrade changes.
