import { useEffect, useMemo, useState } from "react";
import { DataTable, Button, InlineNotification, FlexGrid, Column, Row, NumberInput } from "@carbon/react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import {
  useSessionRequirements,
  useSessionUser,
} from "../hooks/useSession";
import { setUser } from "../services/session";
import MapView from "../components/MapView";
import "../styles/pages/jobs.css";
import "../styles/components/role-choice.css";
import SearchAutocomplete from "../components/SearchAutocomplete";
import { haversineFormulaKm } from "../util/locationHelpers";
import { cfg } from "../services/config";

const ROLE_OPTIONS = [
  {
    role: "contractor",
    headline: "I want to post jobs",
    label: "Contractor",
    copy: "Create opportunities, invite bids, and manage awards.",
  },
  {
    role: "bidder",
    headline: "I want to bid on jobs",
    label: "Bidder",
    copy: "Browse open projects, review details, and submit bids.",
  },
];

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [roleNotice, setRoleNotice] = useState("");
  const [roleError, setRoleError] = useState("");
  const [rolePending, setRolePending] = useState("");
  const [roleActivated, setRoleActivated] = useState(false);
  const nav = useNavigate();
  const location = useLocation();
  const user = useSessionUser();
  const requirements = useSessionRequirements();
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(1000000);
  const [center, setCenter] = useState({ lat: 43.6532, lng: -79.3832 });
  const [selectedAddress, setSelectedAddress] = useState("Toronto, ON, Canada");
  const [radius, setRadius] = useState(1000000); //In metres

  const isContractor = user?.userType === "contractor";
  const kycVerified = Boolean(requirements.kycVerified);
  const activeRole = isContractor ? "contractor" : "bidder";

  useEffect(() => {
    if (location.state?.notice) {
      setSuccess(location.state.notice);
      setErr("");
      nav(location.pathname + location.search, { replace: true });
    }
  }, [location.state, location.pathname, location.search, nav]);

  useEffect(() => {
    if (!location.state?.roleActivated) return;
    setRoleActivated(true);
    if (location.state.roleMessage) {
      setRoleNotice(location.state.roleMessage);
    }
    const { roleActivated: _roleActivated, roleMessage, ...rest } =
      location.state;
    const hasRemainingState = Object.keys(rest).length > 0;
    nav(location.pathname + location.search, {
      replace: true,
      state: hasRemainingState ? rest : undefined,
    });
  }, [location.state, location.pathname, location.search, nav]);

  useEffect(() => {
    if (!user) return;
    const params = [];
    if (isContractor) {
      params.push("mine=true");
    }
    const query = params.length ? `?${params.join("&")}` : "";
    api
      .jobsList(query)
      .then((d) => setJobs(d.jobs || []))
      .catch(() => setErr("Failed to load jobs"));
  }, [user, isContractor]);

  useEffect(() => {
    setFilteredJobs(jobs.filter((j) => j.location?.lat && j.location?.lng && ((j.budgetAmount >= minBudget && j.budgetAmount <= maxBudget) || j.budgetAmount ==="-") 
            && haversineFormulaKm(center.lat, center.lng, j.location?.lat, j.location?.lng) <= radius));
  }, [radius, minBudget, maxBudget, jobs, center]);

  const handlePlaceSelection = (placeData) => {
    const {address, latLng} = placeData;
    setCenter(latLng);
    setSelectedAddress(address);
  };

  const markers = useMemo(() => {
    return jobs
      .filter((job) => job.location?.lat && job.location?.lng)
      .map((job) => job.location);
  }, [jobs]);

  const headers = [
    { key: "title", header: "Title" },
    { key: "description", header: "Description" },
    { key: "budgetAmount", header: "Budget" },
    { key: "createdAt", header: "Created" },
  ];

  const rows = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
    return sorted.map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description || "-",
      budgetAmount:
        typeof job.budgetAmount === "number"
          ? `$${job.budgetAmount.toFixed(2)}`
          : job.budgetAmount ?? "-",
      createdAt: job.createdAt
        ? new Date(job.createdAt).toLocaleString()
        : "-",
    }));
  }, [jobs]);

  async function handleRoleChoice(targetRole) {
    if (!user) return;
    const normalizedCurrent = (user.userType || "bidder").toLowerCase();
    const destination =
      targetRole === "contractor" ? "/jobs?mine=true" : "/jobs";
    const activationMessage =
      targetRole === "contractor"
        ? "Contractor workspace activated. Post and manage your jobs."
        : "Bidder workspace activated. Browse open work and submit bids.";
    if (normalizedCurrent === targetRole) {
      nav(destination, {
        replace: true,
        state: { roleActivated: true, roleMessage: activationMessage },
      });
      return;
    }
    setRoleError("");
    setRoleNotice("");
    setRolePending(targetRole);
    try {
      const resp = await api.updateRole(targetRole);
      if (!resp?.user) {
        throw new Error("role switch failed");
      }
      setUser(resp.user, resp.requirements ?? requirements);
      nav(destination, {
        replace: true,
        state: { roleActivated: true, roleMessage: activationMessage },
      });
    } catch (switchErr) {
      const message =
        switchErr?.data?.error === "invalid_role"
          ? "This account is not allowed to use that workspace."
          : "Unable to switch workspaces right now. Please try again.";
      setRoleError(message);
    } finally {
      setRolePending("");
    }
  }

  function handlePostClick() {
    if (!requirements.kycVerified) {
      nav("/profile", {
        state: { notice: "Complete KYC verification in your profile to post jobs." },
      });
      return;
    }
    nav("/new-job");
  }

  async function handleDelete(jobId) {
    if (!isContractor) return;
    const job = jobs.find((j) => j.id === jobId);
    const jobTitle = job?.title || "Job";
    const confirmed = window.confirm(
      `Delete "${jobTitle}"? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await api.jobDelete(jobId);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setSuccess(`"${jobTitle}" deleted.`);
      setErr("");
    } catch (deleteErr) {
      const message =
        deleteErr?.data?.error === "forbidden"
          ? "You can only delete jobs you created."
          : "Unable to delete job. Please try again.";
      setErr(message);
    }
  }

  return (
    <div>
      <h2>Nearby Jobs</h2>
      {success && (
        <InlineNotification
          title="Success"
          subtitle={success}
          kind="success"
          lowContrast
          onClose={() => setSuccess("")}
        />
      )}
      {err && (
        <InlineNotification
          title="Error"
          subtitle={err}
          kind="error"
          lowContrast
        />
      )}
      {!cfg.prototype &&<FlexGrid>
        <Row>
          <Column>
            <SearchAutocomplete onSelectPlace={handlePlaceSelection}/>
          </Column>
          <Column className="filter-selection">
            <span>Current Location: {selectedAddress}</span>
          </Column>
        </Row>
        <Row style={{marginTop: 16}}>
          <Column>
            <NumberInput 
              size="md"
              id="radius" 
              label="Radius (km)" 
              min={5} 
              max={1000000} 
              onChange={(event) => setRadius(Number(event.target.value))} 
              value={radius}
              hideSteppers
              helperText="Radius is set to 1000000 by default, radius should be altered after the location is selected to limit results."
            />
          </Column>
          <Column className="filter-selection">
              <span>Current Radius: {radius} km</span>
          </Column>
        </Row>
      </FlexGrid>}
      <MapView
        markers={filteredJobs
          .map((j) => j.location)}
        center={center}
      />
      <FlexGrid style={{marginTop: 16}}>
        <Row>
          <Column>
            <span>Budget Filter</span>
          </Column>
        </Row>
        <Row>
          <Column>
            <NumberInput 
              size="md"
              id="minBudget" label="Min budget" 
              min={0} 
              max={1000000} 
              onChange={(event) => setMinBudget(Number(event.target.value))} 
              value={minBudget}
              hideSteppers
            >
            </NumberInput>
          </Column>
          <Column>
            <NumberInput
              size="md" 
              id="maxBudget" 
              label="Max budget" 
              min={0} max={1000000} 
              onChange={(event) => setMaxBudget(Number(event.target.value))} 
              value={maxBudget}
              hideSteppers
            >
            </NumberInput>
          </Column>
        </Row>
      </FlexGrid>

      {isContractor && !kycVerified && (
        <InlineNotification
          title="KYC Required"
          subtitle="Complete KYC verification in your profile to post jobs."
          kind="info"
          lowContrast
        />
      )}

      <section className="role-choice-panel" aria-label="Select workspace">
        <div className="role-choice-header">
          <p className="role-choice-eyebrow">Choose your workspace</p>
          <h3>How would you like to use OpenBid today?</h3>
          <p>Switch between bidder and contractor views whenever you need.</p>
        </div>
        <div className="role-choice-options">
          {ROLE_OPTIONS.map((option) => {
            const isActive = activeRole === option.role;
            const isLoading = rolePending === option.role;
            const classes = ["role-choice-card"];
            if (isActive) classes.push("role-choice-card--active");
            if (isLoading) classes.push("role-choice-card--loading");
            return (
              <button
                key={option.role}
                type="button"
                className={classes.join(" ")}
                onClick={() => handleRoleChoice(option.role)}
                disabled={Boolean(rolePending) && !isLoading}
              >
                <span className="role-choice-label">{option.headline}</span>
                <span className="role-choice-role">{option.label}</span>
                <p className="role-choice-copy">{option.copy}</p>
                <span className="role-choice-cta">
                  {isLoading
                    ? "Updating…"
                    : isActive
                    ? "Current view"
                    : "Switch now"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {(roleError || roleNotice) && (
        <div className="role-choice-messages">
          {roleError && (
            <InlineNotification
              title="Workspace"
              subtitle={roleError}
              kind="error"
              lowContrast
              onClose={() => setRoleError("")}
            />
          )}
          {roleNotice && (
            <InlineNotification
              title="Workspace"
              subtitle={roleNotice}
              kind="success"
              lowContrast
              onClose={() => setRoleNotice("")}
            />
          )}
        </div>
      )}

      {!roleActivated && (
        <div className="role-choice-hint">
          Select a workspace above to manage posts or bids.
        </div>
      )}

      {roleActivated && isContractor && (
        <div className="job-list-actions">
          <Button onClick={handlePostClick}>
            {kycVerified ? "Post a Job" : "Go to Profile"}
          </Button>
        </div>
      )}

      {roleActivated && !isContractor && (
        <div className="job-list-actions">
          <Button onClick={() => nav("/jobs/myBids")}>My Bids</Button>
        </div>
      )}

      <DataTable rows={filteredJobs
        .map((j) => ({
          id: j.id,
          title: j.title,
          budgetAmount: j.budgetAmount ?? "-",
          status: j.status,
          description: j.description ?? "-",
          createdAt: new Date(j.createdAt).toDateString() ?? "-"
        }))} headers={headers}>

        {({ rows, headers, getHeaderProps, getRowProps }) => (
          <table className="cds--data-table cds--data-table--zebra job-table">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h.key} {...getHeaderProps({ header: h })}>
                    {h.header}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const jobRecord = jobs.find((job) => job.id === row.id);
                const jobStatus = (jobRecord?.status || "open").toLowerCase();
                const jobLocked = jobStatus !== "open";
                return (
                  <tr key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <td key={cell.id}>{cell.value}</td>
                    ))}
                    <td className="job-row-actions">
                      <Button
                        size="sm"
                        onClick={() =>
                          nav(
                            isContractor
                              ? `/jobs/${row.id}`
                              : `/jobs/${row.id}/bid`
                          )
                        }
                      >
                        Open
                      </Button>
                      {isContractor && (
                        <div className="job-row-delete">
                          <Button
                            size="sm"
                            kind="danger--ghost"
                            onClick={() => handleDelete(row.id)}
                            disabled={jobLocked}
                          >
                            Delete
                          </Button>
                          {jobLocked && (
                            <span className="job-row-note">
                              You can’t delete a job after accepting a bid.
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </DataTable>

      {rows.length === 0 && (
        <InlineNotification
          title="No Jobs Found"
          subtitle={
            isContractor
              ? "Jobs you create will appear here."
              : "There are no jobs available yet."
          }
          kind="info"
          lowContrast
        />
      )}
    </div>
  );
}
