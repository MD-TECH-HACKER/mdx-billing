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
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-violet-600/40 blur-3xl" />
      </div>
      <div className="w-full max-w-md rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 p-8 shadow-2xl text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center mb-4">
          <LogOut className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-white text-2xl font-bold mb-2">Sign Out</h1>
        <p className="text-white/60 text-sm mb-6">
          Are you sure you want to sign out?
        </p>
        <div className="flex gap-3">
          <a
            href="/dashboard"
            className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-2xl px-4 py-3 font-medium transition"
          >
            Cancel
          </a>
          <button
            onClick={handleSignOut}
            className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl px-4 py-3 font-semibold hover:opacity-90 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogoutPage;
