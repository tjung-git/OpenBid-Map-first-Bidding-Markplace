import { useEffect, useState } from "react";
import { Button, InlineNotification } from "@carbon/react";
import { api } from "../services/api";
import { cfg } from "../services/config";
import { useNavigate } from "react-router-dom";

export default function KycGate() {
  const [status, setStatus] = useState("pending");
  const nav = useNavigate();

  async function refresh() {
    const r = await api.kycStatus();
    setStatus(r.status || "pending");
  }

  useEffect(() => {
    refresh();
  }, []);

  async function start() {
    const r = await api.kycStart();
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
      <p>
        Status: <b>{status}</b>
      </p>
      <Button onClick={start}>Start KYC</Button>
      {cfg.prototype && (
        <Button kind="tertiary" onClick={forcePass} style={{ marginLeft: 8 }}>
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
      <div style={{ marginTop: 16 }}>
        <Button kind="secondary" onClick={() => nav("/jobs")}>
          Go to Jobs
        </Button>
      </div>
    </div>
  );
}
