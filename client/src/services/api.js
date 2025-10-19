import { cfg } from "./config";
import { getSession } from "./session";

const base = cfg.apiBase;

// attach mock header uid when prototype
function headers() {
  const h = { "Content-Type": "application/json" };
  const session = getSession();
  const uid =
    session?.user?.uid || localStorage.getItem("mockUid") || null;
  if (session?.user?.uid) {
    h["x-user-id"] = session.user.uid;
  }
  if (cfg.prototype && uid) {
    h["x-mock-uid"] = uid;
  }
  const authToken = session?.session?.token || session?.session?.idToken;
  if (authToken) {
    h.Authorization = `Bearer ${authToken}`;
  }
  return h;
}

export const api = {
  async signup(payload) {
    const r = await fetch(`${base}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async login(email, password) {
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) {
      throw { status: r.status, data };
    }
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
  async jobsList(query = "") {
    const r = await fetch(`${base}/api/jobs${query}`, { headers: headers() });
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
  async jobUpdate(id, payload) {
    const r = await fetch(`${base}/api/jobs/${id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    if (r.status === 204) return { job: null };
    return r.json();
  },
  async jobDelete(id) {
    const r = await fetch(`${base}/api/jobs/${id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!r.ok && r.status !== 204) {
      const data = await r.json().catch(() => ({}));
      throw { status: r.status, data };
    }
    return true;
  },
  async bidsForJob(jobId) {
    const r = await fetch(`${base}/api/bids/${jobId}`, { headers: headers() });
    return r.json();
  },
  async bidsForUser() {
    const r = await fetch(`${base}/api/bids/myBids`, { headers: headers() });
    return r.json();
  },
  async bidUpdate(jobId, bidId, payload) {
    const r = await fetch(`${base}/api/bids/${jobId}/${bidId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(payload),
    });
    return r.json();
  },
  async bidDelete(bidId) {
    const r = await fetch(`${base}/api/bids/${bidId}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!r.ok && r.status !== 204) {
      const data = await r.json().catch(() => ({}));
      throw { status: r.status, data };
    }
    return true;
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
