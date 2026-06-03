// Shared dashboard layout — renders DashboardShell once, pages swap via <Outlet>.
// This prevents the sidebar from remounting on every route change.
import { Outlet } from "react-router";
import DashboardShell from "@/components/DashboardShell";

export default function DashboardLayout() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  );
}
