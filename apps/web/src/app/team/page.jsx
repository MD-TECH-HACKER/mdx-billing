import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield, UserCog } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Input, Modal, Select } from "@/components/ui";
import { showToast } from "@/components/Toast";
import useShop from "@/utils/useShop";
import useUser from "@/utils/useUser";
import { shopHeaders } from "@/utils/shopContext";

const ROLES = [
  { value: "manager", label: "Manager - operations and analytics" },
  { value: "cashier", label: "Cashier - billing and customers" },
];

export default function TeamPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [form, setForm] = useState({ email: "", role: "cashier" });

  const query = useQuery({
    queryKey: ["team", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/team", { headers: shopHeaders() });
      if (!response.ok) throw new Error("Team access is owner-only");
      return response.json();
    },
    enabled: !!user && !!shop?.shop_id,
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not add member");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setForm({ email: "", role: "cashier" });
      setOpen(false);
      showToast("Team member added");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const updateMember = async (member, role, status = member.status) => {
    const response = await fetch("/api/team", {
      method: "PUT",
      headers: shopHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ membershipId: member.membership_id, role, status }),
    });
    if (response.ok) {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      showToast("Access updated");
    } else {
      showToast("Could not update access", "error");
    }
  };

  const removeMember = useMutation({
    mutationFn: async (member) => {
      const response = await fetch(`/api/team?id=${encodeURIComponent(member.membership_id)}`, {
        method: "DELETE",
        headers: shopHeaders(),
      });
      if (!response.ok) throw new Error();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setRemoving(null);
      showToast("Member removed");
    },
    onError: () => showToast("Could not remove member", "error"),
  });

  const members = query.data?.members || [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Team Access</h1>
          <p className="t-muted text-sm">Assign fixed roles. Only the owner can change access.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Add Member
        </Button>
      </div>

      <Card className="mb-4">
        <div className="flex items-start gap-3 text-sm">
          <Shield className="w-5 h-5 mt-0.5 t-accent-text" />
          <div>
            <div className="t-text font-medium">Least-privilege roles</div>
            <p className="t-muted mt-1">
              Managers manage stock, purchases, expenses and analytics. Cashiers bill customers and view receipts without cost or profit data.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {members.length === 0 ? (
          <Card className="py-12 text-center">
            <UserCog className="w-12 h-12 t-dim2 mx-auto mb-3" />
            <div className="t-text font-semibold">No staff accounts assigned</div>
            <div className="t-muted text-sm mt-1">Add a registered user by email.</div>
          </Card>
        ) : members.map((member) => (
          <Card key={member.membership_id} className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="w-11 h-11 rounded-xl t-accent-soft flex items-center justify-center">
              <UserCog className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="t-text font-medium">{member.display_name || member.name || "Staff member"}</div>
              <div className="t-muted text-xs flex items-center gap-1">
                <Mail className="w-3 h-3" /> {member.email}
              </div>
            </div>
            <Badge tone={member.status === "active" ? "success" : "warning"}>{member.status}</Badge>
            <div className="w-full md:w-64">
              <Select value={member.role} onChange={(role) => updateMember(member, role)} options={ROLES} />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateMember(member, member.role, member.status === "active" ? "disabled" : "active")}
            >
              {member.status === "active" ? "Disable" : "Enable"}
            </Button>
            <Button variant="danger" size="sm" onClick={() => setRemoving(member)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add team member">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            addMember.mutate();
          }}
        >
          <Input type="email" required placeholder="Registered account email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Select value={form.role} onChange={(role) => setForm({ ...form, role })} options={ROLES} />
          <p className="t-dim text-xs">The person must already have an MDX Billing account. Invitations never create accounts automatically.</p>
          <Button className="w-full" type="submit" disabled={addMember.isPending}>
            {addMember.isPending ? "Adding..." : "Grant access"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!removing}
        title="Remove team access?"
        message={removing ? `${removing.email} will no longer access this shop.` : ""}
        destructive
        confirmText="Remove"
        onClose={() => setRemoving(null)}
        onConfirm={() => removeMember.mutate(removing)}
      />
    </>
  );
}
