import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, InlineLoading, InlineNotification } from "@carbon/react";
import { StarFilled, Star } from "@carbon/icons-react";
import { api } from "../services/api";
import { useSessionUser } from "../hooks/useSession";
import "../styles/pages/reviews.css";
import "../styles/pages/portfolio.css";
import "../styles/components/pagination.css";

export default function UserReviews() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const currentUser = useSessionUser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [portfolioPage, setPortfolioPage] = useState(1);

  const safeUid = useMemo(() => String(uid || "").trim(), [uid]);

  useEffect(() => {
    if (!safeUid) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setData(null);
      setPortfolio(null);
      setReviewsPage(1);
      setPortfolioPage(1);
      try {
        const [resp, portfolioResp] = await Promise.all([
          api.reviewsForUser(safeUid),
          api.portfolioForUser(safeUid),
        ]);
        if (cancelled) return;
        setData(resp);
        setPortfolio(portfolioResp);
      } catch (err) {
        if (cancelled) return;
        const code = err?.data?.error || "Unable to load profile.";
        setError(code);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [safeUid]);

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

  const reviewedUser = data?.reviewedUser || null;
  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
  const summary = data?.summary || { count: 0, avgRating: 0 };
  const portfolioItems = Array.isArray(portfolio?.items) ? portfolio.items : [];
  const isContractor = (currentUser?.userType || "").toLowerCase() === "contractor";

  return (
    <div className="user-reviews-page">
      <div className="user-reviews-header">
        <div>
          <h2 className="user-reviews-title">Reviews</h2>
          <p className="user-reviews-subtitle">
            Public profile reviews for this user.
          </p>
        </div>
        <div className="user-reviews-actions">
          <Button kind="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
          {isContractor && (
            <Button kind="secondary" onClick={() => navigate("/new-job")}>
              Post a Job
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <InlineLoading description="Loading reviews…" />
      ) : error ? (
        <InlineNotification title="Error" subtitle={error} kind="error" lowContrast />
      ) : !data ? (
        <InlineNotification
          title="No Data"
          subtitle="Unable to load reviews."
          kind="info"
          lowContrast
        />
      ) : (
        <>
          <div className="user-reviews-hero">
            <div className="reviews-bidder-avatar">
              {reviewedUser?.avatarUrl ? (
                <img
                  src={reviewedUser.avatarUrl}
                  alt="User avatar"
                  className="reviews-avatar-image"
                />
              ) : (
                <div className="reviews-avatar-fallback">
                  {String(reviewedUser?.firstName || reviewedUser?.email || "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>
            <div className="user-reviews-hero-meta">
              <div className="user-reviews-name">
                {[reviewedUser?.firstName, reviewedUser?.lastName]
                  .filter(Boolean)
                  .join(" ") || reviewedUser?.email || "User"}
              </div>
              <div className="user-reviews-email">{reviewedUser?.email || "—"}</div>
              <div className="reviews-summary">
                {renderStars(summary?.avgRating)}
                <span className="reviews-summary-text">
                  {summary?.count || 0} review{(summary?.count || 0) === 1 ? "" : "s"}
                  {summary?.avgRating ? ` · ${summary.avgRating} / 5` : ""}
                </span>
              </div>
            </div>
          </div>

          {(summary?.count || 0) === 0 ? (
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
                const total = reviews.length;
                const pages = Math.max(1, Math.ceil(total / pageSize));
                const safePage = Math.min(Math.max(1, reviewsPage), pages);
                const start = (safePage - 1) * pageSize;
                const pageItems = reviews.slice(start, start + pageSize);
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
                    <div className="review-card-body">{review.description}</div>
                  )}
                  {Array.isArray(review.photoUrls) && review.photoUrls.length > 0 && (
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

          <div className="portfolio-profile-section">
            <h3 className="job-section-title">Portfolio</h3>
            {portfolioItems.length === 0 ? (
              <InlineNotification
                title="No Portfolio Yet"
                subtitle="This bidder has not added portfolio work yet."
                kind="info"
                lowContrast
              />
            ) : (
              <div className="portfolio-grid">
                {(() => {
                  const pageSize = 5;
                  const total = portfolioItems.length;
                  const pages = Math.max(1, Math.ceil(total / pageSize));
                  const safePage = Math.min(Math.max(1, portfolioPage), pages);
                  const start = (safePage - 1) * pageSize;
                  const pageItems = portfolioItems.slice(start, start + pageSize);
                  return (
                    <>
                      {pageItems.map((item) => (
                  <div key={item.id} className="portfolio-card portfolio-card--static">
                    <div className="portfolio-card-media">
                      {Array.isArray(item.photoThumbUrls) && item.photoThumbUrls[0] ? (
                        <img
                          src={item.photoThumbUrls[0]}
                          alt={item.title}
                          className="portfolio-card-image"
                          loading="lazy"
                        />
                      ) : Array.isArray(item.photoUrls) && item.photoUrls[0] ? (
                        <img
                          src={item.photoUrls[0]}
                          alt={item.title}
                          className="portfolio-card-image"
                          loading="lazy"
                        />
                      ) : (
                        <div className="portfolio-card-placeholder">
                          {String(item.title || "P").trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="portfolio-card-body">
                      <div className="portfolio-card-title">{item.title}</div>
                      {item.description && (
                        <div className="portfolio-card-desc">{item.description}</div>
                      )}
                    </div>
                    {Array.isArray(item.photoUrls) && item.photoUrls.length > 0 && (
                      <div className="review-photos">
                        {item.photoUrls.slice(0, 6).map((url, idx) => {
                          const thumb = Array.isArray(item.photoThumbUrls)
                            ? item.photoThumbUrls[idx]
                            : null;
                          return (
                            <a
                              key={`${item.id}-${idx}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="review-photo-link"
                            >
                              <img
                                src={thumb || url}
                                alt="Portfolio work"
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
                                setPortfolioPage((p) => Math.max(1, p - 1))
                              }
                            >
                              Previous
                            </Button>
                            <Button
                              size="sm"
                              kind="ghost"
                              disabled={safePage >= pages}
                              onClick={() =>
                                setPortfolioPage((p) => Math.min(pages, p + 1))
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
        </>
      )}
    </div>
  );
}
