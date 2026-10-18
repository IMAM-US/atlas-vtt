import type { SeatObservation, WorkspaceRecording, WorkObservation } from './recordingTypes';

const revision = '63db591720e7881ab1b2205d4295bc6ba516295f';
const source = `https://github.com/fsafey/openrig/blob/${revision}/docs/reference/foundation/`;
const writer = '01M55ZB93K82YKSH2X6CNZ75M9';
const reviewer = '01M55ZB72R558J4978YNP8CEP0';
const q1 = 'foundation-pilot-20261017';
const q2 = 'qitem-20261017223014-3f9dc7ae';
const q3 = 'qitem-20261017224200-304449ee';
const q4 = 'qitem-20261017225006-9d4a1724';
const writerNative = '01a14bf5-ad30-7f82-a348-ff5d646feb23';
const coldNative = '01a14c0c-f515-7942-879a-eaf43e316575';
const initialWriterGeneration = '052caac6-cfef-4d05-b35b-5e9f6479ab93';
const resumedGeneration = 'e921a09d-5e34-4a2e-b4db-2441f3407929';
const freshReviewerGeneration = '0bb86a9e-620a-476f-8469-3dcfc75efb70';
const seat = (
  seatId: string, nativeConversationId: string | undefined, sessionId: string | undefined, generation: string | undefined,
  continuity: string, detail: string, status: SeatObservation['status'] = 'live',
): SeatObservation => ({ seatId, continuity, detail, status,
  ...(nativeConversationId === undefined ? {} : { nativeConversationId }),
  ...(sessionId === undefined ? {} : { sessionId }),
  ...(generation === undefined ? {} : { generation }),
});
const initialReviewer = seat(reviewer, '7454260b-e164-4e36-9f3e-f8d1abd2a60a',
  '01M55ZB74E0KAZWNH9Q7S4KDBH', 'ff3ff4af-2adb-4a15-ab4c-44ab8e54ce55',
  'Initial native conversation', 'Initial reviewer identity; no review obligation exists yet.');
const resumedWriter = seat(writer, writerNative, '01M55ZMCQZ01FGXY5093BN2TM1', resumedGeneration,
  'Native resume after interruption', 'Same seat and native conversation; new OpenRig session and generation.');
const freshReviewer = seat(reviewer, '6ed278a2-6ce3-42dd-9783-e4818e7b95d9',
  '01M5600B45R4QZC7J2ZW2Q0DCH', freshReviewerGeneration,
  'Fresh native conversation', 'Replacement discovered the existing handoff and reclaimed its released claim.');
const work = (
  workId: string, status: WorkObservation['status'], transition: number | undefined, detail: string,
  nextAction: string, claim?: { claimGeneration: string | null },
): WorkObservation => ({ workId, status, detail, nextAction, ...(transition === undefined ? {} : { transition }), ...claim });
const doneWriter = work(q1, 'done', 8, 'Handed off to reviewer; successor created atomically.',
  'Closed: review belongs to the successor.');
const doneReview = work(q2, 'done', undefined, 'Review closed with cold writer successor in the recorded 23-25 transition group; individual closure transition is not stated.',
  'Closed: correction and addendum belong to the successor.');
const acceptedBrief = {
  artifactId: 'operating-brief', status: 'accepted' as const, acceptedBy: ['Reviewer'],
  detail: 'Reviewer accepted the frozen original digest at the 22:41 verdict boundary; correction preserved its bytes.',
};

/** Historical read-only projection of the published foundation pilot evidence. */
function freezeRecording<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) freezeRecording(nested);
    Object.freeze(value);
  }
  return value;
}

