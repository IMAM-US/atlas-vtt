import type { AccountDocument } from '../account/accountSchema';
import type { ApplyOutcome } from './applyProposals';

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
export const fileName = (path: string): string => path.split('/').pop() ?? path;
const sentence = (reason: string): string => (/[.!?]$/.test(reason) ? reason : `${reason}.`);
const clause = (reason: string): string => reason.replace(/[.!?]+$/, '');

/** After an uncertain or changed write Atlas reloads the account; the line says what the reload found. */
export type Reload = { ok: true; account?: AccountDocument } | { ok: false; reason: string };

/** The line every Apply outcome shows; the account never changes without one. */
export function applyLine(outcome: ApplyOutcome, accountPath: string, chosen: number, reload?: Reload): string {
  const file = fileName(accountPath);
  switch (outcome.kind) {
    case 'applied':
      return [`Added ${count(outcome.tokenIds.length, 'token')} (hidden).`, outcome.seatsAdded ? `Added ${count(outcome.seatsAdded, 'seat')} to ${file}.` : ''].filter(Boolean).join(' ');
    case 'partial':
      return [`Added ${outcome.tokenIds.length} of ${count(chosen, 'token')} before an error: ${sentence(outcome.reason)}`,
        outcome.seatsAdded ? `${count(outcome.seatsAdded, 'seat')} ${outcome.seatsAdded === 1 ? 'was' : 'were'} added to ${file}; any without a token are listed under Unused seats added by Atlas.` : ''].filter(Boolean).join(' ');
    case 'refused':
      return `Not applied: ${sentence(outcome.reason)}`;
    case 'stopped':
      return outcome.accountChanged ? changedLine(outcome, file, reload) : unusedLine(outcome.seatsAdded, file, outcome.reason);
    case 'indeterminate':
      return reload?.ok === false
        ? `${file} may have been written (${clause(outcome.reason)}); reloading it failed: ${clause(reload.reason)}. Nothing was added to the map.`
        : `${file} may have been written (${clause(outcome.reason)}); reloaded it. Nothing was added to the map.`;
  }
}

/** A stop that left the written seats in the account: they are unused there now. */
const unusedLine = (seats: number, file: string, reason: string): string =>
  `Added ${count(seats, 'seat')} to ${file}, then stopped before adding tokens: ${sentence(reason)} The seats are listed under Unused seats added by Atlas.`;

/** The account changed after the write: what the reload found decides which seats the line may name. */
function changedLine(outcome: Extract<ApplyOutcome, { kind: 'stopped' }>, file: string, reload?: Reload): string {
  if (reload?.ok !== true || !reload.account) {
    return `Stopped: ${file} changed during Apply and could not be read again${reload?.ok === false ? ` (${clause(reload.reason)})` : ''}. No tokens were added to the map.`;
  }
  const account = reload.account, ids = outcome.seatIds ?? [];
  const left = ids.filter((id) => account.subjects.some((subject) => subject.id === id)).length;
  if (left === ids.length) return unusedLine(outcome.seatsAdded, file, outcome.reason);
  if (left === 0) return `Stopped: ${file} changed during Apply and the new ${ids.length === 1 ? 'seat is' : 'seats are'} no longer in it. No tokens were added to the map.`;
  return `Stopped: ${file} changed during Apply; ${left} of its ${ids.length} new seats ${left === 1 ? 'is' : 'are'} still in it, listed under Unused seats added by Atlas. No tokens were added to the map.`;
}

export function undoLine(tokens: number, seats: number, accountPath: string): string {
  return `Undo removed ${count(tokens, 'token')}; their ${count(seats, 'seat')} stay in ${fileName(accountPath)} (see Unused seats in Proposals).`;
}
