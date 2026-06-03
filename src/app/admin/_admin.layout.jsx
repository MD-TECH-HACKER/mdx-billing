import { Outlet, redirect, useLoaderData, useNavigation } from "react-router";
import { auth } from "@/auth";
import { isAdmin } from "@/utils/adminAccess";
import AdminProtectedRoute from "@/components/admin/AdminProtectedRoute";
import AdminSidebar from "@/components/admin/AdminSidebar";

export async function loader({ request }) {
  const session = await auth();
  
  if (!session || !session.user) {
    throw redirect("/account/signin");
  }

  const isUserAdmin = isAdmin(session);
  
  if (!isUserAdmin) {
    // Strict server-side redirect for non-admins to prevent any data exposure
    throw redirect("/dashboard");
  }

  return { isAdmin: isUserAdmin };
}

export default function AdminLayout() {
  const { isAdmin } = useLoaderData();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  return (
    <AdminProtectedRoute isAdmin={isAdmin} isLoading={isLoading}>
      <div 
        style={{ 
          display: "flex", 
          minHeight: "100vh", 
          width: "100vw",
          background: "var(--bg-body, #F9FAFB)",
          color: "var(--text, #111827)",
          fontFamily: "'Inter', 'Poppins', sans-serif"
        }}
      >
        <AdminSidebar />
        <main 
          style={{ 
            flex: 1, 
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflowY: "auto", 
            overflowX: "hidden",
            padding: "24px",
            height: "100vh"
          }}
        >
          <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
            <Outlet />
          </div>
        </main>
      </div>
    </AdminProtectedRoute>
  );
}
