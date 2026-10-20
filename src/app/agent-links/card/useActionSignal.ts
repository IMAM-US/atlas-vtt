import { useCallback, useEffect, useRef } from 'react';

/**
 * One in-flight native action per card section. Starting another aborts the previous one,
 * and unmounting (close, selection change, another subject) aborts whatever is pending, so
 * nothing resolves or focuses after the person can no longer see the action.
 */
export function useActionSignal(): () => AbortSignal {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  return useCallback((): AbortSignal => {
    controller.current?.abort();
    controller.current = new AbortController();
    return controller.current.signal;
  }, []);
}
