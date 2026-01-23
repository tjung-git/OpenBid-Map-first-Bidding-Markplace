import { cfg } from "./config";
import { getSession } from "./session";

const base = cfg.apiBase;

// attach mock header uid when prototype
function headers() {
  const h = { "Content-Type": "application/json" };
  const session = getSession();
  const uid = session?.user?.uid || localStorage.getItem("mockUid") || null;
  if (session?.user?.uid) {
    h["x-user-id"] = session.user.uid;
  }
  const proto = Boolean(session?.prototype ?? cfg.prototype);
  if (proto && uid) {
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
  async forgotPassword(email) {
    const r = await fetch(`${base}/api/password/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async updateRole(role) {
    const r = await fetch(`${base}/api/auth/role`, {
      method: "PATCH",
      headers: headers(),
      credentials: "include",
      body: JSON.stringify({ role }),
    });
    const data = await r.json();
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async me() {
    const r = await fetch(`${base}/api/auth/me`, { headers: headers() });
    return r.ok ? r.json() : null;
  },
  async kycVerification() {
    const r = await fetch(`${base}/api/kyc/verification`, {
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
  async bidAccept(jobId, bidId) {
    const r = await fetch(`${base}/api/bids/${jobId}/${bidId}/accept`, {
      method: "POST",
      headers: headers(),
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
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append("avatar", file);
    const session = getSession();
    const authToken = session?.session?.token || session?.session?.idToken;
    const h = {};
    if (authToken) {
      h.Authorization = `Bearer ${authToken}`;
    }
    if (session?.user?.uid) {
      h["x-user-id"] = session.user.uid;
    }
    if (cfg.prototype && session?.user?.uid) {
      h["x-mock-uid"] = session.user.uid;
    }
    const r = await fetch(`${base}/api/upload/avatar`, {
      method: "POST",
      headers: h,
      body: formData,
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw { status: r.status, data };
    }
    return r.json();
  },
  async deleteAvatar() {
    const session = getSession();
    const authToken = session?.session?.token || session?.session?.idToken;
    const h = {};
    if (authToken) {
      h.Authorization = `Bearer ${authToken}`;
    }
    if (session?.user?.uid) {
      h["x-user-id"] = session.user.uid;
    }
    if (cfg.prototype && session?.user?.uid) {
      h["x-mock-uid"] = session.user.uid;
    }

    const r = await fetch(`${base}/api/upload/avatar`, {
      method: "DELETE",
      headers: h,
    });
    if (!r.ok && r.status !== 204) {
      const data = await r.json().catch(() => ({}));
      throw { status: r.status, data };
    }
    return true;
  },
  async duoFinalize(code) {
    const r = await fetch(`${base}/api/auth/duo/finalize`, {
      method: "POST",
      headers: { ...headers() },
      body: JSON.stringify({ code }),
    });
    const data = await r.json();
    if (!r.ok) throw { status: r.status, data };
    return data;
  },
  async reviewsForUser(uid) {
    const safeUid = encodeURIComponent(String(uid || "").trim());
    const r = await fetch(`${base}/api/reviews/user/${safeUid}`, {
      headers: headers(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async portfolioForUser(uid) {
    const safeUid = encodeURIComponent(String(uid || "").trim());
    const r = await fetch(`${base}/api/portfolio/user/${safeUid}`, {
      headers: headers(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async portfolioCreate(payload) {
    const r = await fetch(`${base}/api/portfolio`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async portfolioUpdate(itemId, payload) {
    const safeItemId = encodeURIComponent(String(itemId || "").trim());
    const r = await fetch(`${base}/api/portfolio/${safeItemId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(payload || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async portfolioUploadPhotos(itemId, files) {
    const safeItemId = encodeURIComponent(String(itemId || "").trim());
    const formData = new FormData();
    (Array.isArray(files) ? files : []).forEach((file) => {
      if (file) formData.append("photos", file);
    });
    const session = getSession();
    const authToken = session?.session?.token || session?.session?.idToken;
    const h = {};
    if (authToken) {
      h.Authorization = `Bearer ${authToken}`;
    }
    if (session?.user?.uid) {
      h["x-user-id"] = session.user.uid;
    }
    if (cfg.prototype && session?.user?.uid) {
      h["x-mock-uid"] = session.user.uid;
    }
    const r = await fetch(`${base}/api/portfolio/${safeItemId}/photos`, {
      method: "POST",
      headers: h,
      body: formData,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async portfolioDeletePhotos(itemId, photoUrls) {
    const safeItemId = encodeURIComponent(String(itemId || "").trim());
    const r = await fetch(`${base}/api/portfolio/${safeItemId}/photos`, {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({ photoUrls: Array.isArray(photoUrls) ? photoUrls : [] }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async portfolioDelete(itemId) {
    const safeItemId = encodeURIComponent(String(itemId || "").trim());
    const r = await fetch(`${base}/api/portfolio/${safeItemId}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (r.status === 204) return true;
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw { status: r.status, data };
    return true;
  },
  async reviewCreate(payload) {
    const r = await fetch(`${base}/api/reviews`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async reviewUploadPhotos(reviewId, files) {
    const safeReviewId = encodeURIComponent(String(reviewId || "").trim());
    const formData = new FormData();
    (Array.isArray(files) ? files : []).forEach((file) => {
      if (file) formData.append("photos", file);
    });
    const session = getSession();
    const authToken = session?.session?.token || session?.session?.idToken;
    const h = {};
    if (authToken) {
      h.Authorization = `Bearer ${authToken}`;
    }
    if (session?.user?.uid) {
      h["x-user-id"] = session.user.uid;
    }
    if (cfg.prototype && session?.user?.uid) {
      h["x-mock-uid"] = session.user.uid;
    }
    const r = await fetch(`${base}/api/reviews/${safeReviewId}/photos`, {
      method: "POST",
      headers: h,
      body: formData,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async reviewUpdate(reviewId, payload) {
    const safeReviewId = encodeURIComponent(String(reviewId || "").trim());
    const r = await fetch(`${base}/api/reviews/${safeReviewId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(payload || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async reviewDeletePhotos(reviewId, photoUrls) {
    const safeReviewId = encodeURIComponent(String(reviewId || "").trim());
    const r = await fetch(`${base}/api/reviews/${safeReviewId}/photos`, {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({
        photoUrls: Array.isArray(photoUrls) ? photoUrls : [],
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw { status: r.status, data };
    }
    return data;
  },
  async reviewDelete(reviewId) {
    const safeReviewId = encodeURIComponent(String(reviewId || "").trim());
    const r = await fetch(`${base}/api/reviews/${safeReviewId}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (r.status === 204) return true;
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw { status: r.status, data };
    return true;
  },
};
