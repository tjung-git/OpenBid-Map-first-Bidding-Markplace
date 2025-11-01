import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { setSession, setUser } from "../services/session";

export default function LoginFinish() {
  const [search] = useSearchParams();
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const handledRef = useRef(false);

  useEffect(() => {
    const code = search.get("code");
    if (!code) {
      setErr("Missing authorization code.");
      return;
    }

    // Guard: only handle this code once
    if (handledRef.current) return;
    handledRef.current = true;
    if (sessionStorage.getItem(`duo_handled_${code}`)) return;
    sessionStorage.setItem(`duo_handled_${code}`, "1");

    (async () => {
      try {
        const data = await api.duoFinalize(code);
        setSession(data);
        const selectedRole = "bidder";
        const currentRole = (data.user?.userType || "").toLowerCase();
        if (currentRole !== selectedRole) {
          try {
            const roleResp = await api.updateRole(selectedRole);
            setUser(
              roleResp.user,
              roleResp.requirements ?? data.requirements
            );
          } catch {
            setErr("Unable to apply selected role. Please try again.");
            return;
          }
        } else {
          setUser(data.user, data.requirements);
        }
        if (!data.requirements?.emailVerified) {
          setErr("Please verify your email address before logging in.");
          return;
        }
        nav("/jobs", { replace: true });
      } catch {
        setErr("Multi-factor sign-in failed. Please try again.");
      }
    })();
  }, [search, nav]);

  return <div style={{ padding: 24 }}>{err ? err : "Finalizing sign-in…"}</div>;
}
