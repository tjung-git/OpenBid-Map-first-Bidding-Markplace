import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { startInactivityMonitor, logout } from "../services/session";
import { useSession } from "../hooks/useSession";
import App from "../App.jsx";

export default function ProtectedApp() {
  const session = useSession();
  const location = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    if (!session?.user) return undefined;
    const stop = startInactivityMonitor(() => {
      logout();
      nav("/login", {
        replace: true,
        state: { notice: "Session expired after inactivity." },
      });
    });
    return stop;
  }, [session?.user, nav]);

  if (!session?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <App />;
}
