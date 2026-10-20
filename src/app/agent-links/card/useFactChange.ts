import { useEffect, useRef, useState } from 'react';

/** A short static emphasis for changed values. Read times and connection churn are not changes. */
export function useFactChange(signature: string | null): boolean {
  const previous = useRef(signature);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (signature === null) { previous.current = null; setChanged(false); return; }
    const before = previous.current;
    previous.current = signature;
    if (before === null || before === signature) return;
    setChanged(true);
    const timer = window.setTimeout(() => setChanged(false), 2000);
    return () => window.clearTimeout(timer);
  }, [signature]);
  return changed;
}
