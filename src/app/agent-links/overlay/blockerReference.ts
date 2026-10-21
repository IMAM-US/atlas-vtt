export type BlockerReference = { kind: 'human' | 'gate' | 'qitem' | 'seat' | 'unresolved'; ref: string };

export function nativeReference(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && ![...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ? value : null;
}

/** Parity with native human-first admission, typed gates and first-@ session locators. */
export function blockerReference(value: unknown): BlockerReference {
  const ref = nativeReference(value);
  if (!ref) return { kind: 'unresolved', ref: '' };
  if (/^human(?:-[A-Za-z0-9._-]+)?@(kernel|host)$/.test(ref) || /^[A-Za-z0-9._:-]+@external$/.test(ref)) return { kind: 'human', ref };
  if (['fold:', 'auth:', 'external:'].some((prefix) => ref.startsWith(prefix))) {
    return { kind: ref.slice(ref.indexOf(':') + 1).trim() ? 'gate' : 'unresolved', ref };
  }
  if (ref.startsWith('qitem-') && ref.length > 6) return { kind: 'qitem', ref };
  if (/\s/.test(ref)) return { kind: 'unresolved', ref };
  const at = ref.indexOf('@');
  return { kind: at > 0 && at < ref.length - 1 ? 'seat' : 'unresolved', ref };
}
