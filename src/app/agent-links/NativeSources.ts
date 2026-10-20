import type { App } from 'obsidian';
import { SettingsService } from '../services/SettingsService';
import { loadAccountJson } from './account/loadAccountJson';
import { validateAccount } from './account/accountValidation';
import type { AccountArtifact, CapturedParticipant, SeatSubject } from './account/accountSchema';
import { inspectArtifact, type ArtifactRead } from './artifactReads';
import { focusHerdrView, returnToHerdrView } from './native/herdrFocus';
import type { HerdrViewWitness } from './native/herdrViews';
import { openLocalFile } from './native/desktopOpen';
import {
  NativeIdentityError, readOpenRigNode, readOpenRigParticipant, readOpenRigProcess, readOpenRigScreen, readOpenRigSeatScreen,
  sameOpenRigParticipant, sameOpenRigProcess, type OpenRigConnection, type OpenRigSeat,
} from './native/openRigRead';
import { readOpenRigOwnedWork, readOpenRigWork } from './native/openRigWork';
import { locateConversationRecord } from './native/providerRecordLocator';
import { resolveNativeSeatViews, resolveNativeViews, type NativeViewConnections } from './native/viewResolution';
import {
  failure, now, type ConversationRecord, type CurrentSeat, type Focus, type LoadedAccount, type OwnedWork, type Screen, type SeatRead, type Views, type Work,
} from './reads';
import { expandRoot, openRigConnectionOf, viewConnectionsOf, type AgentLinkSourceSettings } from './sourceSettings';

interface Options { signal?: AbortSignal }

/**
 * The one entrance the card uses to its native sources. It joins the authored account with
 * the local connection settings, keeps every read bounded and separately dated, revalidates
 * identity before each consequential action, and never writes into the account.
 */
export class NativeSources {
  private static readonly instances = new WeakMap<App, NativeSources>();

  static forApp(app: App): NativeSources {
    let instance = NativeSources.instances.get(app);
    if (!instance) {
      instance = new NativeSources(app, SettingsService.forApp(app) ?? new SettingsService(app));
      NativeSources.instances.set(app, instance);
    }
    return instance;
  }

  private constructor(private readonly app: App, private readonly settings: SettingsService) {}

  source(key: string): AgentLinkSourceSettings {
    return this.settings.getAgentLinkSource(key);
  }

  /** The authored document, validated; a schema problem is an error the card shows, never a guess. */
  async loadAccount(path: string, options: Options = {}): Promise<LoadedAccount> {
    const loaded = await loadAccountJson(this.app, path, options.signal);
    return { account: validateAccount(loaded.value), path: loaded.path, sha256: loaded.sha256, loadedAt: now() };
  }

  private connection(subject: SeatSubject): { source: OpenRigConnection; seat: OpenRigSeat } | string {
    const source = openRigConnectionOf(this.source(subject.sourceKey));
    if (!source) return `No local source "${subject.sourceKey}" is configured in Atlas settings.`;
    return { source, seat: { rigId: subject.seat.rigId, nodeId: subject.seat.nodeId, logicalId: subject.seat.logicalId } };
  }

  /** Identity first: the exact node, then its verified process, then its exact conversation where the runtime can qualify it. */
  async readSeat(subject: SeatSubject, options: Options = {}): Promise<SeatRead> {
    const bound = this.connection(subject);
    if (typeof bound === 'string') return { state: 'unavailable', message: bound, observedAt: now() };
    try {
      const node = await readOpenRigNode(bound.source, bound.seat, options);
      let process;
      try {
        process = (await readOpenRigProcess(bound.source, bound.seat, options)).process;
      } catch (error) {
        if (error instanceof NativeIdentityError && error.kind === 'unverified') return { state: 'unverified', node, message: error.message, observedAt: now() };
        throw error;
      }
      let participant = null;
      let participantMessage: string | null = null;
      try {
        participant = (await readOpenRigParticipant(bound.source, bound.seat, options)).participant;
      } catch (error) {
        participantMessage = error instanceof Error ? error.message : 'The exact conversation could not be qualified.';
      }
      return { state: 'current', node, process, participant, participantMessage, cwd: typeof node.cwd === 'string' ? node.cwd : null, observedAt: now() };
    } catch (error) {
      if (error instanceof NativeIdentityError && error.kind === 'seat') return { state: 'different-seat', message: error.message, observedAt: now() };
      return failure(error, 'OpenRig did not answer.');
    }
  }

  async readOwnedWork(subject: SeatSubject, options: Options = {}): Promise<OwnedWork> {
    const bound = this.connection(subject);
    if (typeof bound === 'string') return { state: 'unavailable', message: bound, observedAt: now() };
    try {
      const owned = await readOpenRigOwnedWork(bound.source, bound.seat, options);
      return { state: 'current', items: owned.items, truncated: owned.truncated, sessionName: owned.sessionName, observedAt: owned.observedAt };
    } catch (error) {
      return failure(error, 'OpenRig did not answer.');
    }
  }

