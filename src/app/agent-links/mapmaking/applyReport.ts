import type { ApplyOutcome } from './applyProposals';

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
export const fileName = (path: string): string => path.split('/').pop() ?? path;
const sentence = (reason: string): string => (/[.!?]$/.test(reason) ? reason : `${reason}.`);
const clause = (reason: string): string => reason.replace(/[.!?]+$/, '');

/** After an indeterminate write Atlas reloads the account; the line says whether that reload worked. */
export type Reload = { ok: true } | { ok: false; reason: string };

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
      return `Added ${count(outcome.seatsAdded, 'seat')} to ${file}, then stopped before adding tokens: ${sentence(outcome.reason)} The seats are listed under Unused seats added by Atlas.`;
    case 'indeterminate':
      return reload?.ok === false
        ? `${file} may have been written (${clause(outcome.reason)}); reloading it failed: ${clause(reload.reason)}. Nothing was added to the map.`
        : `${file} may have been written (${clause(outcome.reason)}); reloaded it. Nothing was added to the map.`;
  }
}

export function undoLine(tokens: number, seats: number, accountPath: string): string {
  return `Undo removed ${count(tokens, 'token')}; their ${count(seats, 'seat')} stay in ${fileName(accountPath)} (see Unused seats in Proposals).`;
}
