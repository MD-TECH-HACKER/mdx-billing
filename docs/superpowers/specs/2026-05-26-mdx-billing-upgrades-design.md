# MDX Billing Upgrades Design

## Summary

Upgrade MDX Billing across web and mobile with faster app-like navigation, secure auth/shop routing, real product units, cleaner UI behavior, Google Drive backup integration using the existing Google OAuth app, and an Android APK build path.

## Goals

- Make dashboard navigation feel like a single-page app instead of full document reloads.
- Add a branded custom loading experience during route, auth, shop, and data transitions.
- Fix unauthenticated access so protected pages do not expose dashboard content.
- Fix returning users being sent to shop setup when their shop already exists.
- Add product primary and secondary units such as piece, kg, g, liter, ml, meter, pack, and box.
- Fix custom dropdowns being hidden behind/clipped by surrounding containers.
- Hide scrollbars while keeping mouse, touch, and trackpad scrolling functional.
- Replace the fake Google Drive toggle with real Drive backup flow using the existing Google OAuth credentials where possible.
- Update the mobile app configuration and produce or prepare an Android APK build.

## Current Findings

- Dashboard navigation in `DashboardShell.jsx` uses plain anchor tags, which causes full page reloads.
- Protected pages depend mainly on client-side checks in `DashboardShell.jsx`; content can render before redirect/loading completes.
- Shop setup reads `/api/shop`, but the setup page does not redirect existing shops away immediately, so returning users can see setup again.
- Products currently store price, stock, category, and SKU, but no unit fields.
- Sales line items and cart items store quantity and prices, but no product unit label.
- The custom `Select` renders an absolutely positioned dropdown inside its parent, which can be clipped by card/modal/overflow stacking contexts.
- Settings has a local JSON export/import and a fake Drive sync toggle; it does not perform OAuth or upload to Drive.
- The mobile app is Expo SDK 54 with `app.json` and `eas.json`; no native `android/` folder exists, so APK generation should use EAS or require native project generation.

## Architecture

### Navigation and Loading

Use React Router primitives for internal navigation:

- Replace internal dashboard/shop links from `<a href>` to `Link` or `NavLink`.
- Replace imperative `window.location.href` inside normal app navigation with `useNavigate` where practical.
- Keep true full-document navigation only for auth/logout/external flows.
- Add a shared branded loader component for route and guard states.
- Show guarded loader while auth or shop state is unknown to avoid flashing protected pages or setup forms.

### Auth and Shop Guards

Use a shared guard pattern in dashboard shell and setup page:

- If no authenticated user is resolved, protected pages redirect to `/` or sign-in flow and render only loader while redirecting.
- If a user is authenticated but no shop exists, protected dashboard pages redirect to `/setup-shop`.
- If a user is authenticated and a shop exists, `/setup-shop` redirects to `/dashboard`.
- All APIs continue to require `auth()` and user ownership filters.

### Product Units

Add unit fields to product storage and UI:

- Add `primary_unit` with default `piece`.
- Add `secondary_unit` nullable.
- Product add/edit form includes primary and secondary unit selectors.
- Product details/cards show stock with the selected unit instead of hard-coded `units`.
- Cart and sale line items snapshot the product unit so receipts remain stable even if product unit changes later.
- Existing products default to `piece` during migration or API fallback.

Recommended unit list:

- `piece`
- `kg`
- `g`
- `liter`
- `ml`
- `meter`
- `cm`
- `pack`
- `box`
- `dozen`
- `bottle`
- `bag`

### Custom Select and Hidden Scrollbars

Update the shared `Select` component:

- Render dropdown using fixed viewport coordinates or a portal to avoid parent clipping.
- Use a high z-index suitable for modals and cards.
- Recompute dropdown position when opened.
- Preserve keyboard/mouse click-outside behavior.
- Apply hidden-scrollbar CSS to app containers and dropdown scroll areas while keeping scrolling enabled.

### Google Drive Backup

Implement real Drive backup flow using the existing Google OAuth app if possible:

