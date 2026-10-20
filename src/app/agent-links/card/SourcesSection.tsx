import React, { useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import type { AccountSource, AccountSubject } from '../account/accountSchema';
import { nodeRoute } from '../nativeRoutes';
import type { SeatRead } from '../reads';
import { useCard } from './cardContext';
import { openVaultNote } from './openNote';
import { RouteRow } from './RouteRow';
import { clock } from './timeLabels';
import type { SeatSnapshot } from '../live/SeatSubscription';
import type { ConnectionState, Observation } from '../live/types';
import { connectionLabel } from './freshnessLabels';

/** The map note, the exact ids, the account's sources and each read's time: why the card says what it says. */
export function SourcesSection({ subject, seat, snapshot, connections = snapshot?.connections, lastKnown }: {
  subject: AccountSubject; seat: SeatRead | null; snapshot?: SeatSnapshot | null;
  connections?: ReadonlyMap<string, ConnectionState>; lastKnown?: ReadonlyMap<string, string | null>;
}): React.ReactElement {
  const { app, loaded, sources } = useCard();
  const [open, setOpen] = useState(false);
  const accountSources: AccountSource[] = loaded.account.sources.filter((source) => !subject.sourceIds || subject.sourceIds.includes(source.id));
  const routeSource = subject.kind === 'seat' ? sources.source(subject.sourceKey) : null;
  const observations: readonly (readonly [string, Observation<unknown>])[] = snapshot
    ? [['Seat process', snapshot.process], ['Current custody', snapshot.owned], ['Activity', snapshot.inventory], ...snapshot.mapWork] : [];
  return <section className="agent-link-section" aria-label="Sources">
    <Button variant="ghost" className="agent-link-section__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <h4>Sources</h4><span className="agent-link-muted">{subject.notePath ? 'map note · ' : ''}{accountSources.length} read{accountSources.length === 1 ? '' : 's'} {open ? '▾' : '▸'}</span>
    </Button>
    {open && <>
      {[...connections ?? []].map(([key, connection]) => <p key={key} className="agent-link-muted">{connectionLabel(connections!.size > 1 ? `OpenRig (${key})` : 'OpenRig', connection,
        lastKnown?.get(key) ?? (subject.kind === 'seat' && key === subject.sourceKey ? snapshot?.process.observedAt ?? null : [...snapshot?.mapWork.values() ?? []].find((fact) => fact.sourceKey === key)?.observedAt ?? null))}</p>)}
      {snapshot?.herdr.map((view, index) => <p key={index} className="agent-link-muted">{connectionLabel(snapshot.herdr.length > 1 ? `Herdr ${index + 1}` : 'Herdr', view.connection, view.observation.observedAt, true)}</p>)}
      {observations.map(([label, fact]) => fact.refusal && <RouteRow key={label} label={`${label} refusal`} detail={`HTTP ${fact.refusal.status}${fact.refusal.code ? ` · ${fact.refusal.code}` : ''} · ${fact.refusal.reason ?? fact.message}`} tone="muted" />)}
      {subject.notePath && <RouteRow label="Open map note" onPress={() => openVaultNote(app, subject.notePath!)} detail={subject.notePath} />}
      <RouteRow label="Account" detail={`${loaded.path} · on map ${clock(loaded.account.capturedAt)} · ${loaded.sha256.slice(0, 8)}…`} tone="muted" />
      {subject.kind === 'seat' && <>
        <RouteRow label="Seat" detail={`rig ${subject.seat.rigId} · node ${subject.seat.nodeId}`} route={routeSource ? nodeRoute(routeSource, subject.seat) : null} tone="muted" />
        {subject.participant && <RouteRow label="Captured conversation" detail={`${subject.participant.runtime} ${subject.participant.conversationId}${subject.participant.generation ? ` · generation ${subject.participant.generation}` : ''} · ${clock(subject.participant.observedAt)}${subject.participant.evidence ? ` · ${subject.participant.evidence}` : ''}`} tone="muted" />}
        {seat?.state === 'current' && <RouteRow label="Now" detail={`${seat.participant ? `conversation ${seat.participant.conversationId}` : 'conversation not qualified'} · process ${seat.process.processId} in ${seat.process.tmuxPane} · ${clock(seat.observedAt)}${seat.participantMessage ? ` · ${seat.participantMessage}` : ''}`} tone="muted" />}
        {seat && seat.state !== 'current' && <RouteRow label="Now" detail={`${seat.state} · ${seat.message} · ${clock(seat.observedAt)}`} tone="muted" />}
        {[snapshot?.conversation.previous, snapshot?.conversation.value].map((read, index) => read && <RouteRow key={index} label="Exact observation" detail={`${read.state === 'current' ? read.participant ? `${read.participant.runtime} ${read.participant.conversationId}` : read.participantMessage ?? 'not confirmed' : read.message} · Read ${clock(read.observedAt)}${read === snapshot?.conversation.value && snapshot.conversation.applicable ? '' : ' · historical read'}`} tone="muted" />)}
        {snapshot?.conversation.value?.state === 'current' && snapshot.conversation.value.participantRefusal && <RouteRow label="Native refusal" detail={`HTTP ${snapshot.conversation.value.participantRefusal.status}${snapshot.conversation.value.participantRefusal.code ? ` · ${snapshot.conversation.value.participantRefusal.code}` : ''} · ${snapshot.conversation.value.participantRefusal.reason ?? snapshot.conversation.value.participantMessage}`} tone="muted" />}
      </>}
      {accountSources.map((source) => <RouteRow key={source.id} label={source.description} detail={clock(source.observedAt)} route={source.command ? { label: source.id, text: source.command } : null} tone="muted" />)}
    </>}
  </section>;
}
