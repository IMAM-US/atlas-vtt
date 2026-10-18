import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { buildIntegrationScene } from '../../src/app/agent-workspace/buildIntegrationScene';
import { ensureIntegrationNotes } from '../../src/app/agent-workspace/integrationNotes';
import { integrationRecording, repositoryTeamRecording, integrationSceneName } from '../../src/app/agent-workspace/integrationRecording';
import { AssetService } from '../../src/app/services/AssetService';
import { createInMemoryApp } from '../mocks/inMemoryVault';

it('seeds two plain seat representations, repository contexts and three resolvable linked-note pins without operational facts', async () => {
  const memory = createInMemoryApp();
  const assets = AssetService.getInstance(memory.app);
  await assets.initialize();
  const seed = buildIntegrationScene(assets.getCollectionSettings(assets.getDefaultCollectionId()), integrationRecording, integrationSceneName);
  const tokens = Object.values(seed.state.objects.tokens);
  expect(tokens).toHaveLength(2);
  expect(tokens.map(token => token.recordingReference?.id).sort()).toEqual(integrationRecording.seats.map(seat => seat.id).sort());
  for (const token of tokens) {
    expect(token).toMatchObject({ kind: 'token', imagePath: '', recordingReference: {
      recordingId: integrationRecording.id, sourceRevision: integrationRecording.sourceRevision, kind: 'seat',
    } });
    expect(token).not.toHaveProperty('name');
    expect(token).not.toHaveProperty('hp');
  }
  const contexts = Object.values(seed.state.objects.texts).filter(text => text.id.startsWith('text_integration_context_'));
  expect(contexts.map(text => text.text)).toEqual([
    expect.stringContaining('Atlas repository'), expect.stringContaining('OpenRig repository'),
  ]);
  const pins = Object.values(seed.state.objects.pins);
  expect(pins.map(pin => pin.notePath).sort()).toEqual([
    'Integration workspace/Atlas repository.md', 'Integration workspace/OpenRig repository.md', 'Integration workspace/Start here.md',
  ]);
  await ensureIntegrationNotes(memory.app);
  for (const pin of pins) expect(memory.files.has(pin.notePath!)).toBe(true);
  const serialized = JSON.stringify(seed.state);
  for (const field of ['nativeConversationId', 'generation', 'claimGeneration', 'transition', 'acceptedBy', 'originalSha256', 'publishedSha256', 'checkpoints']) {
    expect(serialized).not.toContain(`"${field}"`);
  }
  for (const observation of integrationRecording.checkpoints.flatMap(checkpoint => checkpoint.seats)) {
    if (observation.nativeConversationId) expect(serialized).not.toContain(observation.nativeConversationId);
  }
});

it('creates missing orientation notes and preserves authored content across repeated opens', async () => {
  const path = 'Integration workspace/Atlas repository.md';
  const memory = createInMemoryApp({ files: { [path]: '# My authored repository orientation\nOwner decisions.' } });
  await ensureIntegrationNotes(memory.app);
  expect(memory.files.get(path)).toBe('# My authored repository orientation\nOwner decisions.');
  expect(memory.files.get('Integration workspace/Start here.md')).toContain('[[Atlas repository]]');
  expect(memory.files.get('Integration workspace/OpenRig repository.md')).toContain('openrig-representative@atlas-integration-repos\n');
  const before = [...memory.files.entries()];
  await ensureIntegrationNotes(memory.app);
  expect([...memory.files.entries()]).toEqual(before);
  expect(memory.app.vault.create).toHaveBeenCalledTimes(2);
});

it('binds the completed mapping to published artifact bytes and preserves review and execution boundaries', () => {
  const base = resolve(process.cwd(), 'docs/agent-workspace/integration-team');
  const manifest = JSON.parse(readFileSync(resolve(base, 'manifest.json'), 'utf8')) as { files: { path: string; originalSha256?: string; publishedSha256: string }[] };
  for (const artifact of integrationRecording.artifacts) {
    const entry = manifest.files.find(file => file.path === `artifacts/${artifact.id}.md`)!;
    expect(entry).toBeTruthy();
    const digest = createHash('sha256').update(readFileSync(resolve(base, entry.path))).digest('hex');
    expect(digest).toBe(entry.publishedSha256);
    expect(artifact.publishedSha256).toBe(digest);
    expect(artifact.originalSha256).toBe(entry.originalSha256);
    expect(artifact.publishedUrl).toContain(`/blob/${integrationRecording.sourceRevision}/docs/agent-workspace/integration-team/${entry.path}`);
  }
  const [author, reviewer] = integrationRecording.work;
  expect(reviewer!.predecessorId).toBe(author!.id);
  expect(reviewer!.assignedSeatId).not.toBe(author!.assignedSeatId);
  const [orientation, handoff, accepted] = integrationRecording.checkpoints;
  expect(orientation!.work).toHaveLength(1);
  expect(handoff!.work.find(work => work.workId === reviewer!.id)?.status).toBe('in-progress');
  expect(accepted!.work.every(work => work.status === 'done')).toBe(true);
  const firstReviewer = orientation!.seats.find(seat => seat.seatId === reviewer!.assignedSeatId)!;
  const resumedReviewer = handoff!.seats.find(seat => seat.seatId === reviewer!.assignedSeatId)!;
  expect(resumedReviewer.nativeConversationId).toBe(firstReviewer.nativeConversationId);
  expect(resumedReviewer.generation).not.toBe(firstReviewer.generation);
  expect(resumedReviewer.sessionId).toBeTruthy();
  expect(resumedReviewer.sessionId).not.toBe(resumedReviewer.generation);
  expect(handoff!.work.find(work => work.workId === reviewer!.id)?.claimGeneration).toBe(resumedReviewer.generation);
  expect(accepted!.artifacts.find(artifact => artifact.artifactId === 'mapping-proposal')?.acceptedBy).toEqual(['OpenRig representative', 'Coordinator']);
  expect(integrationRecording.openRigScope).toMatchObject({ rigName: 'atlas-integration', stateHome: '~/.openrig-foundation' });
  expect(integrationRecording.openRigScope?.instanceLocator).toContain('recorded locator only');
  const context = JSON.parse(readFileSync(resolve(base, 'workspace/scene-context-v2.json'), 'utf8'));
  expect(context.scene.meaning).toContain('no permissions or execution');
  expect(context.mediation).toContain('No automatic scene subscription');
  const supplied = readFileSync(resolve(base, 'workspace/integration-orientation-supplied.json'));
  expect(createHash('sha256').update(supplied).digest('hex')).toBe(context.recording.sha256);
});


