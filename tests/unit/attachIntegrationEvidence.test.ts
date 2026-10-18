import { expect, it } from 'vitest';
import { attachIntegrationEvidence, attachRepositoryTeamEvidence } from '../../src/app/agent-workspace/attachIntegrationEvidence';
import { buildRecordedScene } from '../../src/app/agent-workspace/buildRecordedScene';
import { foundationRecording as from } from '../../src/app/agent-workspace/foundationRecording';
import { createViewAtlasStore } from '../../src/app/storeFactory';
import { getHistoryStore, runUntracked } from '../../src/app/stores/history';
import { AssetService } from '../../src/app/services/AssetService';
import { createInMemoryApp } from '../mocks/inMemoryVault';

it('attaches evidence in one reversible, persistent edit while preserving authored and foreign representations', async () => {
  const memory = createInMemoryApp();
  const assets = AssetService.getInstance(memory.app);
  await assets.initialize();
  const seed = buildRecordedScene(assets.getCollectionSettings(assets.getDefaultCollectionId()));
  const to = { ...from, id: 'test-final-edition', sourceRevision: 'test-final-hash', work: [...from.work, {
    id: 'new-work', title: 'New recorded review', assignedSeatId: from.seats[0]!.id, artifactIds: [],
  }] };
  const store = createViewAtlasStore(memory.app, 'attach-evidence');
  store.getState().setPersistenceEnabled(false);
  runUntracked(store, () => store.setState(seed.state));
  const token = Object.values(store.getState().objects.tokens)[0]!;
  store.getState().moveToken(token.id, 999, 888);
  const [copyId] = store.getState().duplicateMapObjects([token.id]);
  const label = Object.values(store.getState().objects.texts)[0]!;
  store.getState().updateText(label.id, { text: 'My authored label', x: 123 });
  const foreignId = store.getState().addText({ x: 1, y: 2, text: 'Foreign', fontSize: 21, fontFamily: 'sans-serif', color: '#fff',
    recordingReference: { recordingId: 'foreign', sourceRevision: 'foreign-revision', kind: 'seat', id: token.recordingReference!.id } });
  const invalidId = store.getState().addText({ x: 3, y: 4, text: 'Unknown resource', fontSize: 21, fontFamily: 'sans-serif', color: '#fff',
    recordingReference: { recordingId: from.id, sourceRevision: from.sourceRevision, kind: 'work', id: 'missing-resource' } });
  const before = structuredClone(store.getState().objects);
  const history = getHistoryStore(store)!;
  history.getState().clear();
  const result = attachIntegrationEvidence(store, from, to, 'Published workspace');
  expect(result.addedWorkCards).toBe(1);
  expect(history.getState().pastStates).toHaveLength(1);
  for (const id of [token.id, copyId!]) {
    const old = before.tokens[id]!;
    expect(store.getState().objects.tokens[id]).toEqual({ ...old, recordingReference: { ...old.recordingReference, recordingId: to.id, sourceRevision: to.sourceRevision } });
  }
  expect(store.getState().objects.texts[label.id]).toEqual({ ...before.texts[label.id], recordingReference: { ...label.recordingReference, recordingId: to.id, sourceRevision: to.sourceRevision } });
  expect(store.getState().objects.texts[foreignId]).toEqual(before.texts[foreignId]);
  expect(store.getState().objects.texts[invalidId]).toEqual(before.texts[invalidId]);
  const after = structuredClone(store.getState().objects);
  const added = Object.values(after.texts).filter(text => text.recordingReference?.id === 'new-work');
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ text: 'New recorded review', x: 350, y: 910 });
  expect(attachIntegrationEvidence(store, from, to, 'Published workspace')).toMatchObject({ updatedReferences: 0, addedWorkCards: 0 });
  expect(history.getState().pastStates).toHaveLength(1);
  history.getState().undo();
  expect(store.getState().objects).toEqual(before);
  history.getState().redo();
  expect(store.getState().objects).toEqual(after);
  const path = 'atlas-vtt/collections/Default/scenes/Attached.atlasmap';
  store.getState().setMapPath(path);
  store.getState().setPersistenceEnabled(true);
  await store.flushStorage();
  const reopened = createViewAtlasStore(memory.app, 'attach-evidence-reopen');
  reopened.getState().setPersistenceEnabled(false);
  reopened.getState().setMapPath(path);
  await reopened.persist.rehydrate();
  expect(reopened.getState().objects).toEqual(after);
  store.getState().setPersistenceEnabled(false);
});

