import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldCheck } from "lucide-react";
import { Badge, Card, Skeleton } from "@/components/ui";
import useShop from "@/utils/useShop";
import useUser from "@/utils/useUser";
import { shopHeaders } from "@/utils/shopContext";

export default function AuditPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const query = useQuery({
    queryKey: ["audit", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/audit", { headers: shopHeaders() });
      if (!response.ok) throw new Error("Audit log is owner-only");
      return response.json();
    },
    enabled: !!user && !!shop?.shop_id,
  });
  const events = query.data?.events || [];

  return (
    <>
      <div className="mb-5">
        <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Security Audit Log</h1>
        <p className="t-muted text-sm">Owner-only record of sensitive shop and financial actions.</p>
      </div>

      <Card className="mb-4 flex gap-3 items-start">
        <ShieldCheck className="w-5 h-5 t-accent-text mt-0.5" />
        <p className="t-muted text-sm">
          Product edits, receipts, expenses, purchases, team changes and shop settings are recorded for accountability.
        </p>
      </Card>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16" />)}
        </div>
      ) : events.length === 0 ? (
        <Card className="py-12 text-center">
          <Activity className="w-11 h-11 t-dim2 mx-auto mb-3" />
          <div className="t-text font-semibold">No audit entries yet</div>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <Card key={event.audit_id} className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="t-text font-medium">{event.action.replaceAll(".", " ")}</div>
                <div className="t-dim text-xs truncate">
                  {event.actor_name || event.actor_email || "System"} / {new Date(event.created_at).toLocaleString("en-IN")}
                </div>
              </div>
              <Badge tone="accent">{event.actor_role || "system"}</Badge>
              <span className="t-muted text-xs">
                {event.resource_type}{event.resource_id ? ` #${event.resource_id}` : ""}
              </span>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
