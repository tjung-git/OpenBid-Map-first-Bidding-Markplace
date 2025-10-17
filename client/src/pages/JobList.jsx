import { useEffect, useMemo, useState } from "react";
import { DataTable, Button, InlineNotification } from "@carbon/react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { getRequirements, getUser } from "../services/session";
import MapView from "../components/MapView";
import "../styles/pages/jobs.css";

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const nav = useNavigate();
  const location = useLocation();
  const user = getUser();
  const requirements = getRequirements();

  const isContractor = user?.userType === "contractor";
  const kycVerified = Boolean(requirements.kycVerified);

  useEffect(() => {
    if (location.state?.notice) {
      setSuccess(location.state.notice);
      setErr("");
      nav(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, nav]);

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
    const latest = getRequirements();
    if (!latest.kycVerified) {
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

      {isContractor && !kycVerified && (
        <InlineNotification
          title="KYC Required"
          subtitle="Complete KYC to post or edit your jobs. You can still view the jobs you have created."
          kind="info"
          lowContrast
        />
      )}

      <MapView markers={markers} />

      {isContractor && (
        <div className="job-list-actions">
          <Button onClick={handlePostClick}>
            {kycVerified ? "Post a Job" : "Complete KYC"}
          </Button>
        </div>
      )}

      <DataTable rows={rows} headers={headers}>
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
              {rows.map((row) => (
                <tr key={row.id} {...getRowProps({ row })}>
                  {row.cells.map((cell) => (
                    <td key={cell.id}>{cell.value}</td>
                  ))}
                  <td className="job-row-actions">
                    <Button size="sm" onClick={() => nav(`/jobs/${row.id}`)}>
                      Open
                    </Button>
                    {isContractor && (
                      <Button
                        size="sm"
                        kind="danger--ghost"
                        onClick={() => handleDelete(row.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
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
