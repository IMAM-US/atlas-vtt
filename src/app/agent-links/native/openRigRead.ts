import { readNativeJson, type HttpReadOptions, type NativeHttpConnection } from './httpRead';

export interface OpenRigConnection extends NativeHttpConnection { hostId: string }
export interface OpenRigSeat { rigId: string; nodeId: string; logicalId: string }
export type NativeObject = Record<string, unknown>;

export function nativeObject(value: unknown): value is NativeObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class NativeIdentityError extends Error {
  constructor(public readonly kind: 'source' | 'seat' | 'participant' | 'unverified', message: string) {
    super(message);
    this.name = 'NativeIdentityError';
  }
}

function nodeRoute(seat: OpenRigSeat): string {
  return `/api/rigs/${encodeURIComponent(seat.rigId)}/nodes/${encodeURIComponent(seat.logicalId)}`;
}

/** Logical/session names locate a node. Only the exact host, rig and node identify it. */
export async function readOpenRigNode(
  source: OpenRigConnection, seat: OpenRigSeat, options?: HttpReadOptions,
): Promise<NativeObject> {
  const value = await readNativeJson(source, nodeRoute(seat), options);
  if (!nativeObject(value) || value.hostSelfId !== source.hostId) {
    throw new NativeIdentityError('source', 'The configured endpoint returned a different source.');
  }
  if (value.nodeId !== seat.nodeId || value.rigId !== seat.rigId) {
    throw new NativeIdentityError('seat', 'This locator now identifies a different seat.');
  }
  return value;
}

export interface OpenRigProcess {
  sessionName: string;
  runtime: string;
  bindingId: string;
  tmuxPane: string;
  processId: number;
}
export interface OpenRigParticipant extends OpenRigProcess {
  conversationId: string;
  /** Opaque provider-record generation, never a path or an executable command. */
  recordGeneration: string;
}

/** A verified native process is useful even when the runtime cannot qualify its exact conversation record. */
export async function readOpenRigProcess(
  source: OpenRigConnection, seat: OpenRigSeat, options?: HttpReadOptions,
): Promise<{ node: NativeObject; process: OpenRigProcess }> {
  const node = await readOpenRigNode(source, seat, options);
  const { binding, identityVerdict: identity } = node;
  if (!nativeObject(binding) || !nativeObject(identity) || !nativeObject(identity.evidence)
    || binding.nodeId !== seat.nodeId || typeof binding.id !== 'string' || typeof node.runtime !== 'string'
    || binding.attachmentType !== 'tmux' || typeof binding.tmuxPane !== 'string'
    || typeof binding.tmuxSession !== 'string' || binding.tmuxSession !== node.canonicalSessionName
    || identity.nodeId !== seat.nodeId || identity.verdict !== 'verified' || identity.evidenceSource !== 'pane_process'
    || identity.sessionName !== binding.tmuxSession || identity.evidence.registeredPane !== binding.tmuxPane
    || typeof identity.evidence.observedPid !== 'number' || !Number.isSafeInteger(identity.evidence.observedPid)
    || identity.evidence.observedPid <= 0 || typeof identity.observedAt !== 'string'
    || !Number.isFinite(Date.parse(identity.observedAt)) || Date.now() - Date.parse(identity.observedAt) > 30_000
    || Date.parse(identity.observedAt) > Date.now() + 1000) {
    throw new NativeIdentityError('unverified', 'The current participant has no fresh verified process binding.');
  }
  return {
    node,
    process: { sessionName: binding.tmuxSession, runtime: node.runtime, bindingId: binding.id,
      tmuxPane: binding.tmuxPane, processId: identity.evidence.observedPid },
  };
}

/** Current native generation metadata, joined to the same verified bound process. Reads no transcript bytes. */
export async function readOpenRigParticipant(
  source: OpenRigConnection, seat: OpenRigSeat, options?: HttpReadOptions,
): Promise<{ node: NativeObject; participant: OpenRigParticipant }> {
  const { node, process } = await readOpenRigProcess(source, seat, options);
  const record = await readNativeJson(source, `/api/sessions/${encodeURIComponent(process.sessionName)}/generation-record`, options);
  if (!nativeObject(record) || typeof record.sessionId !== 'string' || !record.sessionId
    || typeof record.generationId !== 'string' || !record.generationId
    || typeof record.runtime !== 'string' || record.runtime !== node.runtime
    || record.sessionId !== node.resumeToken) {
    throw new NativeIdentityError('unverified', 'The native conversation record does not match the current participant.');
  }
  return {
    node,
    participant: {
      ...process, conversationId: record.sessionId, recordGeneration: record.generationId,
    },
  };
}

export function sameOpenRigParticipant(left: OpenRigParticipant, right: OpenRigParticipant): boolean {
  return sameOpenRigProcess(left, right) && left.conversationId === right.conversationId && left.recordGeneration === right.recordGeneration;
}

export function sameOpenRigProcess(left: OpenRigProcess, right: OpenRigProcess): boolean {
  return left.sessionName === right.sessionName && left.runtime === right.runtime && left.bindingId === right.bindingId
    && left.tmuxPane === right.tmuxPane && left.processId === right.processId;
}

function screenResult(screen: unknown, sessionName: string): { content: string; capturedAt: string } {
  if (!nativeObject(screen) || screen.sessionName !== sessionName || typeof screen.content !== 'string'
    || typeof screen.capturedAt !== 'string' || !Number.isFinite(Date.parse(screen.capturedAt))) {
    throw new Error('The native source returned an invalid screen capture.');
  }
  return { content: screen.content, capturedAt: screen.capturedAt };
}

/** Screen capture is read-only, and remains separate from the provider conversation record. */
export async function readOpenRigScreen(
  source: OpenRigConnection, seat: OpenRigSeat, intended: OpenRigParticipant, options?: HttpReadOptions,
): Promise<{ content: string; capturedAt: string }> {
  const before = await readOpenRigParticipant(source, seat, options);
  if (!sameOpenRigParticipant(intended, before.participant)) {
    throw new NativeIdentityError('participant', 'The participant changed. Select the current conversation first.');
  }
  const screen = await readNativeJson(source, `${nodeRoute(seat)}/preview?lines=200`, options);
  const after = await readOpenRigParticipant(source, seat, options);
  if (!sameOpenRigParticipant(before.participant, after.participant)) {
    throw new NativeIdentityError('participant', 'The participant changed while reading the screen.');
  }
  return screenResult(screen, intended.sessionName);
}

/** This is explicitly a seat screen, not proof of an exact native conversation. */
export async function readOpenRigSeatScreen(
  source: OpenRigConnection, seat: OpenRigSeat, intended: OpenRigProcess, options?: HttpReadOptions,
): Promise<{ content: string; capturedAt: string; scope: 'seat-screen' }> {
  const before = await readOpenRigProcess(source, seat, options);
  if (!sameOpenRigProcess(intended, before.process)) throw new NativeIdentityError('participant', 'The bound process changed. Refresh the seat first.');
  const screen = await readNativeJson(source, `${nodeRoute(seat)}/preview?lines=200`, options);
  const after = await readOpenRigProcess(source, seat, options);
  if (!sameOpenRigProcess(intended, after.process)) throw new NativeIdentityError('participant', 'The bound process changed during the screen read.');
  return { ...screenResult(screen, intended.sessionName), scope: 'seat-screen' };
}
