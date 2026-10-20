import { readNativeJson, type HttpReadOptions } from './httpRead';
import { nativeObject, NativeIdentityError, readOpenRigNode, type OpenRigConnection, type OpenRigSeat, type NativeObject } from './openRigRead';

/** The daemon's durable source identity also qualifies historical work after its seat is gone. */
export async function verifyOpenRigSource(source: OpenRigConnection, options?: HttpReadOptions): Promise<void> {
  const health = await readNativeJson(source, '/healthz', options);
  if (!nativeObject(health) || health.selfHostId !== source.hostId) {
    throw new NativeIdentityError('source', 'The configured endpoint returned a different native source.');
  }
}

export interface OpenRigWorkRecord {
  item: NativeObject;
  transitions: NativeObject[];
  observedAt: string;
}

/** Read the actual native item and transition history. No prose parsing or derived task ledger. */
export async function readOpenRigWork(
  source: OpenRigConnection, qitemId: string, options?: HttpReadOptions,
): Promise<OpenRigWorkRecord> {
  if (!qitemId || qitemId.length > 512 || [...qitemId].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new Error('Invalid native work identity.');
  }
  await verifyOpenRigSource(source, options);
  const path = `/api/queue/${encodeURIComponent(qitemId)}`;
  const [item, transitions] = await Promise.all([
    readNativeJson(source, path, options), readNativeJson(source, `${path}/transitions`, options),
  ]);
  if (!nativeObject(item) || item.qitemId !== qitemId || !Array.isArray(transitions)
    || !transitions.every((entry): entry is NativeObject => nativeObject(entry) && entry.qitemId === qitemId)) {
    throw new Error('The native work response does not match the requested item.');
  }
  await verifyOpenRigSource(source, options);
  return { item, transitions, observedAt: new Date().toISOString() };
}

export interface OpenRigOwnedWork {
  items: NativeObject[];
  sessionName: string;
  /** Native queue custody is recorded by seat address, not provider conversation ID. */
  scope: 'native-seat-address';
  truncated: boolean;
  observedAt: string;
}

/** Bounded current assignments. Read one full native item only when it is opened. */
export async function readOpenRigOwnedWork(
  source: OpenRigConnection, seat: OpenRigSeat, options?: HttpReadOptions,
): Promise<OpenRigOwnedWork> {
  const before = await readOpenRigNode(source, seat, options);
  if (typeof before.canonicalSessionName !== 'string' || !before.canonicalSessionName) {
    throw new Error('The seat has no current native address.');
  }
  const sessionName = before.canonicalSessionName;
  const states = ['pending', 'in-progress', 'blocked'];
  const query = new URLSearchParams({ destinationSession: sessionName, state: states.join(','), compact: '1', limit: '51' });
  const value = await readNativeJson(source, `/api/queue/list?${query}`, options);
  if (!Array.isArray(value) || value.length > 51 || !value.every((entry): entry is NativeObject => nativeObject(entry)
    && typeof entry.qitemId === 'string' && !!entry.qitemId && entry.destinationSession === sessionName
    && typeof entry.state === 'string' && states.includes(entry.state))
    || new Set(value.map((entry) => entry.qitemId)).size !== value.length) {
    throw new Error('The native work list does not match this seat address.');
  }
  const after = await readOpenRigNode(source, seat, options);
  if (after.canonicalSessionName !== sessionName) throw new NativeIdentityError('seat', 'The seat address changed while reading its work.');
  return { items: value.slice(0, 50), sessionName, scope: 'native-seat-address', truncated: value.length > 50, observedAt: new Date().toISOString() };
}
