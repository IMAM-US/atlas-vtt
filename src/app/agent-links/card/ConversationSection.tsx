import React, { useState } from 'react';
import { Notice } from 'obsidian';
import { Button } from '../../packages/components/primitives/button';
import type { SeatSubject } from '../account/accountSchema';
import type { HerdrViewWitness } from '../native/herdrViews';
import type { ResolvedNativeView } from '../native/viewResolution';
import { paneFocusRoute, recordRoute, screenRoute } from '../nativeRoutes';
import type { ConversationRecord, CurrentSeat, Focus, Screen, SeatRead, Views } from '../reads';
import { useCard } from './cardContext';
import { RouteRow } from './RouteRow';
import { clock, short } from './timeLabels';
import { useActionSignal } from './useActionSignal';

const SCREEN_LINES = 40;
type Choice = 'pinned' | 'current';

function viewLabel(view: ResolvedNativeView): string {
  return `${view.witness.label} · pane ${view.witness.pane.pane_id}${view.exact ? '' : ' (session view, exact pane unqualified)'}`;
}

/**
 * The three ways into the conversation, in the order of least effect: read, show, record.
 * A subject that pins its captured conversation never reads or shows a successor as if it
 * were that conversation; the current occupant is offered only as a labelled other choice.
 */
export function ConversationSection({ subject, seat }: { subject: SeatSubject; seat: SeatRead | null }): React.ReactElement {
  const { sources } = useCard();
  const next = useActionSignal();
  const routeSource = sources.source(subject.sourceKey);
  const current: CurrentSeat | null = seat?.state === 'current' ? seat : null;
  const liveReason = !seat ? 'Checking…' : seat.state === 'current' ? null : seat.state === 'unverified' ? 'No verified participant' : seat.state === 'different-seat' ? 'Map subject has no live entrance' : 'Unavailable';
  const pinnedProblem = current ? sources.pinnedConversationProblem(subject, current) : null;
  const [screen, setScreen] = useState<Screen | null>(null);
  const [views, setViews] = useState<Views | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [record, setRecord] = useState<{ which: 'current' | 'previous'; read: ConversationRecord } | null>(null);
  const [choice, setChoice] = useState<Choice>('pinned');

  const readScreen = async (which: Choice): Promise<void> => {
    if (!current) return;
    const signal = next();
    setBusy('screen');
    setChoice(which);
    const result = await sources.readScreen(subject, current, { signal, choice: which });
    if (signal.aborted) return;
    setScreen(result);
    setBusy(null);
  };
  const show = async (witness: HerdrViewWitness, signal: AbortSignal, which: Choice): Promise<void> => {
    if (!current) return;
    setBusy('focus');
    const result = await sources.showView(subject, current, witness, { signal, choice: which });
    if (signal.aborted) return;
    setFocus(result);
    setBusy(null);
  };
  const resolve = async (which: Choice): Promise<void> => {
    if (!current) return;
    const signal = next();
    setBusy('views');
    setChoice(which);
    setFocus(null);
    const resolved = await sources.resolveViews(subject, current, { signal, choice: which });
    if (signal.aborted) return;
    setViews(resolved);
    setBusy(null);
    if (resolved.state !== 'unavailable' && resolved.views.length === 1 && resolved.views[0]!.exact) await show(resolved.views[0]!.witness, signal, which);
  };
  const returnToPrevious = async (previous: HerdrViewWitness): Promise<void> => {
    const signal = next();
    setBusy('return');
    const result = await sources.returnToView(subject.sourceKey, previous, { signal });
    if (signal.aborted) return;
    setFocus(result.state === 'unavailable' ? result : { ...result, previous: null });
    setBusy(null);
  };
  const locate = async (which: 'current' | 'previous'): Promise<void> => {
    const participant = participantFor(which);
    if (!participant) return;
    const signal = next();
    setBusy('record');
    const read = await sources.locateRecord(subject.sourceKey, participant, { signal });
    if (signal.aborted) return;
    setRecord({ which, read });
    setBusy(null);
  };
  const participantFor = (which: 'current' | 'previous'): { runtime: 'claude-code' | 'codex'; conversationId: string; cwd: string | null } | null =>
    which === 'current' && current?.participant
      ? { runtime: current.participant.runtime === 'codex' ? 'codex' : 'claude-code', conversationId: current.participant.conversationId, cwd: current.cwd }
      : subject.participant ? { runtime: subject.participant.runtime, conversationId: subject.participant.conversationId, cwd: subject.participant.cwd ?? current?.cwd ?? null } : null;
  const openRecord = async (which: 'current' | 'previous'): Promise<void> => {
    const participant = participantFor(which);
    if (!participant) return;
    const signal = next();
    try {
      await sources.openConversationRecord(subject.sourceKey, participant, { signal });
    } catch (error) {
      if (!signal.aborted) new Notice(error instanceof Error ? error.message : 'The record could not be opened.');
    }
  };

  const changed = Boolean(current?.participant && subject.participant && current.participant.conversationId !== subject.participant.conversationId);
  const pinnedElsewhere = subject.policy === 'captured-conversation' && Boolean(pinnedProblem);
  const screenLines = screen?.state === 'current' ? screen.content.split('\n').slice(-SCREEN_LINES).join('\n') : '';
  const candidates = views && views.state !== 'unavailable' ? views.views : [];
  const unavailable = views && views.state !== 'unavailable' ? views.unavailable : [];
  const occupant = choice === 'current' ? ' · current occupant' : '';
  const busyReason = busy === 'screen' ? 'Reading…' : busy === 'views' || busy === 'focus' ? 'Resolving…' : null;
  return <section className="agent-link-section" aria-label="Conversation">
    <h4>Conversation</h4>
    <RouteRow label="Read screen" onPress={() => { void readScreen('pinned'); }} disabledReason={liveReason ?? pinnedProblem ?? busyReason}
      detail={screen?.state === 'current' ? `last ${SCREEN_LINES} · ${clock(screen.capturedAt)}${screen.scope === 'seat-screen' ? ' · seat screen' : ''}${occupant}` : screen?.state === 'unavailable' ? `Unavailable: ${screen.message}` : `last ${SCREEN_LINES}`}
      route={screenRoute(routeSource, subject.seat)} tone={screen?.state === 'unavailable' ? 'unavailable' : undefined}>
      {screen?.state === 'current' && <pre className="agent-link-screen">{screenLines}</pre>}
    </RouteRow>
    <RouteRow label="Show in Herdr" onPress={() => { void resolve('pinned'); }} disabledReason={liveReason ?? pinnedProblem ?? busyReason}
      detail={views ? views.state === 'unavailable' ? `Unavailable: ${views.message}` : candidates.length === 0 ? `Not open in Herdr${occupant}` : candidates.length > 1 ? `Unclear: ${candidates.length} views${occupant}` : viewLabel(candidates[0]!) + occupant : 'moves the shared Herdr view'}
      route={candidates[0] ? paneFocusRoute(routeSource, candidates[0].witness.socketPath, candidates[0].witness.pane.pane_id) : null}
      tone={views?.state === 'unavailable' ? 'unavailable' : views && candidates.length !== 1 ? 'changed' : undefined}>
      {candidates.length > 1 && <div className="agent-link-list">
        {candidates.map((view) => <Button key={view.witness.pane.pane_id} variant="secondary" onClick={() => { void show(view.witness, next(), choice); }}>{viewLabel(view)}</Button>)}
      </div>}
      {candidates.length === 1 && !candidates[0]!.exact && <Button variant="secondary" onClick={() => { void show(candidates[0]!.witness, next(), choice); }}>Open session view</Button>}
      {views && views.state !== 'unavailable' && <p className="agent-link-muted">Scope: {views.scope === 'conversation' ? 'exact conversation' : 'seat process; conversation not qualified'}{unavailable.length ? ` · ${unavailable.length} source${unavailable.length === 1 ? '' : 's'} unavailable` : ''}</p>}
      {focus && (focus.state === 'unavailable'
        ? <p className="agent-link-muted agent-link-row--unavailable">{focus.message}</p>
        : <>
          <p className={focus.status === 'focused' ? 'agent-link-muted' : 'agent-link-muted agent-link-row--changed'}>{focus.status === 'focused' ? 'Herdr shows this view. Switch to Herdr to see it.' : focus.message}</p>
          {focus.previous && <Button variant="secondary" disabled={busy === 'return'} onClick={() => { void returnToPrevious(focus.previous!); }}>Return to previous view · {focus.previous.label}</Button>}
        </>)}
    </RouteRow>
    {pinnedElsewhere && current && <>
      <RouteRow label="Current occupant: read screen" onPress={() => { void readScreen('current'); }} disabledReason={busyReason} detail="another conversation, not the map's" tone="changed" />
      <RouteRow label="Current occupant: show in Herdr" onPress={() => { void resolve('current'); }} disabledReason={busyReason} detail="another conversation, not the map's" tone="changed" />
    </>}
    {(subject.participant || current?.participant) && <RouteRow label={changed ? (pinnedElsewhere ? 'Pinned conversation record' : 'Current conversation record') : 'Conversation record'}
      onPress={() => { void locate(changed && pinnedElsewhere ? 'previous' : 'current'); }}
      disabledReason={current?.participant || subject.participant ? null : 'No conversation'}
      detail={`${short(changed && pinnedElsewhere ? subject.participant?.conversationId : current?.participant?.conversationId ?? subject.participant?.conversationId)}… · growing record`}
      route={record?.read.state === 'current' ? recordRoute(record.read.record.path) : null}>
      {record && <RecordDetail read={record.read} onOpen={() => openRecord(record.which)} />}
    </RouteRow>}
    {changed && !pinnedElsewhere && subject.participant && <RouteRow label="Previous conversation record" onPress={() => { void locate('previous'); }} detail={`${short(subject.participant.conversationId)}… · map's conversation`} />}
    {changed && pinnedElsewhere && current?.participant && <RouteRow label="Current occupant: conversation record" onPress={() => { void locate('current'); }} detail={`${short(current.participant.conversationId)}… · another conversation`} tone="changed" />}
  </section>;
}

function RecordDetail({ read, onOpen }: { read: ConversationRecord; onOpen: () => Promise<void> }): React.ReactElement {
  if (read.state === 'unavailable') return <p className="agent-link-muted agent-link-row--unavailable">{read.message}</p>;
  const { record } = read;
  return <div className="agent-link-list">
    <p className="agent-link-muted">Exact provider record · {record.validatedRecords} record{record.validatedRecords === 1 ? '' : 's'} checked · {Math.round(record.fileSizeBytes / 1024)} KB{record.complete ? '' : ' and growing'} · {clock(read.observedAt)}</p>
    <Button variant="secondary" onClick={() => { void onOpen(); }}>Open record</Button>
  </div>;
}
