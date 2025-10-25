import { useState, useRef, useEffect } from "react";
import { Button, InlineNotification, Tag, FileUploader } from "@carbon/react";
import { UserAvatar, CheckmarkOutline, WarningAlt, Upload } from "@carbon/icons-react";
import { useNavigate } from "react-router-dom";
import { useSessionUser, useSessionRequirements } from "../hooks/useSession";
import { api } from "../services/api";
import { cfg } from "../services/config";
import { logout, setUser } from "../services/session";
import "../styles/pages/profile.css";

export default function Profile() {
  const user = useSessionUser();
  const requirements = useSessionRequirements();
  const nav = useNavigate();
  const [notice, setNotice] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const fileInputRef = useRef(null);

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

      <div className="profile-actions">
        <Button kind="danger" onClick={handleLogout}>
          Log Out
        </Button>
      </div>
    </div>
  );
}
