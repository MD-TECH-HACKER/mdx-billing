import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { FileText, Plus } from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import { Button, Card, Skeleton } from "@/components/ui";
import { formatMoney } from "@/utils/currency";
import { shopHeaders } from "@/utils/shopContext";

export default function EstimatePage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const query = useQuery({
    queryKey: ["estimates", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/estimates", { headers: shopHeaders() });
      if (!response.ok) throw new Error("Failed to load estimates");
      return response.json();
    },
    enabled: !!user && !!shop?.shop_id,
  });
  const estimates = query.data?.estimates || [];
  const currency = shop?.currency || "INR";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Estimate</h1>
          <p className="t-muted text-sm">
            Create quotation bills without reducing stock. Convert from Billing when ready.
          </p>
        </div>
        <Link to="/billing?type=estimate">
          <Button>
            <Plus className="w-4 h-4" /> New Estimate
          </Button>
        </Link>
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : query.isError ? (
        <Card className="text-center py-10">
          <FileText className="w-11 h-11 mx-auto mb-3 t-dim2" />
          <h2 className="t-text font-semibold">Could not load estimates</h2>
          <Button variant="secondary" className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Card>
      ) : estimates.length === 0 ? (
        <Card className="text-center py-12">
          <FileText className="w-12 h-12 t-dim2 mx-auto mb-3" />
          <h2 className="t-text font-semibold">No estimates yet</h2>
          <p className="t-muted text-sm mt-1 mb-4">
            Use the Estimate / Quotation billing type to prepare quotes without stock out.
          </p>
          <Link to="/billing?type=estimate">
            <Button>
              <Plus className="w-4 h-4" /> Create Estimate
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {estimates.map((estimate) => (
            <Card key={estimate.estimate_id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="t-text font-semibold truncate">{estimate.estimate_number}</div>
                  <div className="t-muted text-xs truncate">
                    {estimate.customer_name || "Walk-in customer"}
                  </div>
                </div>
                <span className="t-accent-soft rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  {estimate.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Amount" value={formatMoney(estimate.total_amount, currency)} />
                <Stat label="Valid until" value={estimate.valid_until ? new Date(estimate.valid_until).toLocaleDateString("en-IN") : "Not set"} />
              </div>
              <div className="t-dim text-xs">
                Created {new Date(estimate.created_at).toLocaleString("en-IN")}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl t-elev px-3 py-2">
      <div className="t-dim text-[10px]">{label}</div>
      <div className="t-text font-semibold truncate">{value}</div>
    </div>
  );
}
