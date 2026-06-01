import useAuth from "@/utils/useAuth";
import { clearActiveShopId } from "@/utils/shopContext";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

function LogoutPage() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const handleSignOut = async () => {
    queryClient.clear();
    clearActiveShopId();
    await signOut({ callbackUrl: "/", redirect: true });
  };
  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center px-4 font-inter">
      <div className="prism-bg" />

      <div className="w-full max-w-md p-8 t-card text-center relative z-10">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center mb-4">
          <LogOut className="w-7 h-7 text-white" />
        </div>
        <h1 className="t-text text-2xl font-bold mb-2">Sign Out</h1>
        <p className="t-muted text-sm mb-6">
          Are you sure you want to sign out?
        </p>
        <div className="flex gap-3">
          <a
            href="/dashboard"
            className="flex-1 t-btn rounded-2xl px-4 py-3 font-medium flex items-center justify-center transition"
          >
            Cancel
          </a>
          <button
            onClick={handleSignOut}
            className="flex-1 t-btn-danger rounded-2xl px-4 py-3 font-semibold transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogoutPage;
