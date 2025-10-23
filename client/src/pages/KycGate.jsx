import { useEffect, useState } from "react";
import { Button, InlineNotification } from "@carbon/react";
import { api } from "../services/api";
import { cfg } from "../services/config";
import { getSession } from "../services/session";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/pages/auth.css";

export default function KycGate() {
  // Guides users through KYC, prefilling status from the stored session when available.
  const session = getSession();
  const isContractor = session?.user?.userType === "contractor";
  const [status, setStatus] = useState("pending");
  const [notice, setNotice] = useState("");
  const nav = useNavigate();
  const location = useLocation();

  async function refresh() {
    if (session?.requirements?.kycVerified) {
      setStatus("verified");
      return;
    }
    const r = await api.kycStatus();
    setStatus(r.status || "pending");
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (location.state?.notice) {
      setNotice(location.state.notice);
    }
  }, [location.state]);

  async function start() {
    const r = await api.kycVerification();
    if (cfg.prototype) {
      // in PROTOTYPE, just inform the user KYC session would start
      // or allow "force pass"
    } else if (r.url) {
      window.location.href = r.url;
    }
  }

  async function forcePass() {
    await api.kycForcePass();
    await refresh();
  }

  return (
    <div className="container">
      <h2>KYC Verification</h2>
      {notice && (
        <InlineNotification
          title="Action required"
          subtitle={notice}
          kind="info"
          lowContrast
          className="auth-notification"
        />
      )}
      {isContractor && (
        <Button onClick={start}>Start KYC</Button>
      )}
      {cfg.prototype && isContractor && (
        <Button
          kind="tertiary"
          onClick={forcePass}
          className="kyc-action"
        >
          Prototype: Mark as Verified
        </Button>
      )}
      {status === "verified" && (
        <InlineNotification
          title="KYC Complete"
          subtitle="You're ready to post and bid on jobs."
          kind="success"
          lowContrast
        />
      )}
      <div className="kyc-actions">
        <Button kind="secondary" onClick={() => nav("/jobs")}>
          Go to Jobs
        </Button>
      </div>
    </div>
  );
}
