import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../lib/firebase.js";

const collections = {
  users: "users",
  profiles: "profiles",
  reviews: "reviews",
  portfolioItems: "portfolioItems",
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
  } else {
    // createdAt is immutable; never allow callers to overwrite it.
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
      const docRef = firestore().collection(collections.users).doc(uid);
      const doc = await docRef.get();
      if (doc.exists) return toRecord(doc, "uid");

      // Backward-compat: some deployments stored users with auto ids and a `uid` field.
      const snapshot = await firestore()
        .collection(collections.users)
        .where("uid", "==", uid)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      return toRecord(snapshot.docs[0], "uid");
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
  profile: {
    async upsert(profile) {
      const ref = firestore().collection(collections.profiles).doc(profile.uid);
      const snapshot = await ref.get();
      const data = clean(withTimestamps({ ...profile }, { isNew: !snapshot.exists }));
      await ref.set(data, { merge: true });
      const updated = await ref.get();
      return toRecord(updated, "uid");
    },
    async update(uid, patch) {
      const ref = firestore().collection(collections.profiles).doc(uid);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;
      const data = clean(withTimestamps({ ...patch }, { isNew: false }));
      await ref.update(data);
      const updated = await ref.get();
      return toRecord(updated, "uid");
    },
    async get(uid) {
      if (!uid) return null;
      const doc = await firestore()
        .collection(collections.profiles)
        .doc(uid)
        .get();
      return toRecord(doc, "uid");
    },
  },
  review: {
    async create(review) {
      const ref = await firestore()
        .collection(collections.reviews)
        .add(clean(withTimestamps({ ...review }, { isNew: true })));
      const doc = await ref.get();
      return toRecord(doc);
    },
    async get(reviewId) {
      if (!reviewId) return null;
      const doc = await firestore()
        .collection(collections.reviews)
        .doc(reviewId)
        .get();
      return toRecord(doc);
    },
    async update(reviewId, patch) {
      if (!reviewId) return null;
      const ref = firestore().collection(collections.reviews).doc(reviewId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;
      await ref.update(clean(withTimestamps({ ...patch }, { isNew: false })));
      const updated = await ref.get();
      return toRecord(updated);
    },
    async delete(reviewId) {
      if (!reviewId) return false;
      const ref = firestore().collection(collections.reviews).doc(reviewId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return false;
      await ref.delete();
      return true;
    },
    async listByReviewed(reviewedId, { limit = 50 } = {}) {
      if (!reviewedId) return [];
      const snapshot = await firestore()
        .collection(collections.reviews)
        .where("reviewedId", "==", reviewedId)
        .limit(limit)
        .get();
      return snapshot.docs
        .map((doc) => toRecord(doc))
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.updatedAt || 0).getTime() -
            new Date(a.createdAt || a.updatedAt || 0).getTime()
        );
    },
    async listByJob(jobId, { limit = 50 } = {}) {
      if (!jobId) return [];
      const snapshot = await firestore()
        .collection(collections.reviews)
        .where("jobId", "==", jobId)
        .limit(limit)
        .get();
      return snapshot.docs
        .map((doc) => toRecord(doc))
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.updatedAt || 0).getTime() -
            new Date(a.createdAt || a.updatedAt || 0).getTime()
        );
    },
    async appendPhotos(reviewId, { photoUrls = [], photoThumbUrls = [] } = {}) {
      if (!reviewId) return null;
      const nextUrls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
      const nextThumbs = Array.isArray(photoThumbUrls)
        ? photoThumbUrls.filter(Boolean)
        : [];
      if (nextUrls.length === 0 && nextThumbs.length === 0) return this.get(reviewId);

      const ref = firestore().collection(collections.reviews).doc(reviewId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;

      const currentUrls = snapshot.data()?.photoUrls;
      const currentThumbs = snapshot.data()?.photoThumbUrls;

      const mergedUrls = Array.from(
        new Set([...(Array.isArray(currentUrls) ? currentUrls : []), ...nextUrls])
      );
      const mergedThumbs = Array.from(
        new Set([
          ...(Array.isArray(currentThumbs) ? currentThumbs : []),
          ...nextThumbs,
        ])
      );

      await ref.update(
        clean(withTimestamps({ photoUrls: mergedUrls, photoThumbUrls: mergedThumbs }, { isNew: false }))
      );
      const updated = await ref.get();
      return toRecord(updated);
    },
    async removePhotos(reviewId, { photoUrls = [], photoThumbUrls = [] } = {}) {
      if (!reviewId) return null;
      const removeUrls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
      const removeThumbs = Array.isArray(photoThumbUrls)
        ? photoThumbUrls.filter(Boolean)
        : [];
      if (removeUrls.length === 0 && removeThumbs.length === 0) return this.get(reviewId);

      const ref = firestore().collection(collections.reviews).doc(reviewId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;

      const currentUrls = snapshot.data()?.photoUrls;
      const currentThumbs = snapshot.data()?.photoThumbUrls;

      const nextUrls = Array.isArray(currentUrls)
        ? currentUrls.filter((u) => !removeUrls.includes(u))
        : [];
      const nextThumbs = Array.isArray(currentThumbs)
        ? currentThumbs.filter((u) => !removeThumbs.includes(u))
        : [];

      await ref.update(
        clean(withTimestamps({ photoUrls: nextUrls, photoThumbUrls: nextThumbs }, { isNew: false }))
      );
      const updated = await ref.get();
      return toRecord(updated);
    },
    async appendPhotoUrls(reviewId, urls = []) {
      return this.appendPhotos(reviewId, { photoUrls: urls });
    },
  },
  portfolio: {
    async create(item) {
      const ref = await firestore()
        .collection(collections.portfolioItems)
        .add(clean(withTimestamps({ ...item }, { isNew: true })));
      const doc = await ref.get();
      return toRecord(doc);
    },
    async get(itemId) {
      if (!itemId) return null;
      const doc = await firestore()
        .collection(collections.portfolioItems)
        .doc(itemId)
        .get();
      return toRecord(doc);
    },
    async listByUser(userId, { limit = 50 } = {}) {
      if (!userId) return [];
      const snapshot = await firestore()
        .collection(collections.portfolioItems)
        .where("userId", "==", userId)
        .limit(limit)
        .get();
      return snapshot.docs
        .map((doc) => toRecord(doc))
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
    },
    async update(itemId, patch) {
      if (!itemId) return null;
      const ref = firestore().collection(collections.portfolioItems).doc(itemId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;
      await ref.update(clean(withTimestamps({ ...patch }, { isNew: false })));
      const updated = await ref.get();
      return toRecord(updated);
    },
    async delete(itemId) {
      if (!itemId) return false;
      const ref = firestore().collection(collections.portfolioItems).doc(itemId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return false;
      await ref.delete();
      return true;
    },
    async appendPhotos(itemId, { photoUrls = [], photoThumbUrls = [] } = {}) {
      if (!itemId) return null;
      const nextUrls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
      const nextThumbs = Array.isArray(photoThumbUrls)
        ? photoThumbUrls.filter(Boolean)
        : [];
      if (nextUrls.length === 0 && nextThumbs.length === 0) return this.get(itemId);

      const ref = firestore().collection(collections.portfolioItems).doc(itemId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;

      const currentUrls = snapshot.data()?.photoUrls;
      const currentThumbs = snapshot.data()?.photoThumbUrls;

      const mergedUrls = Array.from(
        new Set([...(Array.isArray(currentUrls) ? currentUrls : []), ...nextUrls])
      );
      const mergedThumbs = Array.from(
        new Set([
          ...(Array.isArray(currentThumbs) ? currentThumbs : []),
          ...nextThumbs,
        ])
      );

      await ref.update(
        clean(
          withTimestamps(
            { photoUrls: mergedUrls, photoThumbUrls: mergedThumbs },
            { isNew: false }
          )
        )
      );
      const updated = await ref.get();
      return toRecord(updated);
    },
    async removePhotos(itemId, { photoUrls = [], photoThumbUrls = [] } = {}) {
      if (!itemId) return null;
      const removeUrls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
      const removeThumbs = Array.isArray(photoThumbUrls)
        ? photoThumbUrls.filter(Boolean)
        : [];
      if (removeUrls.length === 0 && removeThumbs.length === 0) return this.get(itemId);

      const ref = firestore().collection(collections.portfolioItems).doc(itemId);
      const snapshot = await ref.get();
      if (!snapshot.exists) return null;

      const currentUrls = snapshot.data()?.photoUrls;
      const currentThumbs = snapshot.data()?.photoThumbUrls;

      const nextUrls = Array.isArray(currentUrls)
        ? currentUrls.filter((u) => !removeUrls.includes(u))
        : [];
      const nextThumbs = Array.isArray(currentThumbs)
        ? currentThumbs.filter((u) => !removeThumbs.includes(u))
        : [];

      await ref.update(
        clean(
          withTimestamps(
            { photoUrls: nextUrls, photoThumbUrls: nextThumbs },
            { isNew: false }
          )
        )
      );
      const updated = await ref.get();
      return toRecord(updated);
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
};
