import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  InlineNotification,
  Tag,
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  TextInput,
  TextArea,
  InlineLoading,
} from "@carbon/react";
import {
  UserAvatar,
  CheckmarkOutline,
  WarningAlt,
  Upload,
  StarFilled,
  Star,
} from "@carbon/icons-react";
import { useNavigate } from "react-router-dom";
import { useSessionUser, useSessionRequirements } from "../hooks/useSession";
import { api } from "../services/api";
import { cfg } from "../services/config";
import { logout, setUser } from "../services/session";
import "../styles/pages/profile.css";
import "../styles/pages/portfolio.css";
import "../styles/pages/jobs.css";
import "../styles/components/pagination.css";

export default function Profile() {
  const user = useSessionUser();
  const requirements = useSessionRequirements();
  const nav = useNavigate();
  const [notice, setNotice] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const fileInputRef = useRef(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState("");
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [portfolioFormError, setPortfolioFormError] = useState("");
  const [portfolioEditing, setPortfolioEditing] = useState(null);
  const [portfolioTitle, setPortfolioTitle] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [portfolioNewPhotos, setPortfolioNewPhotos] = useState([]);
  const [portfolioNewPhotoPreviews, setPortfolioNewPhotoPreviews] = useState([]);
  const [portfolioExistingPhotos, setPortfolioExistingPhotos] = useState([]);
  const [portfolioRemovePhotoUrls, setPortfolioRemovePhotoUrls] = useState([]);
  const [portfolioDeleting, setPortfolioDeleting] = useState(false);
  const [showcaseView, setShowcaseView] = useState("portfolio");
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewsData, setReviewsData] = useState(null);
  const [portfolioPage, setPortfolioPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);

  const portfolioDisplayName = useMemo(
    () => [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email,
    [user?.email, user?.firstName, user?.lastName]
  );

  const clearPortfolioNewPhotos = () => {
    portfolioNewPhotoPreviews.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    setPortfolioNewPhotos([]);
    setPortfolioNewPhotoPreviews([]);
  };

  const openPortfolioModal = (item = null) => {
    setPortfolioFormError("");
    setPortfolioRemovePhotoUrls([]);
    clearPortfolioNewPhotos();
    setPortfolioEditing(item);
    setPortfolioTitle(item?.title || "");
    setPortfolioDescription(item?.description || "");
    const urls = Array.isArray(item?.photoUrls) ? item.photoUrls : [];
    const thumbs = Array.isArray(item?.photoThumbUrls) ? item.photoThumbUrls : [];
    setPortfolioExistingPhotos(
      urls.map((url, idx) => ({ url, thumbUrl: thumbs[idx] || null })).filter((p) => p.url)
    );
    setPortfolioOpen(true);
  };

  const closePortfolioModal = () => {
    setPortfolioOpen(false);
    setPortfolioEditing(null);
    setPortfolioTitle("");
    setPortfolioDescription("");
    setPortfolioFormError("");
    setPortfolioRemovePhotoUrls([]);
    setPortfolioExistingPhotos([]);
    setPortfolioSaving(false);
    setPortfolioDeleting(false);
    clearPortfolioNewPhotos();
  };

  const setShowcase = (next) => {
    setShowcaseView(next);
    if (next === "portfolio") setReviewsPage(1);
    if (next === "reviews") setPortfolioPage(1);
    if (next !== "portfolio" && portfolioOpen) {
      closePortfolioModal();
    }
  };

  const refreshPortfolio = async () => {
    if (!user?.uid) return;
    setPortfolioLoading(true);
    setPortfolioError("");
    try {
      const resp = await api.portfolioForUser(user.uid);
      setPortfolioItems(Array.isArray(resp?.items) ? resp.items : []);
      setPortfolioPage(1);
    } catch (err) {
      setPortfolioError(err?.data?.error || "Unable to load portfolio.");
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    refreshPortfolio();
  }, [user?.uid]);

  const refreshMyReviews = async () => {
    if (!user?.uid) return;
    setReviewsLoading(true);
    setReviewsError("");
    try {
      const resp = await api.reviewsForUser(user.uid);
      setReviewsData(resp);
      setReviewsPage(1);
    } catch (err) {
      setReviewsError(err?.data?.error || "Unable to load reviews.");
      setReviewsData(null);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    if (showcaseView !== "reviews") return;
    if (reviewsData) return;
    refreshMyReviews();
  }, [showcaseView, user?.uid]);

  useEffect(() => {
    if (user?.avatarUrl) {
      setAvatarPreview(user.avatarUrl);
    }
  }, [user?.avatarUrl]);

  // Autorefresh for KYC status
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      const currentKycStatus = user?.kycStatus;
      if (currentKycStatus !== "verified") {
        try {
          const response = await api.kycStatus();
          const status = response.status || "pending";
          
          if (isMounted && status !== currentKycStatus) {
            const updatedUser = { ...user, kycStatus: status };
            setUser(updatedUser, { 
              ...requirements, 
              kycVerified: status === "verified"
            });
          }
        } catch (error) {
          console.error('Auto-check KYC status error:', error);
        }
      }
    };

    checkStatus();

    // Check when window regains focus (user returns from Stripe tab)
    const handleFocus = () => {
      checkStatus();
    };

    window.addEventListener('focus', handleFocus);
    
    // Cleanup
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (!user) {
    return null;
  }

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const kycStatus = user.kycStatus || "pending"; // "verified", "pending", or "failed"
  const emailVerified = requirements.emailVerified;

  const handleLogout = () => {
    logout();
    nav("/login");
  };

  const checkKycStatus = async () => {
    setChecking(true);
    try {
      const response = await api.kycStatus();
      const status = response.status || "pending";
      
      // Update user with new KYC status
      const updatedUser = { ...user, kycStatus: status };
      setUser(updatedUser, { 
        ...requirements, 
        kycVerified: status === "verified"
      });
      
      setNotice(`KYC Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`);
    } catch (error) {
      console.error('Check KYC status error:', error);
      setNotice("Failed to check KYC status");
    } finally {
      setChecking(false);
    }
  };

  const handleKycClick = async () => {
    setUploading(true);
    try {
      const response = await api.kycVerification();
      
      if (cfg.prototype) {
        // In prototype mode, use force pass
        await api.kycForcePass();
        const updatedUser = { ...user, kycStatus: "verified" };
        setUser(updatedUser, { 
          ...requirements, 
          kycVerified: true 
        });
        setNotice("KYC verification completed (prototype mode)");
      } else if (response.url) {
        // In production, open Stripe Identity in new tab
        window.open(response.url, '_blank');
        setNotice("KYC verification opened in new tab. Complete the verification and return here.");
      } else {
        setNotice("Failed to start KYC verification. Please try again.");
      }
    } catch (error) {
      console.error('KYC error:', error);
      setNotice("Failed to start KYC verification");
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setNotice("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice("Image must be smaller than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setUploading(true);
    try {
      const response = await api.uploadAvatar(file);
      
      // Update user with avatar URL from server
      const updatedUser = { ...user, avatarUrl: response.avatarUrl };
      setUser(updatedUser, requirements);
      setAvatarPreview(response.avatarUrl);
      setNotice("Avatar updated successfully!");
    } catch (error) {
      console.error('Avatar upload error:', error);
      setNotice(error?.data?.error || "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

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

  const savePortfolioItem = async () => {
    if (!user?.uid) return;
    if (portfolioSaving) return;
    setPortfolioFormError("");

    const title = String(portfolioTitle || "").trim();
    if (!title) {
      setPortfolioFormError("Title is required.");
      return;
    }

    setPortfolioSaving(true);
    try {
      let itemId = portfolioEditing?.id || null;
      if (!itemId) {
        const created = await api.portfolioCreate({
          title,
          description: portfolioDescription,
        });
        itemId = created?.item?.id;
      } else {
        await api.portfolioUpdate(itemId, {
          title,
          description: portfolioDescription,
        });
      }

      if (!itemId) throw new Error("Missing portfolio item id.");

      if (portfolioRemovePhotoUrls.length > 0) {
        await api.portfolioDeletePhotos(itemId, portfolioRemovePhotoUrls);
        setPortfolioRemovePhotoUrls([]);
      }

      if (portfolioNewPhotos.length > 0) {
        await api.portfolioUploadPhotos(itemId, portfolioNewPhotos);
      }

      await refreshPortfolio();
      clearPortfolioNewPhotos();
      setNotice(portfolioEditing ? "Portfolio updated." : "Portfolio item added.");
      closePortfolioModal();
    } catch (err) {
      const code = err?.data?.error;
      const details = [code, err?.data?.details, err?.message].filter(Boolean).join(" · ");
      setPortfolioFormError(details || "Unable to save portfolio.");
    } finally {
      setPortfolioSaving(false);
    }
  };

  const deletePortfolioItem = async () => {
    if (!portfolioEditing?.id) return;
    if (portfolioDeleting) return;
    const confirmed = window.confirm("Delete this portfolio item and all its photos?");
    if (!confirmed) return;
    setPortfolioFormError("");
    setPortfolioDeleting(true);
    try {
      await api.portfolioDelete(portfolioEditing.id);
      await refreshPortfolio();
      closePortfolioModal();
    } catch (err) {
      setPortfolioFormError(err?.data?.error || "Unable to delete portfolio item.");
      setPortfolioDeleting(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar">
            {avatarPreview ? (
              <img src={avatarPreview} alt="User avatar" className="avatar-image" />
            ) : (
              <UserAvatar size={64} />
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          <Button
            size="sm"
            kind="tertiary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            renderIcon={Upload}
          >
            {uploading ? "Uploading..." : "Change Avatar"}
          </Button>
        </div>
        <div className="profile-info">
          <h2>{displayName}</h2>
          <p className="profile-email">{user.email}</p>
        </div>
      </div>

      {notice && (
        <InlineNotification
          title="Notice"
          subtitle={notice}
          kind="info"
          lowContrast
          onCloseButtonClick={() => setNotice("")}
        />
      )}

      <div className="profile-section">
        <h3>Account Status</h3>
        
        <div className="status-item">
          <div className="status-label">
            {emailVerified ? <CheckmarkOutline size={20} /> : <WarningAlt size={20} />}
            <span>Email Verification</span>
          </div>
          <Tag type={emailVerified ? "green" : "red"}>
            {emailVerified ? "Verified" : "Not Verified"}
          </Tag>
        </div>

        <div className="status-item">
          <div className="status-label">
            {kycStatus === "verified" ? <CheckmarkOutline size={20} /> : <WarningAlt size={20} />}
            <span>Identity Verification (KYC)</span>
          </div>
          <div className="status-actions">
            <Tag type={
              kycStatus === "verified" ? "green" : 
              kycStatus === "failed" ? "red" : 
              "gray"
            }>
              {kycStatus === "verified" ? "Verified" : 
               kycStatus === "failed" ? "Failed" : 
               "Pending"}
            </Tag>
            {kycStatus !== "verified" && (
              <>
                <Button size="sm" onClick={handleKycClick} disabled={uploading}>
                  {uploading ? "Starting..." : kycStatus === "failed" ? "Retry KYC" : "Complete KYC"}
                </Button>
                <Button size="sm" kind="ghost" onClick={checkKycStatus} disabled={checking}>
                  {checking ? "Checking..." : "Refresh Status"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h3>Account Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">First Name</span>
            <span className="info-value">{user.firstName || "—"}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Last Name</span>
            <span className="info-value">{user.lastName || "—"}</span>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-showcase-header">
          <div>
            <h3>Showcase</h3>
            <p className="profile-showcase-subtitle">
              Manage your portfolio and see your reviews.
            </p>
          </div>
          <div className="profile-showcase-toggle" role="tablist" aria-label="Showcase">
            <button
              type="button"
              role="tab"
              aria-selected={showcaseView === "portfolio"}
              className={`profile-showcase-tab${
                showcaseView === "portfolio" ? " profile-showcase-tab--active" : ""
              }`}
              onClick={() => setShowcase("portfolio")}
            >
              Portfolio
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showcaseView === "reviews"}
              className={`profile-showcase-tab${
                showcaseView === "reviews" ? " profile-showcase-tab--active" : ""
              }`}
              onClick={() => setShowcase("reviews")}
            >
              Reviews
            </button>
          </div>
        </div>

        {showcaseView === "portfolio" ? (
          <>
            <div className="profile-showcase-actions">
              <Button size="sm" kind="secondary" onClick={() => openPortfolioModal(null)}>
                Add Portfolio Item
              </Button>
            </div>

            {portfolioLoading ? (
              <InlineLoading description="Loading portfolio…" />
            ) : portfolioError ? (
              <InlineNotification title="Error" subtitle={portfolioError} kind="error" lowContrast />
            ) : portfolioItems.length === 0 ? (
              <InlineNotification
                title="No Portfolio Yet"
                subtitle="Add your first portfolio item to showcase your work."
                kind="info"
                lowContrast
              />
            ) : (
              <>
                {(() => {
                  const pageSize = 5;
                  const total = portfolioItems.length;
                  const pages = Math.max(1, Math.ceil(total / pageSize));
                  const safePage = Math.min(Math.max(1, portfolioPage), pages);
                  const start = (safePage - 1) * pageSize;
                  const pageItems = portfolioItems.slice(start, start + pageSize);
                  return (
                    <>
                      <div className="portfolio-grid">
                        {pageItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="portfolio-card"
                    onClick={() => openPortfolioModal(item)}
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
                      {item.description ? (
                        <div className="portfolio-card-desc">{item.description}</div>
                      ) : (
                        <div className="portfolio-card-desc portfolio-card-desc--empty">
                          {portfolioDisplayName}
                        </div>
                      )}
                    </div>
                  </button>
                        ))}
                      </div>
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
              </>
            )}
          </>
        ) : (
          <>
            <div className="profile-showcase-actions">
              <Button size="sm" kind="ghost" onClick={refreshMyReviews}>
                Refresh
              </Button>
            </div>

            {reviewsLoading ? (
              <InlineLoading description="Loading reviews…" />
            ) : reviewsError ? (
              <InlineNotification title="Error" subtitle={reviewsError} kind="error" lowContrast />
            ) : (
              <>
                <div className="profile-reviews-summary">
                  {renderStars(reviewsData?.summary?.avgRating)}
                  <span className="profile-reviews-summary-text">
                    {reviewsData?.summary?.count || 0} review
                    {(reviewsData?.summary?.count || 0) === 1 ? "" : "s"}
                    {reviewsData?.summary?.avgRating
                      ? ` · ${reviewsData.summary.avgRating} / 5`
                      : ""}
                  </span>
                </div>

                {(reviewsData?.summary?.count || 0) === 0 ? (
                  <InlineNotification
                    title="No Reviews Yet"
                    subtitle="You have not received any reviews yet."
                    kind="info"
                    lowContrast
                  />
                ) : (
                  <div className="reviews-list">
                    {(() => {
                      const pageSize = 5;
                      const all = Array.isArray(reviewsData?.reviews)
                        ? reviewsData.reviews
                        : [];
                      const total = all.length;
                      const pages = Math.max(1, Math.ceil(total / pageSize));
                      const safePage = Math.min(Math.max(1, reviewsPage), pages);
                      const start = (safePage - 1) * pageSize;
                      const pageItems = all.slice(start, start + pageSize);
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
              </>
            )}
          </>
        )}
      </div>

      <div className="profile-actions">
        <Button kind="danger" onClick={handleLogout}>
          Log Out
        </Button>
      </div>

      <ComposedModal open={portfolioOpen} onClose={closePortfolioModal} size="lg">
        <ModalHeader
          title={portfolioEditing ? "Edit Portfolio Item" : "New Portfolio Item"}
          label={portfolioEditing ? `Item: ${portfolioEditing.id}` : undefined}
          buttonOnClick={closePortfolioModal}
        />
        <ModalBody>
          {portfolioFormError && (
            <InlineNotification
              title="Error"
              subtitle={portfolioFormError}
              kind="error"
              lowContrast
              onCloseButtonClick={() => setPortfolioFormError("")}
            />
          )}

          <div className="portfolio-modal-content">
            <TextInput
              id="portfolio-title"
              labelText="Heading"
              value={portfolioTitle}
              onChange={(e) => setPortfolioTitle(e.target.value)}
              placeholder="e.g. Bathroom tiling, Kitchen remodel..."
            />
            <TextArea
              id="portfolio-description"
              labelText="Description (optional)"
              value={portfolioDescription}
              onChange={(e) => setPortfolioDescription(e.target.value)}
              placeholder="Briefly describe what you did, tools used, timeframe, etc."
            />

            {portfolioEditing && portfolioExistingPhotos.length > 0 && (
              <div className="portfolio-existing">
                <div className="portfolio-existing-title">Current photos</div>
                <div className="portfolio-photos-grid">
                  {portfolioExistingPhotos.map((p) => {
                    const pendingRemove = portfolioRemovePhotoUrls.includes(p.url);
                    return (
                      <div
                        key={p.url}
                        className={`portfolio-photo-tile${pendingRemove ? " portfolio-photo-tile--removed" : ""}`}
                      >
                        <img
                          src={p.thumbUrl || p.url}
                          alt="Work"
                          className="portfolio-photo"
                          loading="lazy"
                        />
                        <Button
                          size="sm"
                          kind={pendingRemove ? "secondary" : "danger--tertiary"}
                          onClick={() => {
                            setPortfolioRemovePhotoUrls((prev) => {
                              const exists = prev.includes(p.url);
                              if (exists) return prev.filter((u) => u !== p.url);
                              return [...prev, p.url];
                            });
                          }}
                          disabled={portfolioSaving || portfolioDeleting}
                        >
                          {pendingRemove ? "Undo" : "Remove"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="portfolio-upload">
              <div className="portfolio-existing-title">Add photos (max 6)</div>
              <input
                className="portfolio-file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).slice(0, 6);
                  clearPortfolioNewPhotos();
                  setPortfolioNewPhotos(files);
                  setPortfolioNewPhotoPreviews(
                    files.map((file) => URL.createObjectURL(file))
                  );
                }}
              />
              {portfolioNewPhotoPreviews.length > 0 && (
                <>
                  <div className="portfolio-photos-grid">
                    {portfolioNewPhotoPreviews.map((url) => (
                      <img key={url} src={url} alt="New" className="portfolio-photo" />
                    ))}
                  </div>
                  <Button
                    size="sm"
                    kind="ghost"
                    onClick={clearPortfolioNewPhotos}
                    disabled={portfolioSaving || portfolioDeleting}
                  >
                    Clear selected
                  </Button>
                </>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={closePortfolioModal}>
            Close
          </Button>
          {portfolioEditing?.id && (
            <Button
              kind="danger--tertiary"
              onClick={deletePortfolioItem}
              disabled={portfolioSaving || portfolioDeleting}
            >
              {portfolioDeleting ? "Deleting…" : "Delete Item"}
            </Button>
          )}
          <Button
            kind="primary"
            onClick={savePortfolioItem}
            disabled={portfolioSaving || portfolioDeleting}
          >
            {portfolioSaving ? "Saving…" : "Save"}
          </Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}
