import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Form,
  NumberInput,
  TextInput,
  Button,
  InlineNotification,
} from "@carbon/react";
import { api } from "../services/api";
import { getUser } from "../services/session";
import MapView from "../components/MapView";
import "../styles/pages/jobs.css";

export default function JobDetail() {
  const { jobId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState(50);
  const [bidNote, setBidNote] = useState("");
  const [bidError, setBidError] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [flash, setFlash] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editBudget, setEditBudget] = useState("0");
  const [editLat, setEditLat] = useState(43.6532);
  const [editLng, setEditLng] = useState(-79.3832);

  const toNumber = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  useEffect(() => {
    if (location.state?.notice) {
      setFlash(location.state.notice);
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    api.jobGet(jobId).then((d) => setJob(d.job));
    api.bidsForJob(jobId).then((d) => {
      const list = d.bids || [];
      list.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
      setBids(list);
    });
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    setEditTitle(job.title || "");
    setEditDesc(job.description || "");
    const rawBudget =
      job.budgetAmount !== undefined && job.budgetAmount !== null
        ? String(job.budgetAmount)
        : "0";
    const cleaned = rawBudget.replace(/[^0-9.\-]/g, "");
    setEditBudget(cleaned || "0");
    setEditLat(job.location?.lat ?? 43.6532);
    setEditLng(job.location?.lng ?? -79.3832);
  }, [job]);

  const isContractor = user?.userType === "contractor";
  const isOwner = isContractor && job && job.posterId === user?.uid;

  const displayLat = isOwner ? editLat : job?.location?.lat;
  const displayLng = isOwner ? editLng : job?.location?.lng;
  const defaultLocation = useMemo(() => ({ lat: 43.6532, lng: -79.3832 }), []);

  const mapMarkers = useMemo(() => {
    if (displayLat == null || displayLng == null) return [];
    return [{ lat: displayLat, lng: displayLng }];
  }, [displayLat, displayLng]);
  const mapCenter = mapMarkers[0] || defaultLocation;

  async function placeBid(e) {
    e.preventDefault();
    setBidError("");
    setFlash("");
    const response = await api.bid(jobId, {
      amount: bidAmount,
      note: bidNote,
    });
    if (response.error) {
      setBidError(response.error);
      return;
    }
    setBids((prev) => [response.bid, ...prev]);
    setBidNote("");
    setFlash("Bid submitted.");
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!isOwner) return;
    setUpdateError("");
    setFlash("");
    setSaving(true);
    try {
      const payload = {
        title: editTitle,
        description: editDesc,
        budgetAmount: Number.parseFloat(editBudget) || 0,
        location: {
          ...(job?.location || {}),
          lat: editLat,
          lng: editLng,
        },
      };
      const result = await api.jobUpdate(jobId, payload);
      if (result.error) {
        setUpdateError(result.error);
      } else if (result.job) {
        setJob(result.job);
        setFlash(`"${result.job.title}" updated.`);
      }
    } catch (error) {
      setUpdateError("Unable to update job. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isOwner || deleting) return;
    const confirmed = window.confirm(
      `Delete "${job.title}"? This cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await api.jobDelete(jobId);
      navigate("/jobs", {
        replace: true,
        state: { notice: `"${job.title}" deleted.` },
      });
    } catch (error) {
      setUpdateError("Unable to delete job. Please try again.");
      setDeleting(false);
    }
  }

  if (!job) return null;

  return (
    <div className="container job-detail-container">
      <div className="job-detail-header">
        <Button kind="ghost" onClick={() => navigate("/jobs")}>
          Back to Job List
        </Button>
        <div>
          <h2>{job.title}</h2>
          <p className="job-detail-meta">
            Status: {job.status || "open"} · Created{" "}
            {job.createdAt
              ? new Date(job.createdAt).toLocaleString()
              : "Unknown"}
          </p>
        </div>
      </div>

      {flash && (
        <InlineNotification
          title="Success"
          subtitle={flash}
          kind="success"
          lowContrast
          onClose={() => setFlash("")}
        />
      )}
      {updateError && (
        <InlineNotification
          title="Error"
          subtitle={updateError}
          kind="error"
          lowContrast
          onClose={() => setUpdateError("")}
        />
      )}

      <MapView center={mapCenter} markers={mapMarkers} />

      {isOwner ? (
        <>
          <h3 className="job-section-title">Job Details</h3>
          <Form onSubmit={handleUpdate}>
            <TextInput
              id="job-title"
              labelText="Job Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />
            <TextInput
              id="job-desc"
              labelText="Job Description"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
            <TextInput
              id="job-budget"
              type="number"
              labelText="Job Budget"
              value={editBudget}
              onChange={(e) => setEditBudget(e.target.value)}
            />
            <div className="job-form-grid">
              <NumberInput
                id="job-lat"
                label="Latitude"
                value={editLat}
                onChange={(_, { value }) =>
                  setEditLat((prev) => toNumber(value, prev))
                }
              />
              <NumberInput
                id="job-lng"
                label="Longitude"
                value={editLng}
                onChange={(_, { value }) =>
                  setEditLng((prev) => toNumber(value, prev))
                }
              />
            </div>
            <div className="job-detail-actions">
              <Button type="submit" disabled={saving}>
                {saving ? "Updating…" : "Update Job"}
              </Button>
              <Button
                type="button"
                kind="danger"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete Job"}
              </Button>
            </div>
          </Form>
        </>
      ) : (
        <>
          <p>{job.description}</p>
          <p>
            Budget:{" "}
            {typeof job.budgetAmount === "number"
              ? `$${job.budgetAmount.toFixed(2)}`
              : job.budgetAmount ?? "-"}
          </p>
          <h3 className="job-section-title">Place a Bid</h3>
          {bidError && (
            <InlineNotification
              title="Error"
              subtitle={bidError}
              kind="error"
              lowContrast
            />
          )}
          <Form onSubmit={placeBid}>
            <NumberInput
              id="bid-amount"
              label="Amount"
              value={bidAmount}
              onChange={(_, { value }) => setBidAmount(Number(value))}
            />
            <TextInput
              id="bid-note"
              labelText="Note"
              value={bidNote}
              onChange={(e) => setBidNote(e.target.value)}
            />
            <Button type="submit" className="job-bid-button">
              Submit Bid
            </Button>
          </Form>
        </>
      )}

      <h3 className="job-section-title">Bids</h3>
      {bids.length === 0 ? (
        <InlineNotification
          title="No Bids Yet"
          subtitle="Bids from contractors will appear here."
          kind="info"
          lowContrast
        />
      ) : (
        // TODO: Add bid acceptance flow to close jobs when a bid is chosen.
        <ul className="job-bid-list">
          {bids.map((bid) => (
            <li key={bid.id}>
              ${bid.amount} — {bid.note || "(no note)"} —{" "}
              {new Date(bid.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