- Add Drive-related endpoints for connect, callback, status, disconnect, and sync.
- Use existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env variables.
- Request Drive scope `https://www.googleapis.com/auth/drive.file` for app-created backup files.
- Store Drive access metadata on the shop record or a dedicated owner-scoped table, depending on current schema safety.
- Export the same backup data shape currently used locally: shop, products, sales, and export metadata.
- Upload JSON backup to Google Drive with a deterministic filename such as `mdx-billing-backup-latest.json` plus dated backup filenames.
- If Google OAuth consent is not configured for Drive scope, show a clear setup error rather than a fake success.
- Keep local JSON backup available as a fallback.

### Database Changes

Add idempotent migration logic for new fields/tables:

- `products.primary_unit TEXT DEFAULT 'piece'`
- `products.secondary_unit TEXT NULL`
- Drive token/status fields either on `shops` or a dedicated table keyed by owner/shop.
- Preserve all existing data.
- API endpoints should tolerate databases where migration has not run by using safe defaults where possible.

### Mobile and APK

Update Expo configuration:

- Rename app from generic app name to MDX Billing.
- Set Android package to an MDX-specific package name.
- Point mobile env/config to `https://mdx-billing.app` where applicable.
- Keep mobile auth WebView/token flow aligned with the web auth endpoints.
- Build APK using EAS preview/internal profile when credentials and login are available.
- If local APK is not possible due to no native Android project or missing EAS auth, prepare config and provide the exact build command and blocker.

## Data Flow

### Product Creation

1. User opens Add Product.
2. UI collects title, prices, stock, category, SKU, primary unit, and optional secondary unit.
3. `/api/products` validates/sanitizes fields.
4. Product is inserted with owner/shop scoping and unit fields.
5. Products query invalidates and cards update without full page reload.

### Billing and Sales

1. User adds products to cart.
2. Cart item stores unit snapshot.
3. Checkout sends quantity and product IDs to `/api/sales`.
4. API validates ownership, stock, and prices from database.
5. Sale line items include unit labels and stock decrements remain numeric.
6. Receipts/sales show unit labels.

### Drive Backup

1. User clicks Connect Google Drive.
2. App starts OAuth with Drive scope using the existing Google OAuth client.
3. Callback verifies state and owner, then stores token metadata securely enough for server-side upload.
4. Sync Now exports owner-scoped data and uploads JSON to Drive.
5. Settings shows connected account/status and last synced time.

## Error Handling

- Protected pages render branded loader while auth/shop state is unknown.
- Unauthorized API responses remain `401`.
- Missing shop remains `400` for product/sale creation but redirects at UI level.
- Drive OAuth errors show actionable messages for missing credentials, denied consent, or scope misconfiguration.
- Select dropdown falls back to opening below the trigger when viewport positioning cannot be measured.
- APK build failures report whether the blocker is missing EAS login, Android credentials, native project, or dependency/build failure.

## Testing and Verification

- Run web typecheck/build if available.
- Verify unauthenticated `/dashboard` does not show dashboard content and redirects correctly.
- Verify returning signed-in user with existing shop reaches dashboard, not setup.
- Add/edit product with primary and secondary units.
- Verify product cards, cart, billing, sales, and backup export include units.
- Verify internal dashboard navigation does not full-reload the page.
- Verify custom selects are visible inside settings/sales/modals.
- Verify scrollbars are hidden but scrolling works.
- Verify Drive flow reaches OAuth or displays a clear credential/scope setup error.
- Run mobile dependency/build checks and attempt APK build path.

## Implementation Order

1. Shared UI fixes: hidden scrollbars, select dropdown visibility, branded loader.
2. Navigation and guard fixes: SPA links, auth redirect, shop setup redirect.
3. Product unit data model/API/UI/cart/sales updates.
4. Backup improvements and real Google Drive OAuth/API endpoints.
5. Mobile app config updates.
6. Verification and APK build attempt.

## Scope Boundaries

- Do not remove existing local JSON backup; keep it as fallback.
- Do not expose Google access tokens to the browser.
- Do not rewrite the whole app shell unless required by tests.
- Do not hardcode secrets; use environment variables.
- Do not claim APK completion unless the build command produces an APK or EAS returns a build artifact URL.
