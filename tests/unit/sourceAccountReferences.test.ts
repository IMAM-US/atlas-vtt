// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { accountNotePaths, rewriteAccountNotePaths } from '../../src/app/agent-links/account/accountReferences';
import { exampleAccount } from '../fixtures/exampleAccount';

const moved = (path: string): string | null => (path === 'notes/builder.md' ? 'renamed/builder.md' : null);

describe('account note references', () => {
  it('lists only typed note paths of an account document', () => {
    expect(accountNotePaths(exampleAccount())).toEqual(['notes/builder.md']);
    expect(accountNotePaths({ format: 'other', subjects: [{ notePath: 'x.md' }] })).toEqual([]);
    expect(accountNotePaths('text')).toEqual([]);
  });

  it('rewrites typed note paths and nothing else, keeping bytes when nothing moved', () => {
    const account = exampleAccount();
    const text = JSON.stringify(account, null, 2) + '\n';
    const rewritten = rewriteAccountNotePaths(text, moved);
    const parsed = JSON.parse(rewritten) as ReturnType<typeof exampleAccount>;
    expect((parsed.subjects[0] as { notePath: string }).notePath).toBe('renamed/builder.md');
    expect(parsed.subjects[0]).toMatchObject({ seat: { nodeId: 'node-builder' }, participant: { conversationId: 'conversation-one' } });
    expect(parsed.artifacts[0]!.working).toEqual({ root: '/repo/example', path: 'briefs/one.md' });
    expect(rewritten.endsWith('\n')).toBe(true);
    expect(rewriteAccountNotePaths(text, () => null)).toBe(text);
  });

  it('never rewrites a native id or locator that happens to equal a moved path', () => {
    const account = exampleAccount();
    (account.subjects[0] as { seat: { nodeId: string } }).seat.nodeId = 'notes/builder.md';
    account.artifacts[0]!.working!.path = 'notes/builder.md';
    const text = JSON.stringify(account);
    const parsed = JSON.parse(rewriteAccountNotePaths(text, moved)) as ReturnType<typeof exampleAccount>;
    expect((parsed.subjects[0] as { seat: { nodeId: string } }).seat.nodeId).toBe('notes/builder.md');
    expect(parsed.artifacts[0]!.working!.path).toBe('notes/builder.md');
    expect((parsed.subjects[0] as { notePath: string }).notePath).toBe('renamed/builder.md');
  });

  it('follows a heading suffix and leaves non-account JSON alone', () => {
    const account = exampleAccount();
    (account.subjects[0] as { notePath: string }).notePath = 'notes/builder.md#Role';
    const parsed = JSON.parse(rewriteAccountNotePaths(JSON.stringify(account), moved)) as ReturnType<typeof exampleAccount>;
    expect((parsed.subjects[0] as { notePath: string }).notePath).toBe('renamed/builder.md#Role');
    const other = '{"format":"other","subjects":[{"notePath":"notes/builder.md"}]}';
    expect(rewriteAccountNotePaths(other, moved)).toBe(other);
    expect(rewriteAccountNotePaths('not json', moved)).toBe('not json');
  });
});
