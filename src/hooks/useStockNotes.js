import { useState, useCallback } from "react";

const STORAGE_KEY = "tickrview-stock-notes";

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
  const [notes, setNotes] = useState(loadNotes);

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
        saveNotes(next);
        return next;
      });
    },
    [],
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
