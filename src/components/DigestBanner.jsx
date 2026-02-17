import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { authFetch } from '../lib/authFetch.js';
import { useScrollLock } from '../hooks/useScrollLock.js';

function timeAgo(unix) {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DigestBanner() {
  const { isPremium, session } = useAuth();
  const [digest, setDigest] = useState(null);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const modalRef = useRef(null);

  // Re-render every 30s so the "time ago" label stays current
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchDigest = async () => {
      try {
        // Use authFetch so server can identify premium users
        const res = await authFetch('/api/digest');
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && data.digest) setDigest(data.digest);
      } catch {
        // silent
      }
    };
    fetchDigest();
    const id = setInterval(fetchDigest, 10 * 60 * 1000); // refresh every 10 min
    return () => { mounted = false; clearInterval(id); };
  }, [session?.access_token]);

  // Close modal on click outside
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open]);

  useScrollLock(open);

  if (!digest) return <div className="digest-banner-spacer" />;

  return (
    <>
      <button className="digest-banner" onClick={() => setOpen(true)}>
        <span className="digest-banner-icon">{'\u2728'}</span>
        <span className="digest-banner-slide">
          <span className="digest-banner-text">{digest.headline}</span>
        </span>
        <span className="digest-banner-time">{timeAgo(digest.timestamp)}</span>
      </button>

      {open && (
        <div className="digest-overlay">
          <div className="digest-modal" ref={modalRef}>
            <div className="digest-modal-header">
              <span className="digest-modal-label">{'\u2728'} Daily Digest</span>
              <button className="digest-modal-close" onClick={() => setOpen(false)}>&times;</button>
            </div>
            <h2 className="digest-modal-headline">{digest.headline}</h2>
            <ul className="digest-modal-bullets">
              {digest.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
            {!isPremium && (
              <p className="digest-upgrade-hint">
                Upgrade to Premium for AI-powered digest summaries.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
