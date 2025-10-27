import { useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
} from "@carbon/react";
import { Logout, Map } from "@carbon/icons-react";
import { logout } from "./services/session";
import { useSessionUser } from "./hooks/useSession";
import Nav from "./components/Nav";
import "./styles/components/header.css";

export default function App() {
  const nav = useNavigate();
  const user = useSessionUser();

  const greetingName = user?.firstName || user?.name || "Guest";
  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "";
  const userType = user?.userType
    ? user.userType.charAt(0).toUpperCase() + user.userType.slice(1)
    : null;

  const handleBrandNavigation = useCallback(() => {
    if (!user) {
      nav("/login");
      return;
    }
    nav("/jobs");
  }, [nav, user]);

  return (
    <>
      <Header aria-label="OpenBid">
        <HeaderName prefix="">
          <button
            type="button"
            className="header-logo-button"
            onClick={handleBrandNavigation}
            aria-label="OpenBid home"
          >
            <img src="/Images/OpenBidLogo.svg" alt="OpenBid logo" />
            <span className="header-logo-text">OpenBid</span>
          </button>
        </HeaderName>
        <HeaderGlobalBar>
          <div className="header-user-info">
            <span className="header-user-greeting">
              Hello, {greetingName}
            </span>
            {fullName && (
              <span className="header-user-details">
                Logged in as {fullName}
                {userType ? ` (${userType})` : ""}
              </span>
            )}
          </div>
          <HeaderGlobalAction aria-label="Map" onClick={() => nav("/jobs")}>
            <Map />
          </HeaderGlobalAction>
          <HeaderGlobalAction
            aria-label="Logout"
            onClick={() => {
              logout();
              nav("/login");
            }}
          >
            <Logout />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
      <Nav />
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
