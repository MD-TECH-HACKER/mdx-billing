import {
	type RouteConfigEntry,
	index,
	route,
	layout,
} from '@react-router/dev/routes';

// ─── Admin layout and routes (protected) ─────────────────────────────
const adminRoutes = layout('./admin/_admin.layout.jsx', [
	route('admin', './admin/page.jsx'),
	route('admin/users', './admin/users/page.jsx'),
	route('admin/shops', './admin/shops/page.jsx'),
	route('admin/activity', './admin/activity/page.jsx'),
	route('admin/security', './admin/security/page.jsx'),
	route('admin/system', './admin/system/page.jsx'),
	route('admin/settings', './admin/settings/page.jsx'),
]);

// ─── Dashboard pages wrapped in a shared layout (sidebar never remounts) ───
const dashboardRoutes = layout('./_dashboard.layout.jsx', [
	route('dashboard', './dashboard/page.jsx'),
	route('products', './products/page.jsx'),
	route('billing', './billing/page.jsx'),
	route('estimate', './estimate/page.jsx'),
	route('stock-estimate', './stock-estimate/page.jsx'),
	route('sales', './sales/page.jsx'),
	route('sales/:id', './sales/[id]/page.jsx'),
	route('customers', './customers/page.jsx'),
	route('suppliers', './suppliers/page.jsx'),
	route('purchases', './purchases/page.jsx'),
	route('expenses', './expenses/page.jsx'),
	route('analytics', './analytics/page.jsx'),
	route('ai', './ai/page.jsx'),
	route('team', './team/page.jsx'),
	route('audit', './audit/page.jsx'),
	route('audit-log', './audit-log/page.jsx'),
	route('settings', './settings/page.jsx'),
]);

// ─── Non-dashboard routes (no sidebar) ────────────────────────────────
const publicRoutes: RouteConfigEntry[] = [
	index('./page.jsx'),
	route('account/signin', './account/signin/page.jsx'),
	route('account/signup', './account/signup/page.jsx'),
	route('account/logout', './account/logout/page.jsx'),
	route('setup-shop', './setup-shop/page.jsx'),
	route('select-shop', './select-shop/page.jsx'),
	route('invite/accept', './invite/accept/page.jsx'),
	route('receipt/:id', './receipt/[id]/page.jsx'),
];

const notFound = route('*?', './__create/not-found.tsx');
const routes: RouteConfigEntry[] = [...publicRoutes, dashboardRoutes, adminRoutes, notFound];

export default routes;