it('replaces only explicitly mapped old seats, retaining authored duplicates and historical work through one undo step', async () => {
  const memory = createInMemoryApp();
  const assets = AssetService.getInstance(memory.app);
  await assets.initialize();
  const seed = buildRecordedScene(assets.getCollectionSettings(assets.getDefaultCollectionId()));
  const to = { ...from, id: 'repository-team', sourceRevision: 'repository-final', seats: [
    { ...from.seats[0]!, id: 'new-atlas' }, { ...from.seats[1]!, id: 'new-openrig' },
  ], work: [{ id: 'repository-review', title: 'Repository review', assignedSeatId: 'new-openrig', artifactIds: [] }] };
  const store = createViewAtlasStore(memory.app, 'replace-roster');
  store.getState().setPersistenceEnabled(false);
  runUntracked(store, () => store.setState(seed.state));
  const token = Object.values(store.getState().objects.tokens)[0]!;
  store.getState().moveToken(token.id, 777, 888);
  const [copyId] = store.getState().duplicateMapObjects([token.id]);
  const label = Object.values(store.getState().objects.texts)[0]!;
  store.getState().updateText(label.id, { text: 'Owner home', x: 432 });
  const bad = store.getState().addText({ x: 3, y: 1500, text: 'Unverified', fontSize: 21, fontFamily: 'sans-serif', color: '#fff',
    recordingReference: { recordingId: from.id, sourceRevision: 'unknown-edition', kind: 'seat', id: token.recordingReference!.id } });
  const before = structuredClone(store.getState().objects);
  const history = getHistoryStore(store)!;
  history.getState().clear();
  const mapping = { [from.seats[0]!.id]: 'new-atlas', [from.seats[1]!.id]: 'new-openrig' };
  expect(attachRepositoryTeamEvidence(store, [from], to, 'Workspace', mapping)).toMatchObject({ updatedReferences: 5, addedWorkCards: 1 });
  for (const id of [token.id, copyId!]) expect(store.getState().objects.tokens[id]).toEqual({ ...before.tokens[id],
    recordingReference: { recordingId: to.id, sourceRevision: to.sourceRevision, kind: 'seat', id: 'new-atlas' } });
  expect(store.getState().objects.texts[label.id]).toEqual({ ...before.texts[label.id],
    recordingReference: { recordingId: to.id, sourceRevision: to.sourceRevision, kind: 'seat', id: 'new-atlas' } });
  expect(store.getState().objects.texts[bad]).toEqual(before.texts[bad]);
  for (const old of Object.values(before.texts).filter(text => text.recordingReference?.kind !== 'seat')) {
    expect(store.getState().objects.texts[old.id]).toEqual(old);
  }
  const newCard = Object.values(store.getState().objects.texts).find(text => text.recordingReference?.id === 'repository-review')!;
  expect(newCard.y).toBeGreaterThan(1500);
  const after = structuredClone(store.getState().objects);
  expect(history.getState().pastStates).toHaveLength(1);
  expect(attachRepositoryTeamEvidence(store, [from], to, 'Workspace', mapping)).toMatchObject({ updatedReferences: 0, addedWorkCards: 0 });
  expect(history.getState().pastStates).toHaveLength(1);
  history.getState().undo();
  expect(store.getState().objects).toEqual(before);
  history.getState().redo();
  expect(store.getState().objects).toEqual(after);
});
