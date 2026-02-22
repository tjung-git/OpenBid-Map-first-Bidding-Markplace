import { Navigate, Outlet } from "react-router-dom";
import useSessionUser from "../hooks/useSessionUser";

export default function AdminRoute() {
  const user = useSessionUser();

  if (!user) return null;

  if (user.userType !== "admin") {
    return <Navigate to="/jobs" replace />;
  }

  return <Outlet />;
}