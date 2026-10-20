import { useCallback, useEffect, useRef } from 'react';

/**
 * One in-flight native action per card section. Starting another aborts the previous one,
 * and unmounting (close, selection change, another subject, player view) aborts whatever is
 * pending: work not yet sent never starts and a late result is discarded. The guarantee ends
 * at dispatch: a request already sent (a focus, an opener) cannot be recalled, and its effect
 * is neither retried nor reversed here.
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