export const foundationRecording: WorkspaceRecording = freezeRecording({
  id: 'openrig-foundation-20261017',
  title: 'Foundation pilot: recorded agent workspace',
  sourceRevision: revision,
  runtimeVersion: 'OpenRig 0.6.10 (installed build 3001cc436656c435e54425443e708e3e2d8c7d68)',
  evidenceUrl: `${source}evidence.md`,
  reviewUrl: `${source}artifacts/review.md`,
  coordinatorAcceptanceUrl: `${source}artifacts/coordinator-acceptance.md`,
  manifestUrl: `${source}artifacts/manifest.json`,
  seats: [
    { id: writer, label: 'Study writer', address: 'study-writer@foundation', model: 'gpt-6.1-sol' },
    { id: reviewer, label: 'Study reviewer', address: 'study-reviewer@foundation', model: 'claude-opus-5-5' },
  ],
  work: [
    { id: q1, title: 'Write operating brief', assignedSeatId: writer, artifactIds: ['operating-brief'] },
    { id: q2, title: 'Review frozen operating brief', assignedSeatId: reviewer, predecessorId: q1, artifactIds: ['operating-brief'] },
    { id: q3, title: 'Recover and write continuity addendum', assignedSeatId: writer, predecessorId: q2, artifactIds: ['continuity-addendum'] },
    { id: q4, title: 'Review continuity addendum', assignedSeatId: reviewer, predecessorId: q3, artifactIds: ['operating-brief', 'continuity-addendum'] },
  ],
  artifacts: [
    {
      id: 'operating-brief', title: 'Operating brief',
      originalSha256: 'a9fe0e563171f7ccaf9b226c7d98f88c6001138c232e2373b296dd7dc316c67a',
      publishedSha256: 'a5f266346a89ae4e3e68c9e5834b75ddd89621c22f121e0d67b6b4a60685b2f8',
      publishedUrl: `${source}artifacts/operating-brief.md`,
    },
    {
      id: 'continuity-addendum', title: 'Continuity addendum',
      originalSha256: '7b56658ce25abd6df1e2dc438d7325e4adf3ccabf9f80f9dfb70dc1c4773d0ba',
      publishedSha256: 'eb2e75c130aa28e772825af0067250913f14e4b9b5041247258b225c78fd8220',
      publishedUrl: `${source}artifacts/continuity-addendum.md`,
    },
  ],
  checkpoints: [
    {
      id: 'unfinished', label: 'Unfinished writer checkpoint', at: '2026-10-17 22:25 UTC (minute precision)',
      summary: 'Draft and checkpoint files exist. The writer intentionally leaves the obligation unfinished.',
      nextAction: 'Interrupt and recover the writer, then explicitly release the checkpoint.', evidenceUrl: `${source}evidence.md`,
      seats: [seat(writer, writerNative, '01M55ZB94NF7J8SNBX68PGHV0Z', initialWriterGeneration,
        'Initial native conversation', 'Work claimed at 22:24:42; draft remains unfinished.'), initialReviewer],
      work: [work(q1, 'in-progress', 2, 'Initial writer has read and claimed the obligation.',
        'Complete the checkpoint before review handoff.', { claimGeneration: initialWriterGeneration })],
      artifacts: [{ artifactId: 'operating-brief', status: 'draft', acceptedBy: [], detail: 'Real draft exists; no acceptance recorded.' }],
    },
    {
      id: 'resumed', label: 'Interrupted writer resumes', at: '2026-10-17 22:28 UTC (minute precision)',
      summary: 'The 22:26-22:27 interruption preserved work and artifact hashes. Native resume keeps the conversation ID.',
      nextAction: 'Finish the brief and hand it to the reviewer.', evidenceUrl: `${source}evidence.md`,
      seats: [resumedWriter, { ...initialReviewer, detail: 'Reviewer remained live during writer subset recovery; initial identity carried forward, not resampled here.' }],
      work: [work(q1, 'in-progress', 7, 'The surviving claim retains its initial generation stamp; it does not identify the current occupant.',
        'Complete and hand off the frozen brief.', { claimGeneration: initialWriterGeneration })],
      artifacts: [{ artifactId: 'operating-brief', status: 'draft', acceptedBy: [], detail: 'Resumed writer reads durable references and updates evidence. Review has not occurred.' }],
    },
    {
      id: 'reviewer-reclaimed', label: 'Fresh reviewer reclaims handoff', at: '2026-10-17 22:35:45 UTC',
      summary: 'Writer handed off at 22:30:14. Reviewer replacement at 22:34:02 released its old claim; fresh discovery precedes reclaim.',
      nextAction: 'Read the brief after explicit review release and record a verdict.', evidenceUrl: `${source}evidence.md`,
      seats: [{ ...resumedWriter, status: 'not-recorded', detail: 'Last recorded resumed identity carried forward; live status is not recorded at this checkpoint.' }, freshReviewer],
      work: [doneWriter, work(q2, 'in-progress', 18, 'Fresh reviewer claims under its new generation after startup discovery and hashing.',
        'Read the operating brief and supporting artifacts; issue verdict.', { claimGeneration: freshReviewerGeneration })],
      artifacts: [{ artifactId: 'operating-brief', status: 'delivered', acceptedBy: [], detail: 'Frozen candidate handed off; No content read is recorded at this checkpoint.' }],
    },
    {
      id: 'cold-handoff', label: 'Corrected cold handoff waits', at: '2026-10-17 22:47:42 UTC',
      summary: 'Reviewer accepted the brief, then corrected its lifecycle interpretation on the pending follow-on before writer recovery.',
      nextAction: 'Recover the stopped writer and discover its pending obligation through the queue.', evidenceUrl: `${source}evidence.md`,
      seats: [seat(writer, undefined, undefined, undefined, 'Stopped; historical sessions remain',
        'No active occupant is established at this checkpoint. Cold recovery has not happened.', 'stopped'), { ...freshReviewer, detail: 'Fresh reviewer identity carried forward from reclaim; reviewer authored the correction.' }],
      work: [doneWriter, doneReview, work(q3, 'pending', 26, 'Unclaimed obligation for stopped writer; no nudge attempt. Corrected handoff is authoritative.',
        'Discover correction, claim the obligation and author the addendum.', { claimGeneration: null })],
      artifacts: [acceptedBrief],
    },
    {
      id: 'review-closed', label: 'Final reviewer closes chain', at: '2026-10-17 22:50:47 UTC',
      summary: 'Cold recovery created a fresh writer conversation. Its startup queue read found the correction, and the addendum passed review.',
      nextAction: 'Verify explicit snapshot resume and obtain separate coordinator acceptance.', evidenceUrl: `${source}artifacts/review.md`,
      seats: [seat(writer, coldNative, '01M560SV2K76B3MQWM6J49JKM0', '7e72ca7a-a0a5-4000-91a0-b84d140877a1',
        'Last recorded occupant: fresh-primed cold recovery', 'Recovery completed at 22:48:07; fresh native conversation discovered and claimed Q3. Identity carried forward; lifecycle status after handoff is not recorded.', 'not-recorded'), { ...freshReviewer, detail: 'Reviewer identity carried forward from reclaim; final verdict is recorded.' }],
      work: [doneWriter, doneReview,
        work(q3, 'done', undefined, 'Addendum handed off at 22:50:06 in the recorded 28-29 transition group; individual closure transition is not stated.', 'Closed: final review owns the next step.'),
        work(q4, 'done', 32, 'Reviewer verified both digests and closed done/no-follow-on.', 'Closed: no successor obligation.')],
      artifacts: [acceptedBrief, { artifactId: 'continuity-addendum', status: 'accepted', acceptedBy: ['Reviewer'], detail: 'Original addendum digest verified and accepted in final review at 22:50.' }],
    },
    {
      id: 'accepted-stopped', label: 'Accepted and recoverable', at: '2026-10-17 22:52:49 UTC',
      summary: 'Coordinator acceptance was authored at 22:52:03.860823 UTC. All four rows are done; both seats are exited/recoverable with zero assigned or pending work.',
      nextAction: 'No pending action. Durable snapshots and authored artifacts remain available for recovery.', evidenceUrl: `${source}evidence.md`,
      seats: [{ ...seat(writer, coldNative, '01M560ZDB9K5X9YE0FDCZX3ESD', 'ef21e479-47ce-4171-8340-df4c8db42aa2',
        'Last recorded session: explicit snapshot resumed the same cold-recovery conversation', '22:51:13-22:51:22 native turn read an empty owned queue; later stopped with team snapshot.', 'stopped'), recoverable: true },
        { ...freshReviewer, status: 'stopped', recoverable: true, continuity: 'Last recorded occupant: fresh reviewer conversation', detail: 'Last recorded reviewer identity carried forward. Stopped with team snapshot 01M5611HZSFW4T2QKZ8MR5GTET; zero assigned or pending work.' }],
      work: [doneWriter, doneReview,
        work(q3, 'done', undefined, 'Addendum handed off in the recorded 28-29 transition group; individual closure transition is not stated.', 'Closed: successor review completed.'),
        work(q4, 'done', 32, 'Both accepted originals bound at final transition.', 'Closed: done/no-follow-on; coordinator acceptance is a separate record.')],
      artifacts: [
        { ...acceptedBrief, acceptedBy: ['Reviewer', 'Coordinator'], detail: 'Reviewer verdict and separate coordinator acceptance at 22:52:03.860823 UTC cover the original bytes; publication is sanitized.' },
        { artifactId: 'continuity-addendum', status: 'accepted', acceptedBy: ['Reviewer', 'Coordinator'], detail: 'Reviewer verdict and separate coordinator acceptance at 22:52:03.860823 UTC cover the original bytes; publication is sanitized.' },
      ],
    },
  ],
});
