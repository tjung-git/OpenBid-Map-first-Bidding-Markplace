import { Navigate, Outlet } from "react-router-dom";
import { useSessionUser } from "../hooks/useSession";

export default function NonAdminRoute() {
  const user = useSessionUser();

  if (!user) return null;

  if (user.userType === "admin") {
    return <Navigate to="/admin-users" replace />;
  }

  return <Outlet />;
}