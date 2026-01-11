import { Breadcrumb, BreadcrumbItem } from "@carbon/react";
import { Link, useLocation } from "react-router-dom";
import { useSessionUser } from "../hooks/useSession";
import "../styles/components/nav.css";
export default function Nav() {
  const loc = useLocation();
  const user = useSessionUser();
  const path = loc.pathname;
  const isContractor = user?.userType === "contractor";
  const showNewJob = isContractor && path.startsWith("/new-job");
  const isJobBid = /^\/jobs\/[^/]+\/bid$/.test(path);
  const isMyBids = path === "/jobs/myBids";
  const inMyBidsSection = path.startsWith("/jobs/myBids/");
  const isMessages = path.startsWith("/messages");
  const isJobDetail =
    /^\/jobs\/[^/]+$/.test(path) &&
    !isMyBids &&
    !inMyBidsSection &&
    !isJobBid;
  const isBidDetail =
    /^\/bids\/[^/]+$/.test(path) ||
    /^\/jobs\/myBids\/bidDetails\/[^/]+$/.test(path);
  return (
    <nav className="container nav-container">
      <Breadcrumb noTrailingSlash>
        <BreadcrumbItem isCurrentPage={loc.pathname === "/jobs"}>
          <Link to="/jobs">Jobs</Link>
        </BreadcrumbItem>
        {showNewJob && (
          <BreadcrumbItem isCurrentPage={loc.pathname === "/new-job"}>
            <Link to="/new-job">New Job</Link>
          </BreadcrumbItem>
        )}
        {inMyBidsSection && (
          <BreadcrumbItem>
            <Link to="/jobs/myBids">My Bids</Link>
          </BreadcrumbItem>
        )}
        {isJobDetail && (
          <BreadcrumbItem isCurrentPage>
            Job Detail
          </BreadcrumbItem>
        )}
        {isJobBid && (
          <BreadcrumbItem isCurrentPage>
            Bid on Job
          </BreadcrumbItem>
        )}
        {isBidDetail && (
          <BreadcrumbItem isCurrentPage>
            Bid Detail
          </BreadcrumbItem>
        )}
        {isMyBids && (
          <BreadcrumbItem isCurrentPage>
            My Bids
          </BreadcrumbItem>
        )}
        {isMessages && (
          <BreadcrumbItem isCurrentPage>
            Messages
          </BreadcrumbItem>
        )}
      </Breadcrumb>
    </nav>
  );
}
