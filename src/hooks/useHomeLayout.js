import { useState, useCallback } from "react";

const STORAGE_KEY = "tickrview-home-layout";
const DEFAULT_ORDER = [
  "pulse",
  "runners",
  "news",
  "breadth",
  "heatmap",
  "feargreed",
  "losers",
  "movers",
  "trending",
  "futures",
  "crypto",
  "earnings",
  "economy",
  "favorites",
];
const DEFAULT_LAYOUT = { order: DEFAULT_ORDER, hidden: [] };

function loadLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.order)) {
      // Migrate 'watchlist' → 'favorites' for existing users
      const order = saved.order.map((k) =>
        k === "watchlist" ? "favorites" : k,
      );
      const hidden = (Array.isArray(saved.hidden) ? saved.hidden : []).map(
        (k) => (k === "watchlist" ? "favorites" : k),
      );
      const known = new Set(order);
      const missing = DEFAULT_ORDER.filter((k) => !known.has(k));
      return {
        order: [...order, ...missing],
        hidden,
      };
    }
  } catch {}
  return DEFAULT_LAYOUT;
}

export function useHomeLayout() {
  const [layout, setLayout] = useState(loadLayout);

  const persist = (next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  };

  const moveUp = useCallback(
    (key) => {
      setLayout((prev) => {
        const order = [...prev.order];
        const idx = order.indexOf(key);
        if (idx <= 0) return prev;
        [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
        return persist({ ...prev, order });
      });
    },
    [],
  );

  const moveDown = useCallback(
    (key) => {
      setLayout((prev) => {
        const order = [...prev.order];
        const idx = order.indexOf(key);
        if (idx < 0 || idx >= order.length - 1) return prev;
        [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
        return persist({ ...prev, order });
      });
    },
    [],
  );

  const toggleVisibility = useCallback(
    (key) => {
      setLayout((prev) => {
        const hidden = prev.hidden.includes(key)
          ? prev.hidden.filter((k) => k !== key)
          : [...prev.hidden, key];
        return persist({ ...prev, hidden });
      });
    },
    [],
  );

  const reorder = useCallback(
    (fromKey, toKey) => {
      setLayout((prev) => {
        const order = [...prev.order];
        const fromIdx = order.indexOf(fromKey);
        const toIdx = order.indexOf(toKey);
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
        [order[fromIdx], order[toIdx]] = [order[toIdx], order[fromIdx]];
        return persist({ ...prev, order });
      });
    },
    [],
  );

  const resetLayout = useCallback(() => {
    setLayout(persist(DEFAULT_LAYOUT));
  }, []);

  return {
    order: layout.order,
    hidden: layout.hidden,
    moveUp,
    moveDown,
    reorder,
    toggleVisibility,
    resetLayout,
  };
}
