# MDX Billing Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver MDX Billing web/mobile upgrades: SPA navigation, guarded loading, product units, select/dropdown fixes, hidden scrollbars, real Google Drive backup flow, mobile config, and APK attempt.

**Architecture:** Make targeted changes in existing React Router/Hono/Expo structure. Keep the current page files and shared dashboard shell, replacing reload-prone navigation and adding guard/loading behavior rather than rewriting the whole routing tree. Add idempotent schema migration helpers and owner-scoped API changes so existing data remains safe.

**Tech Stack:** React Router 7, React 18, TanStack Query, Hono route handlers, Neon Postgres, Auth.js/CreateAuth, Expo SDK 54, EAS Build.

---

## File Structure

- Modify `apps/web/src/app/global.css`: hidden scrollbar CSS and loading utilities.
- Modify `apps/web/src/components/ui/index.jsx`: fixed/portal-style `Select`, shared `AppLoader`, hidden dropdown scrollbars.
- Modify `apps/web/src/components/DashboardShell.jsx`: React Router `Link`/`NavLink`, guarded loader, no protected content flash.
- Modify `apps/web/src/app/setup-shop/page.jsx`: redirect authenticated users with existing shop to `/dashboard`, loader while checking.
- Modify `apps/web/src/app/page.jsx`: SPA navigation where applicable and better loading state.
- Modify `apps/web/src/app/products/page.jsx`: unit selectors, product display, cart additions.
- Modify `apps/web/src/utils/cartStore.js`: store product unit snapshots in cart.
- Modify `apps/web/src/app/billing/page.jsx`: display units and send cart items unchanged.
- Modify `apps/web/src/app/api/products/route.js`: product unit migration and create/list fields.
- Modify `apps/web/src/app/api/products/[id]/route.js`: update unit fields.
- Modify `apps/web/src/app/api/sales/route.js`: include unit snapshots in sale line items.
- Modify `apps/web/src/app/settings/page.jsx`: replace fake Drive toggle with real connect/sync/disconnect controls and keep local backup.
- Create `apps/web/src/app/api/backup/drive/connect/route.js`: start Drive OAuth.
- Create `apps/web/src/app/api/backup/drive/callback/route.js`: exchange Drive OAuth code and store tokens.
- Create `apps/web/src/app/api/backup/drive/status/route.js`: return Drive connection status.
- Create `apps/web/src/app/api/backup/drive/sync/route.js`: export owner data and upload JSON to Drive.
- Create `apps/web/src/app/api/backup/drive/disconnect/route.js`: clear Drive token metadata.
- Create `apps/web/src/app/api/backup/utils.js`: Drive backup helpers.
- Modify `apps/mobile/app.json`: MDX branding/package.
- Modify `apps/mobile/eas.json`: APK preview build type.
- Add tests where practical under existing test setup, otherwise verify by build/typecheck/manual browser checks.

---

### Task 1: Shared UI Foundation

**Files:**
- Modify: `apps/web/src/app/global.css`
- Modify: `apps/web/src/components/ui/index.jsx`

- [ ] **Step 1: Add hidden scrollbar and loader CSS**

Add global scrollbar hiding that keeps scrolling functional:

```css
html, body, * {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar,
*::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.mdx-route-loader {
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
}
```

- [ ] **Step 2: Update `Select` to avoid clipping**

In `apps/web/src/components/ui/index.jsx`, import `createPortal` from `react-dom`, track trigger position, and render the dropdown fixed in `document.body` when open. Preserve click-outside behavior by checking both trigger and dropdown refs.

- [ ] **Step 3: Add `AppLoader` export**

Add a small branded loader component in `apps/web/src/components/ui/index.jsx`:

