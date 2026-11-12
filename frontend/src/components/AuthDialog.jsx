import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthDialog() {
  const { dialog, closeAuth, setAuthMode, authenticate } = useAuth();
  const ref = useRef(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = dialog.mode === "register";

  // Open / close the native <dialog> to match the shared state.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (dialog.open && !node.open) node.showModal();
    if (!dialog.open && node.open) node.close();
  }, [dialog.open]);

  // Show any message the opener passed in (e.g. "Sign in to continue to checkout").
  useEffect(() => {
    if (dialog.open) setError(dialog.message || "");
  }, [dialog.open, dialog.message]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    const payload = { email: email.trim(), password };
    if (isRegister) payload.fullName = fullName.trim();

    try {
      await authenticate(dialog.mode, payload);
      setFullName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(
        isRegister && /check the submitted/i.test(err.message)
          ? "Please enter your full name, a valid email and a password of at least 10 characters."
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="auth-dialog" onClose={closeAuth}>
      <button className="dialog-close" aria-label="Close" onClick={closeAuth}>×</button>
      <p className="eyebrow">WELCOME TO FILMORA</p>
      <h2>{isRegister ? "Create your account" : "Sign in"}</h2>
      <p className="form-message" aria-live="polite">{error}</p>
      <form onSubmit={handleSubmit}>
        {isRegister && (
          <label>
            Full name
            <input
              name="fullName"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
        )}
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={10}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="button button-primary button-full" type="submit" disabled={busy}>
          {isRegister ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="switch-auth">
        <span>{isRegister ? "Already a member?" : "New to FILMORA?"}</span>{" "}
        <button
          className="text-button"
          type="button"
          onClick={() => { setError(""); setAuthMode(isRegister ? "login" : "register"); }}
        >
          {isRegister ? "Sign in" : "Create an account"}
        </button>
      </p>
    </dialog>
  );
}
