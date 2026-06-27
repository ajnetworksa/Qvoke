import { useCallback } from 'react';

/**
 * Lightweight localStorage-backed draft persistence for document editors.
 *
 * Purpose: keep an in-progress document alive across navigation (e.g. jumping
 * to Products to add an item, then returning) and across accidental reloads —
 * BEFORE anything is committed to the server. This is independent of, and
 * complementary to, server autosave: localStorage covers the window where the
 * document isn't yet server-ready (no customer selected, etc.).
 *
 * Lifecycle:
 *  - `save(data)`  — called on every edit while the form is dirty.
 *  - `load()`      — called on mount; returns the last unsaved snapshot or null.
 *  - `clear()`     — called once changes are committed to the server (not dirty).
 *
 * Drafts older than `maxAgeMs` (default 7 days) are treated as expired so stale
 * snapshots never resurrect.
 */
const PREFIX = 'qvoke:draft:';

interface Stored<T> {
  data: T;
  savedAt: number;
}

export function useDraft<T>(docType: string, id: string, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const key = `${PREFIX}${docType}:${id}`;

  const save = useCallback((data: T) => {
    try {
      const payload: Stored<T> = { data, savedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [key]);

  const load = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Stored<T>;
      if (!parsed || typeof parsed.savedAt !== 'number') return null;
      if (Date.now() - parsed.savedAt > maxAgeMs) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }, [key, maxAgeMs]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* non-fatal */ }
  }, [key]);

  return { save, load, clear };
}
