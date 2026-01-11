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
  jobs: new Map(), // jobId -> job
  bids: new Map(), // bidId -> bid
  conversations: new Map(), // conversationId -> conversation
  messages: new Map(), // messageId -> message
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
  conversations: {
    async create(data) {
      const convId = id("conv");
      const conv = { id: convId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...data };
      state.conversations.set(convId, conv);
      return conv;
    },
    async get(id) {
      return state.conversations.get(id) || null;
    },
    async find(jobId, uid1, uid2) {
      return Array.from(state.conversations.values()).find(c =>
        c.jobId === jobId &&
        c.participants.includes(uid1) &&
        c.participants.includes(uid2)
      ) || null;
    },
    async listByUser(uid) {
      return Array.from(state.conversations.values()).filter(c => c.participants.includes(uid));
    },
    async update(id, patch) {
      const cur = state.conversations.get(id);
      if (!cur) return null;
      const updated = { ...cur, ...patch, updatedAt: new Date().toISOString() };
      state.conversations.set(id, updated);
      return updated;
    },
    async markRead(id, uid) {
      const cur = state.conversations.get(id);
      if (!cur) return null;
      const readBy = cur.readBy || {};
      readBy[uid] = new Date().toISOString();
      const updated = { ...cur, readBy, updatedAt: new Date().toISOString() };
      state.conversations.set(id, updated);
      return updated;
    },
    async hide(id, uid) {
      const cur = state.conversations.get(id);
      if (!cur) return null;
      const hiddenBy = cur.hiddenBy || [];
      if (!hiddenBy.includes(uid)) hiddenBy.push(uid);
      const updated = { ...cur, hiddenBy, updatedAt: new Date().toISOString() };
      state.conversations.set(id, updated);
      return updated;
    },
    async unhide(id, uid) {
      const cur = state.conversations.get(id);
      if (!cur) return null;
      const hiddenBy = (cur.hiddenBy || []).filter(u => u !== uid);
      const updated = { ...cur, hiddenBy, updatedAt: new Date().toISOString() };
      state.conversations.set(id, updated);
      return updated;
    },
    async delete(id) {
      // Delete all messages in this conversation
      for (const [msgId, msg] of Array.from(state.messages.entries())) {
        if (msg.conversationId === id) {
          state.messages.delete(msgId);
        }
      }
      // Delete the conversation
      return state.conversations.delete(id);
    }
  },
  messages: {
    async create(data) {
      const msgId = id("msg");
      const msg = { id: msgId, createdAt: new Date().toISOString(), ...data };
      state.messages.set(msgId, msg);
      return msg;
    },
    async list(conversationId) {
      return Array.from(state.messages.values())
        .filter(m => m.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  }
};
