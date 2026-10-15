import { useAdminSession } from "./useAdminSession";
import AdminLogin from "./AdminLogin";
import AdminPanel from "./AdminPanel";

export default function AdminRoute() {
  const { loading, admin } = useAdminSession();
  if (loading) return <div className="splash"><div className="spinner" /></div>;
  return admin ? <AdminPanel /> : <AdminLogin />;
}
