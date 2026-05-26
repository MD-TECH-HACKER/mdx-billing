import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Receipt as ReceiptIcon,
  Eye,
  Trash2,
  Calendar,
  Printer,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import { showToast } from "@/components/Toast";
import { formatMoney } from "@/utils/currency";
import {
  Card,
  Button,
  SearchInput,
  Select,
  Input,
  Badge,
  ConfirmDialog,
  Skeleton,
} from "@/components/ui";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount_desc", label: "Highest amount" },
  { value: "amount_asc", label: "Lowest amount" },
];

export default function SalesPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [deleting, setDeleting] = useState(null);

  const filtersKey = { search, fromDate, toDate, status, sort };

  const query = useQuery({
    queryKey: ["sales", filtersKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (status) params.set("status", status);
      if (sort) params.set("sort", sort);
      const res = await fetch(`/api/sales?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
    keepPreviousData: true,
    staleTime: 15000,
  });

  const sales = query.data?.sales || [];
  const currency = shop?.currency || "INR";
  const fmt = (n) => formatMoney(n, currency);

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      showToast("Receipt deleted · stock restored");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: () => showToast("Failed to delete", "error"),
  });

  // Totals across visible sales
  const totals = sales.reduce(
    (a, s) => {
      a.revenue += Number(s.total_amount) || 0;
      a.profit += Number(s.total_profit) || 0;
      a.qty += Number(s.total_quantity) || 0;
      return a;
    },
    { revenue: 0, profit: 0, qty: 0 },
  );

  const statusTone = (s) =>
    s === "paid" ? "success" : s === "pending" ? "warning" : "accent";

  return (
    <DashboardShell currentPath="/sales">
      <div className="mb-5">
        <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">
          Sales & Receipts
        </h1>
        <p className="t-muted text-sm">All your previous sales</p>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="lg:col-span-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buyer name or receipt #"
            />
          </div>
          <div className="flex items-center gap-2 t-input px-3 py-2">
            <Calendar className="w-4 h-4 t-dim" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm t-text"
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div className="flex items-center gap-2 t-input px-3 py-2">
            <Calendar className="w-4 h-4 t-dim" />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm t-text"
              style={{ colorScheme: "dark" }}
            />
          </div>
          <Select
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <Select value={sort} onChange={setSort} options={SORT_OPTIONS} />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl t-elev px-3 py-2">
              <div className="t-dim">Revenue</div>
              <div className="t-text font-semibold">{fmt(totals.revenue)}</div>
            </div>
            <div className="rounded-xl t-success-bg px-3 py-2">
              <div className="opacity-80">Profit</div>
              <div className="font-semibold">{fmt(totals.profit)}</div>
            </div>
            <div className="rounded-xl t-elev px-3 py-2">
              <div className="t-dim">Units</div>
              <div className="t-text font-semibold">{totals.qty}</div>
            </div>
          </div>
        </div>
      </Card>

      {query.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <Card className="text-center py-12">
          <ReceiptIcon className="w-12 h-12 t-dim2 mx-auto mb-3" />
          <h3 className="t-text font-semibold mb-1">No sales found</h3>
          <p className="t-muted text-sm mb-4">
            Sales will appear here after you generate a receipt.
          </p>
          <Link to="/billing">
            <Button variant="primary">Start a sale</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sales.map((s) => {
            const itemsCount = Array.isArray(s.items) ? s.items.length : 0;
            return (
              <Card key={s.sale_id} className="flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <div className="t-dim text-[10px] uppercase tracking-wide">
                      Receipt
                    </div>
                    <div className="t-text font-bold text-sm truncate">
                      {s.receipt_number}
                    </div>
                  </div>
                  <Badge tone={statusTone(s.payment_status)}>
                    {s.payment_status}
                  </Badge>
                </div>
                <div className="space-y-1 mb-3">
                  <div className="t-text text-sm font-medium">
                    {s.buyer_name || "Walk-in customer"}
                  </div>
                  <div className="t-dim text-xs">
                    {new Date(s.created_at).toLocaleString("en-IN")}
                  </div>
                  <div className="t-muted text-xs">
                    {itemsCount} items · {s.total_quantity} units ·{" "}
                    <span className="capitalize">
                      {(s.payment_method || "cash").replace("_", " ")}
                    </span>
                  </div>
                </div>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="t-dim text-[10px]">Total</div>
                    <div className="t-text font-bold text-lg">
                      {fmt(s.total_amount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-[10px]"
                      style={{ color: "var(--success)" }}
                    >
                      Profit
                    </div>
                    <div
                      className="font-semibold text-sm"
                      style={{ color: "var(--success)" }}
                    >
                      {fmt(s.total_profit)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <Link
                    to={`/sales/${s.sale_id}`}
                    className="flex-1 t-btn-primary px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1 rounded-xl"
                  >
                    <Eye className="w-3 h-3" /> View
                  </Link>
                  <Link
                    to={`/sales/${s.sale_id}?print=1`}
                    className="t-btn px-2 py-2 text-xs rounded-xl"
                    title="Print"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => setDeleting(s)}
                    className="t-btn-danger px-2 py-2 rounded-xl"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete receipt?"
        message={
          deleting
            ? `Receipt ${deleting.receipt_number} will be removed and stock will be restored.`
            : ""
        }
        destructive
        confirmText="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteMut.mutate(deleting.sale_id);
          setDeleting(null);
        }}
      />
    </DashboardShell>
  );
}
