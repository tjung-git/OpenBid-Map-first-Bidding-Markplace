import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../lib/firebase.js";

const collections = {
  users: "users",
  jobs: "jobs",
  bids: "bids",
  conversations: "conversations",
  messages: "messages",
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
  if (data.jobID && !data.jobId) {
    data.jobId = data.jobID;
  }
  delete data.jobID;
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
        .filter((bid) => bid.jobId === jobId);
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
  conversations: {
    async create(data) {
      const ref = await firestore()
        .collection(collections.conversations)
        .add(clean(withTimestamps(data, { isNew: true })));
      const doc = await ref.get();
      return toRecord(doc);
    },
    async get(id) {
      if (!id) return null;
      const doc = await firestore().collection(collections.conversations).doc(id).get();
      return toRecord(doc);
    },
    async find(jobId, uid1, uid2) {
      const snapshot = await firestore()
        .collection(collections.conversations)
        .where("jobId", "==", jobId)
        .where("participants", "array-contains", uid1)
        .get();

      const found = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.participants && data.participants.includes(uid2);
      });
      return found ? toRecord(found) : null;
    },
    async listByUser(uid) {
      // Firestore array-contains
      const snapshot = await firestore()
        .collection(collections.conversations)
        .where("participants", "array-contains", uid)
        .get();
      return snapshot.docs.map(doc => toRecord(doc));
    },
    async update(id, patch) {
      const ref = firestore().collection(collections.conversations).doc(id);
      await ref.update(clean(withTimestamps(patch, { isNew: false })));
      const updated = await ref.get();
      return toRecord(updated);
    },
    async markRead(id, uid) {
      const ref = firestore().collection(collections.conversations).doc(id);
      await ref.update({
        [`readBy.${uid}`]: new Date().toISOString(),
        updatedAt: FieldValue.serverTimestamp()
      });
      const updated = await ref.get();
      return toRecord(updated);
    },
    async hide(id, uid) {
      const ref = firestore().collection(collections.conversations).doc(id);
      await ref.update({
        hiddenBy: FieldValue.arrayUnion(uid),
        updatedAt: FieldValue.serverTimestamp()
      });
      const updated = await ref.get();
      return toRecord(updated);
    },
    async unhide(id, uid) {
      const ref = firestore().collection(collections.conversations).doc(id);
      await ref.update({
        hiddenBy: FieldValue.arrayRemove(uid),
        updatedAt: FieldValue.serverTimestamp()
      });
      const updated = await ref.get();
      return toRecord(updated);
    },
    async delete(id) {
      const dbRef = firestore();
      // Delete all messages in this conversation
      const messagesSnapshot = await dbRef
        .collection(collections.messages)
        .where("conversationId", "==", id)
        .get();

      if (!messagesSnapshot.empty) {
        const batch = dbRef.batch();
        messagesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // Delete the conversation itself
      await dbRef.collection(collections.conversations).doc(id).delete();
      return true;
    }
  },
  messages: {
    async create(data) {
      const ref = await firestore()
        .collection(collections.messages)
        .add(clean(withTimestamps(data, { isNew: true })));
      const doc = await ref.get();
      return toRecord(doc);
    },
    async list(conversationId) {
      const snapshot = await firestore()
        .collection(collections.messages)
        .where("conversationId", "==", conversationId)
        // .orderBy("createdAt", "asc") // Index might be required
        .get();
      return snapshot.docs.map(doc => toRecord(doc)).sort((a, b) => {
        // Manual sort to avoid needing immediate index creation for prototype
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }
  }
};
