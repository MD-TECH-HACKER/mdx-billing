import { useEffect, useState } from "react";
import useAuth from "@/utils/useAuth";
import { Store } from "lucide-react";
import Turnstile from "@/components/Turnstile";

function SignInPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [securityReady, setSecurityReady] = useState(false);

  const { signInWithCredentials, signInWithGoogle } = useAuth();

  useEffect(() => {
    let active = true;
    fetch("/api/security/turnstile")
      .then((response) => response.json())
      .then((data) => {
        if (active) setTurnstileEnabled(data.enabled !== false);
      })
      .catch(() => {
        if (active) setTurnstileEnabled(true);
      })
      .finally(() => {
        if (active) setSecurityReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const verifySecurity = async () => {
    if (!securityReady) throw new Error("Security settings are loading. Please try again.");
    if (!turnstileEnabled) return;
    const response = await fetch("/api/security/turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: turnstileToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Security check failed");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      await verifySecurity();
      await signInWithCredentials({
        email,
        password,
        callbackUrl: "/",
        redirect: true,
      });
    } catch (err) {
      const errorMessages = {
        OAuthSignin: "Couldn't start sign-in. Please try another method.",
        OAuthCallback: "Sign-in failed after redirecting. Please try again.",
        CredentialsSignin:
          "Incorrect email or password. Try again or sign up first.",
        AccessDenied: "You don't have permission to sign in.",
        Configuration: "Sign-in isn't working right now. Try again later.",
      };

      setError(
        errorMessages[err.message] || "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await verifySecurity();
      await signInWithGoogle({
        callbackUrl: "/",
        redirect: true,
      });
    } catch (e) {
      console.error(e);
      setError(e.message || "Security check failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center px-4 py-10 font-inter">
      <div className="prism-bg" />

      <div className="w-full max-w-md p-8 t-card relative z-10">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-xl mb-4">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="t-text text-2xl font-bold font-poppins">
            Welcome Back
          </h1>
          <p className="t-muted text-sm mt-1">Sign in to MDX Billing</p>
        </div>

        {securityReady && turnstileEnabled ? (
          <div className="mb-4">
            <Turnstile
              onToken={setTurnstileToken}
              onError={(message) => setError(message)}
            />
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-2xl t-danger-bg px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <button
          onClick={handleGoogle}
          disabled={googleLoading || !securityReady}
          className="w-full t-btn rounded-2xl px-4 py-3.5 font-semibold flex items-center justify-center gap-3 transition disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
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
          {googleLoading ? "Loading..." : "Continue with Google"}
        </button>

        <p className="t-dim text-xs text-center mt-6">
          Don't have an account?{" "}
          <a
            href="/account/signup"
            className="t-accent-text hover:opacity-80 font-medium"
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default SignInPage;
