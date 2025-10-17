import { getAuthClient } from "../lib/firebase.js";
import { signInWithEmailPassword } from "../lib/firebaseIdentity.js";

export const auth = {
  async signIn(email, password) {
    const credentials = await signInWithEmailPassword(email, password);
    return {
      token: credentials.idToken,
      idToken: credentials.idToken,
      refreshToken: credentials.refreshToken,
      expiresIn: credentials.expiresIn,
    };
  },
  async verify(req) {
    const header = req.header("Authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1].trim();
    if (!token) return null;
    try {
      const decoded = await getAuthClient().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
      };
    } catch (error) {
      console.error("[auth.real] verify failed", error.message);
      return null;
    }
  },
};