  async readWork(sourceKey: string, qitemId: string, options: Options = {}): Promise<Work> {
    const source = openRigConnectionOf(this.source(sourceKey));
    if (!source) return { state: 'unavailable', message: `No local source "${sourceKey}" is configured in Atlas settings.`, observedAt: now() };
    try {
      const record = await readOpenRigWork(source, qitemId, options);
      return { state: 'current', item: record.item, transitions: record.transitions, observedAt: record.observedAt };
    } catch (error) {
      return failure(error, 'OpenRig did not answer.');
    }
  }

  /** Read-only capture of the seat's screen; it changes no focus and sends no input. */
  async readScreen(subject: SeatSubject, identity: CurrentSeat, options: Options = {}): Promise<Screen> {
    const bound = this.connection(subject);
    if (typeof bound === 'string') return { state: 'unavailable', message: bound, observedAt: now() };
    try {
      if (identity.participant) {
        const screen = await readOpenRigScreen(bound.source, bound.seat, identity.participant, options);
        return { state: 'current', content: screen.content, capturedAt: screen.capturedAt, scope: 'conversation' };
      }
      const screen = await readOpenRigSeatScreen(bound.source, bound.seat, identity.process, options);
      return { state: 'current', content: screen.content, capturedAt: screen.capturedAt, scope: 'seat-screen' };
    } catch (error) {
      return failure(error, 'The screen could not be read.');
    }
  }

  private views(subject: SeatSubject): { source: OpenRigConnection; seat: OpenRigSeat; connections: NativeViewConnections } | string {
    const bound = this.connection(subject);
    if (typeof bound === 'string') return bound;
    const connections = viewConnectionsOf(this.source(subject.sourceKey));
    if (!connections) return 'Herdr and tmux sockets are not configured in Atlas settings.';
    return { ...bound, connections };
  }

  /** Existing Herdr views of the seat's participant, qualified by process, in the strongest scope the runtime allows. */
  async resolveViews(subject: SeatSubject, identity: CurrentSeat, options: Options = {}): Promise<Views> {
    const bound = this.views(subject);
    if (typeof bound === 'string') return { state: 'unavailable', message: bound, observedAt: now() };
    try {
      const resolution = identity.participant
        ? await resolveNativeViews(bound.source, bound.seat, identity.participant, bound.connections, options)
        : await resolveNativeSeatViews(bound.source, bound.seat, identity.process, bound.connections, options);
      return { state: 'current', ...resolution };
    } catch (error) {
      return failure(error, 'Existing views could not be resolved.');
    }
  }

  /** One explicit focus request after re-resolving the participant; the result is read back, never assumed. */
  async showView(subject: SeatSubject, identity: CurrentSeat, view: HerdrViewWitness, options: Options = {}): Promise<Focus> {
    const bound = this.views(subject);
    if (typeof bound === 'string') return { state: 'unavailable', message: bound, observedAt: now() };
    const revalidate = async (): Promise<void> => {
      if (identity.participant) {
        const current = await readOpenRigParticipant(bound.source, bound.seat, options);
        if (!sameOpenRigParticipant(current.participant, identity.participant)) throw new NativeIdentityError('participant', 'The participant changed. Choose the current conversation first.');
      } else {
        const current = await readOpenRigProcess(bound.source, bound.seat, options);
        if (!sameOpenRigProcess(current.process, identity.process)) throw new NativeIdentityError('participant', 'The bound process changed. Refresh the seat first.');
      }
    };
    try {
      return { state: 'current', ...await focusHerdrView(view, bound.connections.tmux, revalidate, options) };
    } catch (error) {
      return failure(error, 'Herdr could not be reached.');
    }
  }

  /** Return revalidates the named previous view; it never restores over another client's later choice. */
  async returnToView(sourceKey: string, previous: HerdrViewWitness, options: Options = {}): Promise<Focus> {
    const connections = viewConnectionsOf(this.source(sourceKey));
    if (!connections) return { state: 'unavailable', message: 'Herdr and tmux sockets are not configured in Atlas settings.', observedAt: now() };
    try {
      return { state: 'current', ...await returnToHerdrView(previous, connections.tmux, options) };
    } catch (error) {
      return failure(error, 'The previous view could not be restored.');
    }
  }

  inspectArtifact(sourceKey: string, artifact: AccountArtifact): Promise<ArtifactRead> {
    return inspectArtifact(this.source(sourceKey), artifact);
  }

  /** Opens a file a confined read has just validated with the system's default application. */
  async openFile(path: string): Promise<void> {
    await openLocalFile(path);
  }

  /** The exact provider record of a conversation, validated by its own header; never the seat's aggregate transcript. */
  async locateRecord(sourceKey: string, participant: Pick<CapturedParticipant, 'runtime' | 'conversationId'> & { cwd?: string | null }): Promise<ConversationRecord> {
    const source = this.source(sourceKey);
    try {
      const record = await locateConversationRecord(
        { claudeProjectsRoot: expandRoot(source.claudeProjectsRoot), codexSessionsRoot: expandRoot(source.codexSessionsRoot) },
        { runtime: participant.runtime, conversationId: participant.conversationId, ...(participant.cwd ? { cwd: participant.cwd } : {}) },
      );
      return { state: 'current', record, observedAt: now() };
    } catch (error) {
      return failure(error, 'The conversation record could not be located.');
    }
  }
}
