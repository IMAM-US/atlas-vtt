// @vitest-environment node
import { expect, it, vi } from 'vitest';
import type { SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import type { ConversationObservationState } from '../../src/app/agent-links/live/ConversationObservation';
import { LiveSources } from '../../src/app/agent-links/live/LiveSources';
import type { CurrentSeat } from '../../src/app/agent-links/reads';
import { defaultSourceSettings } from '../../src/app/agent-links/sourceSettings';
import { comparisonLine } from '../../src/app/agent-links/overlay/comparisonLine';

const subject: SeatSubject = { id: 'builder', kind: 'seat', sourceKey: 'a', caption: 'Builder', policy: 'captured-conversation', workIds: [],
  observedAt: '2026-01-01T10:00:00Z', seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'builder' },
  participant: { runtime: 'codex', conversationId: 'captured', observedAt: '2026-01-01T10:00:00Z' } };
function exact(): CurrentSeat {
  const process = { runtime: 'codex', sessionName: 'builder@example', bindingId: 'binding-a', tmuxPane: '%1', processId: 10 };
  return { state: 'current', node: {}, process, participant: { ...process, conversationId: 'current', recordGeneration: 'generation-a' },
    participantMessage: null, cwd: null, observedAt: '2026-01-01T12:00:00Z' };
}
const state = (value = exact()): ConversationObservationState => ({ value, previous: null, pending: false, applicable: true, needsRecheck: false, changedSince: null });

it('uses only an existing exact comparison with its own Read clock and historical qualifier', () => {
  const observation = state();
  expect(comparisonLine(subject, observation)).toBe('New participant since the map · Read 12:00Z');
  expect(comparisonLine(subject, { ...observation, applicable: false, needsRecheck: true })).toBe('New participant since the map · Read 12:00Z, needs rechecking');
  expect(comparisonLine(subject, { ...observation, value: null, previous: observation.value })).toContain('12:00Z, needs rechecking');
  const same = exact(); same.participant!.conversationId = 'captured';
  expect(comparisonLine(subject, state(same))).toBeNull();
  const processOnly = exact(); processOnly.participant = null;
  expect(comparisonLine(subject, state(processOnly))).toBeNull();
  expect(comparisonLine(subject, null)).toBeNull();
});

it('peeks by source and immutable seat without starting reads, and withdraws on close or settings replacement', () => {
  let settings = defaultSourceSettings('a');
  const noRead = vi.fn(async (): Promise<never> => { throw new Error('Peeking cannot create demand'); });
  const registry = new LiveSources(() => ({ settings, backend: { readSeat: noRead, readOwned: noRead, readWork: noRead } }));
  registry.openRig('a'); // Register settings ownership without retaining a subscriber.
  const owner = {}, observation = state();
  registry.setConversation(subject, owner, 0, observation);
  expect(registry.peekConversation(subject)).toBe(observation);
  expect(registry.peekConversation({ ...subject, sourceKey: 'b' })).toBeNull();
  expect(registry.peekConversation({ ...subject, seat: { ...subject.seat, nodeId: 'replacement' } })).toBeNull();
  registry.setConversation(subject, owner, 0, null);
  expect(registry.peekConversation(subject)).toBeNull();
  registry.setConversation(subject, owner, 0, observation);
  settings = { ...settings, openRigHostId: 'replacement-host' }; registry.settingsChanged();
  expect(registry.peekConversation(subject)).toBeNull();
  expect(noRead).not.toHaveBeenCalled();
  expect(registry.openRig('a').getConnection().status).toBe('closed');
  registry.dispose();
});