```jsx
export function AppLoader({ label = "Loading MDX Billing...", fullScreen = false }) {
  return (
    <div className={`${fullScreen ? "min-h-screen" : "min-h-[240px]"} mdx-route-loader flex items-center justify-center p-6 rounded-3xl`}>
      <div className="t-card t-card-strong px-6 py-5 text-center max-w-xs w-full">
        <div className="mx-auto mb-3 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-dark))" }}>
          <span className="text-white font-bold">M</span>
        </div>
        <div className="t-text font-semibold">{label}</div>
        <div className="mt-4 h-1.5 rounded-full overflow-hidden t-elev">
          <div className="h-full w-1/2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify UI compiles**

Run: `npm run typecheck`

Expected: no syntax/type errors from `global.css` or `ui/index.jsx`.

---

### Task 2: SPA Navigation and Guards

**Files:**
- Modify: `apps/web/src/components/DashboardShell.jsx`
- Modify: `apps/web/src/app/setup-shop/page.jsx`
- Modify: `apps/web/src/app/page.jsx`
- Modify: `apps/web/src/app/sales/[id]/page.jsx` where redirect uses `window.location.href`

- [ ] **Step 1: Replace dashboard links with React Router links**

Import `Link`, `NavLink`, and `useNavigate` from `react-router` in `DashboardShell.jsx`. Replace internal dashboard anchors with `Link` or `NavLink`. Leave `/account/logout` as a normal anchor.

- [ ] **Step 2: Add protected content loader**

Use `AppLoader` in `DashboardShell.jsx`. If `userLoading`, render only loader. If auth is absent after loading, navigate away and render loader. If shop is required and shop is loading/null, render loader while redirecting to setup.

- [ ] **Step 3: Fix setup-shop returning-user behavior**

In `setup-shop/page.jsx`, while user/shop status is unknown render `AppLoader`. If `/api/shop` returns an existing shop, navigate to `/dashboard` before showing the setup form.

- [ ] **Step 4: Use SPA navigation from home**

In `page.jsx`, use `useNavigate` for internal `/dashboard` and `/setup-shop` navigation after checking `/api/shop`.

- [ ] **Step 5: Verify route behavior**

Run dev server and test:

```powershell
npm run dev
```

Expected:
- Clicking Dashboard/Product/Billing/Sales/Settings changes route without full document reload.
- `/dashboard` unauthenticated shows loader/redirect and no dashboard cards.
- Existing-shop users do not see setup form.

---

### Task 3: Product Unit Data Model and UI

**Files:**
- Modify: `apps/web/src/app/api/products/route.js`
- Modify: `apps/web/src/app/api/products/[id]/route.js`
- Modify: `apps/web/src/app/products/page.jsx`
- Modify: `apps/web/src/utils/cartStore.js`
- Modify: `apps/web/src/app/billing/page.jsx`
- Modify: `apps/web/src/app/api/sales/route.js`
- Modify: `apps/web/src/app/dashboard/page.jsx`
- Modify: `apps/web/src/app/sales/page.jsx`
- Modify: `apps/web/src/app/sales/[id]/page.jsx`

- [ ] **Step 1: Add idempotent product unit migration**

In product API routes, ensure these columns exist before reading/writing products:

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_unit TEXT DEFAULT 'piece';
ALTER TABLE products ADD COLUMN IF NOT EXISTS secondary_unit TEXT;
UPDATE products SET primary_unit = 'piece' WHERE primary_unit IS NULL OR primary_unit = '';
```

- [ ] **Step 2: Sanitize product units in API**

Allow unit values from this set: `piece`, `kg`, `g`, `liter`, `ml`, `meter`, `cm`, `pack`, `box`, `dozen`, `bottle`, `bag`. Fallback `primary_unit` to `piece`; allow nullable `secondary_unit`.

- [ ] **Step 3: Update product create/update payloads**

Insert/update `primary_unit` and `secondary_unit` in `/api/products` and `/api/products/[id]`.

- [ ] **Step 4: Update Product Form**

Add `primaryUnit` and `secondaryUnit` form fields with `Select` options in `products/page.jsx`.

- [ ] **Step 5: Update product displays**

Replace hard-coded `units` text with product unit labels in product card/detail/dashboard low stock/recent sales where item quantities are shown.

- [ ] **Step 6: Update cart snapshots**

In `cartStore.js`, add `primary_unit` and `secondary_unit` to cart items and keep existing cart items compatible by defaulting to `piece`.

