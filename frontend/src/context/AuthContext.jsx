import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, resetCsrf } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, mode: "login", message: "" });

  useEffect(() => {
    let alive = true;
    api("/api/auth/me")
      .then((data) => alive && setUser(data.user))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const openAuth = useCallback((mode = "login", message = "") => {
    setDialog({ open: true, mode, message });
  }, []);

  const closeAuth = useCallback(() => setDialog((d) => ({ ...d, open: false })), []);
  const setAuthMode = useCallback((mode) => setDialog((d) => ({ ...d, mode, message: "" })), []);

  const authenticate = useCallback(async (mode, payload) => {
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const data = await api(endpoint, { method: "POST", body: JSON.stringify(payload) });
    resetCsrf(); // sign-in regenerates the server session and its CSRF token
    setUser(data.user);
    setDialog((d) => ({ ...d, open: false }));
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    resetCsrf();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, dialog, openAuth, closeAuth, setAuthMode, authenticate, logout }),
    [user, loading, dialog, openAuth, closeAuth, setAuthMode, authenticate, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
