import React, { useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import type { AccountSource, AccountSubject } from '../account/accountSchema';
import { nodeRoute } from '../nativeRoutes';
import type { SeatRead } from '../reads';
import { useCard } from './cardContext';
import { openVaultNote } from './openNote';
import { RouteRow } from './RouteRow';
import { clock } from './timeLabels';

/** The map note, the exact ids, the account's sources and each read's time: why the card says what it says. */
export function SourcesSection({ subject, seat }: { subject: AccountSubject; seat: SeatRead | null }): React.ReactElement {
  const { app, loaded, sources } = useCard();
  const [open, setOpen] = useState(false);
  const accountSources: AccountSource[] = loaded.account.sources.filter((source) => !subject.sourceIds || subject.sourceIds.includes(source.id));
  const routeSource = subject.kind === 'seat' ? sources.source(subject.sourceKey) : null;
  return <section className="agent-link-section" aria-label="Sources">
    <Button variant="ghost" className="agent-link-section__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <h4>Sources</h4><span className="agent-link-muted">{subject.notePath ? 'map note · ' : ''}{accountSources.length} read{accountSources.length === 1 ? '' : 's'} {open ? '▾' : '▸'}</span>
    </Button>
    {open && <>
      {subject.notePath && <RouteRow label="Open map note" onPress={() => openVaultNote(app, subject.notePath!)} detail={subject.notePath} />}
      <RouteRow label="Account" detail={`${loaded.path} · on map ${clock(loaded.account.capturedAt)} · ${loaded.sha256.slice(0, 8)}…`} tone="muted" />
      {subject.kind === 'seat' && <>
        <RouteRow label="Seat" detail={`rig ${subject.seat.rigId} · node ${subject.seat.nodeId}`} route={routeSource ? nodeRoute(routeSource, subject.seat) : null} tone="muted" />
        {subject.participant && <RouteRow label="Captured conversation" detail={`${subject.participant.runtime} ${subject.participant.conversationId}${subject.participant.generation ? ` · generation ${subject.participant.generation}` : ''} · ${clock(subject.participant.observedAt)}${subject.participant.evidence ? ` · ${subject.participant.evidence}` : ''}`} tone="muted" />}
        {seat?.state === 'current' && <RouteRow label="Now" detail={`${seat.participant ? `conversation ${seat.participant.conversationId}` : 'conversation not qualified'} · process ${seat.process.processId} in ${seat.process.tmuxPane} · ${clock(seat.observedAt)}${seat.participantMessage ? ` · ${seat.participantMessage}` : ''}`} tone="muted" />}
        {seat && seat.state !== 'current' && <RouteRow label="Now" detail={`${seat.state} · ${seat.message} · ${clock(seat.observedAt)}`} tone="muted" />}
      </>}
      {accountSources.map((source) => <RouteRow key={source.id} label={source.description} detail={clock(source.observedAt)} route={source.command ? { label: source.id, text: source.command } : null} tone="muted" />)}
    </>}
  </section>;
}
