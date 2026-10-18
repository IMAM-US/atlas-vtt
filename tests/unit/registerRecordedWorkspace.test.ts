import { beforeEach, expect, it, vi } from 'vitest';
import { App, type Plugin } from 'obsidian';
import { registerRecordedWorkspace } from '../../src/app/agent-workspace/registerRecordedWorkspace';
import { integrationRecording, integrationOrientationRecording, repositoryTeamRecording, integrationSceneName } from '../../src/app/agent-workspace/integrationRecording';

const { open, ensureNotes, attach, attachRepository, artwork, openExisting } = vi.hoisted(() => ({ openExisting: vi.fn().mockResolvedValue(false), attachRepository: vi.fn().mockReturnValue({ updatedReferences: 4, addedWorkCards: 1 }), artwork: vi.fn().mockResolvedValue('studio.webp'), attach: vi.fn().mockReturnValue({ updatedReferences: 2, addedWorkCards: 1 }), open: vi.fn().mockResolvedValue(undefined), ensureNotes: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/app/agent-workspace/createRecordedScene', () => ({ createOrOpenRecordedScene: open, openExistingRecordedScene: openExisting }));
vi.mock('../../src/app/agent-workspace/integrationNotes', () => ({ ensureIntegrationNotes: ensureNotes }));
vi.mock('../../src/app/atlas-view', () => ({ AtlasView: class AtlasView {} }));
vi.mock('../../src/app/agent-workspace/attachIntegrationEvidence', () => ({ attachIntegrationEvidence: attach, attachRepositoryTeamEvidence: attachRepository }));
vi.mock('../../src/app/agent-workspace/integrationStudioArtwork', () => ({ ensureIntegrationStudioArtwork: artwork }));
beforeEach(() => {
  vi.clearAllMocks();
  openExisting.mockReset().mockResolvedValue(false);
  artwork.mockReset().mockResolvedValue('studio.webp');
});

it('does not add predecessor work to a scene containing only the current repository roster', () => {
  const registered = commands();
  const state = { isPlayerView: false, isMapLoading: false, mapPath: 'Current.atlasmap', objects: {
    tokens: { seat: { recordingReference: { recordingId: repositoryTeamRecording.id, sourceRevision: repositoryTeamRecording.sourceRevision,
      kind: 'seat', id: repositoryTeamRecording.seats[0]!.id } } }, texts: {},
  } };
  Object.assign(registered.app, { workspace: { getActiveViewOfType: () => ({ getStore: () => ({ getState: () => state }) }) } });
  for (const id of ['attach-completed-integration-evidence', 'attach-repository-team-evidence']) {
    const command = registered.commands.find(command => command.id === id);
    expect(command.checkCallback(true)).toBe(false);
    expect(command.checkCallback(false)).toBe(false);
  }
  expect(attach).not.toHaveBeenCalled();
  expect(attachRepository).not.toHaveBeenCalled();
});

function commands() {
  const app = new App();
  const addCommand = vi.fn();
  const registerView = vi.fn();
  registerRecordedWorkspace({ app, addCommand, registerView } as unknown as Plugin);
  return { app, registerView, commands: addCommand.mock.calls.map(call => call[0]) };
}

it('registers explicit scene commands without creating a competing view or opening on startup', () => {
  const registered = commands();
  expect(registered.registerView).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
  expect(ensureNotes).not.toHaveBeenCalled();
  const command = registered.commands.find(command => command.id === 'open-recorded-agent-workspace');
  command.callback();
  expect(open).toHaveBeenCalledExactlyOnceWith(registered.app);
  expect(ensureNotes).not.toHaveBeenCalled();
});

it('awaits integration orientation notes before opening the native integration scene builder', async () => {
  let finishNotes!: () => void;
  ensureNotes.mockImplementationOnce(() => new Promise<void>(resolve => { finishNotes = resolve; }));
  const registered = commands();
  const command = registered.commands.find(command => command.id === 'open-integration-workspace');
  command.callback();
  await vi.waitFor(() => expect(ensureNotes).toHaveBeenCalledExactlyOnceWith(registered.app));
  expect(open).not.toHaveBeenCalled();
  finishNotes();
  await vi.waitFor(() => expect(open).toHaveBeenCalledExactlyOnceWith(registered.app, repositoryTeamRecording, integrationSceneName, expect.any(Function), [integrationRecording.id]));
  const build = open.mock.calls[0]![3];
  const scene = build({}, repositoryTeamRecording, integrationSceneName);
  expect(scene.state.background).toBe('studio.webp');
  expect(Object.keys(scene.state.objects.tokens)).toHaveLength(2);
});

it('does not create a scene when orientation note creation fails', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  ensureNotes.mockRejectedValueOnce(new Error('notes unavailable'));
  const registered = commands();
  registered.commands.find(command => command.id === 'open-integration-workspace').callback();
  await vi.waitFor(() => expect(log).toHaveBeenCalled());
  expect(open).not.toHaveBeenCalled();
  log.mockRestore();
});

it('attaches only to the active loaded GM integration scene and never mutates during availability checks', () => {
  const registered = commands();
  const command = registered.commands.find(command => command.id === 'attach-completed-integration-evidence');
  const reference = { recordingId: integrationOrientationRecording.id, sourceRevision: integrationOrientationRecording.sourceRevision, kind: 'seat', id: integrationOrientationRecording.seats[0]!.id };
  const state = { isPlayerView: false, isMapLoading: false, mapPath: 'Workspace.atlasmap', objects: {
    tokens: { seat: { recordingReference: reference } }, texts: {},
  } };
  const store = { getState: () => state };
  const active = vi.fn((): { getStore: () => typeof store } | null => null);
  Object.assign(registered.app, { workspace: { getActiveViewOfType: active } });
  expect(command.checkCallback(false)).toBe(false);
  active.mockReturnValue({ getStore: () => store });
  for (const patch of [{ isPlayerView: true }, { isMapLoading: true }, { mapPath: '' }]) {
    const before = { ...state };
    Object.assign(state, patch);
    expect(command.checkCallback(false)).toBe(false);
    Object.assign(state, before);
  }
  const original = { ...reference };
  reference.recordingId = 'unrelated-recording';
  expect(command.checkCallback(false)).toBe(false);
  Object.assign(reference, original, { sourceRevision: 'unknown-edition' });
  expect(command.checkCallback(false)).toBe(false);
  Object.assign(reference, original);
  expect(command.checkCallback(true)).toBe(true);
  expect(attach).not.toHaveBeenCalled();
  expect(command.checkCallback(false)).toBe(true);
  expect(attach).toHaveBeenCalledExactlyOnceWith(store, integrationOrientationRecording, integrationRecording, integrationSceneName);
  expect(open).not.toHaveBeenCalled();
  expect(ensureNotes).not.toHaveBeenCalled();
});

it('applies studio art only while the original loaded integration view and map remain active', async () => {
  const registered = commands();
  const command = registered.commands.find(command => command.id === 'add-integration-studio-artwork');
  const setBackground = vi.fn();
  const state = { isPlayerView: false, isMapLoading: false, mapPath: 'Integration.atlasmap', setBackground, objects: {
    tokens: { seat: { recordingReference: { recordingId: integrationRecording.id, sourceRevision: integrationRecording.sourceRevision,
      kind: 'seat', id: integrationRecording.seats[0]!.id } } }, texts: {},
  } };
  const store = { getState: () => state };
  const view = { getStore: () => store };
  const active = vi.fn(() => view);
  Object.assign(registered.app, { workspace: { getActiveViewOfType: active } });
  let finish!: (path: string) => void;
  artwork.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
  expect(command.checkCallback(true)).toBe(true);
  expect(artwork).not.toHaveBeenCalled();
  command.checkCallback(false);
  state.mapPath = 'Another.atlasmap';
  finish('studio.webp');
  await vi.waitFor(() => expect(artwork).toHaveResolved());
  expect(setBackground).not.toHaveBeenCalled();
  state.mapPath = 'Integration.atlasmap';
  command.checkCallback(false);
  await vi.waitFor(() => expect(setBackground).toHaveBeenCalledExactlyOnceWith('studio.webp'));
  expect(open).not.toHaveBeenCalled();
  expect(attach).not.toHaveBeenCalled();
});

it('replaces the repository roster only on explicit invocation with the exact seat map', () => {
  const registered = commands();
  const command = registered.commands.find(command => command.id === 'attach-repository-team-evidence');
  const state = { isPlayerView: false, isMapLoading: false, mapPath: 'Workspace.atlasmap', objects: {
    tokens: { seat: { recordingReference: { recordingId: integrationRecording.id, sourceRevision: integrationRecording.sourceRevision,
      kind: 'seat', id: integrationRecording.seats[0]!.id } } }, texts: {},
  } };
  const store = { getState: () => state };
  Object.assign(registered.app, { workspace: { getActiveViewOfType: () => ({ getStore: () => store }) } });
  expect(command.checkCallback(true)).toBe(true);
  expect(attachRepository).not.toHaveBeenCalled();
  command.checkCallback(false);
  expect(attachRepository).toHaveBeenCalledExactlyOnceWith(store, [integrationOrientationRecording, integrationRecording], repositoryTeamRecording, integrationSceneName, {
    '01M569M8QKR9085ZDEG6CFHVVN': '01M56CGCH9NACF766XDX1TF92N',
    '01M569MJ4HHP75EEKF6AEWWM98': '01M56CGNJD6YPXS5STC2QHWVVB',
  });
  expect(open).not.toHaveBeenCalled();
  expect(attach).not.toHaveBeenCalled();
});

it('reopens an existing authored workspace before unavailable starter artwork can block it', async () => {
  openExisting.mockResolvedValueOnce(true);
  artwork.mockRejectedValueOnce(new Error('The original starter image is unavailable'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const registered = commands();
    registered.commands.find(command => command.id === 'open-integration-workspace').callback();
    await vi.waitFor(() => expect(openExisting).toHaveBeenCalledExactlyOnceWith(registered.app, repositoryTeamRecording, [integrationRecording.id]));
    expect(artwork).not.toHaveBeenCalled();
    expect(ensureNotes).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
