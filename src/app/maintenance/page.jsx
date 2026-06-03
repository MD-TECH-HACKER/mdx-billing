import { useEffect } from "react";
import { useNavigate } from "react-router";
import { ShieldAlert, Wrench } from "lucide-react";
import usePlatformSettings from "@/utils/usePlatformSettings";
import useUser from "@/utils/useUser";
import { Button } from "@/components/ui";

export default function MaintenancePage() {
  const navigate = useNavigate();
  const { data: user } = useUser();
  const { settings, currentUserIsAdmin, loading } = usePlatformSettings();

  useEffect(() => {
    if (!loading && (!settings?.maintenanceMode || currentUserIsAdmin)) {
      navigate(user ? "/dashboard" : "/", { replace: true });
    }
  }, [currentUserIsAdmin, loading, navigate, settings?.maintenanceMode, user]);

  return (
    <div className="min-h-screen bg-[var(--bg-page,#f6f7fb)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg t-card p-7 text-center">
        <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
          <Wrench className="w-8 h-8" />
        </div>
        <h1 className="t-text text-2xl font-bold">System maintenance</h1>
        <p className="t-muted text-sm mt-3 leading-6">
          MDX Billing is temporarily unavailable while platform maintenance is active.
          Admin users can still access the admin panel.
        </p>
        <div className="mt-6 rounded-2xl t-elev border t-border p-4 text-left flex gap-3">
          <ShieldAlert className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="t-text text-sm font-semibold">Access is limited</div>
            <div className="t-muted text-xs mt-1">
              Non-admin accounts are redirected here until maintenance mode is turned off.
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button onClick={() => navigate("/account/logout")}>
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
