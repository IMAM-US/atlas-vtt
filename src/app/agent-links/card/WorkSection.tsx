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
import { short } from './timeLabels';
import { WorkDetail } from './WorkDetail';
import type { Observation } from '../live/types';
import { freshnessLabel } from './freshnessLabels';
import { useFactChange } from './useFactChange';

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const rowCaption = (item: NativeObject): string =>
  text(item.summary) ?? (Array.isArray(item.tags) && item.tags.length ? item.tags.filter((tag): tag is string => typeof tag === 'string').join(', ') : null) ?? text(item.qitemId) ?? 'Work';

function liveState(item: NativeObject): string {
  const state = text(item.state) ?? 'unknown';
  if (state === 'done' && text(item.handedOffTo)) return 'handed off';
  if (state === 'blocked') return `waiting on ${short(text(item.blockedOn), 24)}`;
  return state;
}

/** *Now* rows are the seat's current native custody; *Map* rows are what this map represents. Neither replaces the other. */
export function WorkSection({ subject, owned, mapWork, liveMapWork, observation, mapObservations }: {
  subject: SeatSubject; owned: OwnedWork | null; mapWork: readonly AccountWork[]; liveMapWork: ReadonlyMap<string, Work>;
  observation?: Observation<OwnedWork> | undefined; mapObservations?: ReadonlyMap<string, Observation<Work>> | undefined;
}): React.ReactElement {
  const { loaded, sources, openSubject } = useCard();
  const [open, setOpen] = useState<{ qitemId: string; sourceKey: string } | null>(null);
  const routeSource = sources.source(subject.sourceKey);
  const address = subject.seat.sessionAddress ?? subject.seat.logicalId;
  const fresh = newWork(owned, mapWork, subject.sourceKey);
  const changed = useFactChange(owned?.state === 'current' ? JSON.stringify(owned.items.map((item) => [item.qitemId, item.state, item.blockedOn])) : null);
  const mapFreshness = new Map<string, Observation<Work>>();
  const quality = ['unavailable', 'refused', 'refreshing', 'last-known', 'read', 'live'];
  for (const fact of mapObservations?.values() ?? []) {
    const previous = mapFreshness.get(fact.sourceKey);
    if (!previous || quality.indexOf(fact.freshness) < quality.indexOf(previous.freshness)
      || (fact.freshness === previous.freshness && (fact.observedAt ?? '') < (previous.observedAt ?? ''))) mapFreshness.set(fact.sourceKey, fact);
  }
  const isOpen = (qitemId: string, sourceKey: string): boolean => open?.qitemId === qitemId && open.sourceKey === sourceKey;
  const toggle = (qitemId: string, sourceKey: string): void => setOpen((current) => (current?.qitemId === qitemId && current.sourceKey === sourceKey ? null : { qitemId, sourceKey }));
  /** An authored subject id is its own link; a native address resolves only within the work row's source. */
  const handoffLink = (sessionAddress: string | null, subjectId: string | undefined, sourceKey: string): React.ReactNode => {
    const target = subjectId ? subjectOf(loaded.account, subjectId) : sessionAddress ? seatBySessionAddress(loaded.account, sourceKey, sessionAddress) : null;
    if (!target) return sessionAddress ? `→ handed off to ${sessionAddress}` : null;
    return <Button variant="link" className="agent-link-inline" onClick={() => openSubject(target.id)}>→ handed off to {target.caption}</Button>;
  };
  return <section className={`agent-link-section${changed ? ' agent-link-work--changed' : ''}`} aria-label="Work">
    <h4>Work</h4>
    {observation && <p className="agent-link-muted">Current custody · {freshnessLabel(observation)}</p>}
    {[...mapFreshness].map(([sourceKey, fact]) => <p key={sourceKey} className="agent-link-muted">Map work{sourceKey !== subject.sourceKey ? ` (${sourceKey})` : ''} · {freshnessLabel(fact)}</p>)}
    {owned?.state === 'unavailable' && <p className="agent-link-muted agent-link-row--unavailable">Now: unavailable, {owned.message}</p>}
    {owned?.state === 'current' && fresh.length === 0 && <p className="agent-link-muted">{owned.truncated ? "No work beyond the map's in the rows shown." : "Now: no work beyond the map's"}</p>}
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
      const state = item ? liveState(item) : live?.state === 'unavailable' ? `on map: ${work.captured.state} · current unavailable` : `on map: ${work.captured.state} · checking…`;
      const handedTo = text(item?.handedOffTo) ?? work.captured.handedOffTo ?? null;
      return <RouteRow key={work.id} label="Map" onPress={() => toggle(work.qitemId, work.sourceKey)} detail={<>{work.caption} · {state}{work.review ? ' · review ✓' : ''}</>} route={workRoute(sources.source(work.sourceKey), work.qitemId)}>
        {handedTo && <p className="agent-link-muted">{handoffLink(handedTo, work.handedOffToSubjectId, work.sourceKey)}</p>}
        {isOpen(work.qitemId, work.sourceKey) && <WorkDetail sourceKey={work.sourceKey} qitemId={work.qitemId} authored={work} />}
      </RouteRow>;
    })}
    <RouteRow label="All current rows" detail={owned?.state === 'current' ? `${owned.items.length}${owned.truncated ? '+' : ''} owned` : ''} route={ownedWorkRoute(routeSource, address)} tone="muted" />
  </section>;
}
