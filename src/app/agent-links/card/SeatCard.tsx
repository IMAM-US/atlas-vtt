import React from 'react';
import { Button } from '../../packages/components/primitives/button';
import type { SeatSubject } from '../account/accountSchema';
import { artifactsOf, groupsContaining, mapWorkOf, workByQitem } from '../account/accountQueries';
import { ArtifactSection, type ArtifactGroup } from './ArtifactSection';
import { headlineOf, newWork } from './cardHeadline';
import { useCard } from './cardContext';
import { ConversationSection } from './ConversationSection';
import { SourcesSection } from './SourcesSection';
import { clock } from './timeLabels';
import { activityLabel, freshnessLabel } from './freshnessLabels';
import { useSeatReads } from './useSeatReads';
import { WorkSection } from './WorkSection';
import { useFactChange } from './useFactChange';

/** One seat: identity and freshness first, then the four kinds of route. */
export function SeatCard({ subject }: { subject: SeatSubject }): React.ReactElement {
  const { loaded, openSubject } = useCard();
  const mapWork = mapWorkOf(loaded.account, subject);
  const reads = useSeatReads(subject, mapWork);
  const activity = activityLabel(subject, reads.snapshot?.inventory);
  const activityChanged = useFactChange(reads.snapshot?.inventory.value ? activity ?? 'unknown' : null);
  const headline = headlineOf(subject, loaded.account.capturedAt, reads.seat, reads.owned, mapWork, reads.snapshot?.conversation);
  const runtime = reads.seat?.state === 'current' ? reads.seat.process.runtime : subject.participant?.runtime ?? '';
  const groups = groupsContaining(loaded.account, subject.id);
  const artifactGroups: ArtifactGroup[] = [
    ...newWork(reads.owned, mapWork, subject.sourceKey).flatMap((item) => {
      const authored = workByQitem(loaded.account, subject.sourceKey, String(item.qitemId));
      return authored ? [{ heading: 'current work', work: authored, artifacts: artifactsOf(loaded.account, authored.artifactIds) }] : [];
    }),
    ...mapWork.map((work) => ({ heading: 'map work', work, artifacts: artifactsOf(loaded.account, work.artifactIds) })),
  ];
  return <>
    <p className="agent-link-identity">{subject.seat.logicalId} · {subject.seat.rigName ?? subject.seat.rigId} · {runtime || 'runtime unknown'}</p>
    <p className={`agent-link-headline agent-link-headline--${headline.tone}`}>{headline.identity}</p>
    {headline.work && <p className="agent-link-headline agent-link-headline--changed">● {headline.work}</p>}
    <p className="agent-link-muted agent-link-reads">
      On map {clock(loaded.account.capturedAt)} · {freshnessLabel(reads.snapshot?.process)}
      <Button variant="ghost" size="sm" onClick={reads.refresh}>Refresh</Button>
      {groups.map((group) => <Button key={group.id} variant="ghost" size="sm" onClick={() => openSubject(group.id)}>in {group.caption}</Button>)}
    </p>
    <p className={`agent-link-muted${activityChanged ? ' agent-link-row--changed' : ''}`}>{reads.snapshot?.inventory.value ? activity ? `Activity: ${activity}` : 'Activity not confirmed' : 'Activity'} · {freshnessLabel(reads.snapshot?.inventory)}</p>
    <ConversationSection subject={subject} seat={reads.seat} conversation={reads.snapshot?.conversation} recheck={reads.recheckConversation} />
    <WorkSection subject={subject} owned={reads.owned} mapWork={mapWork} liveMapWork={reads.mapWork} observation={reads.snapshot?.owned} mapObservations={reads.snapshot?.mapWork} />
    <ArtifactSection groups={artifactGroups} />
    <SourcesSection subject={subject} seat={reads.seat} snapshot={reads.snapshot} />
  </>;
}
