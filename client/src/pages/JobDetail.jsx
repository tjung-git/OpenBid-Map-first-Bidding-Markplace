import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Form,
  NumberInput,
  TextInput,
  TextArea,
  Button,
  InlineNotification,
  Tile,
  Tag,
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  InlineLoading,
} from "@carbon/react";
import { StarFilled, Star } from "@carbon/icons-react";
import { api } from "../services/api";
import { useSessionUser } from "../hooks/useSession";
import MapView from "../components/MapView";
import SearchAutocomplete from "../components/SearchAutocomplete";
import "../styles/pages/jobs.css";
import "../styles/components/pagination.css";
import "../styles/components/page-shell.css";
import { cfg } from "../services/config";

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
  const user = useSessionUser();

  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState("");
  const [bidNote, setBidNote] = useState("");
  const [bidError, setBidError] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [flash, setFlash] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [acceptingBidId, setAcceptingBidId] = useState(null);
  const [address, setAddress] = useState("Toronto, ON, Canada");
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [selectedBidder, setSelectedBidder] = useState(null);
  const [reviewsData, setReviewsData] = useState(null);
  const [reviewsCache, setReviewsCache] = useState({});
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewComposeOpen, setReviewComposeOpen] = useState(false);
  const [reviewComposeBid, setReviewComposeBid] = useState(null);
  const [reviewComposeLoading, setReviewComposeLoading] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewDescription, setReviewDescription] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState([]);
  const [reviewPhotoPreviews, setReviewPhotoPreviews] = useState([]);
  const [reviewExistingPhotos, setReviewExistingPhotos] = useState([]);
  const [reviewRemovePhotoUrls, setReviewRemovePhotoUrls] = useState([]);
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDeleting, setReviewDeleting] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editBudget, setEditBudget] = useState("0");
  const [editLat, setEditLat] = useState(43.6532);
  const [editLng, setEditLng] = useState(-79.3832);

  const toNumber = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const handlePlaceSelection = (placeData) => {
    const {address, latLng} = placeData;
    console.log(address);
    console.log(latLng);
    setAddress(address);
    setEditLat(latLng.lat);
    setEditLng(latLng.lng);
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
        : "";
    const cleaned = rawBudget ? rawBudget.replace(/[^0-9.\-]/g, "") : "";
    setEditBudget(cleaned);
    setEditLat(job.location?.lat ?? 43.6532);
    setEditLng(job.location?.lng ?? -79.3832);
    setAddress(job.location?.address ?? "Toronto, ON, Canada");
  }, [job]);

  const isContractor = user?.userType === "contractor";
  const isOwner = isContractor && job && job.posterId === user?.uid;
  const isOwnJob = Boolean(job && user?.uid && job.posterId === user.uid);
  const jobStatus = (job?.status || "open").toLowerCase();
  const biddingClosed = jobStatus !== "open";
  const jobLocked = jobStatus !== "open";
  const awardedProviderId = job?.awardedProviderId || null;
  const hasCachedAwardedReviews = awardedProviderId
    ? Boolean(reviewsCache[awardedProviderId])
    : false;

  useEffect(() => {
    if (!isOwner || !awardedProviderId) return;
    if (jobStatus !== "awarded") return;
    if (hasCachedAwardedReviews) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await api.reviewsForUser(awardedProviderId);
        if (cancelled) return;
        setReviewsCache((prev) => ({ ...prev, [awardedProviderId]: data }));
      } catch {
        // ignore prefetch failures; user can still open modal
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOwner, jobStatus, awardedProviderId, hasCachedAwardedReviews]);

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
    if (isOwnJob) {
      setBidError("You posted this job. Switch to contractor view to manage it.");
      return;
    }
    if (biddingClosed) {
      setBidError("Bidding is closed for this job.");
      return;
    }
    const numericBid = Number(bidAmount);
    if (!Number.isFinite(numericBid) || bidAmount === "" || numericBid <= 0) {
      setBidError("Enter a valid bid amount greater than 0.");
      return;
    }
    const response = await api.bid(jobId, {
      amount: numericBid,
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
    setBidAmount("");
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
        budgetAmount:
          editBudget === "" ? null : Number.parseFloat(editBudget) || 0,
        location: {
          ...(job?.location || {}),
          lat: editLat,
          lng: editLng,
          address: address
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

  const renderStars = (value) => {
    const rating = Math.max(0, Math.min(5, Number(value) || 0));
    const stars = [];
    for (let i = 1; i <= 5; i += 1) {
      stars.push(
        i <= rating ? (
          <StarFilled key={i} size={16} />
        ) : (
          <Star key={i} size={16} />
        )
      );
    }
    return <span className="review-stars">{stars}</span>;
  };

  const getMyReviewFor = (providerId) => {
    if (!providerId || !user?.uid) return null;
    const cached = reviewsCache[providerId];
    const list = cached?.reviews;
    if (!Array.isArray(list)) return null;
    return (
      list.find((r) => r?.jobId === jobId && r?.reviewerId === user.uid) || null
    );
  };

  const renderSelectableStars = (value, onChange) => {
    const rating = Math.max(0, Math.min(5, Number(value) || 0));
    const stars = [];
    for (let i = 1; i <= 5; i += 1) {
      const filled = i <= rating;
      stars.push(
        <button
          key={i}
          type="button"
          className="review-star-button"
          onClick={() => onChange(i)}
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
        >
          {filled ? <StarFilled size={20} /> : <Star size={20} />}
        </button>
      );
    }
    return <div className="review-compose-stars">{stars}</div>;
  };

  const openReviews = async (bid) => {
    if (!bid?.providerId) return;
    const bidder = {
      uid: bid.providerId,
      bidderName: bid.bidderName || "Bidder",
    };
    setSelectedBidder(bidder);
    setReviewsError("");
    setReviewsOpen(true);
    setReviewsPage(1);

    const cached = reviewsCache[bidder.uid];
    if (cached) {
      setReviewsData(cached);
      return;
    }

    setReviewsLoading(true);
    setReviewsData(null);
    try {
      const data = await api.reviewsForUser(bidder.uid);
      setReviewsCache((prev) => ({ ...prev, [bidder.uid]: data }));
      setReviewsData(data);
    } catch (err) {
      setReviewsError(err?.data?.error || "Unable to load reviews.");
    } finally {
      setReviewsLoading(false);
    }
  };

  const clearReviewPhotos = useCallback(() => {
    reviewPhotoPreviews.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    setReviewPhotoPreviews([]);
    setReviewPhotos([]);
  }, [reviewPhotoPreviews]);

  const closeReviewComposer = useCallback(() => {
    setReviewComposeOpen(false);
    setReviewComposeBid(null);
    setReviewComposeLoading(false);
    setExistingReview(null);
    setReviewRating(0);
    setReviewDescription("");
    setReviewExistingPhotos([]);
    setReviewRemovePhotoUrls([]);
    setReviewSubmitError("");
    setReviewSubmitting(false);
    setReviewDeleting(false);
    clearReviewPhotos();
  }, [clearReviewPhotos]);

  const openReviewComposer = async (bid) => {
    if (!bid?.providerId) return;
    setReviewComposeBid(bid);
    setReviewComposeOpen(true);
    setReviewComposeLoading(true);
    setExistingReview(null);
    setReviewSubmitError("");
    setReviewSubmitting(false);
    setReviewDeleting(false);
    setReviewRating(5);
    setReviewDescription("");
    setReviewExistingPhotos([]);
    setReviewRemovePhotoUrls([]);
    clearReviewPhotos();

    const providerId = bid.providerId;
    const cached = reviewsCache[providerId];
    try {
      const data = cached || (await api.reviewsForUser(providerId));
      if (!cached) {
        setReviewsCache((prev) => ({ ...prev, [providerId]: data }));
      }
      const mine = (data?.reviews || []).find(
        (r) => r?.jobId === jobId && r?.reviewerId === user?.uid
      );
      setExistingReview(mine || null);
      if (mine) {
        setReviewRating(Number(mine.rating) || 0);
        setReviewDescription(String(mine.description || ""));
        const urls = Array.isArray(mine.photoUrls) ? mine.photoUrls : [];
        const thumbs = Array.isArray(mine.photoThumbUrls)
          ? mine.photoThumbUrls
          : [];
        setReviewExistingPhotos(
          urls
            .map((url, idx) => ({
              url,
              thumbUrl: thumbs[idx] || null,
            }))
            .filter((p) => Boolean(p.url))
        );
      }
    } catch (err) {
      setReviewSubmitError(err?.data?.error || "Unable to check existing review.");
    } finally {
      setReviewComposeLoading(false);
    }
  };

  const submitReview = async () => {
    if (!reviewComposeBid?.providerId) return;
    if (reviewSubmitting) return;
    setReviewSubmitError("");

    const providerId = reviewComposeBid.providerId;
    const hasExisting = Boolean(existingReview?.id);

    if (!reviewRating || reviewRating < 1) {
      setReviewSubmitError("Please select a star rating.");
      return;
    }
    if (providerId === user?.uid) {
      setReviewSubmitError("You cannot review yourself.");
      return;
    }

    setReviewSubmitting(true);
    try {
      let reviewId = existingReview?.id || null;
      if (!reviewId) {
        const resp = await api.reviewCreate({
          jobId,
          reviewedId: providerId,
          rating: reviewRating,
          description: reviewDescription,
        });
        reviewId = resp?.review?.id;
      }

      if (!reviewId) {
        throw new Error("Missing review id.");
      }

      if (existingReview?.id) {
        await api.reviewUpdate(reviewId, {
          rating: reviewRating,
          description: reviewDescription,
        });
      }

      if (existingReview?.id && reviewRemovePhotoUrls.length > 0) {
        await api.reviewDeletePhotos(reviewId, reviewRemovePhotoUrls);
        setReviewRemovePhotoUrls([]);
      }

      if (reviewPhotos.length > 0) {
        await api.reviewUploadPhotos(reviewId, reviewPhotos);
      }

      const refreshed = await api.reviewsForUser(providerId);
      setReviewsCache((prev) => ({ ...prev, [providerId]: refreshed }));
      if (reviewsOpen && selectedBidder?.uid === providerId) {
        setReviewsData(refreshed);
      }
      const mine = (refreshed?.reviews || []).find(
        (r) => r?.jobId === jobId && r?.reviewerId === user?.uid
      );
      setExistingReview(mine || null);
      if (mine) {
        const urls = Array.isArray(mine.photoUrls) ? mine.photoUrls : [];
        const thumbs = Array.isArray(mine.photoThumbUrls)
          ? mine.photoThumbUrls
          : [];
        setReviewExistingPhotos(
          urls
            .map((url, idx) => ({
              url,
              thumbUrl: thumbs[idx] || null,
            }))
            .filter((p) => Boolean(p.url))
        );
      } else {
        setReviewExistingPhotos([]);
      }
      clearReviewPhotos();
      setFlash(existingReview?.id ? "Review updated." : "Review submitted.");
      closeReviewComposer();
    } catch (err) {
      const code = err?.data?.error;
      if (code === "review_already_exists") {
        try {
          const refreshed = await api.reviewsForUser(providerId);
          setReviewsCache((prev) => ({ ...prev, [providerId]: refreshed }));
          const mine = (refreshed?.reviews || []).find(
            (r) => r?.jobId === jobId && r?.reviewerId === user?.uid
          );
          setExistingReview(mine || null);
          setReviewSubmitError("You already submitted a review for this job.");
        } catch {
          setReviewSubmitError("You already submitted a review for this job.");
        }
      } else if (code === "storage_unavailable") {
        const extra = err?.data?.details ? ` (${err.data.details})` : "";
        setReviewSubmitError(
          `Photo upload is unavailable right now. Your review text was saved; try photos again later.${extra}`
        );
      } else {
        const details = [
          code,
          err?.data?.message,
          err?.message,
          err?.status ? `HTTP ${err.status}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        setReviewSubmitError(
          details || "Unable to submit review. Please try again."
        );
      }
    } finally {
      setReviewSubmitting(false);
    }
  };

  const deleteReview = async () => {
    if (!existingReview?.id) return;
    if (reviewDeleting) return;
    const confirmed = window.confirm(
      "Delete this review? This will remove the rating, description, and all uploaded photos."
    );
    if (!confirmed) return;
    setReviewSubmitError("");
    setReviewDeleting(true);
    try {
      await api.reviewDelete(existingReview.id);
      const providerId = reviewComposeBid?.providerId;
      if (providerId) {
        const refreshed = await api.reviewsForUser(providerId);
        setReviewsCache((prev) => ({ ...prev, [providerId]: refreshed }));
        if (reviewsOpen && selectedBidder?.uid === providerId) {
          setReviewsData(refreshed);
        }
      }
      closeReviewComposer();
    } catch (err) {
      setReviewSubmitError(err?.data?.error || "Unable to delete review.");
      setReviewDeleting(false);
    }
  };

  const closeReviews = () => {
    setReviewsOpen(false);
    setReviewsError("");
    setReviewsLoading(false);
    setSelectedBidder(null);
    setReviewsData(null);
    setReviewsPage(1);
  };

  if (!job) return null;

  const budgetDisplay =
    typeof job.budgetAmount === "number"
      ? `$${job.budgetAmount.toLocaleString()}`
      : job.budgetAmount ?? "-";
  const createdDisplay = job.createdAt
    ? new Date(job.createdAt).toLocaleString()
    : "Unknown";
  const locationDisplay =
    job.location?.address ||
    (job.location?.lat != null && job.location?.lng != null
      ? `${job.location.lat}, ${job.location.lng}`
      : "—");

  const statusTagType =
    jobStatus === "open" ? "blue" : jobStatus === "awarded" ? "green" : "cool-gray";

  return (
    <div className="page-shell job-detail-page">
      <div className="page-hero">
        <div className="page-hero-left">
          <Button kind="ghost" onClick={() => navigate("/jobs")}>
            Back to Job List
          </Button>
          <div className="page-hero-titles">
            <h2 className="page-hero-title">{job.title}</h2>
            <p className="page-hero-subtitle">
              Created {createdDisplay} · Location: {locationDisplay}
            </p>
          </div>
        </div>
        <div className="page-hero-actions">
          <Tag type={statusTagType}>
            {(job.status || "open").toString().toUpperCase()}
          </Tag>
          {budgetDisplay !== "-" && (
            <Tag type="outline">Budget: {budgetDisplay}</Tag>
          )}
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

      <div className="page-grid">
        <div className="page-stack">
          <Tile className="page-card">
            <h3 className="page-card-title">Overview</h3>
            <p className="page-card-subtitle">
              What’s needed, the expected budget, and the current job status.
            </p>
            <div className="job-summary-grid">
              <div className="job-summary-item">
                <div className="job-summary-label">Description</div>
                <div className="job-summary-value">
                  {job.description || "No description provided."}
                </div>
              </div>
              <div className="job-summary-item">
                <div className="job-summary-label">Budget</div>
                <div className="job-summary-value">{budgetDisplay}</div>
              </div>
              <div className="job-summary-item">
                <div className="job-summary-label">Status</div>
                <div className="job-summary-value">
                  {(job.status || "open").toString()}
                </div>
              </div>
              <div className="job-summary-item">
                <div className="job-summary-label">Created</div>
                <div className="job-summary-value">{createdDisplay}</div>
              </div>
            </div>
          </Tile>

          {isOwner ? (
            <Tile className="page-card">
              <h3 className="page-card-title">Manage job</h3>
              <p className="page-card-subtitle">
                Update details while the job is open.
              </p>
              {jobLocked && (
                <InlineNotification
                  title="Job Locked"
                  subtitle="You accepted a bid. Finish your job and get paid."
                  kind="info"
                  lowContrast
                />
              )}
              <div className="page-card-body">
                <Form onSubmit={handleUpdate} className="page-stack">
                <TextInput
                  id="job-title"
                  labelText="Job Title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={jobLocked}
                  required
                />
                <TextArea
                  id="job-desc"
                  labelText="Job Description"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  disabled={jobLocked}
                  rows={4}
                />
                <TextInput
                  id="job-budget"
                  type="text"
                  labelText="Job Budget"
                  value={editBudget}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const cleaned = raw.replace(/[^0-9.]/g, "");
                    const normalized = cleaned.replace(/^0+(?=\d)/, "");
                    setEditBudget(normalized);
                  }}
                  placeholder="Enter budget"
                  disabled={jobLocked}
                />
                {cfg.prototype ? (
                  <div className="job-form-grid">
                    <NumberInput
                      key={`lat-${editLat}`}
                      id="lat"
                      label="Latitude"
                      value={editLat}
                      onChange={(_, { value }) => setEditLat(Number(value))}
                    />
                    <NumberInput
                      key={`lng-${editLng}`}
                      id="lng"
                      label="Longitude"
                      value={editLng}
                      onChange={(_, { value }) => setEditLng(Number(value))}
                    />
                  </div>
                ) : (
                  <div className="job-location-search-container">
                    <SearchAutocomplete onSelectPlace={handlePlaceSelection} />
                    <div>Selected location: {address}</div>
                  </div>
                )}
                <div className="job-detail-actions job-detail-actions--tight">
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
              </div>
            </Tile>
          ) : (
            <Tile className="page-card">
              <h3 className="page-card-title">Bid on this job</h3>
              <p className="page-card-subtitle">
                Submit a competitive price and a quick note for the contractor.
              </p>
              {isOwnJob ? (
                <InlineNotification
                  title="Bidding Restricted"
                  subtitle="You posted this job. Switch to contractor view to manage it."
                  kind="info"
                  lowContrast
                />
              ) : biddingClosed ? (
                <InlineNotification
                  title="Bidding Closed"
                  subtitle={bidError || "This job is no longer accepting bids."}
                  kind="info"
                  lowContrast
                />
              ) : (
                <>
                  {bidError && (
                    <InlineNotification
                      title="Error"
                      subtitle={bidError}
                      kind="error"
                      lowContrast
                    />
                  )}
                  <div className="page-card-body">
                    <Form onSubmit={placeBid} className="page-stack">
                    <NumberInput
                      id="bid-amount"
                      label="Bid amount"
                      value={bidAmount === "" ? "" : Number(bidAmount)}
                      allowEmpty
                      onChange={(_, { value }) => {
                        if (value === "" || value == null) {
                          setBidAmount("");
                        } else {
                          const sanitized = String(value).replace(/[^0-9.]/g, "");
                          setBidAmount(sanitized);
                        }
                      }}
                      disabled={isOwnJob}
                    />
                    <TextInput
                      id="bid-note"
                      labelText="Note (optional)"
                      value={bidNote}
                      onChange={(e) => setBidNote(e.target.value)}
                      disabled={isOwnJob}
                    />
                    <div className="job-detail-actions job-detail-actions--tight">
                      <Button type="submit" disabled={isOwnJob}>
                        Submit Bid
                      </Button>
                    </div>
                    </Form>
                  </div>
                </>
              )}
            </Tile>
          )}

          <Tile className="page-card">
            <h3 className="page-card-title">Bids</h3>
            <p className="page-card-subtitle">
              Review offers and manage the winner once you’re ready.
            </p>
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
                  const canAccept =
                    isOwner && !biddingClosed && status === "active";
                  const itemClassNames = ["job-bid-item"];
                  if (["accepted", "rejected", "active"].includes(status)) {
                    itemClassNames.push(`job-bid-item--${status}`);
                  }
                  const canViewReviews = isOwner && Boolean(bid.providerId);
                  const canViewProfile = isOwner && Boolean(bid.providerId);
                  const isAwardedBid =
                    (jobStatus === "awarded" &&
                      (bid.providerId === job.awardedProviderId ||
                        bid.id === job.awardedBidId)) ||
                    bid.status === "accepted";
                  const canLeaveReview =
                    isOwner &&
                    isAwardedBid &&
                    Boolean(bid.providerId) &&
                    bid.providerId !== user?.uid;
                  const hasMyReview = canLeaveReview
                    ? Boolean(getMyReviewFor(bid.providerId))
                    : false;
                  return (
                    <li key={bid.id}>
                      <div className={itemClassNames.join(" ")}>
                        <div className="job-bid-header">
                          <span>${amountDisplay}</span>
                          <span>· {bid.bidderName || "Bidder"}</span>
                          <span className={statusClass}>{statusLabel}</span>
                        </div>
                        <p className="job-bid-meta">
                          {createdAt
                            ? new Date(createdAt).toLocaleString()
                            : "Unknown time"}
                        </p>
                        {bid.note && <p className="job-bid-note">“{bid.note}”</p>}
                        {bid.statusNote && (
                          <p className="job-bid-status-note">{bid.statusNote}</p>
                        )}
                        {(canAccept ||
                          canViewReviews ||
                          canLeaveReview ||
                          canViewProfile) && (
                          <div className="job-bid-actions">
                            {canViewReviews && (
                              <Button
                                size="sm"
                                kind="ghost"
                                onClick={() => openReviews(bid)}
                                disabled={
                                  reviewsLoading &&
                                  selectedBidder?.uid === bid.providerId
                                }
                              >
                                View Reviews
                              </Button>
                            )}
                            {canViewProfile && (
                              <Button
                                size="sm"
                                kind="ghost"
                                onClick={() =>
                                  navigate(`/users/${bid.providerId}/portfolio`)
                                }
                              >
                                View Profile
                              </Button>
                            )}
                            {canLeaveReview && (
                              <Button
                                size="sm"
                                kind="secondary"
                                onClick={() => openReviewComposer(bid)}
                              >
                                {hasMyReview ? "Edit Review" : "Leave Review"}
                              </Button>
                            )}
                            {canAccept && (
                              <Button
                                size="sm"
                                onClick={() => handleAccept(bid.id)}
                                disabled={acceptingBidId === bid.id}
                              >
                                {acceptingBidId === bid.id
                                  ? "Accepting…"
                                  : "Accept Bid"}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tile>
        </div>

        <div className="page-stack">
          <Tile className="page-card job-map-card">
            <h3 className="page-card-title">Map</h3>
            <p className="page-card-subtitle">Confirm the work location.</p>
            <div className="page-card-body">
              <MapView center={mapCenter} markers={mapMarkers} />
            </div>
            <div className="job-map-meta">
              {locationDisplay}
            </div>
          </Tile>
        </div>
      </div>

      <ComposedModal
        open={reviewsOpen}
        onClose={closeReviews}
        size="lg"
        className="reviews-modal"
      >
        <ModalHeader
          title="Bidder Reviews"
          label={selectedBidder?.uid ? `User: ${selectedBidder.uid}` : undefined}
          buttonOnClick={closeReviews}
        />
        <ModalBody>
          {reviewsLoading ? (
            <InlineLoading
              description="Loading reviews…"
              className="reviews-loading"
            />
          ) : reviewsError ? (
            <InlineNotification
              title="Error"
              subtitle={reviewsError}
              kind="error"
              lowContrast
            />
          ) : reviewsData ? (
            <div className="reviews-modal-content">
              <div className="reviews-bidder-card">
                <div className="reviews-bidder-avatar">
                  {reviewsData.reviewedUser?.avatarUrl ? (
                    <img
                      src={reviewsData.reviewedUser.avatarUrl}
                      alt="Bidder avatar"
                      className="reviews-avatar-image"
                    />
                  ) : (
                    <div className="reviews-avatar-fallback">
                      {String(
                        reviewsData.reviewedUser?.firstName ||
                          reviewsData.reviewedUser?.email ||
                          selectedBidder?.bidderName ||
                          "B"
                      )
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="reviews-bidder-meta">
                  <div className="reviews-bidder-name">
                    {[
                      reviewsData.reviewedUser?.firstName,
                      reviewsData.reviewedUser?.lastName,
                    ]
                      .filter(Boolean)
                      .join(" ") ||
                      selectedBidder?.bidderName ||
                      "Bidder"}
                  </div>
                  <div className="reviews-bidder-email">
                    {reviewsData.reviewedUser?.email || "—"}
                  </div>
                  <div className="reviews-summary">
                    {renderStars(reviewsData.summary?.avgRating)}
                    <span className="reviews-summary-text">
                      {reviewsData.summary?.count || 0} review
                      {(reviewsData.summary?.count || 0) === 1 ? "" : "s"}
                      {reviewsData.summary?.avgRating
                        ? ` · ${reviewsData.summary.avgRating} / 5`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>

              {(reviewsData.summary?.count || 0) === 0 ? (
                <InlineNotification
                  title="No Reviews Yet"
                  subtitle="This bidder has not received any reviews yet."
                  kind="info"
                  lowContrast
                />
              ) : (
                <div className="reviews-list">
                  {(() => {
                    const pageSize = 5;
                    const total = Array.isArray(reviewsData.reviews)
                      ? reviewsData.reviews.length
                      : 0;
                    const pages = Math.max(1, Math.ceil(total / pageSize));
                    const safePage = Math.min(Math.max(1, reviewsPage), pages);
                    const start = (safePage - 1) * pageSize;
                    const pageItems = (reviewsData.reviews || []).slice(
                      start,
                      start + pageSize
                    );
                    return (
                      <>
                        {pageItems.map((review) => (
                    <div key={review.id} className="review-card">
                      <div className="review-card-header">
                        <div className="review-card-rating">
                          {renderStars(review.rating)}
                        </div>
                        <div className="review-card-meta">
                          <div className="review-card-author">
                            {review.reviewer?.email || "Contractor"}
                          </div>
                          <div className="review-card-date">
                            {review.createdAt
                              ? new Date(review.createdAt).toLocaleDateString()
                              : ""}
                          </div>
                        </div>
                      </div>
                      {review.description && (
                        <div className="review-card-body">
                          {review.description}
                        </div>
                      )}
                      {Array.isArray(review.photoUrls) &&
                        review.photoUrls.length > 0 && (
                          <div className="review-photos">
                            {review.photoUrls.map((url, idx) => {
                              const thumb = Array.isArray(review.photoThumbUrls)
                                ? review.photoThumbUrls[idx]
                                : null;
                              return (
                              <a
                                key={`${review.id}-${idx}`}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="review-photo-link"
                              >
                                <img
                                  src={thumb || url}
                                  alt="Work photo"
                                  loading="lazy"
                                  className="review-photo"
                                />
                              </a>
                              );
                            })}
                          </div>
                        )}
                    </div>
                        ))}
                        {total > pageSize && (
                          <div className="list-pagination">
                            <span className="list-pagination-text">
                              Page {safePage} of {pages}
                            </span>
                            <div className="list-pagination-actions">
                              <Button
                                size="sm"
                                kind="ghost"
                                disabled={safePage <= 1}
                                onClick={() =>
                                  setReviewsPage((p) => Math.max(1, p - 1))
                                }
                              >
                                Previous
                              </Button>
                              <Button
                                size="sm"
                                kind="ghost"
                                disabled={safePage >= pages}
                                onClick={() =>
                                  setReviewsPage((p) => Math.min(pages, p + 1))
                                }
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <InlineNotification
              title="No Data"
              subtitle="Select a bidder to view reviews."
              kind="info"
              lowContrast
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button kind="primary" onClick={closeReviews}>
            Close
          </Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal
        open={reviewComposeOpen}
        onClose={closeReviewComposer}
        size="lg"
        className="review-compose-modal"
      >
        <ModalHeader
          title={existingReview ? "Your Review" : "Leave a Review"}
          label={
            reviewComposeBid?.providerId
              ? `Bidder: ${reviewComposeBid.providerId}`
              : undefined
          }
          buttonOnClick={closeReviewComposer}
        />
        <ModalBody>
          {reviewComposeLoading ? (
            <InlineLoading
              description="Preparing review…"
              className="reviews-loading"
            />
          ) : (
            <div className="review-compose-content">
              {reviewSubmitError && (
                <InlineNotification
                  title="Error"
                  subtitle={reviewSubmitError}
                  kind="error"
                  lowContrast
                  onClose={() => setReviewSubmitError("")}
                />
              )}

              {existingReview && (
                <InlineNotification
                  title="Review Already Submitted"
                  subtitle="You can edit your rating/description and add more photos."
                  kind="info"
                  lowContrast
                />
              )}

              <div className="review-compose-section">
                <div className="review-compose-label">Rating</div>
                {renderSelectableStars(reviewRating, setReviewRating)}
              </div>
              <TextArea
                id="review-description"
                labelText="Description"
                value={reviewDescription}
                onChange={(e) => setReviewDescription(e.target.value)}
                placeholder="Describe the bidder’s work…"
              />

              <div className="review-compose-section">
                <div className="review-compose-label">
                  Photos (max 6, auto-compressed)
                </div>
                {existingReview && reviewExistingPhotos.length > 0 && (
                  <div className="review-existing-photos">
                    <div className="review-compose-label">Current photos</div>
                    <div className="review-photo-previews">
                      {reviewExistingPhotos.map((p) => {
                        const pendingRemove = reviewRemovePhotoUrls.includes(p.url);
                        return (
                          <div
                            key={p.url}
                            className={`review-existing-photo-tile${pendingRemove ? " review-existing-photo-tile--removed" : ""}`}
                          >
                            <img
                              src={p.thumbUrl || p.url}
                              alt="Existing work photo"
                              className="review-photo-preview"
                            />
                            <Button
                              size="sm"
                              kind={pendingRemove ? "secondary" : "danger--tertiary"}
                              onClick={() => {
                                setReviewRemovePhotoUrls((prev) => {
                                  const exists = prev.includes(p.url);
                                  if (exists) return prev.filter((u) => u !== p.url);
                                  return [...prev, p.url];
                                });
                              }}
                              disabled={reviewSubmitting}
                            >
                              {pendingRemove ? "Undo" : "Remove"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <input
                  className="review-file-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).slice(0, 6);
                    reviewPhotoPreviews.forEach((url) => {
                      try {
                        URL.revokeObjectURL(url);
                      } catch {
                        // ignore
                      }
                    });
                    setReviewPhotos(files);
                    setReviewPhotoPreviews(
                      files.map((file) => URL.createObjectURL(file))
                    );
                  }}
                />
                {reviewPhotoPreviews.length > 0 && (
                  <>
                    <div className="review-photo-previews">
                      {reviewPhotoPreviews.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt="Selected"
                          className="review-photo-preview"
                        />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      kind="ghost"
                      onClick={clearReviewPhotos}
                      disabled={reviewSubmitting}
                    >
                      Clear photos
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={closeReviewComposer}>
            Close
          </Button>
          {existingReview?.id && (
            <Button
              kind="danger--tertiary"
              disabled={reviewComposeLoading || reviewSubmitting || reviewDeleting}
              onClick={deleteReview}
            >
              {reviewDeleting ? "Deleting…" : "Delete Review"}
            </Button>
          )}
          {reviewComposeBid?.providerId && (
            <Button
              kind="primary"
              disabled={reviewComposeLoading || reviewSubmitting || reviewDeleting}
              onClick={submitReview}
            >
              {reviewSubmitting
                ? "Submitting…"
                : existingReview
                  ? "Save Changes"
                  : "Submit Review"}
            </Button>
          )}
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}
