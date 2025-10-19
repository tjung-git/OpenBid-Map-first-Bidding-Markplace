// in-memory store
const state = {
  users: new Map(), // key: uid -> user { uid, email, name, kycStatus }
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
      return state.bids.get(bidId) || null;
    },
    listByJob(jobId) {
      return Array.from(state.bids.values()).filter(
        (b) => b.jobId === jobId || b.jobID === jobId
      );
    },
    listByUser(uid) {
      return Array.from(state.bids.values()).filter(
        (b) => b.providerId === uid
      );
    },
    create(data) {
      const bidId = id("bid");
      const bid = {
        id: bidId,
        createdAt: Date.now(),
        status: "active",
        bidCreatedAt: new Date().toISOString(),
        jobID: data.jobId,
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
      state.bids.set(bidId, updated);
      return updated;
    },
    delete(bidId) {
      return state.bids.delete(bidId);
    },
    deleteByJob(jobId) {
      let count = 0;
      for (const [bidId, bid] of Array.from(state.bids.entries())) {
        if (bid.jobId === jobId) {
          state.bids.delete(bidId);
          count += 1;
        }
      }
      return count;
    },
  },
};
