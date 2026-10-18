import { describe, expect, it } from 'vitest';
import { foundationRecording as recording } from '../../src/app/agent-workspace/foundationRecording';

describe('published foundation recording', () => {
  it('pins public evidence to the exact source revision and keeps accepted originals distinct from sanitized exports', () => {
    expect(recording.sourceRevision).toBe('63db591720e7881ab1b2205d4295bc6ba516295f');
    for (const url of [recording.evidenceUrl, recording.reviewUrl, recording.coordinatorAcceptanceUrl, recording.manifestUrl, ...recording.artifacts.map(a => a.publishedUrl),
      ...recording.checkpoints.map(c => c.evidenceUrl)]) {
      expect(url).toContain(`/blob/${recording.sourceRevision}/docs/reference/foundation/`);
      expect(url).not.toContain('/main/');
    }
    expect(recording.artifacts.map(a => [a.originalSha256, a.publishedSha256])).toEqual([
      ['a9fe0e563171f7ccaf9b226c7d98f88c6001138c232e2373b296dd7dc316c67a',
        'a5f266346a89ae4e3e68c9e5834b75ddd89621c22f121e0d67b6b4a60685b2f8'],
      ['7b56658ce25abd6df1e2dc438d7325e4adf3ccabf9f80f9dfb70dc1c4773d0ba',
        'eb2e75c130aa28e772825af0067250913f14e4b9b5041247258b225c78fd8220'],
    ]);
  });

  it('freezes nested historical evidence so consumer edits cannot rewrite earlier or later checkpoints', () => {
    const before = JSON.stringify(recording);
    const assertFrozen = (value: unknown): void => {
      if (value && typeof value === 'object') {
        expect(Object.isFrozen(value)).toBe(true);
        Object.values(value).forEach(assertFrozen);
      }
    };
    assertFrozen(recording);
    expect(Reflect.set(recording.checkpoints[0]!.work[0]!, 'status', 'done')).toBe(false);
    expect(Reflect.set(recording.artifacts[0]!, 'originalSha256', 'rewritten')).toBe(false);
    expect(Reflect.set(recording.checkpoints[5]!.artifacts[0]!.acceptedBy, '0', 'Consumer')).toBe(false);
    expect(JSON.stringify(recording)).toBe(before);
  });

  it('reveals only existing obligations and artifacts at each recorded boundary', () => {
    const expectedWorkCounts = [1, 1, 2, 3, 4, 4];
    const expectedArtifactCounts = [1, 1, 1, 1, 2, 2];
    recording.checkpoints.forEach((checkpoint, index) => {
      expect(checkpoint.work.map(w => w.workId)).toEqual(recording.work.slice(0, expectedWorkCounts[index]).map(w => w.id));
      expect(checkpoint.artifacts).toHaveLength(expectedArtifactCounts[index]!);
      for (const observation of checkpoint.work) {
        const definition = recording.work.find(w => w.id === observation.workId)!;
        if (definition.predecessorId) {
          expect(checkpoint.work.find(w => w.workId === definition.predecessorId)?.status).toBe('done');
        }
        expect(observation.nextAction.length).toBeGreaterThan(10);
      }
      for (const artifact of checkpoint.artifacts) {
        expect(artifact.acceptedBy.includes('Coordinator')).toBe(index === 5);
        if (index < 3) {
          expect(artifact.status).not.toBe('accepted');
          expect(artifact.acceptedBy).toEqual([]);
        }
      }
    });
  });

  it('separates stable seat, native conversation, OpenRig session, and retained claim generation', () => {
    const before = recording.checkpoints[0]!;
    const resumed = recording.checkpoints[1]!;
    const initialWriter = before.seats[0]!;
    const resumedWriter = resumed.seats[0]!;
    expect(initialWriter.seatId).toBe('01M55ZB93K82YKSH2X6CNZ75M9');
    expect(resumedWriter.seatId).toBe(initialWriter.seatId);
    expect(resumedWriter.nativeConversationId).toBe(initialWriter.nativeConversationId);
    expect(resumedWriter.sessionId).not.toBe(initialWriter.sessionId);
    expect(resumedWriter.generation).not.toBe(initialWriter.generation);
    expect(resumed.work[0]!.claimGeneration).toBe(initialWriter.generation);
    expect(resumed.work[0]!.claimGeneration).not.toBe(resumedWriter.generation);
    const fresh = recording.checkpoints[2]!;
    expect(fresh.seats[1]!.seatId).toBe(before.seats[1]!.seatId);
    expect(fresh.seats[1]!.nativeConversationId).not.toBe(before.seats[1]!.nativeConversationId);
    expect(fresh.work[1]!.claimGeneration).toBe(fresh.seats[1]!.generation);
  });

  it('preserves the actual four-row predecessor chain and source assignment', () => {
    expect(recording.work.map(w => w.id)).toEqual([
      'foundation-pilot-20261017', 'qitem-20261017223014-3f9dc7ae',
      'qitem-20261017224200-304449ee', 'qitem-20261017225006-9d4a1724',
    ]);
    expect(recording.work.map(w => w.predecessorId)).toEqual([
      undefined, ...recording.work.slice(0, -1).map(w => w.id),
    ]);
    expect(recording.work.map(w => w.assignedSeatId)).toEqual([
      recording.seats[0]!.id, recording.seats[1]!.id, recording.seats[0]!.id, recording.seats[1]!.id,
    ]);
  });

  it('keeps pending cold work unclaimed while the writer is stopped and correction awaits discovery', () => {
    const checkpoint = recording.checkpoints.find(c => c.id === 'cold-handoff')!;
    expect(checkpoint.at).toBe('2026-10-17 22:47:42 UTC');
    expect(checkpoint.seats[0]).toMatchObject({ status: 'stopped' });
    expect(Object.hasOwn(checkpoint.seats[0]!, 'nativeConversationId')).toBe(false);
    expect(Object.hasOwn(checkpoint.seats[0]!, 'sessionId')).toBe(false);
    expect(Object.hasOwn(checkpoint.seats[0]!, 'generation')).toBe(false);
    expect(checkpoint.work[2]).toMatchObject({ status: 'pending', transition: 26, claimGeneration: null });
    expect(checkpoint.work[2]!.detail).toContain('no nudge attempt');
    expect(checkpoint.artifacts[0]!.acceptedBy).toEqual(['Reviewer']);
    expect(Object.hasOwn(checkpoint.work[1]!, 'transition')).toBe(false);
    // Absence is intentionally different from an explicitly unclaimed pending row.
    expect(Object.hasOwn(checkpoint.work[0]!, 'claimGeneration')).toBe(false);
  });

  it('preserves known historical identity without inventing current lifecycle or exact closure transitions', () => {
    const reclaimed = recording.checkpoints[2]!;
    const reviewed = recording.checkpoints[4]!;
    for (const checkpoint of [reclaimed, reviewed]) {
      const writer = checkpoint.seats[0]!;
      expect(writer.status).toBe('not-recorded');
      expect(writer.nativeConversationId).toMatch(/^[a-f0-9-]{36}$/);
      expect(writer.sessionId).toBeTruthy();
      expect(writer.generation).toBeTruthy();
    }
    expect(reclaimed.seats[1]!.status).toBe('live');
    for (const checkpoint of recording.checkpoints) {
      for (const observation of checkpoint.work) {
        const q2Closed = observation.workId === recording.work[1]!.id && observation.status === 'done';
        const q3Closed = observation.workId === recording.work[2]!.id && observation.status === 'done';
        if (q2Closed || q3Closed) expect(Object.hasOwn(observation, 'transition')).toBe(false);
      }
    }
  });

  it('attributes final acceptance after review closure and preserves stopped recovery state', () => {
    const review = recording.checkpoints[4]!;
    const final = recording.checkpoints[5]!;
    expect(review.at).toBe('2026-10-17 22:50:47 UTC');
    expect(review.work[3]).toMatchObject({ status: 'done', transition: 32 });
    expect(review.artifacts.every(a => a.acceptedBy.length === 1 && a.acceptedBy[0] === 'Reviewer')).toBe(true);
    expect(final.at).toBe('2026-10-17 22:52:49 UTC');
    expect(final.summary).toContain('22:52:03.860823 UTC');
    expect(final.work.every(w => w.status === 'done')).toBe(true);
    expect(final.seats.every(s => s.status === 'stopped' && s.recoverable === true)).toBe(true);
    expect(final.artifacts.every(a => a.acceptedBy.join(',') === 'Reviewer,Coordinator')).toBe(true);
    expect(final.seats[0]!.nativeConversationId).toBe(review.seats[0]!.nativeConversationId);
    expect(final.seats[0]!.sessionId).not.toBe(review.seats[0]!.sessionId);
    expect(final.work[3]!.nextAction).toContain('done/no-follow-on');
  });
});
