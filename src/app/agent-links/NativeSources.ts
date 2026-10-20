import type { App } from 'obsidian';
import { SettingsService } from '../services/SettingsService';
import { loadAccountJson } from './account/loadAccountJson';
import { validateAccount } from './account/accountValidation';
import type { AccountArtifact, CapturedParticipant, SeatSubject } from './account/accountSchema';
import { inspectArtifact, type ArtifactRead } from './artifactReads';
import { anchoredPath, confinedRoot } from './sourceSettings';
import { readLocalFilePrefix } from './native/localFiles';
import { focusHerdrView, returnToHerdrView } from './native/herdrFocus';
import type { HerdrViewWitness } from './native/herdrViews';
import { openLocalFile, type LocalOpen } from './native/desktopOpen';
import {
  NativeIdentityError, readOpenRigParticipant, readOpenRigProcess, readOpenRigScreen, readOpenRigSeatScreen,
  sameOpenRigParticipant, sameOpenRigProcess, type OpenRigConnection, type OpenRigSeat,
} from './native/openRigRead';
import { LiveSources } from './live/LiveSources';
import { readSeat, readOwnedWork, readWork, type SeatReadOptions } from './sourceReads';
import { locateConversationRecord } from './native/providerRecordLocator';
import { resolveNativeSeatViews, resolveNativeViews, type NativeViewConnections } from './native/viewResolution';
import {
  failure, now, type ConversationRecord, type CurrentSeat, type Focus, type LoadedAccount, type OwnedWork, type Screen, type SeatRead, type Views, type Work,
} from './reads';
import { expandRoot, openRigConnectionOf, viewConnectionsOf, type AgentLinkSourceSettings } from './sourceSettings';

interface Options { signal?: AbortSignal }
/**
 * Which participant a live action targets. `pinned` (default) honours the subject's policy:
 * a `captured-conversation` subject refuses when the seat's current conversation is not the
 * pinned one or cannot be qualified. `current` is the explicitly labelled other choice.
 */
