import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function UserMenu() {
  const { user, profile, isPremium, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
  };

  const initial = user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div className="user-menu-wrapper" ref={ref}>
      <button
        className="user-avatar-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="User menu"
      >
        {initial}
      </button>
      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-email">{user?.email}</div>
          <div className="user-menu-tier">
            <span
              className={`tier-badge ${isPremium ? "tier-premium" : "tier-free"}`}
            >
              {isPremium ? "Premium" : "Free"}
            </span>
          </div>
          {!isPremium && (
            <button
              className="user-menu-upgrade"
              onClick={() => setOpen(false)}
            >
              Upgrade to Premium
            </button>
          )}
          <div className="user-menu-divider" />
          <button className="user-menu-signout" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
