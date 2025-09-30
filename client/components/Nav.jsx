import { Link } from "react-router-dom";
import { auth, signInWithGoogle, signOutNow } from "../firebase";
import { useEffect, useState } from "react";

export default function Nav() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setUser);
    return () => unsub();
  }, []);
  return (
    <nav>
      <div className="inner container">
        <div className="brand">
          <Link to="/">OpenBid</Link>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Link to="/new" className="button">
            + New Job
          </Link>
          {user ? (
            <>
              <span className="badge">
                {user.displayName || user.email || "Signed in"}
              </span>
              <button className="button" onClick={signOutNow}>
                Sign out
              </button>
            </>
          ) : (
            <button className="button" onClick={signInWithGoogle}>
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
