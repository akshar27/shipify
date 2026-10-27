import { useEffect, useState } from "react";
import API from "./api";
import { getUser } from "./session";

// The stored user can be stale (an admin may have approved their ID since they logged in), so pages that depend on it ask the
// server and refresh the stored copy. `user` is the stored one until the answer arrives; `loading` is true until then.
export default function useCurrentUser() {
  const [state, setState] = useState({ user: getUser(), loading: true });

  useEffect(() => {
    let cancelled = false;
    API.get("/auth/me")
      .then((res) => {
        localStorage.setItem("user", JSON.stringify(res.data));
        if (!cancelled) setState({ user: res.data, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