it('binds the repository-grounded roster, accepted artifacts and queue closure to published requalification evidence', () => {
  const recording = repositoryTeamRecording;
  const base = resolve(process.cwd(), 'docs/agent-workspace/integration-team/requalification');
  const read = (path: string): unknown => JSON.parse(readFileSync(resolve(base, path), 'utf8'));
  const manifest = read('manifest.json') as { files: { path: string; originalSha256: string; publishedSha256: string; bytes: number }[] };
  const runtime = read('runtime-observations.json') as { seats: { nodeId: string; rigId: string; address: string; cwd: string;
    nativeConversationId: string; generation: string; sessions: { id: string }[];
    providerEvidence: { models: string[]; nativeCwds: string[]; recordCount: number } }[] };
  type Transition = { transitionId: number; qitemId: string; state: string; transitionNote?: string };
  const queue = read('queue-history.json') as {
    items: { qitemId: string; state: string; destinationSession: string; transitions?: Transition[] }[];
    transitions: Transition[];
    claimStamps: { qitem_id: string; claimed_at: string; claimed_by_generation_uuid: string }[];
  };
  expect(recording.sourceRevision).toMatch(/^[a-f0-9]{40}$/);
  expect(recording.seats).toHaveLength(2);
  const oldSeatIds = new Set(integrationRecording.seats.map(seat => seat.id));
  const final = recording.checkpoints.at(-1)!;
  expect(final.id).toContain('accepted');
  for (const seat of recording.seats) {
    expect(oldSeatIds.has(seat.id)).toBe(false);
    const observed = runtime.seats.find(item => item.nodeId === seat.id)!;
    expect(observed).toBeTruthy();
    expect(observed.address).toBe(seat.address);
    expect(observed.rigId).toBe(recording.openRigScope?.rigId);
    const expectedCwd = seat.address.startsWith('atlas-representative@')
      ? '/Users/farieds/Project/atlas-recorded-agent-scene' : '/Users/farieds/Project/openrig';
    expect(observed.cwd).toBe(expectedCwd);
    expect(observed.providerEvidence.nativeCwds).toContain(expectedCwd);
    expect(observed.providerEvidence.recordCount).toBeGreaterThan(0);
    expect(observed.providerEvidence.models.length).toBeGreaterThan(0);
    expect(observed.providerEvidence.models.some(model => seat.model.includes(model))).toBe(true);
    const identity = final.seats.find(item => item.seatId === seat.id)!;
    expect(identity.nativeConversationId).toBe(observed.nativeConversationId);
    expect(identity.generation).toBe(observed.generation);
    expect(observed.sessions.map(session => session.id)).toContain(identity.sessionId);
    expect(identity.sessionId).not.toBe(identity.generation);
  }
  for (const artifact of recording.artifacts) {
    const entry = manifest.files.find(file => file.path === `${artifact.id}.md`)!;
    expect(entry).toBeTruthy();
    const bytes = readFileSync(resolve(base, entry.path));
    expect(bytes.byteLength).toBe(entry.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.publishedSha256);
    expect(artifact.originalSha256).toBe(entry.originalSha256);
    expect(artifact.publishedSha256).toBe(entry.publishedSha256);
    expect(artifact.publishedUrl).toContain(`/blob/${recording.sourceRevision}/docs/agent-workspace/integration-team/requalification/${entry.path}`);
    expect(final.artifacts.find(item => item.artifactId === artifact.id)).toMatchObject({ status: 'accepted' });
  }
  const [author, reviewer] = recording.work;
  expect(reviewer!.predecessorId).toBe(author!.id);
  expect(reviewer!.assignedSeatId).not.toBe(author!.assignedSeatId);
  const transitions = [...queue.transitions, ...queue.items.flatMap(item => item.transitions ?? [])];
  expect(transitions.some(item => item.qitemId === reviewer!.id && item.transitionNote?.includes(author!.id))).toBe(true);
  for (const work of recording.work) {
    const row = queue.items.find(item => item.qitemId === work.id)!;
    const observation = final.work.find(item => item.workId === work.id)!;
    const seat = recording.seats.find(item => item.id === work.assignedSeatId)!;
    expect(row).toMatchObject({ state: 'done', destinationSession: seat.address });
    expect(observation.status).toBe('done');
    const stamp = queue.claimStamps.find(item => item.qitem_id === work.id)!;
    expect(stamp.claimed_at).toBeTruthy();
    expect(observation.claimGeneration).toBe(stamp.claimed_by_generation_uuid);
    expect(observation.claimGeneration).toBe(final.seats.find(item => item.seatId === work.assignedSeatId)?.generation);
    expect(transitions.find(item => item.qitemId === work.id && item.transitionId === observation.transition)).toMatchObject({ state: 'done' });
  }
});
