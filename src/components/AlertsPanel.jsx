import { useState, useEffect, useRef } from "react";
import { useScrollLock } from "../hooks/useScrollLock.js";

export default function AlertsPanel({
  alerts = [],
  alertCount = 0,
  onToggle,
  onRemove,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useScrollLock(open);

  const active = alerts.filter((a) => a.active);
  const triggered = alerts.filter((a) => !a.active);

  return (
    <div className="alerts-panel-wrapper" ref={ref}>
      <button
        className="alerts-bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Price alerts"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 1.5C5.5 1.5 4 3.5 4 5.5c0 3-1.5 4.5-2 5h12c-.5-.5-2-2-2-5 0-2-1.5-4-4-4z" />
          <path d="M6.5 12.5a1.5 1.5 0 003 0" />
        </svg>
        {alertCount > 0 && (
          <span className="alerts-bell-count">{alertCount}</span>
        )}
      </button>
      {open && (
        <div className="alerts-panel-dropdown">
          <div className="alerts-panel-header">
            <span className="alerts-panel-title">Price Alerts</span>
            <button
              className="alerts-panel-close"
              onClick={() => setOpen(false)}
            >
              &times;
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="alerts-panel-empty">
              No alerts set. Open a chart and tap the bell to add one.
            </div>
          ) : (
            <div className="alerts-panel-list">
              {active.length > 0 && (
                <>
                  <div className="alerts-panel-section-label">
                    Active ({active.length})
                  </div>
                  {active.map((a) => (
                    <div key={a.id} className="alerts-panel-item">
                      <span className="alerts-panel-symbol">{a.symbol}</span>
                      <span className={`alerts-panel-direction ${a.direction}`}>
                        {a.direction === "above" ? "\u2191" : "\u2193"}
                      </span>
                      <span className="alerts-panel-price">
                        ${a.targetPrice.toFixed(2)}
                      </span>
                      <div className="alerts-panel-actions">
                        <button
                          className="alerts-panel-toggle"
                          onClick={() => onToggle(a.id)}
                          title="Pause alert"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="currentColor"
                          >
                            <rect x="2" y="1" width="3" height="10" rx="0.5" />
                            <rect x="7" y="1" width="3" height="10" rx="0.5" />
                          </svg>
                        </button>
                        <button
                          className="alerts-panel-remove"
                          onClick={() => onRemove(a.id)}
                          title="Delete alert"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {triggered.length > 0 && (
                <>
                  <div className="alerts-panel-section-label">
                    Triggered ({triggered.length})
                  </div>
                  {triggered.map((a) => (
                    <div
                      key={a.id}
                      className="alerts-panel-item alerts-panel-item--triggered"
                    >
                      <span className="alerts-panel-symbol">{a.symbol}</span>
                      <span className={`alerts-panel-direction ${a.direction}`}>
                        {a.direction === "above" ? "\u2191" : "\u2193"}
                      </span>
                      <span className="alerts-panel-price">
                        ${a.targetPrice.toFixed(2)}
                      </span>
                      <div className="alerts-panel-actions">
                        <button
                          className="alerts-panel-toggle"
                          onClick={() => onToggle(a.id)}
                          title="Re-enable alert"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="currentColor"
                          >
                            <polygon points="2,1 10,6 2,11" />
                          </svg>
                        </button>
                        <button
                          className="alerts-panel-remove"
                          onClick={() => onRemove(a.id)}
                          title="Delete alert"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
