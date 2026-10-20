// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CARD_WIDTH, cardPlacement } from '../../src/app/agent-links/card/cardPlacement';
import { headlineOf, newWork } from '../../src/app/agent-links/card/cardHeadline';
import { validateAccount } from '../../src/app/agent-links/account/accountValidation';
import { exampleAccount } from '../fixtures/exampleAccount';

describe('cardPlacement', () => {
  const container = { width: 1200, height: 800 };
  it('opens to the right of the token with room, else to its left, never off the view', () => {
    expect(cardPlacement({ x: 300, y: 300, radius: 35 }, container)).toEqual({ left: 347, top: 276, maxHeight: 516 });
    const leftSide = cardPlacement({ x: 1100, y: 300, radius: 35 }, container);
    expect(leftSide.left + CARD_WIDTH).toBeLessThanOrEqual(1100 - 35);
    expect(cardPlacement({ x: 10, y: 10, radius: 35 }, { width: 300, height: 400 }).left).toBe(8);
  });
  it('keeps a minimum height by moving up near the bottom edge', () => {
    const low = cardPlacement({ x: 300, y: 790, radius: 35 }, container);
    expect(low.top).toBe(552);
    expect(low.maxHeight).toBe(240);
  });
});

describe('headlineOf', () => {
  const account = validateAccount(exampleAccount());
  const subject = account.subjects[0];
  if (subject.kind !== 'seat') throw new Error('expected a seat');
  const process = { sessionName: 'builder@example', runtime: 'claude-code', bindingId: 'b', tmuxPane: '%1', processId: 1 };
  const current = (conversationId: string | null) => ({
    state: 'current' as const, node: {}, process, cwd: null, observedAt: '2026-01-01T12:00:00Z', participantMessage: null,
    participant: conversationId ? { ...process, conversationId, recordGeneration: 'g' } : null,
  });
  const owned = (ids: string[]) => ({ state: 'current' as const, sessionName: 'builder@example', truncated: false, observedAt: '2026-01-01T12:00:00Z',
    items: ids.map((qitemId) => ({ qitemId, tsCreated: '2026-01-01T11:30:00Z' })) });

  it('ranks differences worst first and names what matched', () => {
    expect(headlineOf(subject, account.capturedAt, null, null, account.work).identity).toBe('Checking… On map 10:00Z');
    expect(headlineOf(subject, account.capturedAt, { state: 'different-seat', message: 'm', observedAt: 't' }, null, account.work))
      .toMatchObject({ identity: 'A different seat now uses code.builder', tone: 'changed' });
    expect(headlineOf(subject, account.capturedAt, { state: 'unavailable', message: 'OpenRig did not answer.', observedAt: 't' }, null, account.work))
      .toMatchObject({ identity: 'Unavailable: OpenRig did not answer.', tone: 'unavailable' });
    expect(headlineOf(subject, account.capturedAt, current('other-conversation'), null, account.work))
      .toMatchObject({ identity: expect.stringContaining('New participant since the map'), tone: 'changed' });
    expect(headlineOf(subject, account.capturedAt, current('conversation-one'), owned(['qitem-build-one']), account.work))
      .toEqual({ identity: 'Same seat and conversation as map (10:00Z)', tone: 'same', work: null });
    expect(headlineOf(subject, account.capturedAt, current('conversation-one'), owned(['qitem-build-one', 'qitem-new']), account.work))
      .toEqual({ identity: 'Same seat and conversation as map (10:00Z)', tone: 'changed', work: 'Work changed: new work since 11:30Z' });
    expect(headlineOf(subject, account.capturedAt, current(null), null, account.work).identity).toContain('exact conversation not qualified now');
    const pinned = { ...subject, policy: 'captured-conversation' as const };
    expect(headlineOf(pinned, account.capturedAt, current('other-conversation'), null, account.work).identity).toBe("The seat now holds another conversation; this card pins the map's (10:00Z)");
  });

  it('counts only rows the map does not represent as new work', () => {
    expect(newWork(owned(['qitem-build-one', 'qitem-new']), account.work, 'local').map((item) => item.qitemId)).toEqual(['qitem-new']);
    // The same queue id on another source is not the map's work.
    expect(newWork(owned(['qitem-build-one']), account.work, 'other-source').map((item) => item.qitemId)).toEqual(['qitem-build-one']);
    expect(newWork({ state: 'unavailable', message: 'x', observedAt: 't' }, account.work, 'local')).toEqual([]);
  });
});
