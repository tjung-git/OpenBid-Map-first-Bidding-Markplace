import { useEffect, useState } from "react";
import { DataTable, Button, InlineNotification } from "@carbon/react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { getRequirements, getUser } from "../services/session";
import "../styles/pages/jobs.css";
import MapView from "../components/MapView";

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const user = getUser();
  const requirements = getRequirements();

  useEffect(() => {
    const params = [];
    if (user?.userType === "contractor") {
      params.push("mine=true");
    }
    const query = params.length ? `?${params.join("&")}` : "";
    api
      .jobsList(query)
      .then((d) => setJobs(d.jobs || []))
      .catch(() => setErr("Failed to load jobs"));
  }, [user?.userType]);

  const headers = [
    { key: "title", header: "Title" },
    { key: "budgetAmount", header: "Budget" },
    { key: "status", header: "Status" },
  ];

  const rows = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    budgetAmount: j.budgetAmount ?? "-",
    status: j.status,
  }));

  return (
    <div>
      <h2>Nearby Jobs</h2>
      {err && (
        <InlineNotification
          title="Error"
          subtitle={err}
          kind="error"
          lowContrast
        />
      )}
      <MapView
        markers={jobs
          .filter((j) => j.location?.lat && j.location?.lng)
          .map((j) => j.location)}
      />
      {getUser()?.userType === "contractor" && (
        <div className="job-list-actions">
          <Button
            onClick={() => {
              const requirements = getRequirements();
              if (!requirements.kycVerified) {
                nav("/kyc", {
                  state: {
                    notice: "Complete 2FA/KYC before posting jobs.",
                  },
                });
                return;
              }
              nav("/new-job");
            }}
          >
            Post a Job
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
              {rows.map((r) => (
                <tr key={r.id} {...getRowProps({ row: r })}>
                  {r.cells.map((c) => (
                    <td key={c.id}>{c.value}</td>
                  ))}
                  <td>
                    <Button size="sm" onClick={() => nav(`/jobs/${r.id}`)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataTable>
    </div>
  );
}
