import {
	type RouteConfigEntry,
	index,
	route,
	layout,
} from '@react-router/dev/routes';

// ─── Dashboard pages wrapped in a shared layout (sidebar never remounts) ───
const dashboardRoutes = layout('./_dashboard.layout.jsx', [
	route('dashboard', './dashboard/page.jsx'),
	route('products', './products/page.jsx'),
	route('billing', './billing/page.jsx'),
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
const routes: RouteConfigEntry[] = [...publicRoutes, dashboardRoutes, notFound];

export default routes;
