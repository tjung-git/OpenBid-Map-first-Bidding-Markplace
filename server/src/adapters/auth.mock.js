export const auth = {
  async signIn(email) {
    const uid = `u_${email.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
    return { uid, email, name: email.split("@")[0] };
  },
  async verify(req) {
    const uid =
      req.header("x-mock-uid") ||
      req.header("x-user-id") ||
      (() => {
        const authHeader = req.header("Authorization") || "";
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        return match && match[1] ? match[1] : null;
      })();
    if (!uid) return null;
    return { uid, email: `${uid}@mock.local`, name: uid };
  },
};
