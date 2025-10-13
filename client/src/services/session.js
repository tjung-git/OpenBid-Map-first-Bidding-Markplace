let _session = null;

export function setSession(session) {
  _session = session;
  if (session?.prototype && session?.user?.uid) {
    localStorage.setItem("mockUid", session.user.uid);
  } else {
    localStorage.removeItem("mockUid");
  }
}

export function getSession() {
  return _session;
}

export function setUser(user, requirements) {
  if (!_session) _session = {};
  _session.user = user;
  _session.requirements = requirements;
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

export function logout() {
  localStorage.removeItem("mockUid");
  _session = null;
}
