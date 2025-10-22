import { useSyncExternalStore } from "react";
import {
  getSession,
  subscribeSession,
} from "../services/session";

const getSnapshot = () => getSession() || null;

export function useSession() {
  return useSyncExternalStore(subscribeSession, getSnapshot, getSnapshot);
}

export function useSessionUser() {
  const session = useSession();
  return session?.user || null;
}

export function useSessionRequirements() {
  const session = useSession();
  if (session?.requirements) {
    return session.requirements;
  }
  return {
    emailVerified: false,
    kycVerified: false,
  };
}
