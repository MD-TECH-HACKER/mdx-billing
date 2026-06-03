import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { AlertTriangle, Calendar, CircleDollarSign, Eye, Printer, Receipt, Trash2 } from "lucide-react";
import useUser from "@/utils/useUser";
import useShop from "@/utils/useShop";
import { showToast } from "@/components/Toast";
import { formatMoney } from "@/utils/currency";
import { shopHeaders } from "@/utils/shopContext";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Modal,
  SearchInput,
  Select,
  Skeleton,
} from "@/components/ui";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "credit", label: "Credit" },
  { value: "cancelled", label: "Cancelled" },
];
const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount_desc", label: "Highest amount" },
  { value: "amount_asc", label: "Lowest amount" },
];
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank" },
];

export default function SalesPage() {
  const { data: user } = useUser();
  const { shop, role, loading: shopLoading, error: shopError, refetch: refetchShop } = useShop({ enabled: !!user });
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [cancelling, setCancelling] = useState(null);
  const [paying, setPaying] = useState(null);
  const [payment, setPayment] = useState({ amount: "", paymentMethod: "cash", notes: "" });
  const currency = shop?.currency || "INR";
  const fmt = (number) => formatMoney(number, currency);
  const canManage = role === "owner" || role === "manager";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = new URLSearchParams(window.location.search).get("search");
    if (value) setSearch(value);
  }, []);

  const query = useQuery({
    queryKey: ["sales", user?.id, shop?.shop_id, search, fromDate, toDate, status, sort],
    queryFn: async () => {
      const params = new URLSearchParams({ status, sort });
      if (search) params.set("search", search);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const response = await fetch(`/api/sales?${params}`, { headers: shopHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (import.meta.env.DEV) console.error("Sales page API error", { status: response.status, data });
        throw new Error(data.error || `Failed to load sales (${response.status})`);
      }
      return { sales: Array.isArray(data.sales) ? data.sales : [] };
    },
    enabled: !!user?.id && !!shop?.shop_id && !!role,
    staleTime: 15000,
  });
  const sales = query.data?.sales || [];
  const totals = sales.reduce(
    (total, sale) => {
      total.amount += Number(sale.total_amount) || 0;
      total.received += Number(sale.paid_amount) || 0;
      total.balance += Math.max(0, Number(sale.total_amount) - Number(sale.paid_amount || 0));
      total.profit += Number(sale.total_profit) || 0;
      return total;
    },
    { amount: 0, received: 0, balance: 0, profit: 0 },
  );

  const cancel = useMutation({
    mutationFn: async (saleId) => {
      const response = await fetch(`/api/sales/${saleId}`, { method: "DELETE", headers: shopHeaders() });
      if (!response.ok) throw new Error("Could not cancel sale");
    },
    onSuccess: () => {
      showToast("Sale cancelled and stock restored");
      setCancelling(null);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (error) => showToast(error.message, "error"),
  });
  const recordPayment = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sales/${paying.sale_id}`, {
        method: "PATCH",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payment),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not record payment");
      return data;
    },
    onSuccess: () => {
      showToast("Payment recorded");
      setPaying(null);
      setPayment({ amount: "", paymentMethod: "cash", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (error) => showToast(error.message, "error"),
  });

  return (
    <>
      <div className="mb-5">
        <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Sales & Invoices</h1>
        <p className="t-muted text-sm">Paid, partial and credit invoices with permanent history.</p>
      </div>
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="lg:col-span-2"><SearchInput value={search} onChange={setSearch} placeholder="Customer, phone or invoice number" /></div>
          <DateInput value={fromDate} onChange={setFromDate} />
          <DateInput value={toDate} onChange={setToDate} />
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-3">
          <Select value={sort} onChange={setSort} options={SORT_OPTIONS} />
          <Metric label="Total" value={fmt(totals.amount)} />
          <Metric label="Received" value={fmt(totals.received)} />
          <Metric label="Balance" value={fmt(totals.balance)} />
          {canManage ? <Metric label="Profit" value={fmt(totals.profit)} /> : null}
        </div>
      </Card>
      {shopLoading || (!!shop && !role) ? (
        <Card className="py-12">
          <div className="text-center t-muted text-sm">Loading your shop...</div>
        </Card>
      ) : shopError ? (
        <Card className="text-center py-12">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--danger)" }} />
          <h2 className="t-text font-semibold">Could not load your shop</h2>
          <p className="t-muted text-sm mt-1">{shopError.message || "Try again."}</p>
          <Button className="mt-4" onClick={() => refetchShop()}>Retry</Button>
        </Card>
      ) : query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-52" />)}</div>
      ) : query.isError ? (
        <Card className="text-center py-12">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--danger)" }} />
          <h2 className="t-text font-semibold">Could not load sales</h2>
          <p className="t-muted text-sm mt-1">{query.error?.message || "The sales API did not return data."}</p>
          <Button className="mt-4" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? "Retrying..." : "Retry"}
          </Button>
        </Card>
      ) : sales.length === 0 ? (
        <Card className="text-center py-12">
          <Receipt className="w-12 h-12 t-dim2 mx-auto mb-3" />
          <h2 className="t-text font-semibold">No sales yet</h2>
          <p className="t-muted text-sm mt-1">Create your first bill and it will appear here.</p>
          <Link to="/billing"><Button className="mt-4">Create invoice</Button></Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sales.map((sale) => {
            const cancelled = sale.sale_status === "cancelled";
            const balance = Math.max(0, Number(sale.total_amount) - Number(sale.paid_amount || 0));
            const state = cancelled ? "Cancelled" : sale.payment_status;
            return (
              <Card key={sale.sale_id} className="flex flex-col gap-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="t-dim text-[10px] uppercase">Invoice</div>
                    <div className="t-text font-bold">{sale.receipt_number}</div>
                  </div>
                  <Badge tone={cancelled ? "danger" : state === "paid" ? "success" : state === "credit" ? "warning" : "accent"}>{state}</Badge>
                </div>
                <div>
                  <div className="t-text text-sm font-medium">{sale.buyer_name}</div>
                  <div className="t-dim text-xs">{sale.buyer_phone || "No phone"} / {new Date(sale.created_at).toLocaleDateString("en-IN")}</div>
                  <div className="t-muted text-xs capitalize">{(sale.payment_method || "cash").replace("_", " ")}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Metric label="Total" value={fmt(sale.total_amount)} />
                  <Metric label="Received" value={fmt(sale.paid_amount || 0)} />
                  <Metric label="Balance" value={fmt(balance)} />
                </div>
                <div className="flex gap-2 mt-auto">
                  <Link className="flex-1 t-btn-primary rounded-xl px-3 py-2 text-xs flex justify-center items-center gap-1" to={`/sales/${sale.sale_id}`}><Eye className="w-3.5 h-3.5" /> View</Link>
                  <Link className="t-btn rounded-xl px-2 py-2" title="Print" to={`/sales/${sale.sale_id}?print=1`}><Printer className="w-3.5 h-3.5" /></Link>
                  {!cancelled && balance > 0 ? <button className="t-btn rounded-xl px-2 py-2" title="Record payment" onClick={() => setPaying(sale)}><CircleDollarSign className="w-3.5 h-3.5" /></button> : null}
                  {canManage && !cancelled ? <button className="t-btn-danger rounded-xl px-2 py-2" title="Cancel sale" onClick={() => setCancelling(sale)}><Trash2 className="w-3.5 h-3.5" /></button> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={!!cancelling}
        title="Cancel sale?"
        message={cancelling ? `Invoice ${cancelling.receipt_number} remains in history and its stock will be returned.` : ""}
        destructive
        confirmText="Cancel Sale"
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling.sale_id)}
      />
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Record Payment">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); recordPayment.mutate(); }}>
          <div className="t-muted text-sm">{paying?.buyer_name} / Balance {fmt(Math.max(0, Number(paying?.total_amount || 0) - Number(paying?.paid_amount || 0)))}</div>
          <Input required type="number" min="0.01" step="0.01" placeholder="Amount received" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} />
          <Select value={payment.paymentMethod} onChange={(paymentMethod) => setPayment({ ...payment, paymentMethod })} options={PAYMENT_METHODS} />
          <Input placeholder="Notes (optional)" value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })} />
          <Button type="submit" className="w-full" disabled={recordPayment.isPending}>Save payment</Button>
        </form>
      </Modal>
    </>
  );
}

function DateInput({ value, onChange }) {
  return (
    <div className="t-input flex items-center gap-2 px-3 py-2">
      <Calendar className="w-4 h-4 t-dim" />
      <input className="bg-transparent outline-none t-text text-sm w-full" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="t-elev rounded-xl px-3 py-2 text-xs"><div className="t-dim">{label}</div><div className="t-text font-semibold truncate">{value}</div></div>;
}
