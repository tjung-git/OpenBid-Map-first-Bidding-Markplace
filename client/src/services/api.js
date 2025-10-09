import { cfg } from "./config";

const base = cfg.apiBase;

// attach mock header uid when prototype
function headers() {
  const h = { "Content-Type": "application/json" };
  const uid = localStorage.getItem("mockUid");
  if (cfg.prototype && uid) h["x-mock-uid"] = uid;
  return h;
}

export const api = {
  async login(email) {
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await r.json();
    if (cfg.prototype && data.user?.uid)
      localStorage.setItem("mockUid", data.user.uid);
    return data;
  },
  async me() {
    const r = await fetch(`${base}/api/auth/me`, { headers: headers() });
    return r.ok ? r.json() : null;
  },
  async kycStart() {
    const r = await fetch(`${base}/api/kyc/start`, {
      method: "POST",
      headers: headers(),
    });
    return r.json();
  },
  async kycStatus() {
    const r = await fetch(`${base}/api/kyc/status`, { headers: headers() });
    return r.json();
  },
  async kycForcePass() {
    const r = await fetch(`${base}/api/kyc/force-pass`, {
      method: "POST",
      headers: headers(),
    });
    return r.json();
  },
  async jobsList() {
    const r = await fetch(`${base}/api/jobs`, { headers: headers() });
    return r.json();
  },
  async jobCreate(payload) {
    const r = await fetch(`${base}/api/jobs`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    return r.json();
  },
  async jobGet(id) {
    const r = await fetch(`${base}/api/jobs/${id}`, { headers: headers() });
    return r.json();
  },
  async bidsForJob(jobId) {
    const r = await fetch(`${base}/api/bids/${jobId}`, { headers: headers() });
    return r.json();
  },
  async bid(jobId, payload) {
    const r = await fetch(`${base}/api/bids/${jobId}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    return r.json();
  },
};
