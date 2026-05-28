import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";

/**
 * AdminProtectedRoute
 * 
 * Protects admin routes on the frontend by ensuring the user is an admin.
 * Note: Real security is enforced server-side via loaders and APIs. This component
 * provides a seamless UX, loading state, and fallback redirect.
 * 
 * @param {Object} props
 * @param {boolean} props.isAdmin - Boolean flag from server loader indicating admin status
 * @param {boolean} props.isLoading - Whether admin status is still being checked
 * @param {React.ReactNode} props.children - Admin content to render
 */
export default function AdminProtectedRoute({ isAdmin, isLoading, children }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      // Secure redirect for non-admin without showing any admin UI
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--bg-surface, #ffffff)",
        color: "var(--text, #111827)"
      }}>
        <Loader2 style={{ width: 32, height: 32, animation: "spin 1s linear infinite", color: "#F97316" }} />
        <p style={{ marginTop: 16, fontSize: "14px", fontWeight: 500, color: "var(--text-dim, #6B7280)" }}>
          Verifying secure access...
        </p>
      </div>
    );
  }

  // Do not render anything if not admin to prevent UI flashing
  if (!isAdmin) {
    return null;
  }

  return children;
}
