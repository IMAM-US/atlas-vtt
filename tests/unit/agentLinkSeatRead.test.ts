// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { NativeHttpError } from '../../src/app/agent-links/native/httpRead';
import { readOpenRigNode, readOpenRigParticipant, readOpenRigProcess } from '../../src/app/agent-links/native/openRigRead';
import { readSeat } from '../../src/app/agent-links/sourceReads';
import { defaultSourceSettings } from '../../src/app/agent-links/sourceSettings';
import type { SeatSubject } from '../../src/app/agent-links/account/accountSchema';

vi.mock('../../src/app/agent-links/native/openRigRead', async (original) => ({ ...await original<typeof import('../../src/app/agent-links/native/openRigRead')>(),
  readOpenRigNode: vi.fn(), readOpenRigProcess: vi.fn(), readOpenRigParticipant: vi.fn(),
}));
const settings = { ...defaultSourceSettings('a'), openRigEndpoint: 'http://127.0.0.1:1', openRigHostId: 'host-a' };
const subject = { sourceKey: 'a', seat: { rigId: 'rig-a', nodeId: 'node-a', logicalId: 'team.builder' } } as SeatSubject;
const process = { runtime: 'codex', sessionName: 'builder@example', bindingId: 'binding-a', tmuxPane: '%1', processId: 10 };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readOpenRigNode).mockResolvedValue({ cwd: '/synthetic/work' });
  vi.mocked(readOpenRigProcess).mockResolvedValue({ process, node: {} });
});

it('keeps process-only background reads separate from the exact native record route', async () => {
  vi.mocked(readOpenRigParticipant).mockRejectedValue(new Error('Must not be requested'));
  expect(await readSeat(settings, subject, { includeParticipant: false })).toMatchObject({ state: 'current', process, participant: null, participantMessage: null });
  expect(readOpenRigParticipant).not.toHaveBeenCalled();
});

it('retains the process and bounded native refusal status, code and verbatim reason on the opening read', async () => {
  const reason = "The bound pane for 'builder@example' no longer matches its verified occupant.";
  vi.mocked(readOpenRigParticipant).mockRejectedValue(new NativeHttpError(409, 'record_identity_unverified', reason));
  expect(await readSeat(settings, subject, {})).toMatchObject({ state: 'current', process, participant: null,
    participantMessage: reason, participantRefusal: { status: 409, code: 'record_identity_unverified', reason } });
  expect(readOpenRigParticipant).toHaveBeenCalledTimes(1);
});

it('does not attach a participant read from a replacement process to the separately read process', async () => {
  vi.mocked(readOpenRigParticipant).mockResolvedValue({ node: {}, participant: { ...process, processId: 20, conversationId: 'other-conversation', recordGeneration: 'other-generation' } });
  expect(await readSeat(settings, subject, {})).toMatchObject({ state: 'current', process, participant: null,
    participantMessage: 'The seat process changed during the exact conversation read. Recheck the conversation.' });
});
