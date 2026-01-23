import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { config } from "../config.js";

let appInstance;
let firestore;
let authInstance;
let bucketInstance;

function ensureApp() {
  if (appInstance) return appInstance;

  const { projectId, clientEmail, privateKey, storageBucket } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY"
    );
  }

  const storageBucketName = storageBucket || `${projectId}.appspot.com`;

  appInstance =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          storageBucket: storageBucketName,
        });

  return appInstance;
}

export function getDb() {
  if (!firestore) {
    firestore = getFirestore(ensureApp());
  }
  return firestore;
}

export function getAuthClient() {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
  }
  return authInstance;
}

export function getStorageBucket() {
  if (!bucketInstance) {
    bucketInstance = getStorage(ensureApp()).bucket();
  }
  return bucketInstance;
}

export const timestamps = {
  now() {
    return FieldValue.serverTimestamp();
  },
};
