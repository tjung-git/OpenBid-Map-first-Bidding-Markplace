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
    upsert(u) {
      state.users.set(u.uid, u);
      return u;
    },
    get(uid) {
      return state.users.get(uid) || null;
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
  },
  bid: {
    listByJob(jobId) {
      return Array.from(state.bids.values()).filter((b) => b.jobId === jobId);
    },
    create(data) {
      const bidId = id("bid");
      const bid = {
        id: bidId,
        createdAt: Date.now(),
        status: "active",
        ...data,
      };
      state.bids.set(bidId, bid);
      return bid;
    },
    update(bidId, patch) {
      const cur = state.bids.get(bidId);
      if (!cur) return null;
      const updated = { ...cur, ...patch, updatedAt: Date.now() };
      state.bids.set(bidId, updated);
      return updated;
    },
  },
};
