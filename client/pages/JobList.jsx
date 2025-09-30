import { useEffect, useState } from "react";
import { listJobs } from "../firebase";
import { Link } from "react-router-dom";
import MapView from "../components/MapView";

export default function JobList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const j = await listJobs();
      setJobs(j);
      setLoading(false);
    })();
  }, []);

  const markers = jobs
    .filter((j) => j.location?.lat && j.location?.lng)
    .map((j) => ({ position: { lat: j.location.lat, lng: j.location.lng } }));

  return (
    <div className="container">
      <h1>Nearby Jobs</h1>
      <p className="small">
        Iteration 1.2 demo: list & map, create job, place bids.
      </p>
      <MapView markers={markers} />
      {loading ? (
        <div className="card">Loading…</div>
      ) : (
        <div className="list" style={{ marginTop: 12 }}>
          {jobs.length === 0 && (
            <div className="card">
              No jobs yet. Click <b>+ New Job</b> to create one.
            </div>
          )}
          {jobs.map((j) => (
            <Link
              to={`/jobs/${j.id}`}
              key={j.id}
              className="card"
              style={{ display: "block" }}
            >
              <h3>{j.title}</h3>
              <div className="small">{j.description?.slice(0, 120) || "—"}</div>
              <div className="small">
                Budget:{" "}
                {j.budgetType === "fixed"
                  ? `$${j.budgetAmount?.toFixed?.(2) ?? "-"}`
                  : "Open"}
              </div>
              <div className="small">Status: {j.status}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
