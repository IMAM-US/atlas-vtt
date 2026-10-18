import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { foundationRecording as recording } from '../../src/app/agent-workspace/foundationRecording';
import type { WorkspaceSelection } from '../../src/app/agent-workspace/recordingTypes';
import { RecordedWorkspace } from '../../src/app/agent-workspace/RecordedWorkspace';
import { RecordedWorkspaceDetails } from '../../src/app/agent-workspace/RecordedWorkspaceDetails';
import { workspaceItemSummary } from '../../src/app/agent-workspace/workspacePresentation';
import { preferredRecordedObjectId, recordedSceneBindings, selectedRecordedReference } from '../../src/app/agent-workspace/recordedSceneBindings';
import { TooltipProvider } from '../../src/app/packages/components/primitives/tooltip';

afterEach(cleanup);
const availableSelections: WorkspaceSelection[] = [
  ...recording.seats.map(item => ({ kind: 'seat' as const, id: item.id })),
  ...recording.work.map(item => ({ kind: 'work' as const, id: item.id })),
  ...recording.artifacts.map(item => ({ kind: 'artifact' as const, id: item.id })),
];
function Harness(): React.ReactElement {
  const [selection, setSelection] = useState<WorkspaceSelection | null>({ kind: 'work', id: recording.work[0]!.id });
  return <TooltipProvider><RecordedWorkspace recording={recording} selection={selection} availableSelections={availableSelections} onSelect={setSelection} /></TooltipProvider>;
}
function openReferences(): void {
  if (!screen.queryByRole('combobox')) fireEvent.click(screen.getByRole('button', { name: 'Recorded evidence' }));
  fireEvent.click(screen.getByText('Recorded references in this scene'));
}

