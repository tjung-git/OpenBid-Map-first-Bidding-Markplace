import { Outlet, Link, useNavigate } from "react-router-dom";
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
} from "@carbon/react";
import { Logout, Add, Map } from "@carbon/icons-react";
import { logout } from "./services/session";
import Nav from "./components/Nav";

export default function App() {
  const nav = useNavigate();
  return (
    <>
      <Header aria-label="OpenBid">
        <HeaderName prefix="">OpenBid</HeaderName>
        <HeaderGlobalBar>
          <HeaderGlobalAction
            aria-label="New Job"
            onClick={() => nav("/new-job")}
          >
            <Add />
          </HeaderGlobalAction>
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
