import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  serverTimestamp,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const ts = serverTimestamp;

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}
export async function signOutNow() {
  await signOut(auth);
}
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function createJob({
  title,
  description,
  budgetType,
  budgetAmount,
  location,
}) {
  const uid = auth.currentUser?.uid || "anon";
  return addDoc(collection(db, "jobs"), {
    title,
    description,
    budgetType,
    budgetAmount: budgetAmount ?? null,
    location: location ?? null,
    status: "open",
    createdBy: uid,
    createdAt: ts(),
  });
}
export async function listJobs() {
  const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function getJob(id) {
  const snap = await getDoc(doc(db, "jobs", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Bids
export async function createBid(jobId, { amount, note, etaHours }) {
  const uid = auth.currentUser?.uid || "anon";
  return addDoc(collection(db, "jobs", jobId, "bids"), {
    providerId: uid,
    amount: Number(amount),
    note: note || "",
    etaHours: Number(etaHours) || null,
    status: "active",
    createdAt: ts(),
  });
}
export async function listBids(jobId) {
  const q = query(
    collection(db, "jobs", jobId, "bids"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
