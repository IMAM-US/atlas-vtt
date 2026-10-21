import { expect, it } from 'vitest';
import type { AccountDocument } from '../../src/app/agent-links/account/accountSchema';
import { applyLine, undoLine } from '../../src/app/agent-links/mapmaking/applyReport';
import { exampleAccount } from '../fixtures/exampleAccount';

const PATH = 'atlas-vtt/collections/Example/accounts/team.json';

it('words every account outcome, and says when the reload after an uncertain write failed too', () => {
  expect(applyLine({ kind: 'applied', tokenIds: ['a', 'b'], seatsAdded: 2 }, PATH, 2)).toBe('Added 2 tokens (hidden). Added 2 seats to team.json.');
  expect(applyLine({ kind: 'applied', tokenIds: ['a'], seatsAdded: 0 }, PATH, 1)).toBe('Added 1 token (hidden).');
  expect(applyLine({ kind: 'refused', reason: 'team.json changed since it was read.' }, PATH, 1)).toBe('Not applied: team.json changed since it was read.');
  expect(applyLine({ kind: 'stopped', seatsAdded: 1, reason: 'The cell for team.new was taken.' }, PATH, 1))
    .toBe('Added 1 seat to team.json, then stopped before adding tokens: The cell for team.new was taken. The seats are listed under Unused seats added by Atlas.');
  const changed = { kind: 'stopped', seatsAdded: 2, reason: 'team.json changed since it was read.', accountChanged: true, seatIds: ['seat:a', 'seat:b'] } as const;
  const holding = (...ids: string[]): AccountDocument => ({ ...exampleAccount(), subjects: ids.map((id) => ({ ...exampleAccount().subjects[0]!, id })) });
  expect(applyLine(changed, PATH, 2, { ok: true, account: holding() })).toBe('Stopped: team.json changed during Apply and the new seats are no longer in it. No tokens were added to the map.');
  expect(applyLine({ ...changed, seatsAdded: 1, seatIds: ['seat:a'] }, PATH, 1, { ok: true, account: holding() })).toBe('Stopped: team.json changed during Apply and the new seat is no longer in it. No tokens were added to the map.');
  expect(applyLine(changed, PATH, 2, { ok: true, account: holding('seat:a') })).toBe('Stopped: team.json changed during Apply; 1 of its 2 new seats is still in it, listed under Unused seats added by Atlas. No tokens were added to the map.');
  expect(applyLine(changed, PATH, 2, { ok: true, account: holding('seat:a', 'seat:b') })).toBe('Added 2 seats to team.json, then stopped before adding tokens: team.json changed since it was read. The seats are listed under Unused seats added by Atlas.');
  expect(applyLine(changed, PATH, 2, { ok: false, reason: 'team.json is missing' })).toBe('Stopped: team.json changed during Apply and could not be read again (team.json is missing). No tokens were added to the map.');
  expect(applyLine({ kind: 'partial', tokenIds: ['a'], seatsAdded: 2, reason: 'second token failed' }, PATH, 2))
    .toBe('Added 1 of 2 tokens before an error: second token failed. 2 seats were added to team.json; any without a token are listed under Unused seats added by Atlas.');
  expect(applyLine({ kind: 'indeterminate', reason: 'saved, then failed' }, PATH, 1, { ok: true }))
    .toBe('team.json may have been written (saved, then failed); reloaded it. Nothing was added to the map.');
  expect(applyLine({ kind: 'indeterminate', reason: 'saved, then failed' }, PATH, 1, { ok: false, reason: 'team.json is missing' }))
    .toBe('team.json may have been written (saved, then failed); reloading it failed: team.json is missing. Nothing was added to the map.');
  expect(undoLine(2, 2, PATH)).toBe('Undo removed 2 tokens; their 2 seats stay in team.json (see Unused seats in Proposals).');
});
