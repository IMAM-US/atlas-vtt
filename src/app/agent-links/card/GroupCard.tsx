import React, { useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import type { GroupSubject, SeatSubject } from '../account/accountSchema';
import { artifactsOf, seatOf, subjectOf } from '../account/accountQueries';
import type { HerdrViewWitness } from '../native/herdrViews';
import type { CurrentSeat, Focus } from '../reads';
import { ArtifactSection } from './ArtifactSection';
import { useCard } from './cardContext';
import { RouteRow } from './RouteRow';
import { SourcesSection } from './SourcesSection';
import { clock } from './timeLabels';
import { useActionSignal } from './useActionSignal';
import { useGroupReads, type MemberState } from './useGroupReads';
import { activityLabel, freshnessLabel } from './freshnessLabels';

function memberNow(subject: SeatSubject | null, state: MemberState | undefined): string {
  if (!subject || !state) return 'Refreshing…';
  const activity = activityLabel(subject, state.inventory);
  const processAvailable = state.seat?.state === 'current' && ['read', 'live', 'refreshing'].includes(state.process.freshness);
  const rows = processAvailable && state.owned?.state === 'current' ? `owns ${state.owned.items.length}${state.owned.truncated ? '+' : ''} row${state.owned.items.length === 1 ? '' : 's'}` : '';
  return [...new Set([activity, freshnessLabel(state.inventory, true), rows, freshnessLabel(state.work, true),
    freshnessLabel(state.process, true)].filter(Boolean))].join(' · ');
}

/** A group is a party marker: open it to see who is in it, then go to a member. It is never a sixth participant. */
export function GroupCard({ subject }: { subject: GroupSubject }): React.ReactElement {
  const { loaded, sources, openSubject } = useCard();
  const next = useActionSignal();
  const members = subject.members.map((member) => ({ member, seat: seatOf(loaded.account, member.subjectId) }));
  const convener = subject.convenerId ? subjectOf(loaded.account, subject.convenerId) : null;
  const reads = useGroupReads(members.flatMap(({ seat }) => seat ? [seat] : []));
  const states = reads.members;
  const [panelTab, setPanelTab] = useState<{ status: string; previous: HerdrViewWitness | null; sourceKey: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Derived at action time from the members' resolved views, never from a tab's name. */
  const showGroupTab = async (): Promise<void> => {
    const signal = next();
    setBusy(true);
    const resolved: Array<{ seat: SeatSubject; identity: CurrentSeat; witness: HerdrViewWitness }> = [];
    let reason: string | null = null;
    for (const { seat } of members) {
      if (!seat) { reason = 'A member is not in this account.'; break; }
      // The explicit action requalifies its participant; background group selectors stay process-only.
      const state = await sources.readSeat(seat, { signal });
      if (signal.aborted) return;
      if (state.state !== 'current') { reason = `${seat.caption}: ${state.message}`; break; }
      const views = await sources.resolveViews(seat, state, { signal });
      if (signal.aborted) return;
      const exact = views.state === 'unavailable' ? [] : views.views.filter((view) => view.exact);
      if (exact.length !== 1) { reason = `${seat.caption}: ${views.state === 'unavailable' ? views.message : exact.length ? 'several views' : 'no exact view'}`; break; }
      resolved.push({ seat, identity: state, witness: exact[0]!.witness });
    }
    const first = resolved[0];
    if (!reason && first && resolved.every(({ witness }) => witness.socketPath === first.witness.socketPath && witness.pane.tab_id === first.witness.pane.tab_id)) {
      const result: Focus = await sources.showView(first.seat, first.identity, first.witness, { signal });
      if (signal.aborted) return;
      setPanelTab(result.state === 'unavailable' ? { status: result.message, previous: null, sourceKey: first.seat.sourceKey }
        : { status: result.status === 'focused' ? `Herdr shows the tab with all ${resolved.length} members.` : result.message, previous: result.previous, sourceKey: first.seat.sourceKey });
    } else {
      setPanelTab({ status: reason ?? 'The members are not all in one Herdr tab.', previous: null, sourceKey: first?.seat.sourceKey ?? 'local' });
    }
    setBusy(false);
  };
  const returnToPrevious = async (): Promise<void> => {
    if (!panelTab?.previous) return;
    const signal = next();
    const result = await sources.returnToView(panelTab.sourceKey, panelTab.previous, { signal });
    if (signal.aborted) return;
    setPanelTab({ ...panelTab, status: result.state === 'unavailable' ? result.message : result.status === 'focused' ? 'Returned to the previous view.' : result.message, previous: null });
  };

  return <>
    <p className="agent-link-identity">{subject.purpose}{convener ? <> · convened by <Button variant="link" className="agent-link-inline" onClick={() => openSubject(convener.id)}>{convener.caption}</Button></> : ''}</p>
    <p className="agent-link-headline agent-link-headline--same">Members {subject.membership.basis}, captured {clock(subject.membership.observedAt)}</p>
    <section className="agent-link-section" aria-label="Members">
      <h4>Members</h4>
      {reads.error && <p className="agent-link-muted">Unavailable: {reads.error}</p>}
      {members.map(({ member, seat }) => <RouteRow key={member.subjectId} label={member.lens} onPress={seat ? () => openSubject(seat.id) : undefined}
        disabledReason={seat ? null : 'Not in this account'} detail={<>{seat?.seat.logicalId ?? member.subjectId}{member.summary ? ` · ${member.summary}` : ''} · {memberNow(seat, seat ? states.get(seat.id) : undefined)}</>} />)}
    </section>
    <section className="agent-link-section" aria-label="Group actions">
      <RouteRow label="Show group tab" onPress={() => { void showGroupTab(); }} disabledReason={busy ? 'Resolving…' : null} detail={panelTab?.status ?? `only when all ${members.length} members are in one tab`}>
        {panelTab?.previous && <Button variant="secondary" onClick={() => { void returnToPrevious(); }}>Return to previous view · {panelTab.previous.label}</Button>}
      </RouteRow>
      {convener && <RouteRow label={`${convener.caption} ▸`} onPress={() => openSubject(convener.id)} detail="consulting the group goes through the convener" />}
      {subject.earlierParticipation?.map((entry) => <RouteRow key={entry.caption} label="Earlier participation" detail={`${entry.caption} · ${entry.lenses.join(', ')} · ${entry.attribution}`} tone="muted" />)}
    </section>
    <ArtifactSection groups={[{ heading: 'group record', work: null, artifacts: artifactsOf(loaded.account, subject.artifactIds) }]} />
    <SourcesSection subject={subject} seat={null} connections={reads.connections} lastKnown={new Map([...states.values()].map((state) => [state.process.sourceKey, state.process.observedAt]))} />
  </>;
}
