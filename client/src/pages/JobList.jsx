import { useEffect, useMemo, useState } from "react";
import { DataTable, Button, InlineNotification, FlexGrid, Column, TextInput, Row, NumberInput } from "@carbon/react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import {
  useSessionRequirements,
  useSessionUser,
} from "../hooks/useSession";
import MapView from "../components/MapView";
import SearchAutocomplete from "../components/SearchAutocomplete";
import { Text } from "@carbon/react/lib/components/Text";
import { haversineFormulaKm } from "../util/locationHelpers";
import { cfg } from "../services/config";
import "../styles/pages/jobs.css";

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [err, setErr] = useState("");
  const [minBudget, setMinBudget] = useState(0);
  const [maxBudget, setMaxBudget] = useState(1000000);
  const [center, setCenter] = useState({ lat: 43.6532, lng: -79.3832 });
  const [selectedAddress, setSelectedAddress] = useState("Toronto, ON, Canada");
  const [radius, setRadius] = useState(1000000); //In metres
  const [success, setSuccess] = useState("");
  const nav = useNavigate();
  const location = useLocation();
  const user = useSessionUser();
  const requirements = useSessionRequirements();

  const isContractor = user?.userType === "contractor";
  const kycVerified = Boolean(requirements.kycVerified);

  useEffect(() => {
    if (location.state?.notice) {
      setSuccess(location.state.notice);
      setErr("");
      nav(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, nav]);

  const handlePlaceSelection = (placeData) => {
    const {address, latLng} = placeData;
    setCenter(latLng);
    setSelectedAddress(address);
  };

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

  const markers = useMemo(() => {
    return jobs
      .filter((job) => job.location?.lat && job.location?.lng)
      .map((job) => job.location);
  }, [jobs]);

  useEffect(() => {
    setFilteredJobs(jobs.filter((j) => j.location?.lat && j.location?.lng && ((j.budgetAmount >= minBudget && j.budgetAmount <= maxBudget) || j.budgetAmount ==="-") 
            && haversineFormulaKm(center.lat, center.lng, j.location?.lat, j.location?.lng) <= radius));
  }, [radius, minBudget, maxBudget, jobs, center]);

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

  function handlePostClick() {
    if (!requirements.kycVerified) {
      nav("/kyc", {
        state: { notice: "Complete KYC before posting jobs." },
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
          <Column>
            <Text>Current Location: {selectedAddress}</Text>
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
        </Row>
      </FlexGrid>}
      <MapView
        markers={filteredJobs
          .map((j) => j.location)}
        center={center}
      />
      <div style={{ marginTop: 16 }}>
        <Button onClick={() => nav("/new-job")}>Post a Job</Button>
      </div>
      <FlexGrid style={{marginTop: 16}}>
        <Row>
          <Column>
            <Text>Budget Filter</Text>
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
          subtitle="Complete KYC to post or edit your jobs. You can still view the jobs you have created."
          kind="info"
          lowContrast
        />
      )}

      {isContractor && (
        <div className="job-list-actions">
          <Button onClick={handlePostClick}>
            {kycVerified ? "Post a Job" : "Complete KYC"}
          </Button>
        </div>
      )}

      {!isContractor && (
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
