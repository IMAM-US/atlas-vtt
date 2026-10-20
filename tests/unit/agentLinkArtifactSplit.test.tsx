import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountArtifact } from '../../src/app/agent-links/account/accountSchema';
import { compareArtifact, type ArtifactFile, type ArtifactRead } from '../../src/app/agent-links/artifactReads';
import { ArtifactSection } from '../../src/app/agent-links/card/ArtifactSection';
import { CardContext, type CardContextValue } from '../../src/app/agent-links/card/cardContext';
import type { NativeSources } from '../../src/app/agent-links/NativeSources';
import { TooltipProvider } from '../../src/app/packages/components/primitives/tooltip';

afterEach(cleanup);

const artifact: AccountArtifact = {
  id: 'artifact:brief', caption: 'Build brief', sourceKey: 'local',
  working: { root: 'workspace', path: 'brief.md' },
  captured: { root: 'workspace', path: 'captured/brief.md', sha256: 'a'.repeat(64), capturedAt: '2026-01-01T10:00:00Z' },
  reviewed: { revision: 'c'.repeat(40) },
};

function file(source: ArtifactFile['source'], sha256: string, text: string): ArtifactFile {
  return { state: 'current', source, path: `/workspace/${source}/brief.md`, sha256, sizeBytes: text.length, text, checkout: null,
    label: source === 'working' ? 'Working file' : source === 'captured' ? 'As captured 10:00Z' : 'At review cccccccc', observedAt: '2026-01-01T11:00:00Z' };
}

/** The working file changed after capture and review; the captured copy and the reviewed revision keep the reviewed bytes. */
const changed: ArtifactRead = {
  artifact, observedAt: '2026-01-01T11:00:00Z',
  working: file('working', 'b'.repeat(64), 'changed working bytes'),
  captured: file('captured', 'a'.repeat(64), 'reviewed bytes'),
  reviewed: file('reviewed', 'a'.repeat(64), 'reviewed bytes'),
};
const same: ArtifactRead = { ...changed, working: file('working', 'a'.repeat(64), 'reviewed bytes') };

function renderSection(read: ArtifactRead): void {
  const sources = { inspectArtifact: vi.fn(async () => read) } as unknown as NativeSources;
  const value = { app: {}, sources, loaded: { account: { subjects: [] } }, openSubject: () => undefined } as unknown as CardContextValue;
  render(<TooltipProvider><CardContext.Provider value={value}>
    <ArtifactSection groups={[{ heading: 'map work', work: null, artifacts: [artifact] }]} />
  </CardContext.Provider></TooltipProvider>);
}

const rowOf = (label: string): HTMLElement => screen.getByRole('button', { name: label }).closest('.agent-link-row') as HTMLElement;
const detailOf = (label: string): string => within(rowOf(label)).getAllByText((_, element) => element?.classList.contains('agent-link-row__detail') ?? false)[0]!.textContent ?? '';

describe('artifact source comparison', () => {
  it('splits sources whose bytes differ and collapses equal ones', () => {
    expect(compareArtifact(changed)).toEqual({ kind: 'split', sources: ['working', 'captured', 'reviewed'], checkoutNote: null });
    expect(compareArtifact(same)).toEqual({ kind: 'equal', sources: ['working', 'captured', 'reviewed'], sha256: 'a'.repeat(64), checkoutNote: null });
  });

  it('renders changed working bytes as their own row, apart from the captured and reviewed bytes', async () => {
    renderSection(changed);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await act(async () => undefined);
    const artifactRow = screen.getByRole('button', { name: 'Check' }).closest('.agent-link-row') as HTMLElement;
    expect(artifactRow.classList.contains('agent-link-row--changed')).toBe(true);
    expect(detailOf('Check')).toContain('sources differ');
    expect(detailOf('Open working file')).toContain('bbbbbbbb');
    expect(detailOf('Open working file')).toContain('· changed');
    expect(detailOf('View as captured')).toContain('aaaaaaaa');
    expect(detailOf('View as captured')).not.toContain('changed');
    expect(detailOf('View at review')).toContain('aaaaaaaa');

    fireEvent.click(screen.getByRole('button', { name: 'View as captured' }));
    expect(within(rowOf('View as captured')).getByText('reviewed bytes')).toBeTruthy();
    expect(screen.queryByText('changed working bytes')).toBeNull();
  });

  it('renders equal bytes as one comparison without a changed mark', async () => {
    renderSection(same);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await act(async () => undefined);
    expect(detailOf('Check')).toContain('working file = as captured = at review, 1 file');
    expect(detailOf('Open working file')).not.toContain('changed');
    const artifactRow = screen.getByRole('button', { name: 'Check' }).closest('.agent-link-row') as HTMLElement;
    expect(artifactRow.classList.contains('agent-link-row--changed')).toBe(false);
  });
});
