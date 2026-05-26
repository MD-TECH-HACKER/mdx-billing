import { useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import useAuth from "@/utils/useAuth";
import useUser from "@/utils/useUser";
import { setActiveShopId } from "@/utils/shopContext";
import ToastHost, { showToast } from "@/components/Toast";
import { Badge, Button, Card, AppLoader } from "@/components/ui";

function roleLabel(role) {
  return role === "manager" ? "Manager" : "Cashier";
}

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const { data: user, loading: userLoading } = useUser();
  const { signInWithGoogle } = useAuth();
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);

  useEffect(() => {
    if (token && typeof window !== "undefined") {
      sessionStorage.setItem("mdx_pending_invite_token", token);
    }
  }, [token]);

  const inviteQuery = useQuery({
    queryKey: ["invite-accept", token],
    queryFn: async () => {
      const response = await fetch(`/api/invite/accept?token=${encodeURIComponent(token)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Invitation could not be loaded");
      return data;
    },
    enabled: !!token,
  });

  const acceptInvite = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not accept invitation");
      return data;
    },
    onSuccess: (data) => {
      setActiveShopId(data.shopId);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("mdx_pending_invite_token");
      }
      showToast("Invitation accepted");
      navigate(data.redirectTo || (data.role === "cashier" ? "/billing" : "/dashboard"), { replace: true });
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const invite = inviteQuery.data?.invite;
  const currentEmail = (user?.email || "").toLowerCase();
  const invitedEmail = (invite?.invitedEmail || "").toLowerCase();
  const wrongEmail = !!user && !!invite && currentEmail !== invitedEmail;

  if (userLoading || inviteQuery.isLoading) {
    return <AppLoader fullScreen label="Opening invitation..." />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-10 font-inter">
      <ToastHost />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#fff7ed] via-[#f6f7fb] to-[#eef2ff]" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-orange-400/20 blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="MDX Billing" className="mx-auto w-16 h-16 rounded-full shadow-2xl object-cover" />
          <div className="mt-3 text-xs uppercase tracking-[0.2em] font-black" style={{ color: "var(--accent, #f97316)" }}>
            MDX Billing App
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black t-text font-poppins">Team Invitation</h1>
        </div>

        {inviteQuery.isError ? (
          <Card className="text-center py-10">
            <ShieldCheck className="w-12 h-12 mx-auto t-dim2 mb-3" />
            <h2 className="t-text font-bold text-lg">Invitation unavailable</h2>
            <p className="t-muted text-sm mt-1">{inviteQuery.error.message}</p>
          </Card>
        ) : invite?.status !== "pending" ? (
          <Card className="text-center py-10">
            <ShieldCheck className="w-12 h-12 mx-auto t-dim2 mb-3" />
            <h2 className="t-text font-bold text-lg">Invitation is {invite?.status || "invalid"}</h2>
            <p className="t-muted text-sm mt-1">Ask the shop owner to send a fresh invitation.</p>
          </Card>
        ) : !user ? (
          <Card className="text-center py-8">
            {invite.shopLogo ? (
              <img src={invite.shopLogo} alt={invite.shopName} className="mx-auto w-16 h-16 rounded-2xl object-cover border t-border mb-4" />
            ) : (
              <div className="mx-auto w-16 h-16 rounded-2xl t-accent-soft flex items-center justify-center mb-4">
                <Mail className="w-7 h-7" />
              </div>
            )}
            <h2 className="t-text text-xl font-bold">Login to accept invitation</h2>
            <p className="t-muted text-sm mt-2">
              This invitation is for <strong className="t-text">{invite.invitedEmail}</strong>.
              Use the same Google account email to accept.
            </p>
            <Button
              className="w-full mt-5"
              onClick={() => signInWithGoogle({ callbackUrl: window.location.href })}
            >
              Continue with Google
            </Button>
            <a
              className="inline-flex mt-3 t-accent-text text-sm font-semibold"
              href={`/account/signin?callbackUrl=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
            >
              Open login page
            </a>
          </Card>
        ) : wrongEmail ? (
          <Card className="text-center py-10">
            <ShieldCheck className="w-12 h-12 mx-auto t-dim2 mb-3" />
            <h2 className="t-text font-bold text-lg">Wrong account</h2>
            <p className="t-muted text-sm mt-1">
              This invitation is for {invite.invitedEmail}. Please login using that email.
            </p>
            <a href="/account/logout" className="inline-flex mt-5 t-btn px-4 py-2 rounded-xl text-sm">
              Sign out
            </a>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-center gap-4">
              {invite.shopLogo ? (
                <img src={invite.shopLogo} alt={invite.shopName} className="w-16 h-16 rounded-2xl object-cover border t-border" />
              ) : (
                <div className="w-16 h-16 rounded-2xl t-accent-soft flex items-center justify-center text-xl font-black">
                  {(invite.shopName || "S")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="t-text text-xl font-black truncate">{invite.shopName}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{roleLabel(invite.role)}</Badge>
                  <Badge tone="neutral">Invited by {invite.inviterName || "Owner"}</Badge>
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-2xl t-elev p-4 text-sm">
              <div className="flex items-center gap-2 t-text font-semibold">
                <CheckCircle2 className="w-4 h-4 t-accent-text" />
                Access details
              </div>
              <p className="t-muted mt-2">
                Accepting this invitation will add {user.email} as a {roleLabel(invite.role)} for this shop.
              </p>
            </div>
            <Button
              className="w-full mt-5"
              onClick={() => acceptInvite.mutate()}
              disabled={acceptInvite.isPending}
            >
              {acceptInvite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Accept Invitation
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
