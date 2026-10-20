import { isRecord } from '../../services/assetMetadataGuards';
import { ACCOUNT_FORMAT } from './accountSchema';

/**
 * The vault files an account document names, read structurally without trusting the rest
 * of the document: today only `subjects[].notePath`. Native ids, locators, hashes and
 * unknown fields are never touched by rename or bundle machinery.
 */
function isAccountShape(value: unknown): value is { subjects: unknown[] } & Record<string, unknown> {
  return isRecord(value) && value.format === ACCOUNT_FORMAT && Array.isArray(value.subjects);
}

export function accountNotePaths(value: unknown): string[] {
  if (!isAccountShape(value)) return [];
  return value.subjects.flatMap((subject) => (isRecord(subject) && typeof subject.notePath === 'string' && subject.notePath ? [subject.notePath] : []));
}

/** A note target (`path` or `path#heading`) after the moves, or null when its file did not move. */
function movedNoteTarget(target: string, moved: (path: string) => string | null): string | null {
  const hash = target.indexOf('#');
  const path = moved(hash === -1 ? target : target.slice(0, hash));
  return path === null ? null : path + (hash === -1 ? '' : target.slice(hash));
}

function indentationOf(text: string): string | undefined {
  return /^[[{]\r?\n([ \t]+)\S/.exec(text)?.[1];
}

/**
 * The account's text with its typed note references pointed at moved files; the same
 * text when nothing moved, so unchanged accounts keep their exact bytes. A document that
 * is not an account of this format is returned untouched.
 */
export function rewriteAccountNotePaths(text: string, moved: (path: string) => string | null): string {
  let parsed: unknown;
  try { parsed = JSON.parse(text) as unknown; } catch { return text; }
  if (!isAccountShape(parsed)) return text;
  let changed = false;
  for (const subject of parsed.subjects) {
    if (!isRecord(subject) || typeof subject.notePath !== 'string') continue;
    const target = movedNoteTarget(subject.notePath, moved);
    if (target !== null && target !== subject.notePath) {
      subject.notePath = target;
      changed = true;
    }
  }
  if (!changed) return text;
  return JSON.stringify(parsed, null, indentationOf(text) ?? 2) + (text.endsWith('\n') ? '\n' : '');
}
