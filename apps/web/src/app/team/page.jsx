import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Mail,
  Plus,
  Send,
  Shield,
  Trash2,
  UserCog,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Input, Modal, Select } from "@/components/ui";
import { showToast } from "@/components/Toast";
import useShop from "@/utils/useShop";
import useUser from "@/utils/useUser";
import { shopHeaders } from "@/utils/shopContext";

const ROLES = [
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
];

const ROLE_HELP = {
  manager: "Products, stock, purchases, expenses, customers, receipts and analytics.",
  cashier: "Billing, receipts and basic customer access without costs or profit.",
};

function roleTone(role) {
  return role === "manager" ? "accent" : "neutral";
}

function roleLabel(role) {
  return role === "manager" ? "Manager" : "Cashier";
}

function dateText(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-IN");
}

export default function TeamPage() {
  const { data: user } = useUser();
  const { shop } = useShop({ enabled: !!user });
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", role: "cashier" });

  const query = useQuery({
    queryKey: ["team", shop?.shop_id],
    queryFn: async () => {
      const response = await fetch("/api/team", { headers: shopHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Team access is owner-only");
      return data;
    },
    enabled: !!user && !!shop?.shop_id,
  });

  const inviteMember = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not send invitation");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setForm({ name: "", email: "", role: "cashier" });
      setOpen(false);
      showToast(data.emailSent ? "Team invitation sent" : data.emailError || "Invitation saved");
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
      const data = await response.json().catch(() => ({}));
      showToast(data.error || "Could not update access", "error");
    }
  };

  const removeMember = useMutation({
    mutationFn: async (member) => {
      const response = await fetch(`/api/team?id=${encodeURIComponent(member.membership_id)}`, {
        method: "DELETE",
        headers: shopHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not remove member");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setRemoving(null);
      showToast("Member removed");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const resendInvite = useMutation({
    mutationFn: async (invite) => {
      const response = await fetch(`/api/team/invitations/${invite.invite_id}`, {
        method: "POST",
        headers: shopHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ action: "resend" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not resend invite");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      showToast(data.emailSent ? "Invitation resent" : data.emailError || "Invitation updated");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const cancelInvite = useMutation({
    mutationFn: async (invite) => {
      const response = await fetch(`/api/team/invitations/${invite.invite_id}`, {
        method: "DELETE",
        headers: shopHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not cancel invite");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setCancelling(null);
      showToast("Invitation cancelled");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const members = query.data?.members || [];
  const invitations = query.data?.invitations || [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="t-text text-2xl md:text-3xl font-bold font-poppins">Team Access</h1>
          <p className="t-muted text-sm">Invite staff by email. Only the owner can manage roles.</p>
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
              Managers manage operations and analytics. Cashiers bill customers and view receipts without cost or profit data.
              The staff email does not need to already have an MDX account; the invite link will ask them to log in with the same email.
            </p>
          </div>
        </div>
      </Card>

      {query.isError ? (
        <Card className="py-12 text-center">
          <Shield className="w-12 h-12 t-dim2 mx-auto mb-3" />
          <div className="t-text font-semibold">Team access is owner-only</div>
          <div className="t-muted text-sm mt-1">{query.error.message}</div>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="t-text font-bold">Existing members</h2>
                <p className="t-muted text-xs">Active staff accounts assigned to this shop.</p>
              </div>
              <Badge tone="neutral">{members.length} members</Badge>
            </div>

            {members.length === 0 ? (
              <div className="py-10 text-center">
                <UserCog className="w-12 h-12 t-dim2 mx-auto mb-3" />
                <div className="t-text font-semibold">No staff accounts assigned</div>
                <div className="t-muted text-sm mt-1">Send an invitation to add a manager or cashier.</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="hidden lg:grid grid-cols-[1.5fr_1.8fr_1fr_0.8fr_1fr_1.8fr] gap-3 px-3 py-2 text-[11px] uppercase tracking-wide t-dim">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span>Joined Date</span>
                  <span className="text-right">Actions</span>
                </div>
                {members.map((member) => (
                  <div
                    key={member.membership_id}
                    className="grid grid-cols-1 lg:grid-cols-[1.5fr_1.8fr_1fr_0.8fr_1fr_1.8fr] gap-3 items-center rounded-2xl t-elev border t-border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {member.image ? (
                        <img src={member.image} alt={member.name || member.email} className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl t-accent-soft flex items-center justify-center">
                          <UserCog className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="t-text font-semibold truncate">{member.display_name || member.name || "Staff member"}</div>
                        <div className="lg:hidden t-muted text-xs truncate">{member.email}</div>
                      </div>
                    </div>
                    <div className="hidden lg:flex t-muted text-xs items-center gap-1 min-w-0">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    <Select value={member.role} onChange={(role) => updateMember(member, role)} options={ROLES} />
                    <Badge tone={member.status === "active" ? "success" : "warning"}>{member.status}</Badge>
                    <div className="t-muted text-xs">{dateText(member.created_at)}</div>
                    <div className="flex flex-wrap lg:justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateMember(member, member.role, member.status === "active" ? "disabled" : "active")}
                      >
                        {member.status === "active" ? "Disable" : "Enable"}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setRemoving(member)}>
                        <Trash2 className="w-4 h-4" /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="t-text font-bold">Pending invitations</h2>
                <p className="t-muted text-xs">Invites expire automatically and can be resent securely.</p>
              </div>
              <Badge tone="accent">{invitations.length} pending</Badge>
            </div>

            {invitations.length === 0 ? (
              <div className="py-8 text-center t-muted text-sm">No pending invitations.</div>
            ) : (
              <div className="space-y-2">
                {invitations.map((invite) => (
                  <div key={invite.invite_id} className="rounded-2xl t-elev border t-border p-3 flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl t-accent-soft flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="t-text font-semibold truncate">{invite.invited_name || "Invited staff"}</div>
                      <div className="t-muted text-xs truncate">{invite.invited_email}</div>
                      <div className="t-dim text-xs mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Expires {dateText(invite.expires_at)}</span>
                        <span>Invited {dateText(invite.created_at)}</span>
                      </div>
                    </div>
                    <Badge tone={roleTone(invite.role)}>{roleLabel(invite.role)}</Badge>
                    <Badge tone={invite.status === "pending" ? "warning" : "danger"}>{invite.status}</Badge>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => resendInvite.mutate(invite)}
                        disabled={resendInvite.isPending}
                      >
                        <Send className="w-4 h-4" /> Resend invite
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setCancelling(invite)}>
                        <XCircle className="w-4 h-4" /> Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Invite team member">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            inviteMember.mutate();
          }}
        >
          <div>
            <label className="block t-muted text-xs mb-1">Staff name</label>
            <Input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Staff name"
            />
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Email</label>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="staff@example.com"
            />
            <p className="t-dim text-xs mt-1">
              Send to the staff email now. They can create/login after opening the invite.
            </p>
          </div>
          <div>
            <label className="block t-muted text-xs mb-1">Role</label>
            <Select value={form.role} onChange={(role) => setForm({ ...form, role })} options={ROLES} />
            <p className="t-dim text-xs mt-2">{ROLE_HELP[form.role]}</p>
          </div>
          <Button className="w-full" type="submit" disabled={inviteMember.isPending}>
            {inviteMember.isPending ? "Sending..." : "Send invitation"}
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
      <ConfirmDialog
        open={!!cancelling}
        title="Cancel invitation?"
        message={cancelling ? `${cancelling.invited_email} will not be able to use this invite link.` : ""}
        destructive
        confirmText="Cancel invite"
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelInvite.mutate(cancelling)}
      />
    </>
  );
}
