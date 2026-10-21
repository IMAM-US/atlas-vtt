import type { ApplyOutcome } from './applyProposals';

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
export const fileName = (path: string): string => path.split('/').pop() ?? path;
const sentence = (reason: string): string => (/[.!?]$/.test(reason) ? reason : `${reason}.`);
const clause = (reason: string): string => reason.replace(/[.!?]+$/, '');

/** After an uncertain or changed write Atlas reloads the account; the line says when that reload failed. */
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
      return outcome.changedPath ? changedLine(fileName(outcome.changedPath), outcome.reason, reload) : unusedLine(outcome.seatsAdded, file, outcome.reason);
    case 'indeterminate':
      return reload?.ok === false
        ? `${file} may have been written (${clause(outcome.reason)}); reloading it failed: ${clause(reload.reason)}. Nothing was added to the map.`
        : `${file} may have been written (${clause(outcome.reason)}); reloaded it. Nothing was added to the map.`;
  }
}

/** A stop for the scene, with every account still holding what was written: the seats are unused there. */
const unusedLine = (seats: number, file: string, reason: string): string =>
  `Added ${count(seats, 'seat')} to ${file}, then stopped before adding tokens: ${sentence(reason)} The seats are listed under Unused seats added by Atlas.`;

/** An account changed after the write: the line gives the reason and the reread, and claims nothing about what the accounts hold now. */
const changedLine = (file: string, reason: string, reload?: Reload): string =>
  `Stopped: ${file} changed during Apply (${clause(reason)}). ${reload?.ok === false ? `It could not be read again (${clause(reload.reason)}).` : 'It was read again.'} No tokens were added to the map; the Proposals panel shows its current state.`;

export function undoLine(tokens: number, seats: number, accountPath: string): string {
  return `Undo removed ${count(tokens, 'token')}; their ${count(seats, 'seat')} stay in ${fileName(accountPath)} (see Unused seats in Proposals).`;
}
