import { Navigate, useLocation } from "react-router-dom";
import { getSession } from "../services/session";
import App from "../App.jsx";

export default function ProtectedApp() {
  const session = getSession();
  const location = useLocation();

  if (!session?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <App />;
}
