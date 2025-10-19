import { useCallback, useEffect, useMemo, useState } from "react";
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

const sortBidsByCreated = (list) =>
  [...list].sort((a, b) => {
    const aTime = new Date(a.bidCreatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.bidCreatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

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
  const [acceptingBidId, setAcceptingBidId] = useState(null);

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

  const refreshJob = useCallback(async () => {
    const jobResp = await api.jobGet(jobId);
    setJob(jobResp.job);
    return jobResp.job;
  }, [jobId]);

  const refreshBids = useCallback(async () => {
    const response = await api.bidsForJob(jobId);
    const list = Array.isArray(response?.bids)
      ? sortBidsByCreated(response.bids)
      : [];
    setBids(list);
    return list;
  }, [jobId]);

  useEffect(() => {
    refreshJob();
    refreshBids();
  }, [refreshJob, refreshBids]);

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
  const jobStatus = (job?.status || "open").toLowerCase();
  const biddingClosed = jobStatus !== "open";
  const jobLocked = jobStatus !== "open";

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
    if (biddingClosed) {
      setBidError("Bidding is closed for this job.");
      return;
    }
    const response = await api.bid(jobId, {
      amount: bidAmount,
      note: bidNote,
    });
    if (response.error) {
      const errors = {
        bidding_closed: "Bidding is closed for this job.",
        bid_already_exists: "You have already placed a bid on this job.",
      };
      setBidError(errors[response.error] || response.error);
      return;
    }
    await refreshBids();
    setBidNote("");
    setFlash("Bid submitted.");
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!isOwner) return;
    if (jobLocked) {
      setUpdateError(
        "This job is locked after accepting a bid. Finish the job to get paid."
      );
      return;
    }
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
    if (jobLocked) {
      setUpdateError(
        "This job is locked after accepting a bid and cannot be deleted."
      );
      return;
    }
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

  async function handleAccept(bidId) {
    if (!isOwner || !bidId) return;
    setUpdateError("");
    setFlash("");
    setAcceptingBidId(bidId);
    try {
      const resp = await api.bidAccept(jobId, bidId);
      if (resp.error) {
        const messages = {
          job_already_awarded:
            "This job has already been awarded to another bid.",
          bid_not_found: "This bid could not be found.",
          bidding_closed: "Bidding is already closed for this job.",
          forbidden: "You do not have permission to accept this bid.",
        };
        setUpdateError(
          messages[resp.error] ||
            "Unable to accept bid. Please try again."
        );
      } else {
        await Promise.all([refreshJob(), refreshBids()]);
        setFlash("Bid accepted. Job awarded.");
      }
    } catch (error) {
      setUpdateError("Unable to accept bid. Please try again.");
    } finally {
      setAcceptingBidId(null);
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
          {jobLocked && (
            <InlineNotification
              title="Job Locked"
              subtitle="You accepted a bid. Finish your job and get paid."
              kind="info"
              lowContrast
            />
          )}
          <h3 className="job-section-title">Job Details</h3>
          <Form onSubmit={handleUpdate}>
            <TextInput
              id="job-title"
              labelText="Job Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={jobLocked}
              required
            />
            <TextInput
              id="job-desc"
              labelText="Job Description"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              disabled={jobLocked}
            />
            <TextInput
              id="job-budget"
              type="number"
              labelText="Job Budget"
              value={editBudget}
              onChange={(e) => setEditBudget(e.target.value)}
              disabled={jobLocked}
            />
            <div className="job-form-grid">
              <NumberInput
                id="job-lat"
                label="Latitude"
                value={editLat}
                disabled={jobLocked}
                onChange={(_, { value }) =>
                  setEditLat((prev) => toNumber(value, prev))
                }
              />
              <NumberInput
                id="job-lng"
                label="Longitude"
                value={editLng}
                disabled={jobLocked}
                onChange={(_, { value }) =>
                  setEditLng((prev) => toNumber(value, prev))
                }
              />
            </div>
            <div className="job-detail-actions">
              <Button type="submit" disabled={saving || jobLocked}>
                {saving ? "Updating…" : "Update Job"}
              </Button>
              <Button
                type="button"
                kind="danger"
                disabled={deleting || jobLocked}
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
          {biddingClosed ? (
            <InlineNotification
              title="Bidding Closed"
              subtitle={
                bidError || "This job is no longer accepting bids."
              }
              kind="info"
              lowContrast
            />
          ) : (
            <>
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
        </>
      )}

      <h3 className="job-section-title">Bids</h3>
      {biddingClosed && job.awardedBidId && (
        <InlineNotification
          title="Job Awarded"
          subtitle="Bidding is closed. The accepted bid is highlighted below."
          kind="info"
          lowContrast
        />
      )}
      {bids.length === 0 ? (
        <InlineNotification
          title="No Bids Yet"
          subtitle="Bids from contractors will appear here."
          kind="info"
          lowContrast
        />
      ) : (
        <ul className="job-bid-list">
          {bids.map((bid) => {
            const amountValue = Number(bid.amount);
            const amountDisplay = Number.isFinite(amountValue)
              ? amountValue.toLocaleString()
              : bid.amount;
            const createdAt = bid.bidCreatedAt || bid.createdAt;
            const status = (bid.status || "active").toLowerCase();
            const statusLabel =
              status.charAt(0).toUpperCase() + status.slice(1);
            const statusClass = `job-bid-status job-bid-status--${status}`;
            const canAccept = isOwner && !biddingClosed && status === "active";
            const itemClassNames = ["job-bid-item"];
            if (["accepted", "rejected", "active"].includes(status)) {
              itemClassNames.push(`job-bid-item--${status}`);
            }
            return (
              <li key={bid.id}>
                <div className={itemClassNames.join(" ")}>
                  <div className="job-bid-item__header">
                    <span>${amountDisplay}</span>
                    <span>· {bid.bidderName || "Bidder"}</span>
                    <span className={statusClass}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="job-bid-item__meta">
                    {createdAt
                      ? new Date(createdAt).toLocaleString()
                      : "Unknown time"}
                  </p>
                  {bid.note && (
                    <p className="job-bid-item__note">“{bid.note}”</p>
                  )}
                  {bid.statusNote && (
                    <p className="job-bid-item__status-note">
                      {bid.statusNote}
                    </p>
                  )}
                  {canAccept && (
                    <div className="job-bid-item__actions">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(bid.id)}
                        disabled={acceptingBidId === bid.id}
                      >
                        {acceptingBidId === bid.id
                          ? "Accepting…"
                          : "Accept Bid"}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
