import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../lib/firebase.js";

const collections = {
  users: "users",
  jobs: "jobs",
  bids: "bids",
};

const firestore = () => getDb();

const toRecord = (doc, idKey = "id") => {
  if (!doc.exists) return null;
  const data = doc.data();
  for (const key of Object.keys(data)) {
    if (data[key] instanceof Timestamp) {
      data[key] = data[key].toDate().toISOString();
    }
  }
  return { [idKey]: doc.id, ...data };
};

const withTimestamps = (payload, { isNew } = {}) => {
  const data = { ...payload };
  if (isNew) {
    data.createdAt = FieldValue.serverTimestamp();
  } else if (data.createdAt === undefined) {
    delete data.createdAt;
  }
  data.updatedAt = FieldValue.serverTimestamp();
  return data;
};

const clean = (payload) => {
  const result = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

export const db = {
  user: {
    async create(user) {
      const ref = firestore().collection(collections.users).doc(user.uid);
      const data = clean(
        withTimestamps(
          { ...user, email: user.email?.toLowerCase() },
          { isNew: true }
        )
      );
      await ref.set(data);
      const snapshot = await ref.get();
      return toRecord(snapshot, "uid");
    },
    async upsert(user) {
      const ref = firestore().collection(collections.users).doc(user.uid);
      const snapshot = await ref.get();
      const data = clean(
        withTimestamps(
          { ...user, email: user.email?.toLowerCase() },
          { isNew: !snapshot.exists }
        )
      );
      await ref.set(data, { merge: true });
      const updated = await ref.get();
      return toRecord(updated, "uid");
    },
    async update(uid, patch) {
      const ref = firestore().collection(collections.users).doc(uid);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;
      const data = clean(
        withTimestamps(
          { ...patch, email: patch.email?.toLowerCase() },
          { isNew: false }
        )
      );
      await ref.update(data);
      const updated = await ref.get();
      return toRecord(updated, "uid");
    },
    async get(uid) {
      if (!uid) return null;
      const doc = await firestore()
        .collection(collections.users)
        .doc(uid)
        .get();
      return toRecord(doc, "uid");
    },
    async findByEmail(email) {
      if (!email) return null;
      const snapshot = await firestore()
        .collection(collections.users)
        .where("email", "==", email.toLowerCase())
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      return toRecord(snapshot.docs[0], "uid");
    },
  },
  job: {
    async list() {
      const snapshot = await firestore()
        .collection(collections.jobs)
        .orderBy("createdAt", "desc")
        .get();
      return snapshot.docs.map((doc) => toRecord(doc));
    },
    async get(jobId) {
      if (!jobId) return null;
      const doc = await firestore()
        .collection(collections.jobs)
        .doc(jobId)
        .get();
      return toRecord(doc);
    },
    async create(data) {
      const ref = await firestore()
        .collection(collections.jobs)
        .add(
          clean(
            withTimestamps(
              {
                status: "open",
                ...data,
              },
              { isNew: true }
            )
          )
        );
      const doc = await ref.get();
      return toRecord(doc);
    },
    async update(jobId, patch) {
      const ref = firestore().collection(collections.jobs).doc(jobId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;
      await ref.update(clean(withTimestamps(patch, { isNew: false })));
      const updated = await ref.get();
      return toRecord(updated);
    },
    async delete(jobId) {
      if (!jobId) return false;
      const dbRef = firestore();
      const ref = dbRef.collection(collections.jobs).doc(jobId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return false;
      await ref.delete();

      const bidsSnapshot = await dbRef
        .collection(collections.bids)
        .where("jobId", "==", jobId)
        .get();
      if (!bidsSnapshot.empty) {
        const batch = dbRef.batch();
        bidsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      return true;
    },
  },
  bid: {
    async get(bidId) {
      if (!bidId) return null;
      const doc = await firestore()
        .collection(collections.bids)
        .doc(bidId)
        .get();
      return toRecord(doc);
    },
    async listByJob(jobId) {
      if (!jobId) return [];
      const snapshot = await firestore()
        .collection(collections.bids)
        .get();
      return snapshot.docs
        .map((doc) => toRecord(doc))
        .filter((bid) => bid.jobId === jobId || bid.jobID === jobId);
    },
    async listByUser(uid) {
      if (!uid) return [];
      const snapshot = await firestore()
        .collection(collections.bids)
        .where("providerId", "==", uid)
        .get();
      return snapshot.docs
        .map((doc) => toRecord(doc))
        .sort((a, b) => {
          const aCreated = new Date(a.bidCreatedAt || a.createdAt || 0).getTime();
          const bCreated = new Date(b.bidCreatedAt || b.createdAt || 0).getTime();
          return bCreated - aCreated;
        });
    },
    async create(data) {
      const ref = await firestore()
        .collection(collections.bids)
        .add(
          clean(
            withTimestamps(
              {
                status: "active",
                jobId: data.jobId,
                jobID: data.jobId,
                bidCreatedAt:
                  data.bidCreatedAt || new Date().toISOString(),
                ...data,
              },
              { isNew: true }
            )
          )
        );
      const doc = await ref.get();
      return toRecord(doc);
    },
    async update(bidId, patch) {
      const ref = firestore().collection(collections.bids).doc(bidId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;
      await ref.update(clean(withTimestamps(patch, { isNew: false })));
      const updated = await ref.get();
      return toRecord(updated);
    },
    async delete(bidId) {
      if (!bidId) return false;
      const ref = firestore().collection(collections.bids).doc(bidId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return false;
      await ref.delete();
      return true;
    },
    async deleteByJob(jobId) {
      if (!jobId) return 0;
      const dbRef = firestore();
      const snapshot = await dbRef
        .collection(collections.bids)
        .where("jobId", "==", jobId)
        .get();
      if (snapshot.empty) return 0;
      const batch = dbRef.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      return snapshot.size;
    },
  },
};
