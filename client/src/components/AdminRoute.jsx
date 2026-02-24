import { Navigate, Outlet } from "react-router-dom";
import { useSessionUser } from "../hooks/useSession";

export default function AdminRoute() {
  const user = useSessionUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // if (user.userType !== "admin") {
  //   return <Navigate to="/jobs" replace />;
  // }

  return <Outlet />;
}