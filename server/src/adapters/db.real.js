// Example shape for later: Firebase Admin or SQL client.
// Export same methods as db.mock so routes don't change.
export const db = {
  user: {
    async upsert(u) {
      /* write to real DB */ return u;
    },
    async get(uid) {
      return null;
    },
  },
  job: {
    async list() {
      return [];
    },
    async get(jobId) {
      return null;
    },
    async create(data) {
      return { id: "real_job", ...data };
    },
    async update(jobId, patch) {
      return { id: jobId, ...patch };
    },
  },
  bid: {
    async listByJob(jobId) {
      return [];
    },
    async create(data) {
      return { id: "real_bid", ...data };
    },
    async update(bidId, patch) {
      return { id: bidId, ...patch };
    },
  },
};