- [ ] **Step 7: Update sales line items**

In `/api/sales`, include `primaryUnit` and `secondaryUnit` in line item JSON from the product row.

- [ ] **Step 8: Verify unit behavior**

Create/edit products with `kg/liter/piece`, add them to cart, checkout, and confirm cards/cart/receipt show the unit.

---

### Task 4: Google Drive Backup

**Files:**
- Modify: `apps/web/src/app/settings/page.jsx`
- Create: `apps/web/src/app/api/backup/utils.js`
- Create: `apps/web/src/app/api/backup/drive/connect/route.js`
- Create: `apps/web/src/app/api/backup/drive/callback/route.js`
- Create: `apps/web/src/app/api/backup/drive/status/route.js`
- Create: `apps/web/src/app/api/backup/drive/sync/route.js`
- Create: `apps/web/src/app/api/backup/drive/disconnect/route.js`

- [ ] **Step 1: Add backup utility helpers**

Create helpers that:
- verify authenticated user
- create Drive metadata table if missing
- build OAuth URL with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and Drive scope
- exchange code for tokens
- export shop/products/sales JSON
- upload backup file to Drive API

- [ ] **Step 2: Add Drive connect endpoint**

`GET /api/backup/drive/connect` returns `{ url }` or credential setup error. Use `state` containing signed user/shop context or an owner-scoped random value stored server-side.

- [ ] **Step 3: Add Drive callback endpoint**

`GET /api/backup/drive/callback` exchanges OAuth code for tokens and stores token metadata owner-scoped. Redirect back to `/settings?drive=connected` or `/settings?drive=error`.

- [ ] **Step 4: Add status/sync/disconnect endpoints**

Expose current connection status and support upload sync/disconnect. Never send access tokens to browser.

- [ ] **Step 5: Replace fake settings toggle**

In `settings/page.jsx`, Connect opens the OAuth URL, Sync calls `/api/backup/drive/sync`, Disconnect calls `/api/backup/drive/disconnect`, and local JSON export remains.

- [ ] **Step 6: Verify Drive behavior**

Expected:
- Without configured credentials or Drive scope, user sees clear setup error.
- With credentials/scope, OAuth begins and returns to settings.
- Sync uploads JSON backup or returns a clear API error.

---

### Task 5: Mobile Configuration and APK Path

**Files:**
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/eas.json`
- Inspect/update env usage in `apps/mobile/src/__create/fetch.ts` and `apps/mobile/src/utils/auth/AuthWebView.jsx` only if needed.

- [ ] **Step 1: Update app branding**

Set Expo name to `MDX Billing`, slug to `mdx-billing`, and Android package to an MDX-specific package such as `app.mdx.billing`.

- [ ] **Step 2: Update EAS preview to APK**

Set preview Android build type to `apk`.

- [ ] **Step 3: Run Expo config check**

Run:

```powershell
npx expo config --type public
```

Expected: config resolves with MDX Billing name/package.

- [ ] **Step 4: Attempt APK build**

Run:

```powershell
npx eas build --platform android --profile preview
```

Expected:
- EAS returns a build URL/artifact, or
- command reports login/credentials blocker to give user exact next step.

---

### Task 6: Verification and Final Polish

**Files:**
- Modify any files from earlier tasks only if verification finds failures.

- [ ] **Step 1: Run web typecheck/build**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: both pass or report actionable errors to fix.

- [ ] **Step 2: Browser verification**

Use browser against local dev server:
- navigation does not reload document
- dropdown appears above cards/modals
- scrollbars hidden but scroll works
- product units work end-to-end
- auth/shop guards show loader and redirect correctly

- [ ] **Step 3: Mobile verification**

Run Expo config/build checks and record APK artifact URL or blocker.

- [ ] **Step 4: Commit implementation**

Commit cohesive changes:

```powershell
git add apps/web apps/mobile docs/superpowers/plans/2026-05-26-mdx-billing-upgrades-plan.md
git commit -m "Implement MDX Billing upgrades"
```
