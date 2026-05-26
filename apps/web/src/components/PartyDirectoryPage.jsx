import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { Button, Card, ConfirmDialog, Input, Modal, SearchInput, Textarea } from "@/components/ui";
import { showToast } from "@/components/Toast";
import useShop from "@/utils/useShop";
import useUser from "@/utils/useUser";
import { formatMoney } from "@/utils/currency";
import { shopHeaders } from "@/utils/shopContext";

const EMPTY_PARTY = {
  name: "",
  phone: "",
  email: "",
  gstin: "",
  address: "",
  openingBalance: "",
  notes: "",
};

export default function PartyDirectoryPage({
  endpoint,
  title,
  singular,
  currentPath,
  description,
  allowedRoles,
}) {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_PARTY);
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: [endpoint, search],
    queryFn: async () => {
      const suffix = search ? `?search=${encodeURIComponent(search)}` : "";
      const response = await fetch(`/api/${endpoint}${suffix}`, { headers: shopHeaders() });
      if (!response.ok) throw new Error(`Failed to load ${title.toLowerCase()}`);
      return response.json();
    },
    enabled: !!user,
  });
  const records = query.data?.[endpoint] || [];
  const currency = shop?.currency || "INR";

  const save = useMutation({
    mutationFn: async (payload) => {
      const url = editing
        ? `/api/${endpoint}/${editing[`${singular.toLowerCase()}_id`]}`
        : `/api/${endpoint}`;
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Save failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      showToast(`${singular} saved`);
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_PARTY);
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const remove = useMutation({
    mutationFn: async (record) => {
      const id = record[`${singular.toLowerCase()}_id`];
      const response = await fetch(`/api/${endpoint}/${id}`, {
        method: "DELETE",
        headers: shopHeaders(),
      });
      if (!response.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setDeleting(null);
      showToast(`${singular} removed`);
    },
    onError: () => showToast("Delete failed", "error"),
  });

  const startCreate = () => {
    setEditing(null);
    setForm(EMPTY_PARTY);
    setOpen(true);
  };

  const startEdit = (record) => {
    setEditing(record);
    setForm({
      name: record.name || "",
      phone: record.phone || "",
      email: record.email || "",
      gstin: record.gstin || "",
      address: record.address || "",
      openingBalance: String(record.opening_balance || ""),
      notes: record.notes || "",
    });
    setOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">{title}</h1>
          <p className="t-muted text-sm">{description}</p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="w-4 h-4" /> Add {singular}
        </Button>
      </div>

      <Card className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Search ${title.toLowerCase()} by name or phone...`}
        />
      </Card>

      {records.length === 0 && !query.isLoading ? (
        <Card className="py-12 text-center">
          <UserRound className="w-11 h-11 mx-auto mb-3 t-dim2" />
          <h2 className="t-text font-semibold">No {title.toLowerCase()} yet</h2>
          <p className="t-muted text-sm mt-1">Create the first {singular.toLowerCase()} record for this shop.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {records.map((record) => (
            <Card key={record[`${singular.toLowerCase()}_id`]} className="flex flex-col gap-3">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <div className="t-text font-semibold truncate">{record.name}</div>
                  <div className="t-dim text-xs truncate">{record.email || "No email recorded"}</div>
                </div>
                <div className="t-accent-soft rounded-xl px-2.5 py-1 h-fit text-xs font-medium">
                  Due: {formatMoney(record.credit_balance ?? record.balance_due ?? record.opening_balance ?? 0, currency)}
                </div>
              </div>
              <div className="space-y-1 text-xs t-muted">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  {record.phone || "No phone"}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{record.address || "No address"}</span>
                </div>
              </div>
              {record.gstin ? <div className="t-elev rounded-xl px-3 py-2 t-muted text-xs">GSTIN: {record.gstin}</div> : null}
              {endpoint === "customers" ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Purchases" value={formatMoney(record.total_purchases || 0, currency)} />
                  <Stat label="Paid" value={formatMoney(record.total_paid || 0, currency)} />
                  <Stat label="Invoices" value={record.invoice_count || 0} />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Purchases" value={formatMoney(record.total_purchase_amount || 0, currency)} />
                  <Stat label="Paid" value={formatMoney(record.amount_paid || 0, currency)} />
                  <Stat label="Bills" value={record.purchase_count || 0} />
                </div>
              )}
              {record.last_purchase_date ? <div className="t-dim text-xs">Last purchase: {new Date(record.last_purchase_date).toLocaleDateString("en-IN")}</div> : null}
              <div className="flex gap-2 mt-auto">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => startEdit(record)}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleting(record)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={`${editing ? "Edit" : "Add"} ${singular}`}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(form);
          }}
        >
          <Input required value={form.name} placeholder={`${singular} name`} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input value={form.phone} placeholder="Phone" onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            <Input type="email" value={form.email} placeholder="Email" onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input value={form.gstin} placeholder="GSTIN (optional)" onChange={(event) => setForm({ ...form, gstin: event.target.value })} />
            <Input type="number" step="0.01" value={form.openingBalance} placeholder="Opening balance" onChange={(event) => setForm({ ...form, openingBalance: event.target.value })} />
          </div>
          <Textarea rows={2} value={form.address} placeholder="Address" onChange={(event) => setForm({ ...form, address: event.target.value })} />
          <Textarea rows={2} value={form.notes} placeholder="Notes" onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending ? "Saving..." : `Save ${singular}`}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Remove ${singular.toLowerCase()}?`}
        message={deleting ? `${deleting.name} will be removed from this shop.` : ""}
        destructive
        confirmText="Remove"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting)}
      />
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="t-elev rounded-xl px-2 py-2">
      <div className="t-dim text-[10px]">{label}</div>
      <div className="t-text font-semibold truncate">{value}</div>
    </div>
  );
}
