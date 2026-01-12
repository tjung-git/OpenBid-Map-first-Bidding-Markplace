// in-memory store
const state = {
  users: new Map([
    ['u_testexamplec', { 
      uid: 'u_testexamplec', 
      email: 'test@example.com', 
      kycStatus: 'pending',
      kycSessionId: null
    }],
    ['u_openbid123', {
      uid: 'u_openbid123',
      email: 'openbid123@gmail.com',
      firstName: 'OpenBid',
      lastName: 'Developer',
      userType: 'bidder',
      emailVerification: 'verified',
      kycStatus: 'pending',
      kycSessionId: null,
      passwordHash: '$2b$10$JIyQumAfY3GLNiNvSNu4.efls3iHM6CAiQyoHfr/H1mISNppvqSaC',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  ]), // key: uid -> user { uid, email, name, kycStatus, kycSessionId }
  profiles: new Map(), // key: uid -> profile { uid, avatarUrl, ... }
  reviews: new Map(), // key: reviewId -> review { ... }
  portfolioItems: new Map(), // key: portfolioId -> item { ... }
  jobs: new Map(), // jobId -> job
  bids: new Map(), // bidId -> bid
};

let seq = 1;
const id = (p) => `${p}_${seq++}`;

export const db = {
  user: {
    async upsert(u) {
      const current = state.users.get(u.uid) || {};
      const merged = { ...current, ...u };
      state.users.set(u.uid, merged);
      return merged;
    },
    async get(uid) {
      return state.users.get(uid) || null;
    },
    async create(user) {
      const newUser = { ...user };
      state.users.set(user.uid, newUser);
      return newUser;
    },
    async update(uid, patch) {
      const current = state.users.get(uid);
      if (!current) return null;
      const updated = { ...current, ...patch };
      state.users.set(uid, updated);
      return updated;
    },
    async findByEmail(email) {
      const normalized = email?.toLowerCase();
      if (!normalized) return null;
      for (const user of state.users.values()) {
        if (user.email?.toLowerCase() === normalized) {
          return user;
        }
      }
      return null;
    },
  },
  profile: {
    async upsert(p) {
      const current = state.profiles.get(p.uid) || {};
      const merged = { ...current, ...p };
      state.profiles.set(p.uid, merged);
      return merged;
    },
    async get(uid) {
      return state.profiles.get(uid) || null;
    },
    async update(uid, patch) {
      const current = state.profiles.get(uid);
      if (!current) return null;
      const updated = { ...current, ...patch };
      state.profiles.set(uid, updated);
      return updated;
    },
  },
  review: {
    async create(review) {
      const reviewId = id("review");
      const payload = {
        id: reviewId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...review,
      };
      state.reviews.set(reviewId, payload);
      return payload;
    },
    async get(reviewId) {
      return state.reviews.get(reviewId) || null;
    },
    async update(reviewId, patch) {
      const current = state.reviews.get(reviewId);
      if (!current) return null;
      const merged = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      state.reviews.set(reviewId, merged);
      return merged;
    },
    async delete(reviewId) {
      return state.reviews.delete(reviewId);
    },
    async listByReviewed(reviewedId, { limit = 50 } = {}) {
      if (!reviewedId) return [];
      return Array.from(state.reviews.values())
        .filter((r) => r.reviewedId === reviewedId)
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.updatedAt || 0).getTime() -
            new Date(a.createdAt || a.updatedAt || 0).getTime()
        )
        .slice(0, limit);
    },
    async listByJob(jobId, { limit = 50 } = {}) {
      if (!jobId) return [];
      return Array.from(state.reviews.values())
        .filter((r) => r.jobId === jobId)
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.updatedAt || 0).getTime() -
            new Date(a.createdAt || a.updatedAt || 0).getTime()
        )
        .slice(0, limit);
    },
    async appendPhotos(reviewId, { photoUrls = [], photoThumbUrls = [] } = {}) {
      const current = state.reviews.get(reviewId);
      if (!current) return null;
      const nextUrls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
      const nextThumbs = Array.isArray(photoThumbUrls)
        ? photoThumbUrls.filter(Boolean)
        : [];
      const merged = {
        ...current,
        photoUrls: Array.from(new Set([...(current.photoUrls || []), ...nextUrls])),
        photoThumbUrls: Array.from(
          new Set([...(current.photoThumbUrls || []), ...nextThumbs])
        ),
        updatedAt: new Date().toISOString(),
      };
      state.reviews.set(reviewId, merged);
      return merged;
    },
    async removePhotos(reviewId, { photoUrls = [], photoThumbUrls = [] } = {}) {
      const current = state.reviews.get(reviewId);
      if (!current) return null;
      const removeUrls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
      const removeThumbs = Array.isArray(photoThumbUrls)
        ? photoThumbUrls.filter(Boolean)
        : [];
      const merged = {
        ...current,
        photoUrls: Array.isArray(current.photoUrls)
          ? current.photoUrls.filter((u) => !removeUrls.includes(u))
          : [],
        photoThumbUrls: Array.isArray(current.photoThumbUrls)
          ? current.photoThumbUrls.filter((u) => !removeThumbs.includes(u))
          : [],
        updatedAt: new Date().toISOString(),
      };
      state.reviews.set(reviewId, merged);
      return merged;
    },
    async appendPhotoUrls(reviewId, urls = []) {
      return this.appendPhotos(reviewId, { photoUrls: urls });
    },
  },
  portfolio: {
    async create(item) {
      const itemId = id("portfolio");
      const payload = {
        id: itemId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        photoUrls: [],
        photoThumbUrls: [],
        ...item,
      };
      state.portfolioItems.set(itemId, payload);
      return payload;
    },
    async get(itemId) {
      return state.portfolioItems.get(itemId) || null;
    },
    async listByUser(userId, { limit = 50 } = {}) {
      if (!userId) return [];
      return Array.from(state.portfolioItems.values())
        .filter((p) => p.userId === userId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
        )
        .slice(0, limit);
    },
    async update(itemId, patch) {
      const current = state.portfolioItems.get(itemId);
      if (!current) return null;
      const merged = { ...current, ...patch, updatedAt: new Date().toISOString() };
      state.portfolioItems.set(itemId, merged);
      return merged;
    },
    async delete(itemId) {
      return state.portfolioItems.delete(itemId);
    },
    async appendPhotos(itemId, { photoUrls = [], photoThumbUrls = [] } = {}) {
      const current = state.portfolioItems.get(itemId);
      if (!current) return null;
      const nextUrls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
      const nextThumbs = Array.isArray(photoThumbUrls)
        ? photoThumbUrls.filter(Boolean)
        : [];
      const merged = {
        ...current,
        photoUrls: Array.from(new Set([...(current.photoUrls || []), ...nextUrls])),
        photoThumbUrls: Array.from(
          new Set([...(current.photoThumbUrls || []), ...nextThumbs])
        ),
        updatedAt: new Date().toISOString(),
      };
      state.portfolioItems.set(itemId, merged);
      return merged;
    },
    async removePhotos(itemId, { photoUrls = [], photoThumbUrls = [] } = {}) {
      const current = state.portfolioItems.get(itemId);
      if (!current) return null;
      const removeUrls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
      const removeThumbs = Array.isArray(photoThumbUrls)
        ? photoThumbUrls.filter(Boolean)
        : [];
      const merged = {
        ...current,
        photoUrls: Array.isArray(current.photoUrls)
          ? current.photoUrls.filter((u) => !removeUrls.includes(u))
          : [],
        photoThumbUrls: Array.isArray(current.photoThumbUrls)
          ? current.photoThumbUrls.filter((u) => !removeThumbs.includes(u))
          : [],
        updatedAt: new Date().toISOString(),
      };
      state.portfolioItems.set(itemId, merged);
      return merged;
    },
  },
  job: {
    list() {
      return Array.from(state.jobs.values());
    },
    get(jobId) {
      return state.jobs.get(jobId) || null;
    },
    create(data) {
      const jobId = id("job");
      const job = { id: jobId, status: "open", createdAt: Date.now(), ...data };
      state.jobs.set(jobId, job);
      return job;
    },
    update(jobId, patch) {
      const cur = state.jobs.get(jobId);
      if (!cur) return null;
      const updated = { ...cur, ...patch, updatedAt: Date.now() };
      state.jobs.set(jobId, updated);
      return updated;
    },
    delete(jobId) {
      const exists = state.jobs.has(jobId);
      if (!exists) return false;
      state.jobs.delete(jobId);
      for (const [bidId, bid] of Array.from(state.bids.entries())) {
        if (bid.jobId === jobId) {
          state.bids.delete(bidId);
        }
      }
      return true;
    },
  },
  bid: {
    get(bidId) {
      const bid = state.bids.get(bidId) || null;
      if (bid?.jobID && !bid.jobId) {
        bid.jobId = bid.jobID;
        delete bid.jobID;
      }
      return bid;
    },
    listByJob(jobId) {
      return Array.from(state.bids.values())
        .map((bid) => {
          if (bid.jobID && !bid.jobId) {
            bid.jobId = bid.jobID;
            delete bid.jobID;
          }
          return bid;
        })
        .filter((b) => b.jobId === jobId);
    },
    listByUser(uid) {
      return Array.from(state.bids.values())
        .map((bid) => {
          if (bid.jobID && !bid.jobId) {
            bid.jobId = bid.jobID;
            delete bid.jobID;
          }
          return bid;
        })
        .filter((b) => b.providerId === uid);
    },
    create(data) {
      const bidId = id("bid");
      const bid = {
        id: bidId,
        createdAt: Date.now(),
        status: "active",
        bidCreatedAt: new Date().toISOString(),
        ...data,
      };
      state.bids.set(bidId, bid);
      return bid;
    },
    update(bidId, patch) {
      const cur = state.bids.get(bidId);
      if (!cur) return null;
      const updated = {
        ...cur,
        ...patch,
        updatedAt: Date.now(),
        bidUpdatedAt: new Date().toISOString(),
      };
      if (updated.jobID && !updated.jobId) {
        updated.jobId = updated.jobID;
      }
      delete updated.jobID;
      state.bids.set(bidId, updated);
      return updated;
    },
    delete(bidId) {
      return state.bids.delete(bidId);
    },
    deleteByJob(jobId) {
      let count = 0;
      for (const [bidId, bid] of Array.from(state.bids.entries())) {
        if (bid.jobID && !bid.jobId) {
          bid.jobId = bid.jobID;
          delete bid.jobID;
          state.bids.set(bidId, bid);
        }
        if (bid.jobId === jobId) {
          state.bids.delete(bidId);
          count += 1;
        }
      }
      return count;
    },
  },
};
