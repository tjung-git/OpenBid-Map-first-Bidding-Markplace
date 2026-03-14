import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSessionUser } from "../hooks/useSession";

export default function NonAdminRoute() {
  const user = useSessionUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.userType === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
