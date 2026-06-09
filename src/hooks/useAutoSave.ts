import { useState, useEffect, useRef } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'unsaved';

interface UseAutoSaveProps<T> {
  isDirty: boolean;
  getPayload: () => T;
  saveFn: (payload: T) => Promise<boolean>;
  onSaveSuccess?: (payload: T) => void;
  isReady: boolean;
  debounceDelay?: number;
}

export function useAutoSave<T>({
  isDirty,
  getPayload,
  saveFn,
  onSaveSuccess,
  isReady,
  debounceDelay = 2000
}: UseAutoSaveProps<T>) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const getPayloadRef = useRef(getPayload);
  const saveFnRef = useRef(saveFn);
  const onSaveSuccessRef = useRef(onSaveSuccess);

  // Sync refs to avoid re-triggering effects when functions change
  useEffect(() => {
    getPayloadRef.current = getPayload;
    saveFnRef.current = saveFn;
    onSaveSuccessRef.current = onSaveSuccess;
  });

  // Whenever isDirty or isReady changes, trigger debounce save
  useEffect(() => {
    if (!isReady || !isDirty) {
      if (!isDirty && status === 'unsaved') {
        setStatus('idle');
      }
      return;
    }

    setStatus('unsaved');

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      await performSave();
    }, debounceDelay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isDirty, isReady, debounceDelay]);

  const performSave = async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setStatus('saving');
    try {
      const payload = getPayloadRef.current();
      const success = await saveFnRef.current(payload);
      if (success) {
        setStatus('saved');
        if (onSaveSuccessRef.current) {
          onSaveSuccessRef.current(payload);
        }
        // Transition back to idle after a short delay
        setTimeout(() => {
          setStatus((current) => (current === 'saved' ? 'idle' : current));
        }, 3000);
        return true;
      } else {
        setStatus('failed');
        return false;
      }
    } catch (error) {
      console.error('AutoSave failed:', error);
      setStatus('failed');
      return false;
    }
  };

  return {
    status,
    performSave,
    setStatus
  };
}
