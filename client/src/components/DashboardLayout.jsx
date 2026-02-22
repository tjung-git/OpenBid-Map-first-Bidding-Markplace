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
} from "@carbon/react";
import { Link, Outlet } from "react-router-dom";

function DashboardLayout() {
  return (
    <>
      <Header aria-label="Admin Dashboard">
        <HeaderName prefix="OpenBid">Admin</HeaderName>
      </Header>

      <SideNav aria-label="Side navigation" expanded>
        <SideNavItems>
          <SideNavLink as={Link} to="/">
            Users
          </SideNavLink>
          <SideNavLink as={Link} to="/jobs">
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