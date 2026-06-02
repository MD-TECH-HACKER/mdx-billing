import { useEffect } from "react";
import useAuth from "@/utils/useAuth";

export default function MobileLogin() {
  const { signInWithGoogle } = useAuth();

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const cb = params.get("callbackUrl") || "mdxbilling://auth";
    
    // Trigger Google Sign-in immediately
    signInWithGoogle({
      callbackUrl: cb,
      redirect: true,
    }).catch(err => {
      console.error("Mobile Google Login Error", err);
    });

    return () => {
      active = false;
    };
  }, [signInWithGoogle]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center prism-bg">
      <div className="text-center p-8">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-medium font-poppins t-text">Redirecting to Google...</h2>
      </div>
    </div>
  );
}
