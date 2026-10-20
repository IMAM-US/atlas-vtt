import type { NativeObject, OpenRigParticipant, OpenRigProcess } from './native/openRigRead';
import type { NativeViewResolution } from './native/viewResolution';
import type { HerdrFocusResult } from './native/herdrFocus';
import type { ProviderRecord } from './native/providerRecord';
import type { AccountDocument } from './account/accountSchema';
import { NativeHttpError } from './native/httpRead';

/**
 * Every native read the card shows is an observation with its own time and state. A failed
 * read never hides the captured account, and no read result is ever written into it.
 */
export interface ReadFailure {
  state: 'unavailable'; message: string; observedAt: string;
  refusal?: { status: number; code: string | null; reason: string | null };
}

export interface LoadedAccount { account: AccountDocument; path: string; sha256: string; loadedAt: string }

/** The exact seat answered and its bound process is verified; the conversation may still be unqualified. */
export interface CurrentSeat {
  state: 'current';
  node: NativeObject;
  process: OpenRigProcess;
  /** Null when the runtime could not qualify the exact conversation; reads then carry `seat-process` scope. */
  participant: OpenRigParticipant | null;
  participantMessage: string | null;
  cwd: string | null;
  observedAt: string;
}
/** The locator answered with another seat: same logical name, new node. The map's subject has no live entrance. */
export interface DifferentSeat { state: 'different-seat'; message: string; observedAt: string }
/** The exact seat answered but has no fresh verified process, so nothing may be entered. */
export interface UnverifiedSeat { state: 'unverified'; node: NativeObject; message: string; observedAt: string }
export type SeatRead = CurrentSeat | DifferentSeat | UnverifiedSeat | ReadFailure;

export interface OwnedWorkRead { state: 'current'; items: NativeObject[]; truncated: boolean; sessionName: string; observedAt: string }
export type OwnedWork = OwnedWorkRead | ReadFailure;

export interface WorkRead { state: 'current'; item: NativeObject; transitions: NativeObject[]; observedAt: string }
export type Work = WorkRead | ReadFailure;

export interface ScreenRead { state: 'current'; content: string; capturedAt: string; scope: 'conversation' | 'seat-screen' }
export type Screen = ScreenRead | ReadFailure;

export type ViewsRead = { state: 'current' } & NativeViewResolution;
export type Views = ViewsRead | ReadFailure;
export type FocusRead = { state: 'current' } & HerdrFocusResult;
export type Focus = FocusRead | ReadFailure;

export interface RecordRead { state: 'current'; record: ProviderRecord; observedAt: string }
export type ConversationRecord = RecordRead | ReadFailure;

export const failure = (error: unknown, fallback: string): ReadFailure => ({
  state: 'unavailable', message: error instanceof Error && error.message ? error.message : fallback, observedAt: new Date().toISOString(),
  ...(error instanceof NativeHttpError && [403, 409].includes(error.status)
    ? { refusal: { status: error.status, code: error.code, reason: error.reason } } : {}),
});

export const now = (): string => new Date().toISOString();
