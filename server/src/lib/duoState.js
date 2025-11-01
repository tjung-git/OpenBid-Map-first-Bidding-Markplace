export const pendingLogins = new Map();

export function putWithTTL(key, data, ms) {
  const expiresAt = Date.now() + ms;
  pendingLogins.set(key, { ...data, expiresAt });
  return { key, expiresAt };
}

export function getValid(key) {
  const v = pendingLogins.get(key);
  if (!v) return null;
  if (v.expiresAt < Date.now()) {
    pendingLogins.delete(key);
    return null;
  }
  return v;
}

export function remove(key) {
  pendingLogins.delete(key);
}
