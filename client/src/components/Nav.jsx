import { Breadcrumb, BreadcrumbItem } from "@carbon/react";
import { Link, useLocation } from "react-router-dom";
import { getUser } from "../services/session";
import "../styles/components/nav.css";
export default function Nav() {
  const loc = useLocation();
  const user = getUser();
  const path = loc.pathname;
  const isContractor = user?.userType === "contractor";
  const showNewJob =
    isContractor && (path.startsWith("/new-job") || path.startsWith("/kyc"));
  const showKyc = isContractor && path.startsWith("/kyc");
  const isJobBid = /^\/jobs\/[^/]+\/bid$/.test(path);
  const isMyBids = path === "/jobs/myBids";
  const inMyBidsSection = path.startsWith("/jobs/myBids/");
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
        {(showNewJob || showKyc) && (
          <BreadcrumbItem isCurrentPage={loc.pathname === "/new-job"}>
            <Link to="/new-job">New Job</Link>
          </BreadcrumbItem>
        )}
        {showKyc && (
          <BreadcrumbItem isCurrentPage={loc.pathname === "/kyc"}>
            <Link to="/kyc">KYC</Link>
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
      </Breadcrumb>
    </nav>
  );
}
