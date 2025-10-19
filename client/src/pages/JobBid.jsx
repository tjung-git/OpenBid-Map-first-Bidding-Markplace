import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function JobBid() {
  const { jobId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const user = getUser();
  const requirements = getRequirements();
  const existingNotice = location.state?.notice || "";

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
  const canBid = isBidder && kycVerified;

  const mapMarkers = useMemo(() => {
    if (!job?.location?.lat || !job?.location?.lng) return [];
    return [job.location];
  }, [job?.location?.lat, job?.location?.lng]);

  const hydrateBids = useCallback(
    (list = [], highest = null, { resetPage = false, minAmount = null } = {}) => {
      setBids(list);
      setHighestBid(highest);

      if (user?.uid) {
        const existing = list.find((bid) => bid.providerId === user.uid);
        if (existing) {
          const numericAmount = Number(existing.amount);
          setOwnBidId(existing.id);
          setAmountInput(
            Number.isFinite(numericAmount) ? String(numericAmount) : ""
          );
          setNote(existing.note || "");
        } else {
          setOwnBidId(null);
          if (resetPage) {
            if (Number.isFinite(minAmount) && minAmount > 0) {
              setAmountInput(String(minAmount));
            } else {
              setAmountInput("");
            }
            setNote("");
          }
        }
      }

      setPage((prev) => {
        const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        if (resetPage) return 1;
        return prev > total ? total : prev;
      });
    },
    [user?.uid]
  );

  const loadJob = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [jobResp, bidsResp] = await Promise.all([
        api.jobGet(jobId),
        api.bidsForJob(jobId),
      ]);
      const jobData = jobResp?.job || null;
      setJob(jobData);
      setContractor(jobResp?.contractor || null);
      const list = Array.isArray(bidsResp?.bids) ? bidsResp.bids : [];
      const minAmount = normalizeAmount(jobData?.budgetAmount);
      hydrateBids(list, bidsResp?.highestBid || null, {
        resetPage: true,
        minAmount,
      });
    } catch (err) {
      console.error("[JobBid] load failed", err);
      setError("Unable to load job for bidding.");
      setJob(null);
      setContractor(null);
      hydrateBids([], null, { resetPage: true });
    } finally {
      setLoading(false);
    }
  }, [jobId, hydrateBids]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  useEffect(() => {
    if (location.state?.notice) {
      setSuccess(location.state.notice);
      const { notice, ...rest } = location.state;
      nav(location.pathname, { replace: true, state: rest });
    }
  }, [location.state, location.pathname, nav]);

  const refreshBids = useCallback(
    async ({ silent = false, reset = false } = {}) => {
      try {
        const bidsResp = await api.bidsForJob(jobId);
        const list = Array.isArray(bidsResp?.bids) ? bidsResp.bids : [];
        hydrateBids(list, bidsResp?.highestBid || null, {
          minAmount: normalizeAmount(job?.budgetAmount),
          resetPage: reset,
        });
      } catch (err) {
        console.error("[JobBid] refresh failed", err);
        if (!silent) {
          setError("Unable to refresh bids.");
        }
      }
    },
    [jobId, hydrateBids, job?.budgetAmount]
  );

  useEffect(() => {
    if (loading) return undefined;
    const interval = window.setInterval(() => {
      refreshBids({ silent: true });
    }, 10000);
    return () => window.clearInterval(interval);
  }, [loading, refreshBids]);

  useEffect(() => {
    if (!loading && isBidder && ownBidId) {
      const notice =
        success ||
        existingNotice ||
        "You already placed a bid for this job. Showing your bid details.";
      nav(`/bids/${jobId}`, {
        replace: true,
        state: { notice },
      });
    }
  }, [loading, isBidder, ownBidId, jobId, nav, success, existingNotice]);

  const sortedBids = useMemo(() => {
    return [...bids].sort((a, b) => {
      const aCreated = new Date(a.bidCreatedAt || a.createdAt || 0).getTime();
      const bCreated = new Date(b.bidCreatedAt || b.createdAt || 0).getTime();
      return bCreated - aCreated;
    });
  }, [bids]);

  const ownBid = useMemo(
    () => sortedBids.find((bid) => bid.providerId === user?.uid) || null,
    [sortedBids, user?.uid]
  );

  const highestEntry = useMemo(() => {
    if (highestBid?.id) {
      return (
        sortedBids.find((bid) => bid.id === highestBid.id) ||
        sortedBids.find(
          (bid) => Number(bid.amount) === Number(highestBid.amount)
        ) ||
        null
      );
    }
    return sortedBids.reduce((acc, bid) => {
      const amount = Number(bid.amount);
      if (!Number.isFinite(amount)) return acc;
      if (!acc || amount > Number(acc.amount)) return bid;
      return acc;
    }, null);
  }, [highestBid, sortedBids]);

  const highestAmountDisplay = useMemo(() => {
    if (!highestEntry) return null;
    const numeric = Number(highestEntry.amount);
    return Number.isFinite(numeric)
      ? numeric.toLocaleString()
      : highestEntry.amount || "—";
  }, [highestEntry]);

  const otherBids = useMemo(() => {
    return sortedBids.filter((bid) => {
      if (ownBid && bid.id === ownBid.id) return false;
      if (highestEntry && bid.id === highestEntry.id) return false;
      return true;
    });
  }, [sortedBids, ownBid, highestEntry]);

  const budgetAmountNumber = useMemo(
    () => normalizeAmount(job?.budgetAmount),
    [job?.budgetAmount]
  );

  const budgetDisplay = useMemo(() => {
    if (budgetAmountNumber !== null) {
      return `$${budgetAmountNumber.toLocaleString()}`;
    }
    if (job?.budgetAmount !== undefined && job?.budgetAmount !== null) {
      return String(job.budgetAmount);
    }
    return null;
  }, [budgetAmountNumber, job?.budgetAmount]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(otherBids.length / PAGE_SIZE)),
    [otherBids.length]
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!ownBid && Number.isFinite(budgetAmountNumber) && budgetAmountNumber > 0) {
      setAmountInput((current) => {
        const numeric = Number(current);
        if (Number.isFinite(numeric) && numeric >= budgetAmountNumber) {
          return current;
        }
        return String(budgetAmountNumber);
      });
    }
  }, [ownBid, budgetAmountNumber]);

  const paginatedBids = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return otherBids.slice(start, start + PAGE_SIZE);
  }, [otherBids, page]);

  const showPagination = otherBids.length > PAGE_SIZE;

  function errorMessageFromResponse(resp, { mode } = {}) {
    const minAmount = Number(resp?.minAmount);
    switch (resp?.error) {
      case "bid_below_budget":
        return `Bids must be at least ${
          Number.isFinite(minAmount)
            ? `$${minAmount.toLocaleString()}`
            : "the job budget amount"
        }.`;
      case "bid_already_exists":
        return "You already have a bid for this job. Update or delete it instead.";
      case "invalid_amount":
        return "Enter a valid bid amount greater than zero.";
      case "no_update_fields":
        return "Nothing to update. Change an amount or note before saving.";
      default:
        return mode === "update"
          ? "Unable to update bid. Please try again."
          : "Unable to submit bid. Please try again.";
    }
  }

  function handleAmountChange(_, { value }) {
    const raw = value == null ? "" : String(value);
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const normalized = cleaned.replace(/^0+(?=\d)/, "");
    if (!normalized) {
      setAmountInput("");
      if (error && error.includes("budget")) {
        setError("");
      }
      return;
    }
    const numeric = Number(normalized);
    if (Number.isFinite(budgetAmountNumber) && numeric < budgetAmountNumber) {
      setError(
        `You cannot bid below the contractor's budget of ${budgetDisplay}.`
      );
    } else if (error && error.includes("budget")) {
      setError("");
    }
    setAmountInput(normalized);
  }

  async function submitBid(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const numericAmount = Number(amountInput);
    if (!canBid) {
      setError(
        isBidder
          ? "Complete KYC before bidding on jobs."
          : "Only bidder accounts can place bids."
      );
      if (isBidder && !kycVerified) {
        nav("/kyc", {
          replace: true,
          state: { notice: "Complete KYC before bidding on jobs." },
        });
      }
      return;
    }
    if (!Number.isFinite(numericAmount) || amountInput === "") {
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
        if (resp?.error) {
          setError(errorMessageFromResponse(resp, { mode: "update" }));
        } else {
          setSuccess("Bid updated.");
          await refreshBids();
        }
      } else {
        const resp = await api.bid(jobId, {
          amount: numericAmount,
          note,
        });
        if (resp?.error) {
          setError(errorMessageFromResponse(resp, { mode: "create" }));
        } else {
          setSuccess("Bid placed.");
          setOwnBidId(resp.bid?.id || null);
          await refreshBids({ reset: true });
        }
      }
    } catch (err) {
      console.error("[JobBid] submit failed", err);
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

  const renderBidItem = (
    bid,
    { highlightOwn = false, highlightHighest = false } = {}
  ) => {
    if (!bid) return null;
    const amountValue = Number(bid.amount);
    const status = (bid.status || "active").toLowerCase();
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    const itemClassNames = ["bid-list-item"];
    if (highlightOwn) itemClassNames.push("bid-list-item--own");
    if (["accepted", "rejected", "active"].includes(status)) {
      itemClassNames.push(`bid-list-item--${status}`);
    }
    return (
      <li
        key={bid.id || `${bid.providerId}-${bid.bidCreatedAt}`}
        className={itemClassNames.join(" ")}
      >
        <div>
          <p className="bid-list-amount">
            ${Number.isFinite(amountValue) ? amountValue.toLocaleString() : bid.amount}
            {highlightHighest && <span className="bid-tag">Highest</span>}
            {highlightOwn && <span className="bid-tag bid-tag--own">Your bid</span>}
          </p>
          <p className="bid-list-meta">
            {bid.bidderName || "Bidder"} ·{" "}
            <span className={`bid-status-badge bid-status-badge--${status}`}>
              {statusLabel}
            </span>{" "}
            ·{" "}
            {new Date(
              bid.bidCreatedAt || bid.createdAt || Date.now()
            ).toLocaleString()}
          </p>
          {bid.note && <p className="bid-list-note">“{bid.note}”</p>}
        </div>
      </li>
    );
  };

  return (
    <div className="container bid-detail-container">
      <div className="bid-detail-header">
        <Button kind="ghost" onClick={() => nav("/jobs")}>
          Back to Job List
        </Button>
        <div>
          <h2>{job.title}</h2>
          <p className="job-detail-meta">
            Posted by{" "}
            {[contractor?.firstName, contractor?.lastName]
              .filter(Boolean)
              .join(" ") || contractor?.email || "Unknown contractor"}
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
          {!canBid && (
            <InlineNotification
              title="Bidding Restricted"
              subtitle={
                isBidder
                  ? "Complete KYC before you can place bids."
                  : "Switch to a bidder account to place bids."
              }
              kind="warning"
              lowContrast
            />
          )}
          {highestEntry ? (
            <p className="bid-detail-highest">
              Highest bid: ${highestAmountDisplay}{" "}
              {highestEntry.bidderName ? `by ${highestEntry.bidderName}` : ""}
            </p>
          ) : (
            <p className="bid-detail-highest">Be the first to bid.</p>
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
              allowEmpty
              onChange={handleAmountChange}
              min={budgetAmountNumber ?? 0}
              step={5}
              disabled={!canBid}
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
              disabled={!canBid}
            />
            <Button
              type="submit"
              disabled={submitting || !canBid}
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
        <h3>Your Bid & Highest Bid</h3>
        <div className="bid-highlight-grid">
          <div className="bid-highlight-section">
            <h4>Your Bid</h4>
            {ownBid ? (
              <ul className="bid-list">
                {renderBidItem(ownBid, {
                  highlightOwn: true,
                  highlightHighest:
                    Boolean(highestEntry && highestEntry.id === ownBid.id),
                })}
              </ul>
            ) : (
              <p>You haven't placed a bid yet.</p>
            )}
          </div>
          <div className="bid-highlight-section">
            <h4>Highest Bid</h4>
            {highestEntry ? (
              <ul className="bid-list">
                {renderBidItem(highestEntry, {
                  highlightHighest: true,
                  highlightOwn: highestEntry?.providerId === user?.uid,
                })}
              </ul>
            ) : (
              <p>No bids yet.</p>
            )}
          </div>
        </div>
      </Tile>

      <Tile className="bid-detail-card">
        <h3>Other Bids</h3>
        {otherBids.length === 0 ? (
          <p>No other bids yet.</p>
        ) : (
          <>
            <ul className="bid-list">
              {paginatedBids.map((bid) =>
                renderBidItem(bid, {
                  highlightHighest: Boolean(
                    highestEntry && highestEntry.id === bid.id
                  ),
                })
              )}
            </ul>
            {showPagination && (
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
