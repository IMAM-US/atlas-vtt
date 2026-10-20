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

const SCREEN_LINES = 40;

function viewLabel(view: ResolvedNativeView): string {
  return `${view.witness.label} · pane ${view.witness.pane.pane_id}${view.exact ? '' : ' (session view, exact pane unqualified)'}`;
}

/** The three ways into the conversation, in the order of least effect: read, show, record. */
export function ConversationSection({ subject, seat }: { subject: SeatSubject; seat: SeatRead | null }): React.ReactElement {
  const { sources } = useCard();
  const current: CurrentSeat | null = seat?.state === 'current' ? seat : null;
  const address = subject.seat.sessionAddress ?? current?.process.sessionName ?? subject.seat.logicalId;
  const liveReason = !seat ? 'Checking…' : seat.state === 'current' ? null : seat.state === 'unverified' ? 'No verified participant' : seat.state === 'different-seat' ? 'Map subject has no live entrance' : 'Unavailable';
  const [screen, setScreen] = useState<Screen | null>(null);
  const [views, setViews] = useState<Views | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [record, setRecord] = useState<{ which: 'current' | 'previous'; read: ConversationRecord } | null>(null);

  const readScreen = async (): Promise<void> => {
    if (!current) return;
    setBusy('screen');
    setScreen(await sources.readScreen(subject, current));
    setBusy(null);
  };
  const resolve = async (): Promise<void> => {
    if (!current) return;
    setBusy('views');
    setFocus(null);
    const resolved = await sources.resolveViews(subject, current);
    setViews(resolved);
    setBusy(null);
    const exact = resolved.state === 'unavailable' ? [] : resolved.views.filter((view) => view.exact);
    if (exact.length === 1 && resolved.state !== 'unavailable' && resolved.views.length === 1) await show(exact[0]!.witness);
  };
  const show = async (witness: HerdrViewWitness): Promise<void> => {
    if (!current) return;
    setBusy('focus');
    setFocus(await sources.showView(subject, current, witness));
    setBusy(null);
  };
  const returnToPrevious = async (previous: HerdrViewWitness): Promise<void> => {
    setBusy('return');
    const result = await sources.returnToView(subject.sourceKey, previous);
    setFocus(result.state === 'unavailable' ? result : { ...result, previous: null });
    setBusy(null);
  };
  const locate = async (which: 'current' | 'previous'): Promise<void> => {
    const participant = which === 'current' && current?.participant
      ? { runtime: current.participant.runtime === 'codex' ? 'codex' as const : 'claude-code' as const, conversationId: current.participant.conversationId, cwd: current.cwd }
      : subject.participant ? { runtime: subject.participant.runtime, conversationId: subject.participant.conversationId, cwd: subject.participant.cwd ?? current?.cwd ?? null } : null;
    if (!participant) return;
    setBusy('record');
    setRecord({ which, read: await sources.locateRecord(subject.sourceKey, participant) });
    setBusy(null);
  };
  const openRecord = async (path: string): Promise<void> => {
    try { await sources.openFile(path); } catch (error) { new Notice(error instanceof Error ? error.message : 'The record could not be opened.'); }
  };

  const changed = Boolean(current?.participant && subject.participant && current.participant.conversationId !== subject.participant.conversationId);
  const screenLines = screen?.state === 'current' ? screen.content.split('\n').slice(-SCREEN_LINES).join('\n') : '';
  const candidates = views && views.state !== 'unavailable' ? views.views : [];
  const unavailable = views && views.state !== 'unavailable' ? views.unavailable : [];
  return <section className="agent-link-section" aria-label="Conversation">
    <h4>Conversation</h4>
    <RouteRow label="Read screen" onPress={() => { void readScreen(); }} disabledReason={liveReason ?? (busy === 'screen' ? 'Reading…' : null)}
      detail={screen?.state === 'current' ? `last ${SCREEN_LINES} · ${clock(screen.capturedAt)}${screen.scope === 'seat-screen' ? ' · seat screen' : ''}` : screen?.state === 'unavailable' ? `Unavailable: ${screen.message}` : `last ${SCREEN_LINES}`}
      route={screenRoute(address)} tone={screen?.state === 'unavailable' ? 'unavailable' : undefined}>
      {screen?.state === 'current' && <pre className="agent-link-screen">{screenLines}</pre>}
    </RouteRow>
    <RouteRow label="Show in Herdr" onPress={() => { void resolve(); }} disabledReason={liveReason ?? (busy === 'views' || busy === 'focus' ? 'Resolving…' : null)}
      detail={views ? views.state === 'unavailable' ? `Unavailable: ${views.message}` : candidates.length === 0 ? 'Not open in Herdr' : candidates.length > 1 ? `Unclear: ${candidates.length} views` : viewLabel(candidates[0]!) : 'moves the shared Herdr view'}
      route={candidates[0] ? paneFocusRoute(candidates[0].witness.socketPath, candidates[0].witness.pane.pane_id) : null}
      tone={views?.state === 'unavailable' ? 'unavailable' : views && candidates.length !== 1 ? 'changed' : undefined}>
      {views && views.state !== 'unavailable' && candidates.length > 1 && <div className="agent-link-list">
        {candidates.map((view) => <Button key={view.witness.pane.pane_id} variant="secondary" onClick={() => { void show(view.witness); }}>{viewLabel(view)}</Button>)}
      </div>}
      {views && views.state !== 'unavailable' && candidates.length === 1 && !candidates[0]!.exact && <Button variant="secondary" onClick={() => { void show(candidates[0]!.witness); }}>Open session view</Button>}
      {views && views.state !== 'unavailable' && <p className="agent-link-muted">Scope: {views.scope === 'conversation' ? 'exact conversation' : 'seat process; conversation not qualified'}{unavailable.length ? ` · ${unavailable.length} source${unavailable.length === 1 ? '' : 's'} unavailable` : ''}</p>}
      {focus && (focus.state === 'unavailable'
        ? <p className="agent-link-muted agent-link-row--unavailable">{focus.message}</p>
        : <>
          <p className={focus.status === 'focused' ? 'agent-link-muted' : 'agent-link-muted agent-link-row--changed'}>{focus.status === 'focused' ? 'Herdr shows this view. Switch to Herdr to see it.' : focus.message}</p>
          {focus.previous && <Button variant="secondary" disabled={busy === 'return'} onClick={() => { void returnToPrevious(focus.previous!); }}>Return to previous view · {focus.previous.label}</Button>}
        </>)}
    </RouteRow>
    {(subject.participant || current?.participant) && <RouteRow label={changed ? 'Current conversation record' : 'Conversation record'} onPress={() => { void locate('current'); }}
      disabledReason={current?.participant ? null : subject.participant && !changed ? null : 'No current conversation'}
      detail={current?.participant ? `${short(current.participant.conversationId)}… · growing record` : subject.participant ? `${short(subject.participant.conversationId)}… · growing record` : ''}
      route={record?.which === 'current' && record.read.state === 'current' ? recordRoute(record.read.record.path) : null}>
      {record?.which === 'current' && <RecordDetail read={record.read} onOpen={openRecord} />}
    </RouteRow>}
    {changed && subject.participant && <RouteRow label="Previous conversation record" onPress={() => { void locate('previous'); }} detail={`${short(subject.participant.conversationId)}… · map's conversation`}
      route={record?.which === 'previous' && record.read.state === 'current' ? recordRoute(record.read.record.path) : null}>
      {record?.which === 'previous' && <RecordDetail read={record.read} onOpen={openRecord} />}
    </RouteRow>}
  </section>;
}

function RecordDetail({ read, onOpen }: { read: ConversationRecord; onOpen: (path: string) => Promise<void> }): React.ReactElement {
  if (read.state === 'unavailable') return <p className="agent-link-muted agent-link-row--unavailable">{read.message}</p>;
  const { record } = read;
  return <div className="agent-link-list">
    <p className="agent-link-muted">Exact provider record · {record.validatedRecords} record{record.validatedRecords === 1 ? '' : 's'} checked · {Math.round(record.fileSizeBytes / 1024)} KB{record.complete ? '' : ' and growing'} · {clock(read.observedAt)}</p>
    <Button variant="secondary" onClick={() => { void onOpen(record.path); }}>Open record</Button>
  </div>;
}
