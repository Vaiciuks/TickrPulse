import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useScrollLock } from "../hooks/useScrollLock.js";

export default function AuthModal({ onClose }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const modalRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handle = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handle = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  useScrollLock(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "signin") {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err.message);
        } else {
          onClose();
        }
      } else {
        const { error: err } = await signUp(email, password);
        if (err) {
          setError(err.message);
        } else {
          setSignupSuccess(true);
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError("");
    setSignupSuccess(false);
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal" ref={modalRef}>
        <button className="auth-modal-close" onClick={onClose}>
          &times;
        </button>

        {signupSuccess ? (
          <div className="auth-success">
            <div className="auth-success-icon">&#10003;</div>
            <h2>Check your email</h2>
            <p>
              We sent a confirmation link to <strong>{email}</strong>. Click it
              to activate your account.
            </p>
            <button className="auth-btn" onClick={onClose}>
              Got it
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                className={`auth-tab${mode === "signin" ? " auth-tab-active" : ""}`}
                onClick={() => {
                  setMode("signin");
                  setError("");
                }}
              >
                Sign In
              </button>
              <button
                className={`auth-tab${mode === "signup" ? " auth-tab-active" : ""}`}
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
              >
                Create Account
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-label">
                Email
                <input
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </label>
              <label className="auth-label">
                Password
                <input
                  className="auth-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                />
              </label>

              {error && <div className="auth-error">{error}</div>}

              <button className="auth-btn" type="submit" disabled={submitting}>
                {submitting
                  ? "Please wait..."
                  : mode === "signin"
                    ? "Sign In"
                    : "Create Account"}
              </button>
            </form>

            <p className="auth-switch">
              {mode === "signin"
                ? "Don't have an account? "
                : "Already have an account? "}
              <button className="auth-switch-btn" onClick={switchMode}>
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
