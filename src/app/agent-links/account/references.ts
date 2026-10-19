import { isRecord } from '../../services/assetMetadataGuards';

/** Account files are visible, canonical vault-relative JSON files, never native filesystem locators. */
export function isAccountPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1024 || !value.toLowerCase().endsWith('.json')) return false;
  if (/[\\:#?]/.test(value) || [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return false;
  return value.split('/').every((segment) => segment !== '' && !segment.startsWith('.'));
}

/** Reads an appearance's structural reference without assuming unchecked scene data has the current type. */
export function accountPathOf(appearance: unknown): string | null {
  if (!isRecord(appearance) || !isRecord(appearance.sourceReference)) return null;
  const { accountPath, subjectId } = appearance.sourceReference;
  return isAccountPath(accountPath) && typeof subjectId === 'string' && subjectId.trim() !== '' ? accountPath : null;
}

/** Only the account location is a vault path; subject IDs and unknown native metadata remain opaque. */
export function remapSourceReference(reference: unknown, moved: (path: string) => string | null): unknown {
  if (!isRecord(reference) || typeof reference.accountPath !== 'string') return reference;
  const target = moved(reference.accountPath);
  return target === null || target === reference.accountPath ? reference : { ...reference, accountPath: target };
}

/** Follows a vault rename in place without interpreting any other reference field. */
export function followSourceAccount(appearance: unknown, moved: (path: string) => string | null): boolean {
  if (!isRecord(appearance)) return false;
  const reference = remapSourceReference(appearance.sourceReference, moved);
  if (reference === appearance.sourceReference) return false;
  appearance.sourceReference = reference;
  return true;
}
