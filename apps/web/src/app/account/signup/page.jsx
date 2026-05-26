import { useState } from "react";
import useAuth from "@/utils/useAuth";
import { Store } from "lucide-react";

function SignUpPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { signUpWithCredentials, signInWithGoogle } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      await signUpWithCredentials({
        email,
        password,
        callbackUrl: "/",
        redirect: true,
      });
    } catch (err) {
      const errorMessages = {
        EmailCreateAccount: "This email is already registered. Try signing in.",
        CredentialsSignin:
          "Invalid email or password. If you already have an account, sign in instead.",
        AccessDenied: "You don't have permission to sign up.",
        Configuration: "Sign-up isn't working right now. Try again later.",
      };

      setError(
        errorMessages[err.message] || "Something went wrong. Please try again.",
      );
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle({
        callbackUrl: "/",
        redirect: true,
      });
    } catch (e) {
      console.error(e);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center px-4 py-10 font-inter">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-violet-600/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-fuchsia-500/30 blur-3xl" />
      </div>

      <div className="w-full max-w-md rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-xl mb-4">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold font-poppins">
            Create Account
          </h1>
          <p className="text-white/60 text-sm mt-1">
            Start managing your shop today
          </p>
        </div>

        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-white/80 text-sm mb-1.5">Email</label>
            <input
              required
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 outline-none focus:border-violet-400 focus:bg-white/15 transition"
            />
          </div>

          <div>
            <label className="block text-white/80 text-sm mb-1.5">
              Password
            </label>
            <input
              required
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 outline-none focus:border-violet-400 focus:bg-white/15 transition"
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-red-500/20 border border-red-400/30 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-2xl px-4 py-3.5 font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/15" />
          <span className="text-white/40 text-xs">or</span>
          <div className="flex-1 h-px bg-white/15" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full bg-white text-gray-800 rounded-2xl px-4 py-3.5 font-semibold flex items-center justify-center gap-3 hover:bg-gray-100 transition disabled:opacity-60"
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

        <p className="text-white/50 text-xs text-center mt-6">
          Already have an account?{" "}
          <a
            href="/account/signin"
            className="text-violet-300 hover:text-violet-200 font-medium"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

export default SignUpPage;
