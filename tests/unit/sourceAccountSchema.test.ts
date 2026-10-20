// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateAccount } from '../../src/app/agent-links/account/accountValidation';
import { groupsContaining, mapWorkOf, seatBySessionAddress, workByQitem } from '../../src/app/agent-links/account/accountQueries';
import { exampleAccount } from '../fixtures/exampleAccount';

describe('validateAccount', () => {
  it('accepts the example account and keeps unknown fields on every record', () => {
    const raw = exampleAccount();
    (raw as Record<string, unknown>).futureField = { nested: true };
    (raw.subjects[0] as Record<string, unknown>).nativeExtra = 'kept';
    (raw.work[0] as Record<string, unknown>).evidenceRef = null;
    const account = validateAccount(raw);
    expect(account.futureField).toEqual({ nested: true });
    expect((account.subjects[0] as Record<string, unknown>).nativeExtra).toBe('kept');
    expect((account.work[0] as Record<string, unknown>).evidenceRef).toBeNull();
    expect(account.subjects.map((subject) => subject.kind)).toEqual(['seat', 'group', 'seat', 'seat', 'seat']);
  });

  it('rejects other formats and versions without guessing', () => {
    expect(() => validateAccount({ ...exampleAccount(), format: 'other' })).toThrow('account.format');
    expect(() => validateAccount({ ...exampleAccount(), version: 2 })).toThrow('cannot read other versions');
    expect(() => validateAccount('text')).toThrow('must be a JSON object');
  });

  it('names the failing field', () => {
    const missingNode = exampleAccount();
    delete (missingNode.subjects[0] as { seat: Record<string, unknown> }).seat.nodeId;
    expect(() => validateAccount(missingNode)).toThrow('account.subjects[0].seat.nodeId');
    const badTime = exampleAccount();
    badTime.capturedAt = 'yesterday';
    expect(() => validateAccount(badTime)).toThrow('account.capturedAt: must be an ISO 8601 time');
    const badPolicy = exampleAccount();
    (badPolicy.subjects[0] as Record<string, unknown>).policy = 'follow';
    expect(() => validateAccount(badPolicy)).toThrow('policy: must be one of current-seat, captured-conversation');
  });

  it('requires every reference to resolve inside the document', () => {
    const danglingWork = exampleAccount();
    (danglingWork.subjects[0] as { workIds: string[] }).workIds.push('work:missing');
    expect(() => validateAccount(danglingWork)).toThrow('unknown work work:missing');
    const danglingMember = exampleAccount();
    (danglingMember.subjects[1] as { members: { subjectId: string; lens: string }[] }).members.push({ subjectId: 'seat:nobody', lens: 'Ghost' });
    expect(() => validateAccount(danglingMember)).toThrow('unknown member seat:nobody');
    const danglingArtifact = exampleAccount();
    danglingArtifact.work[0]!.artifactIds.push('artifact:missing');
    expect(() => validateAccount(danglingArtifact)).toThrow('unknown artifact artifact:missing');
    const duplicate = exampleAccount();
    duplicate.artifacts.push({ ...duplicate.artifacts[0]! });
    expect(() => validateAccount(duplicate)).toThrow('duplicate id');
  });

  it('checks revisions, digests and locators', () => {
    const shortRevision = exampleAccount();
    (shortRevision.work[0]!.review as { revision: string }).revision = 'abc123';
    expect(() => validateAccount(shortRevision)).toThrow('must be a full commit id');
    const relativeRoot = exampleAccount();
    (relativeRoot.artifacts[0]!.working as { root: string }).root = 'repo';
    expect(() => validateAccount(relativeRoot)).toThrow('must be an absolute local directory');
    const badDigest = exampleAccount();
    (badDigest.artifacts[0]!.captured as { sha256: string }).sha256 = 'nope';
    expect(() => validateAccount(badDigest)).toThrow('must be a SHA-256 hex digest');
    const emptyArtifact = exampleAccount();
    emptyArtifact.artifacts.push({ id: 'artifact:empty', caption: 'Empty', sourceKey: 'local' });
    expect(() => validateAccount(emptyArtifact)).toThrow('must locate a working, captured or reviewed file');
  });
});

describe('account queries', () => {
  it('finds work, seats by address and the groups of a member', () => {
    const account = validateAccount(exampleAccount());
    const builder = account.subjects[0];
    if (builder.kind !== 'seat') throw new Error('expected a seat');
    expect(mapWorkOf(account, builder).map((entry) => entry.id)).toEqual(['work:build-one']);
    expect(workByQitem(account, 'local', 'qitem-build-one')?.id).toBe('work:build-one');
    expect(workByQitem(account, 'other-source', 'qitem-build-one')).toBeNull();
    expect(workByQitem(account, 'local', 'qitem-unknown')).toBeNull();
    expect(seatBySessionAddress(account, 'local', 'lead@example')?.id).toBe('seat:lead');
    expect(seatBySessionAddress(account, 'other-source', 'lead@example')).toBeNull();
    expect(groupsContaining(account, 'seat:panel-a').map((group) => group.id)).toEqual(['group:panel']);
    expect(groupsContaining(account, 'seat:builder')).toEqual([]);
  });
});