interface ActionOptions extends Options { choice?: 'pinned' | 'current' }

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

  static release(app: App): void {
    const instance = NativeSources.instances.get(app);
    instance?.live.dispose(); instance?.unsubscribeSettings();
    NativeSources.instances.delete(app);
  }

  readonly live: LiveSources;
  private readonly unsubscribeSettings: () => void;

  private constructor(private readonly app: App, private readonly settings: SettingsService) {
    this.live = new LiveSources((sourceKey) => ({ settings: this.source(sourceKey), backend: {
      readSeat: (subject, signal) => this.readSeat(subject, { signal, includeParticipant: false }),
      readOwned: (subject, signal) => this.readOwnedWork(subject, { signal }),
      readWork: (key, qitemId, signal) => this.readWork(key, qitemId, { signal }),
    } }));
    this.unsubscribeSettings = settings.onChange(() => this.live.settingsChanged());
  }

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

  readSeat(subject: SeatSubject, options: SeatReadOptions = {}): Promise<SeatRead> {
    return readSeat(this.source(subject.sourceKey), subject, options);
  }

  readOwnedWork(subject: SeatSubject, options: Options = {}): Promise<OwnedWork> {
    return readOwnedWork(this.source(subject.sourceKey), subject, options);
  }

  readWork(sourceKey: string, qitemId: string, options: Options = {}): Promise<Work> {
    return readWork(this.source(sourceKey), qitemId, options);
  }

  /** Why a live action on `identity` would not reach the subject's pinned conversation, or null when it may proceed. */
  pinnedConversationProblem(subject: SeatSubject, identity: CurrentSeat): string | null {
    if (subject.policy !== 'captured-conversation') return null;
    const pinned = subject.participant;
    if (!pinned) return 'This subject pins a captured conversation but the account records none.';
    if (!identity.participant) return 'The pinned conversation cannot be qualified right now.';
    if (identity.participant.runtime !== pinned.runtime || identity.participant.conversationId !== pinned.conversationId) {
      return 'The seat now holds another conversation; this card pins the captured one.';
    }
    return null;
  }

  private refused(subject: SeatSubject, identity: CurrentSeat, options: ActionOptions): string | null {
    return options.choice === 'current' ? null : this.pinnedConversationProblem(subject, identity);
  }

  /** Read-only capture of the seat's screen; it changes no focus and sends no input. */
  async readScreen(subject: SeatSubject, identity: CurrentSeat, options: ActionOptions = {}): Promise<Screen> {
    const bound = this.connection(subject);
    if (typeof bound === 'string') return { state: 'unavailable', message: bound, observedAt: now() };
    const refused = this.refused(subject, identity, options);
    if (refused) return { state: 'unavailable', message: refused, observedAt: now() };
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
  async resolveViews(subject: SeatSubject, identity: CurrentSeat, options: ActionOptions = {}): Promise<Views> {
    const bound = this.views(subject);
    if (typeof bound === 'string') return { state: 'unavailable', message: bound, observedAt: now() };
    const refused = this.refused(subject, identity, options);
    if (refused) return { state: 'unavailable', message: refused, observedAt: now() };
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
  async showView(subject: SeatSubject, identity: CurrentSeat, view: HerdrViewWitness, options: ActionOptions = {}): Promise<Focus> {
    const bound = this.views(subject);
    if (typeof bound === 'string') return { state: 'unavailable', message: bound, observedAt: now() };
    const refused = this.refused(subject, identity, options);
    if (refused) return { state: 'unavailable', message: refused, observedAt: now() };
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

  inspectArtifact(sourceKey: string, artifact: AccountArtifact, options: Options = {}): Promise<ArtifactRead> {
    return inspectArtifact(this.source(sourceKey), artifact, options.signal);
  }

  /**
   * Opens an artifact's working file with the system's default application, confining and
   * reading it again now; a path retained from an earlier read is never opened as is.
   */
  openArtifactWorkingFile(sourceKey: string, artifact: AccountArtifact, options: Options = {}): Promise<LocalOpen> {
    const locator = artifact.working;
    if (!locator) return Promise.reject(new Error('This artifact has no working file.'));
    const source = this.source(sourceKey);
    return openLocalFile(async () => {
      const confined = await confinedRoot(source, locator.root);
      if (!confined) throw new Error('This path is outside the allowed roots in Atlas settings.');
      return (await readLocalFilePrefix(confined.anchor, anchoredPath(confined, locator.path), { maxBytes: 1 })).path;
    }, options.signal);
  }

  /**
   * Opens the exact provider record, located and validated again now; a cancelled open never reaches the desktop.
   * When no application opens it, the record itself is shown in its folder; the seat's aggregate transcript never stands in.
   */
  openConversationRecord(
    sourceKey: string, participant: Pick<CapturedParticipant, 'runtime' | 'conversationId'> & { cwd?: string | null }, options: Options = {},
  ): Promise<LocalOpen> {
    return openLocalFile(async () => {
      const located = await this.locateRecord(sourceKey, participant, options);
      if (located.state === 'unavailable') throw new Error(located.message);
      return located.record.path;
    }, options.signal);
  }

  /** The exact provider record of a conversation, validated by its own header; never the seat's aggregate transcript. */
  async locateRecord(
    sourceKey: string, participant: Pick<CapturedParticipant, 'runtime' | 'conversationId'> & { cwd?: string | null }, options: Options = {},
  ): Promise<ConversationRecord> {
    const source = this.source(sourceKey);
    try {
      options.signal?.throwIfAborted();
      const record = await locateConversationRecord(
        { claudeProjectsRoot: expandRoot(source.claudeProjectsRoot), codexSessionsRoot: expandRoot(source.codexSessionsRoot) },
        { runtime: participant.runtime, conversationId: participant.conversationId, ...(participant.cwd ? { cwd: participant.cwd } : {}) },
      );
      options.signal?.throwIfAborted();
      return { state: 'current', record, observedAt: now() };
    } catch (error) {
      return failure(error, 'The conversation record could not be located.');
    }
  }
}
