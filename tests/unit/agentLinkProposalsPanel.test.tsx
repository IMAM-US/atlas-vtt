import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { SeatSubject } from '../../src/app/agent-links/account/accountSchema';
import type { ProposalsSnapshot } from '../../src/app/agent-links/mapmaking/MapmakingSession';
import { ProposalsPanel } from '../../src/app/agent-links/mapmaking/ProposalsPanel';
import { emptyProposals, type NotOnMap } from '../../src/app/agent-links/mapmaking/proposals';

afterEach(cleanup);
const lead = { id: 'seat:lead', kind: 'seat', caption: 'team.lead', sourceKey: 'local', seat: { rigId: 'rig-one', nodeId: 'node-lead', logicalId: 'team.lead' }, policy: 'current-seat', workIds: [], observedAt: '2026-01-01T10:00:00Z' } as SeatSubject;
const TEAM = JSON.stringify(['accounts/team.json', 'a'.repeat(64)]);
const row = (key: string, logicalId: string, reuse: SeatSubject | null = null): NotOnMap =>
  ({ key, node: { sourceKey: 'local', hostId: 'host-one', rigId: 'rig-one', nodeId: `node-${key}`, logicalId, podId: 'pod-team', rigName: 'example' }, reuse, pinnedEarlier: null });

function snapshot(change: Partial<ProposalsSnapshot> = {}): ProposalsSnapshot {
  const set = { ...emptyProposals({ kind: 'ready' }), notOnMap: [row('lead', 'team.lead', lead), row('new', 'team.new'), row('full', 'team.full')] };
  return { open: true, set, scope: ['example · inventory Live 12:06:00Z'], targets: ['accounts/team.json'], targetPath: 'accounts/team.json', basis: TEAM, layout: 'kept',
    placements: new Map([['lead', { x: 35, y: 35 }], ['new', { x: 175, y: 105 }], ['full', null]]), busy: false, status: null, ...change };
}
function panel(change: Partial<ProposalsSnapshot> = {}) {
  const props = { onPreview: vi.fn(), onApply: vi.fn(), onDismiss: vi.fn(), onChooseTarget: vi.fn(), onClose: vi.fn() };
  render(<ProposalsPanel snapshot={snapshot(change)} {...props} />);
  return props;
}

it('says what Apply will do, previews the chosen rows with their captions, and offers no cell it cannot use', () => {
  const props = panel();
  expect(screen.getByText('example · inventory Live 12:06:00Z')).toBeTruthy();
  expect((screen.getByLabelText('Add team.full') as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText(/No free space on the map/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Add team.lead'));
  expect(screen.getByRole('button', { name: 'Add 1 token (hidden)' })).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Add team.new'));
  fireEvent.change(screen.getByLabelText('Caption for team.new'), { target: { value: 'New builder' } });
  expect(props.onPreview).toHaveBeenLastCalledWith([{ key: 'lead', caption: 'team.lead' }, { key: 'new', caption: 'New builder' }]);
  fireEvent.click(screen.getByRole('button', { name: 'Add 2 tokens (hidden) · adds 1 seat to team.json' }));
  expect(props.onApply).toHaveBeenCalledWith([{ key: 'lead', caption: 'team.lead' }, { key: 'new', caption: 'New builder' }], null);
});

it('asks for a second press before an account in another layout is reformatted, and only when a seat is added', () => {
  const props = panel({ layout: 'reformat' });
  fireEvent.click(screen.getByLabelText('Add team.lead'));
  expect(screen.getByRole('button', { name: 'Add 1 token (hidden)' })).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Add team.new'));
  fireEvent.click(screen.getByRole('button', { name: 'Apply will reformat team.json once' }));
  expect(props.onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Add 2 tokens (hidden) · adds 1 seat to team.json' }));
  expect(props.onApply).toHaveBeenCalledWith(expect.any(Array), TEAM);
});

it('binds a consent to the account text it was given for, and waits while the layout is being checked', () => {
  const props = { onPreview: vi.fn(), onApply: vi.fn(), onDismiss: vi.fn(), onChooseTarget: vi.fn(), onClose: vi.fn() };
  const ui = render(<ProposalsPanel snapshot={snapshot({ layout: 'reformat' })} {...props} />);
  fireEvent.click(screen.getByLabelText('Add team.new'));
  fireEvent.click(screen.getByRole('button', { name: 'Apply will reformat team.json once' }));
  const other = JSON.stringify(['accounts/other.json', 'b'.repeat(64)]);
  ui.rerender(<ProposalsPanel snapshot={snapshot({ layout: 'reformat', targets: ['accounts/team.json', 'accounts/other.json'], targetPath: 'accounts/other.json', basis: other })} {...props} />);
  expect(screen.getByRole('button', { name: 'Apply will reformat other.json once' })).toBeTruthy();
  const edited = JSON.stringify(['accounts/team.json', 'c'.repeat(64)]);
  ui.rerender(<ProposalsPanel snapshot={snapshot({ layout: 'reformat', basis: edited })} {...props} />);
  expect(screen.getByRole('button', { name: 'Apply will reformat team.json once' })).toBeTruthy();
  ui.rerender(<ProposalsPanel snapshot={snapshot({ layout: 'checking', basis: edited })} {...props} />);
  expect((screen.getByRole('button', { name: 'Checking the layout of team.json…' }) as HTMLButtonElement).disabled).toBe(true);
  expect(props.onApply).not.toHaveBeenCalled();
});

it('asks which account new seats go to when the map uses several, and shows each outcome line', () => {
  const props = panel({ targets: ['accounts/other.json', 'accounts/team.json'], targetPath: null, status: 'Not applied: team.json changed since it was read.',
    set: emptyProposals({ kind: 'blocked', reason: 'Choose the account new seats are added to.' }) });
  expect(screen.getByText('Choose the account new seats are added to.')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('Not applied: team.json changed since it was read.');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'accounts/other.json' } });
  expect(props.onChooseTarget).toHaveBeenCalledWith('accounts/other.json');
});
