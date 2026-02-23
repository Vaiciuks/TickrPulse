import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "../lib/authFetch.js";

const STORAGE_KEY = "stock-scanner-alerts";

function loadAlerts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveAlerts(alerts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function useAlerts(session = null) {
  const [alerts, setAlerts] = useState(loadAlerts);
  const notifiedRef = useRef(new Set());
  const syncTimeoutRef = useRef(null);
  const initialSyncDone = useRef(false);

  // Always persist to localStorage
  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  // Merge cloud alerts on login
  useEffect(() => {
    if (!session) return;
    if (initialSyncDone.current) return;
    initialSyncDone.current = true;

    authFetch("/api/user/alerts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setAlerts((prev) => {
          const existing = new Set(
            prev.map((a) => `${a.symbol}-${a.direction}-${a.targetPrice}`),
          );
          const cloudAlerts = data.alerts
            .filter(
              (a) =>
                !existing.has(`${a.symbol}-${a.direction}-${a.target_price}`),
            )
            .map((a) => ({
              id: `${a.symbol}-${a.direction}-${a.target_price}-${Date.now()}`,
              symbol: a.symbol,
              targetPrice: a.target_price,
              direction: a.direction,
              active: a.active,
              createdAt: new Date(a.created_at).getTime(),
            }));
          if (cloudAlerts.length === 0) return prev;
          return [...prev, ...cloudAlerts];
        });
      })
      .catch(() => {});
  }, [session?.access_token]);

  // Debounced sync to cloud on changes
  useEffect(() => {
    if (!session) return;
    if (!initialSyncDone.current) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      authFetch("/api/user/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alerts }),
      }).catch(() => {});
    }, 2000);

    return () => clearTimeout(syncTimeoutRef.current);
  }, [alerts, session?.access_token]);

  const addAlert = useCallback(
    (symbol, targetPrice, direction) => {
      const id = `${symbol}-${direction}-${targetPrice}-${Date.now()}`;
      setAlerts((prev) => [
        ...prev,
        {
          id,
          symbol,
          targetPrice,
          direction,
          active: true,
          createdAt: Date.now(),
        },
      ]);
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
      )
        Notification.requestPermission();
      return { id };
    },
    [alerts],
  );

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    notifiedRef.current.delete(id);
  }, []);

  const toggleAlert = useCallback((id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
    );
  }, []);

  const getAlerts = useCallback(
    (symbol) => {
      return alerts.filter((a) => a.symbol === symbol && a.active);
    },
    [alerts],
  );

  const checkAlerts = useCallback((symbol, price) => {
    if (
      !price ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;

    setAlerts((prev) => {
      let changed = false;
      const next = prev.map((a) => {
        if (!a.active || a.symbol !== symbol || notifiedRef.current.has(a.id))
          return a;

        const triggered =
          (a.direction === "above" && price >= a.targetPrice) ||
          (a.direction === "below" && price <= a.targetPrice);

        if (triggered) {
          notifiedRef.current.add(a.id);
          changed = true;
          new Notification(`${symbol} Price Alert`, {
            body: `${symbol} is now $${price.toFixed(2)} (${a.direction} $${a.targetPrice.toFixed(2)})`,
            icon: "/favicon.ico",
          });
          return { ...a, active: false };
        }
        return a;
      });
      return changed ? next : prev;
    });
  }, []);

  const alertCount = alerts.filter((a) => a.active).length;

  return {
    alerts,
    addAlert,
    removeAlert,
    toggleAlert,
    getAlerts,
    checkAlerts,
    alertCount,
  };
}
