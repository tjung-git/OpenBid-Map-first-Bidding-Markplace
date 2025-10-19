import { useEffect, useState } from "react";
import { Button, InlineNotification } from "@carbon/react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { getUser } from "../services/session";
import "../styles/pages/bid.css";

export default function MyBids() {
  const [bids, setBids] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const location = useLocation();
  const user = getUser();

  useEffect(() => {
    if (user && user.userType !== "bidder") {
      nav("/jobs", { replace: true });
    }
  }, [user, nav]);

  useEffect(() => {
    if (location.state?.notice) {
      setSuccess(location.state.notice);
      const { notice, ...rest } = location.state;
      nav(location.pathname, { replace: true, state: rest });
    }
  }, [location.state, location.pathname, nav]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const resp = await api.bidsForUser();
        setBids(resp.bids || []);
      } catch (err) {
        setError("Unable to load your bids.");
      } finally {
        setLoading(false);
      }
    }
    if (user?.userType === "bidder") {
      load();
    }
  }, [user?.userType]);

  async function remove(bidId) {
    const target = bids.find((bid) => bid.id === bidId);
    if (target && (target.status || "").toLowerCase() === "accepted") {
      return;
    }
    const confirmed = window.confirm(
      "Delete this bid? This cannot be undone."
    );
    if (!confirmed) return;
    try {
      await api.bidDelete(bidId);
      setBids((prev) => prev.filter((bid) => bid.id !== bidId));
      setSuccess("Bid deleted.");
    } catch (err) {
      setError("Unable to delete bid.");
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container bid-detail-container">
      <div className="bid-detail-header">
        <Button kind="ghost" onClick={() => nav("/jobs")}>
          Back to Job List
        </Button>
        <h2>My Bids</h2>
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
      {loading ? (
        <p>Loading…</p>
      ) : bids.length === 0 ? (
        <InlineNotification
          title="No Bids Found"
          subtitle="You have not placed any bids yet."
          kind="info"
          lowContrast
        />
      ) : (
        <div className="bid-list">
          {bids.map((bid) => {
            const amountValue = Number(bid.amount);
            const amountDisplay = Number.isFinite(amountValue)
              ? amountValue.toLocaleString()
              : bid.amount;
            const createdAt = bid.bidCreatedAt || bid.createdAt;
                const status = (bid.status || "active").toLowerCase();
                const deleteDisabled = status === "accepted";
            const statusLabel =
              status.charAt(0).toUpperCase() + status.slice(1);
            const itemClassNames = ["bid-list-item", "bid-list-item--own"];
            if (["accepted", "rejected", "active"].includes(status)) {
              itemClassNames.push(`bid-list-item--${status}`);
            }
            return (
              <div key={bid.id} className={itemClassNames.join(" ")}>
                <div className="bid-list-amount">
                  ${amountDisplay}
                  <span className="bid-tag">Bid</span>
                </div>
                <p className="bid-list-meta">
                  Job: {bid.jobTitle || bid.jobId} · Contractor: {bid.contractorName || "Unknown"}
                </p>
                {bid.jobBudgetAmount !== undefined && (
                  <p className="bid-list-meta">
                    Job Budget: {Number.isFinite(Number(bid.jobBudgetAmount))
                      ? `$${Number(bid.jobBudgetAmount).toLocaleString()}`
                      : bid.jobBudgetAmount}
                  </p>
                )}
                {bid.jobDescription && (
                  <p className="bid-list-note">{bid.jobDescription}</p>
                )}
                <p className="bid-list-meta">
                  {createdAt ? new Date(createdAt).toLocaleString() : ""} ·{" "}
                  <span
                    className={`bid-status-badge bid-status-badge--${status}`}
                  >
                    {statusLabel}
                  </span>
                </p>
                {bid.note && <p className="bid-list-note">“{bid.note}”</p>}
                {bid.statusNote && (
                  <p className="bid-list-status-note">{bid.statusNote}</p>
                )}
                <div className="job-row-actions">
                  <Button
                    size="sm"
                    onClick={() =>
                      nav(`/jobs/myBids/bidDetails/${bid.jobId}`, {
                        state: { fromMyBids: true },
                      })
                    }
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    kind="danger--ghost"
                    disabled={deleteDisabled}
                    onClick={() => {
                      if (!deleteDisabled) {
                        remove(bid.id);
                      }
                    }}
                  >
                    Delete Bid
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
