import React, { useState } from 'react';
import { Notice } from 'obsidian';
import type { AccountArtifact, AccountWork } from '../account/accountSchema';
import { subjectOf } from '../account/accountQueries';
import { compareArtifact, type ArtifactFile, type ArtifactRead, type ArtifactSource } from '../artifactReads';
import { capturedFileRoute, reviewedFileRoute, workingFileRoute, type NativeRoute } from '../nativeRoutes';
import { useCard } from './cardContext';
import { RouteRow } from './RouteRow';
import { clock, short } from './timeLabels';

export interface ArtifactGroup { heading: string; work: AccountWork | null; artifacts: AccountArtifact[] }

const SOURCE_LABEL: Record<ArtifactFile['source'], string> = { working: 'Working file', captured: 'As captured', reviewed: 'At review' };

function routeFor(artifact: AccountArtifact, source: ArtifactFile['source']): NativeRoute | null {
  return source === 'working' ? workingFileRoute(artifact) : source === 'captured' ? capturedFileRoute(artifact) : reviewedFileRoute(artifact);
}

/** Artifacts grouped by the work they belong to: equal bytes collapse, differences split, and a review stays with its revision. */
export function ArtifactSection({ groups }: { groups: readonly ArtifactGroup[] }): React.ReactElement | null {
  if (!groups.some((group) => group.artifacts.length)) return null;
  return <section className="agent-link-section" aria-label="Artifacts">
    <h4>Artifacts</h4>
    {groups.flatMap((group) => group.artifacts.map((artifact) => <ArtifactRows key={`${group.heading}:${artifact.id}`} heading={group.heading} work={group.work} artifact={artifact} />))}
  </section>;
}

function ArtifactRows({ heading, work, artifact }: { heading: string; work: AccountWork | null; artifact: AccountArtifact }): React.ReactElement {
  const { sources, loaded } = useCard();
  const [read, setRead] = useState<ArtifactRead | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<ArtifactFile['source'] | null>(null);
  const sourceKey = work?.sourceKey ?? 'local';
  const inspect = async (): Promise<void> => {
    setBusy(true);
    setRead(await sources.inspectArtifact(sourceKey, artifact));
    setBusy(false);
  };
  const review = work?.review && artifact.reviewed && work.review.revision === artifact.reviewed.revision ? work.review : null;
  const reviewer = review?.reviewerSubjectId ? subjectOf(loaded.account, review.reviewerSubjectId) : null;
  const reviewNote = review ? `Review ✓ ${reviewer ? `by ${reviewer.caption} ` : ''}at ${short(review.revision)}` : null;
  const open = async (file: ArtifactFile): Promise<void> => {
    if (file.source !== 'working') { setViewing((current) => (current === file.source ? null : file.source)); return; }
    try { await sources.openFile(file.path); } catch (error) { new Notice(error instanceof Error ? error.message : 'The file could not be opened.'); }
  };
  const summary = (): string => {
    if (!read) return [artifact.working && 'working', artifact.captured && 'captured', artifact.reviewed && 'reviewed'].filter(Boolean).join(' · ');
    const comparison = compareArtifact(read);
    if (comparison.kind === 'none') return 'no source could be read';
    if (comparison.kind === 'equal') return `${comparison.sources.map((source) => SOURCE_LABEL[source].toLowerCase()).join(' = ')}, 1 file`;
    return 'sources differ';
  };
  const entries: Array<[ArtifactFile['source'], ArtifactSource | null]> = read ? [['working', read.working], ['captured', read.captured], ['reviewed', read.reviewed]] : [];
  const comparison = read ? compareArtifact(read) : null;
  return <RouteRow label={busy ? 'Inspecting…' : 'Inspect'} onPress={() => { void inspect(); }} disabledReason={busy ? 'Reading…' : null}
    detail={<>{artifact.caption} · {heading} · {summary()}</>} route={workingFileRoute(artifact) ?? capturedFileRoute(artifact) ?? reviewedFileRoute(artifact)}
    tone={comparison?.kind === 'split' ? 'changed' : undefined}>
    {comparison && comparison.kind !== 'none' && comparison.checkoutNote && <p className="agent-link-muted agent-link-row--changed">{comparison.kind === 'equal' ? 'Same bytes, different checkout. ' : ''}{comparison.checkoutNote}</p>}
    {entries.map(([source, file]) => file && <RouteRow key={source} label={file.state === 'current' ? (source === 'working' ? 'Open working file' : `View ${SOURCE_LABEL[source].toLowerCase()}`) : SOURCE_LABEL[source]}
      onPress={file.state === 'current' ? () => { void open(file); } : undefined}
      detail={file.state === 'current'
        ? <>{file.label} · {short(file.sha256)}… · {file.checkout ? `${file.checkout.branch ?? 'detached'} ${short(file.checkout.headCommit)}` : `${Math.round(file.sizeBytes / 1024)} KB`}{source === 'reviewed' && reviewNote ? ` · ${reviewNote}` : ''}{comparison?.kind === 'split' && source === 'working' ? ' · changed' : ''}</>
        : `${file.state === 'unavailable' ? 'Unavailable' : ''}: ${file.message}`}
      route={routeFor(artifact, source)} tone={file.state === 'unavailable' ? 'unavailable' : undefined}>
      {viewing === source && file.state === 'current' && (file.text !== null ? <pre className="agent-link-body">{file.text}</pre> : <p className="agent-link-muted">Not text, or too large to show here.</p>)}
    </RouteRow>)}
    {read && <p className="agent-link-muted">Read {clock(read.observedAt)}{reviewNote && comparison?.kind === 'equal' ? ` · ${reviewNote} (the reviewed bytes only)` : ''}</p>}
  </RouteRow>;
}
