import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Sparkles,
  ArrowRight,
  ShoppingBag,
  Receipt,
  BarChart3,
  ShieldCheck,
  Package,
  Smartphone,
  Zap,
  Printer,
  Cloud,
  Check,
} from "lucide-react";
import useUser from "@/utils/useUser";
import useAuth from "@/utils/useAuth";
import { setActiveShopId, shopHeaders } from "@/utils/shopContext";
import { redirect } from "react-router";

export async function action() {
  return redirect("/");
}

export default function WelcomePage() {
  const { data: user, loading } = useUser();
  const [checking, setChecking] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    setChecking(true);
    fetch("/api/shop/active", { headers: shopHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const pendingInviteToken =
          typeof window !== "undefined"
            ? sessionStorage.getItem("mdx_pending_invite_token")
            : null;
        if (pendingInviteToken) {
          navigate(`/invite/accept?token=${encodeURIComponent(pendingInviteToken)}`, { replace: true });
          return;
        }
        const shops = d.shops || [];
        if (shops.length === 0) {
          navigate("/setup-shop", { replace: true });
        } else {
          // One or more shops — always show select-shop screen so user can pick or create new
          navigate("/select-shop", { replace: true });
        }
      })
      .catch(() => setChecking(false));
  }, [user, loading, navigate]);

  const goSignIn = () =>
    (window.location.href = `/account/signin?callbackUrl=${encodeURIComponent("/")}`);
  const goSignUp = () =>
    (window.location.href = `/account/signup?callbackUrl=${encodeURIComponent("/")}`);
  const goGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle({ callbackUrl: "/", redirect: true });
    } catch {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="welcome-page min-h-screen w-full relative font-inter">
      <div className="prism-bg" />
      {/* Floating glows */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden hidden" data-theme-only="glass">
        <div className="absolute top-0 -left-32 w-[600px] h-[600px] rounded-full bg-violet-600/30 blur-3xl animate-pulse" />
        <div className="absolute -top-20 right-0 w-[500px] h-[500px] rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[700px] h-[700px] rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      {/* Top nav */}
      <header className="relative z-10 px-4 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 t-text">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <span className="font-poppins font-bold text-lg">MDX Billing</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goSignIn}
            disabled={loading || checking}
            className="hidden sm:inline-flex t-muted hover:t-text text-sm font-medium px-3 py-2"
          >
            Sign in
          </button>
          <button
            onClick={goSignUp}
            disabled={loading || checking}
            className="t-btn px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
          >
            Get started
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-4 md:px-8 pt-6 md:pt-12 pb-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-8 items-center">
          <div className="t-text space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full t-elev border t-border backdrop-blur-md text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
              Premium Shop Billing · ₹ INR ready
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-poppins leading-[1.05]">
              <span className="bg-gradient-to-r from-[var(--accent)] to-fuchsia-500 bg-clip-text text-transparent">
                Bill faster.
              </span>
              <br />
              <span className="t-text">Grow smarter.</span>
            </h1>
            <p className="t-muted text-base md:text-lg max-w-md mx-auto md:mx-0 leading-relaxed">
              The all-in-one billing app for modern shops. Manage inventory,
              generate printable receipts, and track real profit — all in one
              beautiful place.
            </p>

            <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-2">
              <button
                onClick={goSignUp}
                disabled={loading || checking}
                className="t-btn-primary rounded-2xl px-6 py-3.5 font-semibold flex items-center gap-2 shadow-xl disabled:opacity-60"
              >
                Start free
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={goGoogle}
                disabled={loading || checking || googleLoading}
                className="t-btn rounded-2xl px-6 py-3.5 font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {googleLoading ? "Opening Google..." : "Continue with Google"}
              </button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 justify-center md:justify-start pt-3 t-dim text-xs">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" /> Free to start
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" /> No credit
                card
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-500" /> Your data,
                isolated
              </span>
            </div>
          </div>

          {/* Right: dashboard mockup */}
          <div className="relative min-w-0 w-full max-w-full">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 blur-2xl" />
            <div className="relative rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 p-2 shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img 
                src="/preview.png" 
                alt="MDX Billing Dashboard Preview" 
                className="block w-full max-w-full h-auto rounded-2xl relative z-10 shadow-inner transform transition-transform duration-700 group-hover:scale-[1.02]"
                style={{ display: "block", width: "100%", maxWidth: "100%", height: "auto" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-4 md:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="t-text text-2xl md:text-3xl font-bold font-poppins text-center mb-2">
            Everything your shop needs
          </h2>
          <p className="t-muted text-center max-w-xl mx-auto mb-10 text-sm md:text-base">
            From the first sale to your hundredth — built to keep up.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {[
              {
                Icon: Package,
                title: "Smart inventory",
                desc: "Stock tracking, low-stock alerts, and live cost/profit per product.",
              },
              {
                Icon: Receipt,
                title: "Printable receipts",
                desc: "Beautiful colour or black-&-white printable receipts. A4 or thermal.",
              },
              {
                Icon: BarChart3,
                title: "Real analytics",
                desc: "Daily revenue, profit, best-sellers and product margin tables.",
              },
              {
                Icon: ShoppingBag,
                title: "Frictionless billing",
                desc: "Add to cart, set quantity, and save bills in seconds with auto-stock updates.",
              },
              {
                Icon: Printer,
                title: "INR-first, multi-currency",
                desc: "Defaults to ₹. Switch to USD, EUR, AED and more in settings.",
              },
              {
                Icon: ShieldCheck,
                title: "Private by default",
                desc: "Your data is isolated per account. Only you can see your sales.",
              },
              {
                Icon: Smartphone,
                title: "Mobile-friendly",
                desc: "Bill on your phone, tablet or PC — bottom nav and slide-up cart.",
              },
              {
                Icon: Cloud,
                title: "Backup & export",
                desc: "Export full JSON backup any time. Google Drive sync coming soon.",
              },
              {
                Icon: Zap,
                title: "Fast & themed",
                desc: "Light, Dark, and Glass themes with accent colours. Persists across devices.",
              },
            ].map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl t-card p-5 transition"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center mb-3 shadow-lg">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="t-text font-semibold mb-1">{title}</h3>
                <p className="t-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-4 md:px-8 pb-20">
        <div className="max-w-4xl mx-auto rounded-3xl t-card p-8 md:p-12 text-center">
          <h2 className="t-text text-2xl md:text-3xl font-bold font-poppins mb-3">
            Ready to run your shop better?
          </h2>
          <p className="t-muted max-w-xl mx-auto mb-6 text-sm md:text-base">
            Sign up free and have your shop set up in under a minute.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={goSignUp}
              disabled={loading || checking}
              className="t-btn-primary px-6 py-3.5 font-semibold flex items-center gap-2 shadow-xl disabled:opacity-60"
            >
              Create account
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={goSignIn}
              disabled={loading || checking}
              className="t-btn px-6 py-3.5 font-semibold disabled:opacity-60"
            >
              I already have an account
            </button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-4 md:px-8 pb-10 text-center t-dim2 text-xs">
        © {new Date().getFullYear()} MDX Billing · Built for shop owners
      </footer>
    </div>
  );
}
