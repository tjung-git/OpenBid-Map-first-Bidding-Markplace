import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  ComposedModal,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@carbon/react";
import { api } from "../services/api";
import { useSessionUser } from "../hooks/useSession";
import "../styles/pages/portfolio.css";
import "../styles/pages/reviews.css";
import "../styles/components/pagination.css";

export default function UserPortfolio() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const currentUser = useSessionUser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [page, setPage] = useState(1);

  const safeUid = useMemo(() => String(uid || "").trim(), [uid]);

  useEffect(() => {
    if (!safeUid) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setData(null);
      setPage(1);
      try {
        const resp = await api.portfolioForUser(safeUid);
        if (cancelled) return;
        setData(resp);
      } catch (err) {
        if (cancelled) return;
        setError(err?.data?.error || "Unable to load portfolio.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [safeUid]);

  const user = data?.user || null;
  const items = Array.isArray(data?.items) ? data.items : [];
  const isContractor =
    (currentUser?.userType || "").toLowerCase() === "contractor";

  const openItem = (item) => {
    setSelectedItem(item);
    setItemOpen(true);
  };

  const closeItem = () => {
    setItemOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="user-reviews-page">
      <div className="user-reviews-header">
        <div>
          <h2 className="user-reviews-title">Portfolio</h2>
          <p className="user-reviews-subtitle">
            Work examples for this user.
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
          {safeUid && (
            <Button
              kind="ghost"
              onClick={() => navigate(`/users/${safeUid}/reviews`)}
            >
              View Reviews
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <InlineLoading description="Loading portfolio…" />
      ) : error ? (
        <InlineNotification title="Error" subtitle={error} kind="error" lowContrast />
      ) : !data ? (
        <InlineNotification
          title="No Data"
          subtitle="Unable to load portfolio."
          kind="info"
          lowContrast
        />
      ) : (
        <>
          <div className="user-reviews-hero">
            <div className="reviews-bidder-avatar">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="User avatar"
                  className="reviews-avatar-image"
                />
              ) : (
                <div className="reviews-avatar-fallback">
                  {String(user?.firstName || user?.email || "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>
            <div className="user-reviews-hero-meta">
              <div className="user-reviews-name">
                {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
                  user?.email ||
                  "User"}
              </div>
              <div className="user-reviews-email">{user?.email || "—"}</div>
            </div>
          </div>

          {items.length === 0 ? (
            <InlineNotification
              title="No Portfolio Yet"
              subtitle="This user has not added portfolio work yet."
              kind="info"
              lowContrast
            />
          ) : (
            <div className="portfolio-grid">
              {(() => {
                const pageSize = 5;
                const total = items.length;
                const pages = Math.max(1, Math.ceil(total / pageSize));
                const safePage = Math.min(Math.max(1, page), pages);
                const start = (safePage - 1) * pageSize;
                const pageItems = items.slice(start, start + pageSize);
                return (
                  <>
                    {pageItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="portfolio-card"
                  onClick={() => openItem(item)}
                >
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
                    <div className="portfolio-card-meta">
                      {Array.isArray(item.photoUrls) ? item.photoUrls.length : 0} photo
                      {Array.isArray(item.photoUrls) && item.photoUrls.length === 1
                        ? ""
                        : "s"}
                    </div>
                  </div>
                </button>
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
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            size="sm"
                            kind="ghost"
                            disabled={safePage >= pages}
                            onClick={() => setPage((p) => Math.min(pages, p + 1))}
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
        </>
      )}

      <ComposedModal open={itemOpen} onClose={closeItem} size="lg">
        <ModalHeader
          title={selectedItem?.title || "Portfolio Item"}
          label={selectedItem?.id ? `Item: ${selectedItem.id}` : undefined}
          buttonOnClick={closeItem}
        />
        <ModalBody>
          {selectedItem?.description && (
            <div className="portfolio-item-description">
              {selectedItem.description}
            </div>
          )}
          {Array.isArray(selectedItem?.photoUrls) &&
          selectedItem.photoUrls.length > 0 ? (
            <div className="portfolio-item-photos">
              {selectedItem.photoUrls.map((url, idx) => {
                const thumb = Array.isArray(selectedItem.photoThumbUrls)
                  ? selectedItem.photoThumbUrls[idx]
                  : null;
                return (
                  <a
                    key={`${selectedItem.id}-${idx}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="portfolio-item-photo-link"
                  >
                    <img
                      src={thumb || url}
                      alt="Work"
                      loading="lazy"
                      className="portfolio-item-photo"
                    />
                  </a>
                );
              })}
            </div>
          ) : (
            <InlineNotification
              title="No Photos"
              subtitle="This portfolio item has no photos yet."
              kind="info"
              lowContrast
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button kind="primary" onClick={closeItem}>
            Close
          </Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}
