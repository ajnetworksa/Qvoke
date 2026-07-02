import { useEffect, useRef, useState } from 'react';

export type AutosaveState = 'idle' | 'saving' | 'saved';

/**
 * Debounced autosave for edit forms. Fires `save()` when `active` is true and
 * `deps` change, skipping the first change right after `key` changes (the initial
 * populate when a record is opened for editing). Creating a record should keep
 * `active` false so only edits autosave.
 */
export function useDebouncedAutosave(
  active: boolean,
  key: string | null,
  deps: any[],
  save: () => void | Promise<void>,
  delay = 800
): AutosaveState {
  const [state, setState] = useState<AutosaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipKey = useRef<string | null>(null);
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });

  // When the edited record changes, arm the skip so the initial populate
  // doesn't trigger a redundant save.
  useEffect(() => {
    skipKey.current = key;
    setState('idle');
  }, [key]);

  useEffect(() => {
    if (!active || !key) return;
    if (skipKey.current === key) { skipKey.current = null; return; }
    if (timer.current) clearTimeout(timer.current);
    setState('saving');
    timer.current = setTimeout(async () => {
      await saveRef.current();
      setState('saved');
      setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 2000);
    }, delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
