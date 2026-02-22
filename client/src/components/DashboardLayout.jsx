import React from "react";
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
  HeaderGlobalBar,
  HeaderGlobalAction
} from "@carbon/react";
import { Logout } from "@carbon/icons-react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useSessionUser } from "../hooks/useSession";
import { logout } from "../services/session";

function DashboardLayout() {

  const nav = useNavigate();
    const user = useSessionUser();
  
    const greetingName = user?.firstName || user?.name || "Guest";
    const fullName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
      : "";
    const userType = user?.userType
      ? user.userType.charAt(0).toUpperCase() + user.userType.slice(1)
      : null;

  return (
    <>
      <Header aria-label="Admin Dashboard">
        <HeaderName prefix="OpenBid">Admin</HeaderName>
        <HeaderGlobalBar>
          <div className="header-user-info">
            <span className="header-user-greeting">
              Hello, {greetingName}
            </span>
            {fullName && (
              <span className="header-user-details">
                Logged in as {`${fullName} (Admin)`}
              </span>
            )}
          </div>
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

      <SideNav aria-label="Side navigation" expanded>
        <SideNavItems>
          <SideNavLink as={Link} to="/admin-users">
            Users
          </SideNavLink>
          <SideNavLink as={Link} to="/admin-jobs">
            Jobs
          </SideNavLink>
        </SideNavItems>
      </SideNav>

      <Content style={{ marginLeft: "200px", padding: "2rem" }}>
        <Outlet />
      </Content>
    </>
  );
}

export default DashboardLayout;