describe('recorded evidence over an editable Atlas scene', () => {
  it('defaults to final acceptance and offers viewing controls without operational actions', () => {
    render(<Harness />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(recording.checkpoints.at(-1)!.id);
    expect(screen.getByText('OpenRig recording · Not live')).toBeTruthy();
    expect(screen.getByText(/Authored scene; recorded operations/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /assign|handoff|resume/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse recorded evidence' }));
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recorded evidence' }));
    expect(screen.getByRole('combobox')).toBeTruthy();
  });
  it('keeps native selected reference when its work does not yet exist at an earlier checkpoint', () => {
    render(<Harness />); openReferences();
    fireEvent.click(screen.getByRole('button', { name: /Review continuity addendum/ }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: recording.checkpoints[0]!.id } });
    expect(screen.getByRole('status').textContent).toBe('Not recorded at this checkpoint.');
    expect(within(screen.getByRole('complementary')).getByRole('heading').textContent).toContain('Review continuity addendum');
    expect(screen.getByRole('button', { name: /Review continuity addendum/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('Original revision SHA-256')).toBeNull();
  });
  it('checkpoint changes are local evidence browsing and do not call native selection or mutate source', () => {
    const onSelect = vi.fn();
    const before = JSON.stringify(recording);
    render(<TooltipProvider><RecordedWorkspace recording={recording} selection={{ kind: 'artifact', id: recording.artifacts[1]!.id }} availableSelections={availableSelections} onSelect={onSelect} /></TooltipProvider>);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: recording.checkpoints[0]!.id } });
    expect(onSelect).not.toHaveBeenCalled();
    expect(JSON.stringify(recording)).toBe(before);
    const inspector = within(screen.getByRole('complementary'));
    expect(inspector.getByRole('status').textContent).toBe('Not recorded at this checkpoint.');
    expect(inspector.queryByRole('link')).toBeNull();
    expect(inspector.queryByText(recording.artifacts[1]!.originalSha256)).toBeNull();
  });
  it('keeps Enter and Delete inside the evidence panel instead of map hotkeys', () => {
    const mapKeydown = vi.fn();
    window.addEventListener('keydown', mapKeydown);
    try {
      render(<Harness />);
      const controls = [screen.getByRole('combobox'), screen.getByRole('button', { name: 'Recorded evidence' }), screen.getByText('Identity and revision details')];
      for (const control of controls) {
        control.focus();
        fireEvent.keyDown(control, { key: 'Delete', bubbles: true });
        fireEvent.keyDown(control, { key: 'Enter', bubbles: true });
      }
      expect(mapKeydown).not.toHaveBeenCalled();
    } finally { window.removeEventListener('keydown', mapKeydown); }
  });
  it('shows authored labels separately from the canonical recorded identity', () => {
    render(<TooltipProvider><RecordedWorkspace recording={recording} selection={{ kind: 'work', id: recording.work[0]!.id }} authoredLabel="My revised workspace label" availableSelections={availableSelections} onSelect={vi.fn()} /></TooltipProvider>);
    expect(screen.getByText('Authored Atlas label')).toBeTruthy();
    expect(screen.getByText('My revised workspace label')).toBeTruthy();
    expect(within(screen.getByRole('complementary')).getByRole('heading', { name: 'Write operating brief' })).toBeTruthy();
  });
  it('preserves the selected representation when a token and text share one recording reference', () => {
    const selection = { kind: 'seat' as const, id: recording.seats[0]!.id };
    const bindings = [{ objectId: 'seat-token', selection }, { objectId: 'edited-label', selection }];
    expect(preferredRecordedObjectId(bindings, ['edited-label'], selection)).toBe('edited-label');
    expect(preferredRecordedObjectId(bindings, [], selection)).toBe('seat-token');
  });
  it('uses native object provenance and selection even after authored labels or positions change', () => {
    const selection = { kind: 'work' as const, id: recording.work[0]!.id };
    const object = { id: 'atlas-object', name: 'My renamed marker', x: 900, recordingReference: { ...selection, recordingId: recording.id, sourceRevision: recording.sourceRevision } };
    const bindings = recordedSceneBindings(recording, [object]);
    expect(recordedSceneBindings(recording, [{ id: 'ordinary-scene-object' }])).toEqual([]);
    expect(selectedRecordedReference(bindings, ['atlas-object'])).toEqual(selection);
    expect(recordedSceneBindings(recording, [{ ...object, name: 'Another name', x: 1 }])).toEqual(bindings);
    expect(recordedSceneBindings(recording, [{ ...object, recordingReference: { ...object.recordingReference, sourceRevision: 'another-revision' } }])).toEqual([]);
    expect(selectedRecordedReference(bindings, ['unrelated-note'])).toBeNull();
  });
  it('list selection asks Atlas to select an object without retaining a second selection', () => {
    const onSelect = vi.fn();
    render(<TooltipProvider><RecordedWorkspace recording={recording} selection={null} availableSelections={availableSelections} onSelect={onSelect} /></TooltipProvider>);
    openReferences(); fireEvent.click(screen.getByRole('button', { name: /Write operating brief/ }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'work', id: recording.work[0]!.id });
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByText('Select a referenced Atlas object to inspect its recorded facts.')).toBeTruthy();
  });
  it('shows claims separately from last occupant generations and exact original acceptance', () => {
    render(<Harness />);
    expect(screen.getByText('Claim generation')).toBeTruthy();
    expect(screen.getByText('Last recorded occupant generation')).toBeTruthy();
    openReferences(); fireEvent.click(screen.getByRole('button', { name: /^Operating brief/ }));
    const details = within(screen.getByRole('complementary'));
    expect(details.getByText(recording.artifacts[0]!.originalSha256)).toBeTruthy();
    expect(details.getByText(recording.artifacts[0]!.publishedSha256)).toBeTruthy();
    expect(details.getByText('Reviewer, Coordinator')).toBeTruthy();
    expect(details.getByText(/publication bytes may differ/)).toBeTruthy();
  });
  it('hides future hashes and acceptance links for a draft artifact', () => {
    const checkpoint = recording.checkpoints.find(item => item.artifacts.some(artifact => artifact.status === 'draft'))!;
    const draft = checkpoint.artifacts.find(item => item.status === 'draft')!;
    const artifact = recording.artifacts.find(item => item.id === draft.artifactId)!;
    render(<RecordedWorkspaceDetails recording={recording} checkpoint={checkpoint} selection={{ kind: 'artifact', id: artifact.id }} />);
    expect(screen.queryByText(artifact.originalSha256)).toBeNull();
    expect(screen.queryByText(artifact.publishedSha256)).toBeNull();
    expect(screen.queryByText('Acceptance scope')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/Draft at this checkpoint/)).toBeTruthy();
  });
  it('describes a delivered candidate without implying acceptance or exposing publication bytes', () => {
    const artifact = recording.artifacts[0]!;
    const checkpoint = { ...recording.checkpoints[0]!, artifacts: [{ artifactId: artifact.id, status: 'delivered' as const, acceptedBy: [], detail: 'Frozen candidate' }] };
    render(<RecordedWorkspaceDetails recording={recording} checkpoint={checkpoint} selection={{ kind: 'artifact', id: artifact.id }} />);
    expect(screen.getByText(artifact.originalSha256)).toBeTruthy();
    expect(screen.queryByText(artifact.publishedSha256)).toBeNull();
    expect(screen.getByText('Frozen candidate revision. No acceptance recorded at this checkpoint.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Open recorded reviewer verdict' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open separate coordinator acceptance' })).toBeNull();
  });
  it('provides separate publication, review, manifest and coordinator references after acceptance', () => {
    render(<Harness />); openReferences(); fireEvent.click(screen.getByRole('button', { name: /^Operating brief/ }));
    expect(screen.getByRole('link', { name: 'Open published artifact' }).getAttribute('href')).toBe(recording.artifacts[0]!.publishedUrl);
    expect(screen.getByRole('link', { name: 'Open original and publication digest manifest' }).getAttribute('href')).toBe(recording.manifestUrl);
    expect(screen.getByRole('link', { name: 'Open recorded reviewer verdict' }).getAttribute('href')).toBe(recording.reviewUrl);
    expect(screen.getByRole('link', { name: 'Open separate coordinator acceptance' }).getAttribute('href')).toBe(recording.coordinatorAcceptanceUrl);
  });
  it('does not expose a planned addendum as recorded artifact evidence on pending cold work', () => {
    const checkpoint = recording.checkpoints.find(item => item.id === 'cold-handoff')!;
    const observation = checkpoint.work.find(item => item.status === 'pending')!;
    render(<RecordedWorkspaceDetails recording={recording} checkpoint={checkpoint} selection={{ kind: 'work', id: observation.workId }} />);
    expect(screen.getByText('No artifact recorded yet')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(recording.artifacts[1]!.originalSha256)).toBeNull();
    expect(screen.getByText('Identity and revision details').closest('details')!.open).toBe(false);
  });
  it('uses readable lifecycle summaries and labels stopped identities historically', () => {
    const checkpoint = recording.checkpoints.at(-1)!;
    const seat = recording.seats[0]!;
    expect(workspaceItemSummary(recording, checkpoint, { kind: 'seat', id: seat.id }).status).toBe('Stopped · Recoverable');
    render(<RecordedWorkspaceDetails recording={recording} checkpoint={checkpoint} selection={{ kind: 'seat', id: seat.id }} />);
    expect(screen.getByText('Last recorded occupant generation')).toBeTruthy();
    expect(screen.queryByText('Current recorded occupant generation')).toBeNull();
  });
});

it('leads a selected agent card with supplied purpose and native context, with history secondary and honest opening instructions', () => {
  const seat = { ...recording.seats[0]!, purpose: 'Own Atlas scene integration.', nativeHarness: 'Codex CLI',
    repositoryPath: '/project/atlas', workingDirectory: '/project/atlas-worktree',
    repositoryUrl: 'https://example.com/atlas', projectBriefUrl: 'https://example.com/brief', openAgentInstructionsUrl: 'https://example.com/agent-guide' };
  const source = { ...recording, seats: [seat, ...recording.seats.slice(1)] };
  const onSelect = vi.fn();
  render(<TooltipProvider><RecordedWorkspace recording={source} selection={{ kind: 'seat', id: seat.id }}
    availableSelections={availableSelections} onSelect={onSelect} /></TooltipProvider>);
  const card = screen.getByRole('complementary');
  expect(within(card).getByRole('heading', { name: seat.label })).toBeTruthy();
  expect(within(card).getByText(seat.purpose)).toBeTruthy();
  expect(within(card).getByText(seat.nativeHarness)).toBeTruthy();
  expect(within(card).getByText(seat.model)).toBeTruthy();
  expect(within(card).getByText(seat.repositoryPath)).toBeTruthy();
  expect(within(card).getByText(seat.workingDirectory)).toBeTruthy();
  expect(within(card).getByRole('link', { name: 'Open repository source' }).getAttribute('href')).toBe(seat.repositoryUrl);
  expect(within(card).getByRole('link', { name: 'Open project brief' }).getAttribute('href')).toBe(seat.projectBriefUrl);
  expect(within(card).getByRole('link', { name: 'Open agent instructions' }).getAttribute('href')).toBe(seat.openAgentInstructionsUrl);
  expect(within(card).getByText('Direct opening from Atlas is not connected.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Open agent$/ })).toBeNull();
  expect(within(card).getByText('Recorded operations').closest('details')!.open).toBe(false);
  expect(screen.getByText('Historical checkpoints').closest('details')!.open).toBe(false);
  fireEvent.click(screen.getByText('Historical checkpoints'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: recording.checkpoints[0]!.id } });
  expect(within(card).getByRole('heading', { name: seat.label })).toBeTruthy();
  expect(within(card).getByText(seat.purpose)).toBeTruthy();
  expect(onSelect).not.toHaveBeenCalled();
});

it('does not invent agent entry links or native context when metadata was not recorded', () => {
  render(<RecordedWorkspaceDetails recording={recording} checkpoint={recording.checkpoints[0]!} selection={{ kind: 'seat', id: recording.seats[0]!.id }} />);
  expect(screen.queryByRole('link', { name: 'Open agent instructions' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Open repository source' })).toBeNull();
  expect(screen.getByText('Purpose not recorded.')).toBeTruthy();
});

it('links accepted work artifacts to their published documents and exact acceptance evidence', () => {
  const work = recording.work[0]!;
  const artifact = recording.artifacts.find(item => work.artifactIds.includes(item.id))!;
  const checkpoint = recording.checkpoints.at(-1)!;
  render(<RecordedWorkspaceDetails recording={recording} checkpoint={checkpoint} selection={{ kind: 'work', id: work.id }} />);
  expect(screen.getByRole('link', { name: `Open accepted artifact: ${artifact.title}` }).getAttribute('href')).toBe(artifact.publishedUrl);
  expect(screen.getByRole('link', { name: 'Open work acceptance evidence' }).getAttribute('href')).toBe(checkpoint.evidenceUrl);
  expect(screen.getByRole('link', { name: 'Open work artifact digest manifest' }).getAttribute('href')).toBe(recording.manifestUrl);
});

it.each(['absent', 'draft', 'delivered'] as const)('withholds future work publication links when artifact acceptance is %s', status => {
  const work = recording.work[0]!;
  const artifact = recording.artifacts.find(item => work.artifactIds.includes(item.id))!;
  const checkpoint = { ...recording.checkpoints.at(-1)!, artifacts: status === 'absent' ? [] : [{
    artifactId: artifact.id, status, acceptedBy: [], detail: 'No acceptance at this checkpoint.',
  }] };
  render(<RecordedWorkspaceDetails recording={recording} checkpoint={checkpoint} selection={{ kind: 'work', id: work.id }} />);
  expect(screen.queryByRole('link', { name: `Open accepted artifact: ${artifact.title}` })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Open work acceptance evidence' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Open work artifact digest manifest' })).toBeNull();
});
