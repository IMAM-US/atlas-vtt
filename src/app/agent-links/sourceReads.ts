import type { SeatSubject } from './account/accountSchema';
import { NativeHttpError } from './native/httpRead';
import { NativeIdentityError, readOpenRigNode, readOpenRigParticipant, readOpenRigProcess, sameOpenRigProcess } from './native/openRigRead';
import { readOpenRigOwnedWork, readOpenRigWork } from './native/openRigWork';
import { failure, now, type NativeRefusal, type OwnedWork, type SeatRead, type Work } from './reads';
import { openRigConnectionOf, type AgentLinkSourceSettings } from './sourceSettings';

export interface SeatReadOptions { signal?: AbortSignal; includeParticipant?: boolean }

/** Background reads stop at the process. Opening and actions retain the exact native read. */
export async function readSeat(sourceSettings: AgentLinkSourceSettings, subject: SeatSubject, options: SeatReadOptions): Promise<SeatRead> {
  const source = openRigConnectionOf(sourceSettings);
  if (!source) return { state: 'unavailable', message: `No local source "${subject.sourceKey}" is configured in Atlas settings.`, observedAt: now() };
  const seat = subject.seat;
  try {
    const node = await readOpenRigNode(source, seat, options);
    let process;
    try { process = (await readOpenRigProcess(source, seat, options)).process; }
    catch (error) {
      if (error instanceof NativeIdentityError && error.kind === 'unverified') return { state: 'unverified', node, message: error.message, observedAt: now() };
      throw error;
    }
    let participant = null;
    let participantMessage: string | null = null;
    let participantRefusal: NativeRefusal | undefined;
    if (options.includeParticipant !== false) {
      try {
        const exact = (await readOpenRigParticipant(source, seat, options)).participant;
        if (!sameOpenRigProcess(process, exact)) throw new NativeIdentityError('participant', 'The seat process changed during the exact conversation read. Recheck the conversation.');
        participant = exact;
      }
      catch (error) {
        participantMessage = error instanceof NativeHttpError ? error.reason ?? error.message : error instanceof Error ? error.message : 'The exact conversation could not be qualified.';
        if (error instanceof NativeHttpError) participantRefusal = { status: error.status, code: error.code, reason: error.reason };
      }
    }
    return { state: 'current', node, process, participant, participantMessage, ...(participantRefusal ? { participantRefusal } : {}),
      cwd: typeof node.cwd === 'string' ? node.cwd : null, observedAt: now() };
  } catch (error) {
    if (error instanceof NativeIdentityError && error.kind === 'seat') return { state: 'different-seat', message: error.message, observedAt: now() };
    return failure(error, 'OpenRig did not answer.');
  }
}

export async function readOwnedWork(settings: AgentLinkSourceSettings, subject: SeatSubject, options: { signal?: AbortSignal }): Promise<OwnedWork> {
  const source = openRigConnectionOf(settings);
  if (!source) return { state: 'unavailable', message: `No local source "${subject.sourceKey}" is configured in Atlas settings.`, observedAt: now() };
  try { return { state: 'current', ...await readOpenRigOwnedWork(source, subject.seat, options) }; }
  catch (error) { return failure(error, 'OpenRig did not answer.'); }
}

export async function readWork(settings: AgentLinkSourceSettings, qitemId: string, options: { signal?: AbortSignal }): Promise<Work> {
  const source = openRigConnectionOf(settings);
  if (!source) return { state: 'unavailable', message: `No local source "${settings.key}" is configured in Atlas settings.`, observedAt: now() };
  try { return { state: 'current', ...await readOpenRigWork(source, qitemId, options) }; }
  catch (error) { return failure(error, 'OpenRig did not answer.'); }
}
