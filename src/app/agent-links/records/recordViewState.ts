/**
 * The exact conversation a record view shows: source, runtime and conversation id, plus the
 * working directory a Claude Code record is located by. It is the view's whole saved state;
 * no record content is ever part of it.
 */
export interface RecordViewIdentity {
  sourceKey: string;
  runtime: 'claude-code' | 'codex';
  conversationId: string;
  cwd: string | null;
  /** How the card named the seat, for the tab title. */
  seatCaption: string;
}

const CONVERSATION_ID = /^[A-Za-z0-9_-]{1,256}$/;

/** Reads a saved or requested view state; anything else than a well-formed identity is no identity. */
export function recordViewIdentity(value: unknown): RecordViewIdentity | null {
  if (typeof value !== 'object' || value === null) return null;
  const state = value as Record<string, unknown>;
  const { sourceKey, runtime, conversationId, cwd, seatCaption } = state;
  if (typeof sourceKey !== 'string' || !sourceKey) return null;
  if (runtime !== 'claude-code' && runtime !== 'codex') return null;
  if (typeof conversationId !== 'string' || !CONVERSATION_ID.test(conversationId)) return null;
  if (cwd !== null && cwd !== undefined && (typeof cwd !== 'string' || !cwd.startsWith('/'))) return null;
  return { sourceKey, runtime, conversationId, cwd: typeof cwd === 'string' ? cwd : null, seatCaption: typeof seatCaption === 'string' ? seatCaption : '' };
}

/** One key per exact record: two views of the same source, runtime and conversation show the same record. */
export function recordIdentityKey(identity: RecordViewIdentity): string {
  return JSON.stringify([identity.sourceKey, identity.runtime, identity.conversationId]);
}
