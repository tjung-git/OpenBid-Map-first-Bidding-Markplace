const STORAGE_KEY = "openbid_session";
const INACTIVITY_LIMIT_MS = 2 * 60 * 1000; // 2 minutes

let _session = null;
let inactivityTimer = null;
let removeInactivityListeners = null;
const subscribers = new Set();

const isBrowser = typeof window !== "undefined";

function notifySubscribers() {
  subscribers.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn("[session] subscriber error", error);
    }
  });
}

export function subscribeSession(listener) {
  if (typeof listener !== "function") return () => {};
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

function persistSession() {
  if (!isBrowser) return;
  if (_session) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(_session));
    } catch (error) {
      console.warn("[session] Failed to persist session", error);
    }
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function clearInactivityMonitor() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  if (removeInactivityListeners) {
    removeInactivityListeners();
    removeInactivityListeners = null;
  }
}

function markActive() {
  if (!_session) return;
  _session.lastActive = Date.now();
  persistSession();
}

function hydrateSession() {
  if (!isBrowser) return;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const data = JSON.parse(stored);
    if (
      data?.lastActive &&
      Date.now() - data.lastActive > INACTIVITY_LIMIT_MS
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem("mockUid");
      return;
    }
    _session = data;
    if (_session?.prototype && _session?.user?.uid) {
      window.localStorage.setItem("mockUid", _session.user.uid);
    }
  } catch (error) {
    console.warn("[session] Failed to hydrate session", error);
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function scheduleTimeout(onTimeout) {
  if (!isBrowser) return;
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = window.setTimeout(() => {
    clearInactivityMonitor();
    onTimeout?.();
  }, INACTIVITY_LIMIT_MS);
}

hydrateSession();

export function setSession(session) {
  _session = { ...session, lastActive: Date.now() };
  if (isBrowser) {
    if (session?.prototype && session?.user?.uid) {
      window.localStorage.setItem("mockUid", session.user.uid);
    } else {
      window.localStorage.removeItem("mockUid");
    }
  }
  persistSession();
  notifySubscribers();
}

export function getSession() {
  return _session;
}

export function setUser(user, requirements) {
  const base = _session || { lastActive: Date.now() };
  const nextSession = {
    ...base,
    user,
  };
  if (requirements !== undefined) {
    nextSession.requirements = requirements;
  } else if (base.requirements !== undefined) {
    nextSession.requirements = base.requirements;
  }
  _session = nextSession;
  persistSession();
  notifySubscribers();
}

export function getUser() {
  return _session?.user || null;
}

export function getRequirements() {
  return _session?.requirements || {
    emailVerified: false,
    kycVerified: false,
  };
}

export function getPrototypeMode() {
  return Boolean(_session?.prototype);
}

export function startInactivityMonitor(onTimeout) {
  if (!isBrowser || !_session?.user) return () => {};
  clearInactivityMonitor();
  const events = [
    "mousemove",
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
    "focus",
    "click",
  ];
  const handleActivity = () => {
    markActive();
    scheduleTimeout(onTimeout);
  };
  events.forEach((event) =>
    window.addEventListener(event, handleActivity, { passive: true })
  );
  removeInactivityListeners = () => {
    events.forEach((event) =>
      window.removeEventListener(event, handleActivity)
    );
  };
  handleActivity();
  return () => {
    clearInactivityMonitor();
  };
}

export function logout() {
  clearInactivityMonitor();
  if (isBrowser) {
    window.localStorage.removeItem("mockUid");
  }
  _session = null;
  persistSession();
  notifySubscribers();
}
