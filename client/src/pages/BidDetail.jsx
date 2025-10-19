import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Form,
  NumberInput,
  TextInput,
  Button,
  InlineNotification,
  Tile,
} from "@carbon/react";
import { api } from "../services/api";
import { getRequirements, getUser } from "../services/session";
import MapView from "../components/MapView";
import "../styles/pages/bid.css";

const PAGE_SIZE = 5;

const normalizeAmount = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.\-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export default function BidDetail() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const user = getUser();
  const requirements = getRequirements();

  const locationNotice = location.state?.notice || "";

  const [job, setJob] = useState(null);
  const [contractor, setContractor] = useState(null);
  const [bids, setBids] = useState([]);
  const [highestBid, setHighestBid] = useState(null);
  const [amountInput, setAmountInput] = useState("");
  const [note, setNote] = useState("");
  const [ownBidId, setOwnBidId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(location.state?.notice || "");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);

  const isBidder = user?.userType === "bidder";
  const kycVerified = requirements.kycVerified;
  const contractorName = useMemo(() => {
    const name =
      [contractor?.firstName, contractor?.lastName].filter(Boolean).join(" ") ||
      contractor?.email ||
      "Unknown contractor";
    return name;
  }, [contractor?.firstName, contractor?.lastName, contractor?.email]);
  const jobStatus = (job?.status || "open").toLowerCase();
  const biddingClosed = jobStatus !== "open";
  const budgetAmountNumber = useMemo(
    () => normalizeAmount(job?.budgetAmount),
    [job?.budgetAmount]
  );
  const budgetDisplay = useMemo(() => {
    if (!Number.isFinite(budgetAmountNumber)) return null;
    return `$${budgetAmountNumber.toLocaleString()}`;
  }, [budgetAmountNumber]);

  const mapMarkers = useMemo(() => {
    if (!job?.location?.lat || !job?.location?.lng) return [];
    return [job.location];
  }, [job?.location?.lat, job?.location?.lng]);

  useEffect(() => {
    if (location.state?.notice) {
      const { notice, ...rest } = location.state;
      nav(location.pathname, { replace: true, state: rest });
      setSuccess(notice);
    }
  }, [location.state, location.pathname, nav]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const jobResp = await api.jobGet(jobId);
        const jobData = jobResp.job || null;
        setJob(jobData);
        setContractor(jobResp.contractor || null);
        const bidsResp = await api.bidsForJob(jobId);
        const list = Array.isArray(bidsResp?.bids) ? bidsResp.bids : [];
        setBids(list);
        setHighestBid(bidsResp.highestBid || null);
        const minAmount = normalizeAmount(jobData?.budgetAmount);
        if (user?.uid) {
          const existing = list.find((bid) => bid.providerId === user.uid);
          if (existing) {
            setOwnBidId(existing.id);
            const numericAmount = Number(existing.amount);
            setAmountInput(
              Number.isFinite(numericAmount) ? String(numericAmount) : ""
            );
            setNote(existing.note || "");
          } else {
            setOwnBidId(null);
            if (Number.isFinite(minAmount) && minAmount > 0) {
              setAmountInput(String(minAmount));
            } else {
              setAmountInput("");
            }
            setNote("");
          }
        } else if (Number.isFinite(minAmount) && minAmount > 0) {
          setAmountInput(String(minAmount));
        } else {
          setAmountInput("");
        }
        setPage(1);
      } catch (err) {
        setError("Unable to load bid details.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId, user?.uid]);

  useEffect(() => {
    if (loading) return undefined;
    const interval = window.setInterval(() => {
      refreshBids({ silent: true });
    }, 10000);
    return () => window.clearInterval(interval);
  }, [loading, jobId]);

  useEffect(() => {
    if (!loading && isBidder && job && !ownBidId) {
      const notice =
        locationNotice ||
        "Place a bid to view detailed status for this job.";
      nav(`/jobs/${jobId}/bid`, {
        replace: true,
        state: { notice },
      });
    }
  }, [loading, isBidder, job, ownBidId, jobId, nav, locationNotice]);

  function handleAmountChange(_, { value }) {
    const raw = value == null ? "" : String(value);
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const normalized = cleaned.replace(/^0+(?=\d)/, "");
    setAmountInput(normalized);
  }

  async function submitBid(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (biddingClosed) {
      setError("Bidding is closed for this job.");
      return;
    }
    if (!isBidder) {
      setError("Only bidders can place bids.");
      return;
    }
    if (!kycVerified) {
      nav("/kyc", {
        replace: true,
        state: { notice: "Complete KYC before bidding on jobs." },
      });
      return;
    }
    const numericAmount = Number(amountInput);
    if (!Number.isFinite(numericAmount) || amountInput === "" || numericAmount <= 0) {
      setError("Enter a valid bid amount greater than 0.");
      return;
    }
    const minAmount = budgetAmountNumber || 0;
    if (numericAmount < minAmount) {
      setError(
        minAmount > 0
          ? `You cannot bid below the contractor's budget of ${budgetDisplay}.`
          : "Enter a valid bid amount greater than 0."
      );
      return;
    }
    setSubmitting(true);
    try {
      if (ownBidId) {
        const resp = await api.bidUpdate(jobId, ownBidId, {
          amount: numericAmount,
          note,
        });
        if (resp.error) {
          const messages = {
            bidding_closed: "Bidding is closed for this job.",
            bid_closed: "This bid is closed and cannot be updated.",
          };
          setError(
            messages[resp.error] ||
              "Unable to update bid. Please try again."
          );
        } else {
          setSuccess("Bid updated.");
          await refreshBids();
        }
      } else {
        const resp = await api.bid(jobId, { amount: numericAmount, note });
        if (resp.error) {
          const messages = {
            bidding_closed: "Bidding is closed for this job.",
            bid_already_exists:
              "You have already placed a bid on this job.",
          };
          setError(
            messages[resp.error] ||
              "Unable to place bid. Please try again."
          );
        } else {
          setSuccess("Bid placed.");
          setOwnBidId(resp.bid?.id || null);
          await refreshBids({ reset: true });
        }
      }
    } catch (err) {
      setError("Unable to submit bid. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBid() {
    if (!ownBidId || deleting) return;
    const confirmed = window.confirm(
      "Delete your bid? This cannot be undone."
    );
    if (!confirmed) return;
    setDeleting(true);
    setError("");
    try {
      await api.bidDelete(ownBidId);
      setSuccess("Bid deleted.");
      setOwnBidId(null);
      setNote("");
      const minAmount = normalizeAmount(job?.budgetAmount);
      if (Number.isFinite(minAmount) && minAmount > 0) {
        setAmountInput(String(minAmount));
      } else {
        setAmountInput("");
      }
      await refreshBids({ reset: true });
    } catch (err) {
      setError("Unable to delete bid. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function refreshBids({ silent = false, reset = false } = {}) {
    try {
      const bidsResp = await api.bidsForJob(jobId);
      const list = Array.isArray(bidsResp?.bids) ? bidsResp.bids : [];
      setBids(list);
      setHighestBid(bidsResp.highestBid || null);
      if (user?.uid) {
        const existing = list.find((bid) => bid.providerId === user.uid);
        if (existing) {
          setOwnBidId(existing.id);
          const numericAmount = Number(existing.amount);
          setAmountInput(
            Number.isFinite(numericAmount) ? String(numericAmount) : ""
          );
          setNote(existing.note || "");
        } else {
          setOwnBidId(null);
          if (reset) {
            const minAmount = normalizeAmount(job?.budgetAmount);
            if (Number.isFinite(minAmount) && minAmount > 0) {
              setAmountInput(String(minAmount));
            } else {
              setAmountInput("");
            }
            setNote("");
          }
        }
      } else if (reset) {
        const minAmount = normalizeAmount(job?.budgetAmount);
        if (Number.isFinite(minAmount) && minAmount > 0) {
          setAmountInput(String(minAmount));
        } else {
          setAmountInput("");
        }
        setNote("");
      }
    } catch (err) {
      if (!silent) {
        setError("Unable to refresh bids.");
      }
    }
  }

  const sortedBids = useMemo(() => {
    return [...bids].sort((a, b) => {
      const aCreated = new Date(a.bidCreatedAt || a.createdAt || 0).getTime();
      const bCreated = new Date(b.bidCreatedAt || b.createdAt || 0).getTime();
      return bCreated - aCreated;
    });
  }, [bids]);

  const ownBid = sortedBids.find((bid) => bid.providerId === user?.uid) || null;
  const highestEntry = highestBid
    ? sortedBids.find((bid) => bid.id === highestBid.id) || null
    : sortedBids.reduce((acc, bid) => {
        const amount = Number(bid.amount);
        if (!Number.isFinite(amount)) return acc;
        if (!acc || amount > Number(acc.amount)) return bid;
        return acc;
      }, null);

  useEffect(() => {
    const total = Math.max(
      1,
      Math.ceil(sortedBids.length / PAGE_SIZE)
    );
    if (page > total) {
      setPage(total);
    }
  }, [page, sortedBids.length]);

  const paginatedBids = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedBids.slice(start, start + PAGE_SIZE);
  }, [sortedBids, page]);

  if (loading) {
    return (
      <div className="container">
        <p>Loading bid details…</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container">
        <InlineNotification
          title="Not Found"
          subtitle="Job could not be found."
          kind="error"
          lowContrast
        />
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(sortedBids.length / PAGE_SIZE));

  return (
    <div className="container bid-detail-container">
      <div className="bid-detail-header">
        <Button kind="ghost" onClick={() => nav("/jobs")}>
          Back to Job List
        </Button>
        <div>
          <h2>{job.title}</h2>
          <p className="job-detail-meta">
            Posted by {contractorName}
          </p>
        </div>
      </div>

      {success && (
        <InlineNotification
          title="Success"
          subtitle={success}
          kind="success"
          lowContrast
          onClose={() => setSuccess("")}
        />
      )}
      {error && (
        <InlineNotification
          title="Error"
          subtitle={error}
          kind="error"
          lowContrast
          onClose={() => setError("")}
        />
      )}

      <div className="bid-detail-content">
        <Tile className="bid-detail-card">
          <MapView markers={mapMarkers} center={mapMarkers[0]} />
          <div className="bid-detail-job-info">
            <p className="bid-detail-label">Job Description</p>
            <p>{job.description || "No description provided."}</p>
            <p className="bid-detail-label">Location</p>
            <p>{job.location?.address || "Lat/Lng provided"}</p>
          </div>
        </Tile>

        <Tile className="bid-detail-card">
          <h3>{ownBidId ? "Update Your Bid" : "Place Your Bid"}</h3>
          {highestEntry ? (
            <p className="bid-detail-highest">
              Highest bid: ${Number(highestEntry.amount).toLocaleString()}{" "}
              {highestEntry.bidderName ? `by ${highestEntry.bidderName}` : ""}
            </p>
          ) : (
            <p className="bid-detail-highest">Be the first to bid.</p>
          )}
          {biddingClosed && (
            <InlineNotification
              title="Bidding Closed"
              subtitle="This job is no longer accepting bids."
              kind="info"
              lowContrast
            />
          )}
          {budgetDisplay && (
            <p className="bid-detail-helper">
              Minimum bid (contractor budget): {budgetDisplay}
            </p>
          )}
          <Form onSubmit={submitBid} className="bid-detail-form">
            <NumberInput
              id="bid-amount"
              label="Your Bid Amount"
              value={amountInput === "" ? "" : Number(amountInput)}
              onChange={handleAmountChange}
              allowEmpty
              min={budgetAmountNumber ?? 0}
              step={5}
              disabled={submitting || biddingClosed}
              helperText={
                budgetDisplay
                  ? `Enter an amount of at least ${budgetDisplay}.`
                  : undefined
              }
            />
            <TextInput
              id="bid-note"
              labelText="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={submitting || biddingClosed}
            />
            <Button
              type="submit"
              disabled={submitting || biddingClosed}
              className="bid-detail-submit"
            >
              {ownBidId
                ? submitting
                  ? "Updating…"
                  : "Update Bid"
                : submitting
                ? "Placing…"
                : "Place Bid"}
            </Button>
            {ownBidId && (
              <Button
                type="button"
                kind="danger--ghost"
                onClick={handleDeleteBid}
                disabled={submitting || deleting}
              >
                Delete Bid
              </Button>
            )}
          </Form>
        </Tile>
      </div>

      <Tile className="bid-detail-card">
        <h3>Recent Bids</h3>
        {sortedBids.length === 0 ? (
          <p>No bids yet.</p>
        ) : (
          <>
            <ul className="bid-list">
              {paginatedBids.map((bid) => {
                const amountValue = Number(bid.amount);
                const isOwn = bid.providerId === user?.uid;
                const isHighest = highestEntry && highestEntry.id === bid.id;
                const status = (bid.status || "active").toLowerCase();
                const statusLabel =
                  status.charAt(0).toUpperCase() + status.slice(1);
                const itemClassNames = ["bid-list-item"];
                if (isOwn) itemClassNames.push("bid-list-item--own");
                if (["accepted", "rejected", "active"].includes(status)) {
                  itemClassNames.push(`bid-list-item--${status}`);
                }
                return (
                  <li key={bid.id} className={itemClassNames.join(" ")}>
                    <div>
                      <p className="bid-list-amount">
                        $
                        {Number.isFinite(amountValue)
                          ? amountValue.toLocaleString()
                          : bid.amount}
                        {isHighest && <span className="bid-tag">Highest</span>}
                        {isOwn && (
                          <span className="bid-tag bid-tag--own">Your bid</span>
                        )}
                      </p>
                      <p className="bid-list-meta">
                        {bid.bidderName || "Bidder"} ·{" "}
                        <span
                          className={`bid-status-badge bid-status-badge--${status}`}
                        >
                          {statusLabel}
                        </span>{" "}
                        ·{" "}
                        {new Date(
                          bid.bidCreatedAt || bid.createdAt || Date.now()
                        ).toLocaleString()}
                      </p>
                      {bid.note && <p className="bid-list-note">“{bid.note}”</p>}
                      {bid.statusNote && (
                        <p className="bid-list-status-note">
                          {bid.statusNote}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {totalPages > 1 && (
              <div className="bid-pagination">
                <Button
                  kind="ghost"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <span className="bid-pagination__status">
                  Page {page} of {totalPages}
                </span>
                <Button
                  kind="ghost"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Tile>
    </div>
  );
}
