import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import type { GroupSubject, SeatSubject } from '../account/accountSchema';
import { artifactsOf, seatOf, subjectOf } from '../account/accountQueries';
import type { HerdrViewWitness } from '../native/herdrViews';
import type { Focus, OwnedWork, SeatRead } from '../reads';
import { ArtifactSection } from './ArtifactSection';
import { useCard } from './cardContext';
import { RouteRow } from './RouteRow';
import { SourcesSection } from './SourcesSection';
import { clock } from './timeLabels';

interface MemberState { seat: SeatRead | null; owned: OwnedWork | null }

function memberNow(state: MemberState | undefined): string {
  if (!state?.seat) return 'checking…';
  if (state.seat.state !== 'current') return state.seat.state === 'different-seat' ? 'different seat now' : state.seat.state === 'unverified' ? 'not verified' : 'unavailable';
  const activity = state.seat.node.agentActivity;
  const word = typeof activity === 'object' && activity && 'state' in activity && typeof activity.state === 'string' ? activity.state.replace(/_/g, ' ') : 'live';
  const rows = state.owned?.state === 'current' ? `owns ${state.owned.items.length} row${state.owned.items.length === 1 ? '' : 's'}` : '';
  return [word, rows, clock(state.seat.observedAt)].filter(Boolean).join(' · ');
}

/** A group is a party marker: open it to see who is in it, then go to a member. It is never a sixth participant. */
export function GroupCard({ subject }: { subject: GroupSubject }): React.ReactElement {
  const { loaded, sources, openSubject } = useCard();
  const members = subject.members.map((member) => ({ member, seat: seatOf(loaded.account, member.subjectId) }));
  const convener = subject.convenerId ? subjectOf(loaded.account, subject.convenerId) : null;
  const [states, setStates] = useState<ReadonlyMap<string, MemberState>>(new Map());
  const [panelTab, setPanelTab] = useState<{ status: string; previous: HerdrViewWitness | null; sourceKey: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Members are fixed by the account, so they are read once per group, not per render.
  const latestMembers = useRef(members);
  latestMembers.current = members;
  useEffect(() => {
    const controller = new AbortController();
    setStates(new Map());
    for (const { seat } of latestMembers.current) {
      if (!seat) continue;
      const update = (patch: Partial<MemberState>): void => {
        if (controller.signal.aborted) return;
        setStates((current) => new Map(current).set(seat.id, { seat: null, owned: null, ...current.get(seat.id), ...patch }));
      };
      void sources.readSeat(seat, { signal: controller.signal }).then((result) => update({ seat: result }));
      void sources.readOwnedWork(seat, { signal: controller.signal }).then((result) => update({ owned: result }));
    }
    return () => controller.abort();
  }, [sources, subject.id]);

  /** Derived at action time from the members' resolved views, never from a tab's name. */
  const showPanelTab = async (): Promise<void> => {
    setBusy(true);
    const resolved: Array<{ seat: SeatSubject; witness: HerdrViewWitness }> = [];
    let reason: string | null = null;
    for (const { seat } of members) {
      const state = seat ? states.get(seat.id)?.seat : null;
      if (!seat || !state || state.state !== 'current') { reason = 'Not every member is live.'; break; }
      const views = await sources.resolveViews(seat, state);
      const exact = views.state === 'unavailable' ? [] : views.views.filter((view) => view.exact);
      if (exact.length !== 1) { reason = `${seat.caption}: ${views.state === 'unavailable' ? views.message : exact.length ? 'several views' : 'no exact view'}`; break; }
      resolved.push({ seat, witness: exact[0]!.witness });
    }
    const first = resolved[0];
    if (!reason && first && resolved.every(({ witness }) => witness.socketPath === first.witness.socketPath && witness.pane.tab_id === first.witness.pane.tab_id)) {
      const state = states.get(first.seat.id)?.seat;
      const result: Focus = state?.state === 'current' ? await sources.showView(first.seat, state, first.witness) : { state: 'unavailable', message: 'Member changed.', observedAt: '' };
      setPanelTab(result.state === 'unavailable' ? { status: result.message, previous: null, sourceKey: first.seat.sourceKey }
        : { status: result.status === 'focused' ? `Herdr shows the tab with all ${resolved.length} members.` : result.message, previous: result.previous, sourceKey: first.seat.sourceKey });
    } else {
      setPanelTab({ status: reason ?? 'The members are not all in one Herdr tab.', previous: null, sourceKey: first?.seat.sourceKey ?? 'local' });
    }
    setBusy(false);
  };
  const returnToPrevious = async (): Promise<void> => {
    if (!panelTab?.previous) return;
    const result = await sources.returnToView(panelTab.sourceKey, panelTab.previous);
    setPanelTab({ ...panelTab, status: result.state === 'unavailable' ? result.message : result.status === 'focused' ? 'Returned to the previous view.' : result.message, previous: null });
  };

  return <>
    <p className="agent-link-identity">{subject.purpose}{convener ? <> · convened by <Button variant="link" className="agent-link-inline" onClick={() => openSubject(convener.id)}>{convener.caption}</Button></> : ''}</p>
    <p className="agent-link-headline agent-link-headline--same">Members {subject.membership.basis}, captured {clock(subject.membership.observedAt)}</p>
    <section className="agent-link-section" aria-label="Members">
      <h4>Members</h4>
      {members.map(({ member, seat }) => <RouteRow key={member.subjectId} label={member.lens} onPress={seat ? () => openSubject(seat.id) : undefined}
        disabledReason={seat ? null : 'Not in this account'} detail={<>{seat?.caption ?? member.subjectId}{member.summary ? ` · ${member.summary}` : ''} · {memberNow(seat ? states.get(seat.id) : undefined)}</>} />)}
    </section>
    <section className="agent-link-section" aria-label="Group actions">
      <RouteRow label="Show Panel tab" onPress={() => { void showPanelTab(); }} disabledReason={busy ? 'Resolving…' : null} detail={panelTab?.status ?? 'only when every member is in one tab'}>
        {panelTab?.previous && <Button variant="secondary" onClick={() => { void returnToPrevious(); }}>Return to previous view · {panelTab.previous.label}</Button>}
      </RouteRow>
      {convener && <RouteRow label={`${convener.caption} ▸`} onPress={() => openSubject(convener.id)} detail="consulting the group goes through the convener" />}
      {subject.earlierParticipation?.map((entry) => <RouteRow key={entry.caption} label="Earlier participation" detail={`${entry.caption} · ${entry.lenses.join(', ')} · ${entry.attribution}`} tone="muted" />)}
    </section>
    <ArtifactSection groups={[{ heading: 'group record', work: null, artifacts: artifactsOf(loaded.account, subject.artifactIds) }]} />
    <SourcesSection subject={subject} seat={null} />
  </>;
}
