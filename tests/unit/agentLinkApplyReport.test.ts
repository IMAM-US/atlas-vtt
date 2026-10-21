import { expect, it } from 'vitest';
import { applyLine, undoLine } from '../../src/app/agent-links/mapmaking/applyReport';

const PATH = 'atlas-vtt/collections/Example/accounts/team.json';

it('words every account outcome, and says when the reload after an uncertain write failed too', () => {
  expect(applyLine({ kind: 'applied', tokenIds: ['a', 'b'], seatsAdded: 2 }, PATH, 2)).toBe('Added 2 tokens (hidden). Added 2 seats to team.json.');
  expect(applyLine({ kind: 'applied', tokenIds: ['a'], seatsAdded: 0 }, PATH, 1)).toBe('Added 1 token (hidden).');
  expect(applyLine({ kind: 'refused', reason: 'team.json changed since it was read.' }, PATH, 1)).toBe('Not applied: team.json changed since it was read.');
  expect(applyLine({ kind: 'stopped', seatsAdded: 1, reason: 'The cell for team.new was taken.' }, PATH, 1))
    .toBe('Added 1 seat to team.json, then stopped before adding tokens: The cell for team.new was taken. The seats are listed under Unused seats added by Atlas.');
  const changed = { kind: 'stopped', seatsAdded: 2, reason: 'other.json changed since it was read.', changedPath: 'atlas-vtt/collections/Example/accounts/other.json' } as const;
  expect(applyLine(changed, PATH, 2, { ok: true }))
    .toBe('Stopped: other.json changed during Apply (other.json changed since it was read). It was read again. No tokens were added to the map; the Proposals panel shows its current state.');
  expect(applyLine({ ...changed, reason: 'team.json changed since it was read.', changedPath: PATH }, PATH, 2, { ok: false, reason: 'team.json is missing' }))
    .toBe('Stopped: team.json changed during Apply (team.json changed since it was read). It could not be read again (team.json is missing). No tokens were added to the map; the Proposals panel shows its current state.');
  expect(applyLine({ kind: 'partial', tokenIds: ['a'], seatsAdded: 2, reason: 'second token failed' }, PATH, 2))
    .toBe('Added 1 of 2 tokens before an error: second token failed. 2 seats were added to team.json; any without a token are listed under Unused seats added by Atlas.');
  expect(applyLine({ kind: 'indeterminate', reason: 'saved, then failed' }, PATH, 1, { ok: true }))
    .toBe('team.json may have been written (saved, then failed); reloaded it. Nothing was added to the map.');
  expect(applyLine({ kind: 'indeterminate', reason: 'saved, then failed' }, PATH, 1, { ok: false, reason: 'team.json is missing' }))
    .toBe('team.json may have been written (saved, then failed); reloading it failed: team.json is missing. Nothing was added to the map.');
  expect(undoLine(2, 2, PATH)).toBe('Undo removed 2 tokens; their 2 seats stay in team.json (see Unused seats in Proposals).');
});
