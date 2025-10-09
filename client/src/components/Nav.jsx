import { Breadcrumb, BreadcrumbItem } from "@carbon/react";
import { Link, useLocation } from "react-router-dom";
export default function Nav() {
  const loc = useLocation();
  return (
    <nav className="container" style={{ marginTop: "4rem" }}>
      <Breadcrumb noTrailingSlash>
        <BreadcrumbItem isCurrentPage={loc.pathname === "/jobs"}>
          <Link to="/jobs">Jobs</Link>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage={loc.pathname === "/new-job"}>
          <Link to="/new-job">New Job</Link>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage={loc.pathname === "/kyc"}>
          <Link to="/kyc">KYC</Link>
        </BreadcrumbItem>
      </Breadcrumb>
    </nav>
  );
}
