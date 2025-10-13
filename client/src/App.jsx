import { Outlet, useNavigate } from "react-router-dom";
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
} from "@carbon/react";
import { Logout, Add, Map } from "@carbon/icons-react";
import { logout, getUser, getRequirements } from "./services/session";
import Nav from "./components/Nav";
import "./styles/components/header.css";

export default function App() {
  const nav = useNavigate();
  const user = getUser();
  const requirements = getRequirements();

  const greetingName = user?.firstName || user?.name || "Guest";
  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "";
  const userType = user?.userType
    ? user.userType.charAt(0).toUpperCase() + user.userType.slice(1)
    : null;

  function handleNewJob() {
    if (!requirements.kycVerified) {
      nav("/kyc", {
        state: {
          notice: "Complete 2FA/KYC before posting jobs.",
        },
      });
      return;
    }
    nav("/new-job");
  }
  return (
    <>
      <Header aria-label="OpenBid">
        <HeaderName prefix="">OpenBid</HeaderName>
        <HeaderGlobalBar>
          <div className="header-user-info">
            <span className="header-user-info__greeting">
              Hello, {greetingName}
            </span>
            {fullName && (
              <span className="header-user-info__details">
                Logged in as {fullName}
                {userType ? ` (${userType})` : ""}
              </span>
            )}
          </div>
          {user?.userType === "contractor" && (
            <HeaderGlobalAction
              aria-label="New Job"
              onClick={handleNewJob}
            >
              <Add />
            </HeaderGlobalAction>
          )}
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
