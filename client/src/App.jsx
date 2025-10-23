import { useCallback, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
} from "@carbon/react";
import { Logout, Map, Switcher } from "@carbon/icons-react";
import { logout, setUser } from "./services/session";
import { api } from "./services/api";
import { useSessionRequirements, useSessionUser } from "./hooks/useSession";
import Nav from "./components/Nav";
import "./styles/components/header.css";

export default function App() {
  const nav = useNavigate();
  const user = useSessionUser();
  const requirements = useSessionRequirements();
  const [roleSwitching, setRoleSwitching] = useState(false);
  const [roleError, setRoleError] = useState("");

  const greetingName = user?.firstName || user?.name || "Guest";
  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "";
  const userType = user?.userType
    ? user.userType.charAt(0).toUpperCase() + user.userType.slice(1)
    : null;
  const currentRole = (user?.userType || "bidder").toLowerCase();
  const nextRole = currentRole === "contractor" ? "bidder" : "contractor";
  const nextRoleLabel = nextRole.charAt(0).toUpperCase() + nextRole.slice(1);

  const handleBrandNavigation = useCallback(() => {
    if (!user) {
      nav("/login");
      return;
    }
    nav("/jobs");
  }, [nav, user]);

  const handleRoleToggle = useCallback(async () => {
    if (!user) return;
    const roleToApply = user.userType === "contractor" ? "bidder" : "contractor";
    setRoleError("");
    setRoleSwitching(true);
    try {
      const resp = await api.updateRole(roleToApply);
      if (resp?.error || !resp?.user) {
        setRoleError("Unable to switch role. Please try again.");
        return;
      }
      setUser(resp.user, resp.requirements ?? requirements);
      const destination =
        roleToApply === "contractor" ? "/jobs?mine=true" : "/jobs";
      nav(destination);
    } catch (error) {
      const message =
        error?.data?.error === "invalid_role"
          ? "Unable to switch role. Please refresh and try again."
          : "Unable to switch role. Please try again.";
      setRoleError(message);
    } finally {
      setRoleSwitching(false);
    }
  }, [user, requirements, nav]);

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
            {roleError && (
              <span className="header-user-status header-user-status-warning">
                {roleError}
              </span>
            )}
          </div>
          <HeaderGlobalAction aria-label="Map" onClick={() => nav("/jobs")}>
            <Map />
          </HeaderGlobalAction>
          {user && (
            <button
              type="button"
              className="header-role-switch"
              onClick={handleRoleToggle}
              disabled={roleSwitching}
              aria-label={
                roleSwitching
                  ? "Switching role"
                  : `Switch to ${nextRoleLabel} view`
              }
            >
              <Switcher size={16} />
              <span>
                {roleSwitching ? "Switching…" : `Switch to ${nextRoleLabel}`}
              </span>
            </button>
          )}
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
