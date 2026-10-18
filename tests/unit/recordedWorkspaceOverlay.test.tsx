import React from 'react';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { ViewAtlasStore } from '../../src/app/storeFactory';
import { ViewStoreProvider } from '../../src/app/react/ViewStoreContext';
import { RecordedWorkspaceOverlay } from '../../src/app/agent-workspace/RecordedWorkspaceOverlay';
import { foundationRecording as recording } from '../../src/app/agent-workspace/foundationRecording';
import { TooltipProvider } from '../../src/app/packages/components/primitives/tooltip';
vi.mock('../../src/app/agent-workspace/workspaceRecordings', async () => {
  const { foundationRecording } = await import('../../src/app/agent-workspace/foundationRecording');
  return { workspaceRecordings: [foundationRecording, {
    ...foundationRecording, id: 'test-second-capture', sourceRevision: 'test-second-revision',
    checkpoints: foundationRecording.checkpoints.map(checkpoint => ({ ...checkpoint, id: `second-${checkpoint.id}` })),
  }] };
});
afterEach(cleanup);
it('contains drag subscriptions in the overlay and follows native selection and authored text', () => {
  const reference = { recordingId: recording.id, sourceRevision: recording.sourceRevision, kind: 'seat' as const, id: recording.seats[0]!.id };
  const store = createStore(() => ({
    objects: { tokens: { token: { id: 'token', kind: 'token', x: 20, y: 20, imagePath: 'seat.png', recordingReference: reference } },
      texts: { label: { id: 'label', kind: 'text', text: 'My authored seat', x: 20, y: 10, recordingReference: reference } } },
    selectedIds: ['label'],
    setSelection: (selectedIds: string[]) => store.setState({ selectedIds }),
  }));
  let parentRenders = 0;
  function Parent(): React.ReactElement { parentRenders++; return <RecordedWorkspaceOverlay />; }
  render(<ViewStoreProvider store={store as unknown as ViewAtlasStore}><TooltipProvider><Parent /></TooltipProvider></ViewStoreProvider>);
  expect(screen.getByText('My authored seat')).toBeTruthy();
  act(() => store.setState(state => ({ objects: { ...state.objects, tokens: { token: { ...state.objects.tokens.token, x: 300 } } } })));
  expect(parentRenders).toBe(1);
  fireEvent.click(screen.getByText('Recorded references in this scene'));
  fireEvent.click(screen.getByRole('button', { name: /Study writer/ }));
  expect(store.getState().selectedIds).toEqual(['label']);
  act(() => store.setState(state => ({ objects: { ...state.objects, texts: { label: { ...state.objects.texts.label, text: 'Changed authored seat' } } } })));
  expect(screen.getByText('Changed authored seat')).toBeTruthy();
  expect(parentRenders).toBe(1);
});
it('does not render evidence in an ordinary scene without recording references', () => {
  const store = createStore(() => ({ objects: { tokens: {}, texts: {} }, selectedIds: [] }));
  render(<ViewStoreProvider store={store as unknown as ViewAtlasStore}><RecordedWorkspaceOverlay /></ViewStoreProvider>);
  expect(screen.queryByRole('region', { name: 'Recorded evidence' })).toBeNull();
});

it('follows a selected recording and resets inspector checkpoint state across captures', () => {
  const reference = { recordingId: recording.id, sourceRevision: recording.sourceRevision, kind: 'seat' as const, id: recording.seats[0]!.id };
  const store = createStore(() => ({
    objects: { tokens: {
      foundation: { id: 'foundation', kind: 'token', recordingReference: reference },
      second: { id: 'second', kind: 'token', recordingReference: { ...reference, recordingId: 'test-second-capture', sourceRevision: 'test-second-revision' } },
    }, texts: {} }, selectedIds: ['foundation'],
    setSelection: (selectedIds: string[]) => store.setState({ selectedIds }),
  }));
  render(<ViewStoreProvider store={store as unknown as ViewAtlasStore}><TooltipProvider><RecordedWorkspaceOverlay /></TooltipProvider></ViewStoreProvider>);
  fireEvent.click(screen.getByText('Historical checkpoints'));
  const firstCheckpoint = recording.checkpoints[0]!.id;
  fireEvent.change(screen.getByRole('combobox'), { target: { value: firstCheckpoint } });
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(firstCheckpoint);
  act(() => store.setState({ selectedIds: ['second'] }));
  fireEvent.click(screen.getByText('Historical checkpoints'));
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(`second-${recording.checkpoints.at(-1)!.id}`);
  expect(screen.getByText('test-second-revision')).toBeTruthy();
  act(() => store.setState({ selectedIds: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Recorded evidence' }));
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(recording.checkpoints.at(-1)!.id);
});
