import React, { useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import type { AccountWork, SeatSubject } from '../account/accountSchema';
import { seatBySessionAddress, subjectOf, workByQitem } from '../account/accountQueries';
import type { NativeObject } from '../native/openRigRead';
import { ownedWorkRoute, workRoute } from '../nativeRoutes';
import type { OwnedWork, Work } from '../reads';
import { newWork } from './cardHeadline';
import { useCard } from './cardContext';
import { RouteRow } from './RouteRow';
import { clock, short } from './timeLabels';
import { WorkDetail } from './WorkDetail';

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const rowCaption = (item: NativeObject): string =>
  text(item.summary) ?? (Array.isArray(item.tags) && item.tags.length ? item.tags.filter((tag): tag is string => typeof tag === 'string').join(', ') : null) ?? text(item.qitemId) ?? 'Work';

function liveState(item: NativeObject): string {
  const state = text(item.state) ?? 'unknown';
  if (state === 'done' && text(item.handedOffTo)) return `handed off ${clock(text(item.tsUpdated))}`;
  if (state === 'blocked') return `waiting on ${short(text(item.blockedOn), 24)}`;
  return `${state} ${clock(text(item.tsUpdated) ?? text(item.claimedAt))}`.trim();
}

/** *Now* rows are the seat's current native custody; *Map* rows are what this map represents. Neither replaces the other. */
export function WorkSection({ subject, owned, mapWork, liveMapWork }: {
  subject: SeatSubject; owned: OwnedWork | null; mapWork: readonly AccountWork[]; liveMapWork: ReadonlyMap<string, Work>;
}): React.ReactElement {
  const { loaded, sources, openSubject } = useCard();
  const [open, setOpen] = useState<{ qitemId: string; sourceKey: string } | null>(null);
  const routeSource = sources.source(subject.sourceKey);
  const address = subject.seat.sessionAddress ?? subject.seat.logicalId;
  const fresh = newWork(owned, mapWork, subject.sourceKey);
  const isOpen = (qitemId: string, sourceKey: string): boolean => open?.qitemId === qitemId && open.sourceKey === sourceKey;
  const toggle = (qitemId: string, sourceKey: string): void => setOpen((current) => (current?.qitemId === qitemId && current.sourceKey === sourceKey ? null : { qitemId, sourceKey }));
  const handoffLink = (sessionAddress: string | null, subjectId: string | undefined): React.ReactNode => {
    const target = subjectId ? subjectOf(loaded.account, subjectId) : sessionAddress ? seatBySessionAddress(loaded.account, subject.sourceKey, sessionAddress) : null;
    if (!target) return sessionAddress ? `→ handed off to ${sessionAddress}` : null;
    return <Button variant="link" className="agent-link-inline" onClick={() => openSubject(target.id)}>→ handed off to {target.caption}</Button>;
  };
  return <section className="agent-link-section" aria-label="Work">
    <h4>Work</h4>
    {owned?.state === 'unavailable' && <p className="agent-link-muted agent-link-row--unavailable">Now: unavailable, {owned.message}</p>}
    {owned?.state === 'current' && fresh.length === 0 && <p className="agent-link-muted">Now: no work beyond the map's · {clock(owned.observedAt)}</p>}
    {fresh.map((item) => {
      const qitemId = String(item.qitemId);
      const authored = workByQitem(loaded.account, subject.sourceKey, qitemId);
      return <RouteRow key={qitemId} label="Now" onPress={() => toggle(qitemId, subject.sourceKey)} detail={`${authored?.caption ?? rowCaption(item)} · ${liveState(item)}`} route={workRoute(routeSource, qitemId)} tone="changed">
        {isOpen(qitemId, subject.sourceKey) && <WorkDetail sourceKey={subject.sourceKey} qitemId={qitemId} authored={authored} />}
      </RouteRow>;
    })}
    {owned?.state === 'current' && owned.truncated && <p className="agent-link-muted">More rows than shown; use the native queue list.</p>}
    {mapWork.map((work) => {
      const live = liveMapWork.get(work.id) ?? null;
      const item = live?.state === 'current' ? live.item : null;
      const state = item ? liveState(item) : live?.state === 'unavailable' ? `on map: ${work.captured.state} ${clock(work.captured.observedAt)} · live unavailable` : `on map: ${work.captured.state} ${clock(work.captured.observedAt)} · checking…`;
      const handedTo = text(item?.handedOffTo) ?? work.captured.handedOffTo ?? null;
      return <RouteRow key={work.id} label="Map" onPress={() => toggle(work.qitemId, work.sourceKey)} detail={<>{work.caption} · {state}{work.review ? ' · review ✓' : ''}</>} route={workRoute(sources.source(work.sourceKey), work.qitemId)}>
        {handedTo && <p className="agent-link-muted">{handoffLink(handedTo, work.handedOffToSubjectId)}</p>}
        {isOpen(work.qitemId, work.sourceKey) && <WorkDetail sourceKey={work.sourceKey} qitemId={work.qitemId} authored={work} />}
      </RouteRow>;
    })}
    <RouteRow label="All current rows" detail={owned?.state === 'current' ? `${owned.items.length} owned · ${clock(owned.observedAt)}` : ''} route={ownedWorkRoute(routeSource, address)} tone="muted" />
  </section>;
}
