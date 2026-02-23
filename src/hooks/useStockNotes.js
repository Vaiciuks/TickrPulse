import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

const STORAGE_KEY = "tickrpulse-stock-notes";

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function useStockNotes() {
  const { session } = useAuth();
  const [notes, setNotes] = useState(() => (session ? loadNotes() : {}));

  useEffect(() => {
    if (session) {
      setNotes(loadNotes());
    } else {
      setNotes({});
    }
  }, [!!session]);

  const setNote = useCallback(
    (symbol, text) => {
      setNotes((prev) => {
        const next = { ...prev };
        const trimmed = text.trim();
        if (trimmed) {
          next[symbol] = { text: trimmed, updatedAt: Date.now() };
        } else {
          delete next[symbol];
        }
        if (session) saveNotes(next);
        return next;
      });
    },
    [session],
  );

  const getNote = useCallback(
    (symbol) => {
      return notes[symbol] || null;
    },
    [notes],
  );

  const hasNote = useCallback(
    (symbol) => {
      return !!notes[symbol];
    },
    [notes],
  );

  return { notes, setNote, getNote, hasNote };
}
