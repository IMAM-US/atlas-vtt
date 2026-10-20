import React, { useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import type { SeatSubject } from '../account/accountSchema';
import type { HerdrViewWitness } from '../native/herdrViews';
import type { ResolvedNativeView } from '../native/viewResolution';
import { paneFocusRoute, screenRoute } from '../nativeRoutes';
import type { CurrentSeat, Focus, Screen, SeatRead, Views } from '../reads';
import { useCard } from './cardContext';
import { ConversationRecords } from './ConversationRecords';
import { RouteRow } from './RouteRow';
import { clock } from './timeLabels';
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
  /** Record actions share the section's one in-flight action; an action they abort leaves no busy state behind. */
  const startRecordAction = (): AbortSignal => {
    setBusy(null);
    return next();
  };

  const changed = Boolean(current?.participant && subject.participant
    && (current.participant.conversationId !== subject.participant.conversationId || current.participant.runtime !== subject.participant.runtime));
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
    <ConversationRecords subject={subject} current={current} changed={changed} pinnedElsewhere={pinnedElsewhere} startAction={startRecordAction} />
  </section>;
}
