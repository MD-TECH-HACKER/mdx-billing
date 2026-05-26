import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, ConfirmDialog, Input, Modal, Select, Textarea } from "@/components/ui";
import { showToast } from "@/components/Toast";
import useShop from "@/utils/useShop";
import useUser from "@/utils/useUser";
import { formatMoney } from "@/utils/currency";
import { shopHeaders } from "@/utils/shopContext";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];
const EMPTY = { category: "", amount: "", expenseDate: "", vendor: "", paymentMethod: "cash", notes: "" };

export default function ExpensesPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const currency = shop?.currency || "INR";

  const query = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const response = await fetch("/api/expenses", { headers: shopHeaders() });
      if (!response.ok) throw new Error("Failed to load expenses");
      return response.json();
    },
    enabled: !!user,
  });
  const expenses = query.data?.expenses || [];
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Save failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setForm(EMPTY);
      setOpen(false);
      showToast("Expense recorded");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const remove = useMutation({
    mutationFn: async (expense) => {
      const response = await fetch(`/api/expenses?id=${expense.expense_id}`, {
        method: "DELETE",
        headers: shopHeaders(),
      });
      if (!response.ok) throw new Error();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setDeleting(null);
      showToast("Expense removed");
    },
    onError: () => showToast("Could not remove expense", "error"),
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Expenses</h1>
          <p className="t-muted text-sm">Record overheads and calculate net operating profit.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Record Expense
        </Button>
      </div>

      <Card className="mb-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl t-accent-soft flex items-center justify-center">
          <Wallet className="w-6 h-6" />
        </div>
        <div>
          <div className="t-dim text-xs">Recorded expense total</div>
          <div className="t-text font-bold text-2xl">{formatMoney(total, currency)}</div>
        </div>
      </Card>

      {expenses.length === 0 ? (
        <Card className="py-12 text-center">
          <Receipt className="w-11 h-11 t-dim2 mx-auto mb-3" />
          <div className="t-text font-semibold">No expenses recorded</div>
          <div className="t-muted text-sm mt-1">Add rent, utilities or other operating costs.</div>
        </Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <Card key={expense.expense_id} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="t-text font-medium">{expense.category}</div>
                <div className="t-dim text-xs">
                  {new Date(expense.expense_date).toLocaleDateString("en-IN")} / {expense.vendor || "No vendor"} / {expense.payment_method.replace("_", " ")}
                </div>
              </div>
              <div className="t-text font-semibold">{formatMoney(expense.amount, currency)}</div>
              <Button variant="danger" size="sm" onClick={() => setDeleting(expense)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Record expense">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <div className="grid grid-cols-2 gap-3">
            <Input required placeholder="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            <Input required type="number" min="0.01" step="0.01" placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} />
            <Select value={form.paymentMethod} onChange={(paymentMethod) => setForm({ ...form, paymentMethod })} options={METHODS} />
          </div>
          <Input placeholder="Vendor (optional)" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} />
          <Textarea rows={2} placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <Button className="w-full" type="submit" disabled={create.isPending}>
            {create.isPending ? "Saving..." : "Save expense"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete expense?"
        message={deleting ? `${deleting.category} will be removed from reporting.` : ""}
        destructive
        confirmText="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
      />
    </>
  );
}
