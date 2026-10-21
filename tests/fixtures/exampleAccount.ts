import type { AccountDocument } from '../../src/app/agent-links/account/accountSchema';

/** A synthetic account with one builder seat, a two-member panel and the subjects they relate to. */
export function exampleAccount(): AccountDocument {
  return {
    format: 'atlas-source-account',
    version: 1,
    title: 'Example team',
    capturedAt: '2026-01-01T10:00:00Z',
    sources: [
      { id: 'roster', description: 'Roster read', observedAt: '2026-01-01T10:00:00Z', command: 'rig ps --nodes --json' },
    ],
    subjects: [
      {
        id: 'seat:builder', kind: 'seat', caption: 'team.builder', sourceKey: 'local',
        seat: { rigId: 'rig-one', nodeId: 'node-builder', logicalId: 'team.builder', rigName: 'example', sessionAddress: 'builder@example' },
        participant: { runtime: 'claude-code', conversationId: 'conversation-one', generation: 'generation-one', cwd: '/repo/example', observedAt: '2026-01-01T10:00:00Z' },
        policy: 'current-seat', workIds: ['work:build-one'], notePath: 'notes/builder.md', observedAt: '2026-01-01T10:00:00Z', sourceIds: ['roster'],
      },
      {
        id: 'group:panel', kind: 'group', caption: 'Panel (2)', purpose: 'Advises the lead, no vote',
        members: [{ subjectId: 'seat:panel-a', lens: 'Source', summary: 'grounding' }, { subjectId: 'seat:panel-b', lens: 'Dissent' }],
        convenerId: 'seat:lead', membership: { basis: 'per charter', observedAt: '2026-01-01T10:00:00Z' },
        artifactIds: ['artifact:charter'],
        earlierParticipation: [{ caption: 'Round one', lenses: ['Source'], attribution: 'earlier subagents, not these seats' }],
        observedAt: '2026-01-01T10:00:00Z',
      },
      { id: 'seat:panel-a', kind: 'seat', caption: 'panel.a', sourceKey: 'local', seat: { rigId: 'rig-one', nodeId: 'node-a', logicalId: 'panel.a' }, policy: 'current-seat', workIds: [], observedAt: '2026-01-01T10:00:00Z' },
      { id: 'seat:panel-b', kind: 'seat', caption: 'panel.b', sourceKey: 'local', seat: { rigId: 'rig-one', nodeId: 'node-b', logicalId: 'panel.b' }, policy: 'current-seat', workIds: [], observedAt: '2026-01-01T10:00:00Z' },
      { id: 'seat:lead', kind: 'seat', caption: 'team.lead', sourceKey: 'local', seat: { rigId: 'rig-one', nodeId: 'node-lead', logicalId: 'team.lead', sessionAddress: 'lead@example' }, policy: 'current-seat', workIds: [], observedAt: '2026-01-01T10:00:00Z' },
    ],
    work: [
      {
        id: 'work:build-one', caption: 'Build one', sourceKey: 'local', qitemId: 'qitem-build-one',
        captured: { state: 'in-progress', sourceSession: 'lead@example', destinationSession: 'builder@example', claimedAt: '2026-01-01T09:00:00Z', observedAt: '2026-01-01T10:00:00Z' },
        handedOffToSubjectId: 'seat:lead',
        review: { reviewerSubjectId: 'seat:lead', revision: 'a'.repeat(40), qitemId: 'qitem-review-one', summary: 'No blocking finding', observedAt: '2026-01-01T11:00:00Z' },
        artifactIds: ['artifact:brief'],
      },
    ],
    artifacts: [
      {
        id: 'artifact:brief', caption: 'Brief', sourceKey: 'local',
        working: { root: '/repo/example', path: 'briefs/one.md' },
        captured: { root: '/evidence', path: 'briefs/one.md', sha256: 'b'.repeat(64), capturedAt: '2026-01-01T10:05:00Z' },
        reviewed: { revision: 'a'.repeat(40) },
      },
      { id: 'artifact:charter', caption: 'Charter', sourceKey: 'local', working: { root: '/repo/example', path: 'panel/CHARTER.md' } },
    ],
  };
}
