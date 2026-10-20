// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, realpath, symlink } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import {
  confinedRoot, defaultSourceSettings, expandRoot, openRigConnectionOf, readAgentLinkSettings, viewConnectionsOf,
} from '../../src/app/agent-links/sourceSettings';
import { claudeRecordRelativePath } from '../../src/app/agent-links/native/providerRecordLocator';

describe('source settings', () => {
  it('reads stored settings field by field and falls back per field', () => {
    const read = readAgentLinkSettings({ sources: [{ key: 'local', openRigEndpoint: ' http://127.0.0.1:1 ', herdrSocketPaths: ['a', 7, ' b '], allowedRoots: 'not a list' }] });
    expect(read.sources).toEqual([{ ...defaultSourceSettings(), openRigEndpoint: 'http://127.0.0.1:1', herdrSocketPaths: ['a', 'b'] }]);
    expect(readAgentLinkSettings(undefined)).toEqual({ sources: [defaultSourceSettings()] });
    expect(readAgentLinkSettings({ sources: [] })).toEqual({ sources: [defaultSourceSettings()] });
  });

  it('confines artifact roots to the real paths of the allowed roots', async () => {
    const base = await realpath(await mkdtemp(join(tmpdir(), 'atlas-roots-')));
    await mkdir(join(base, 'allowed', 'inside'), { recursive: true });
    await mkdir(join(base, 'outside'), { recursive: true });
    await symlink(join(base, 'outside'), join(base, 'allowed', 'escape'));
    await symlink(join(base, 'allowed'), join(base, 'alias'));
    const source = { ...defaultSourceSettings(), allowedRoots: [join(base, 'allowed'), '/nonexistent-root'] };
    expect(await confinedRoot(source, join(base, 'allowed'))).toBe(join(base, 'allowed'));
    expect(await confinedRoot(source, join(base, 'allowed', 'inside'))).toBe(join(base, 'allowed', 'inside'));
    // A link inside an allowed root that points outside is outside.
    expect(await confinedRoot(source, join(base, 'allowed', 'escape'))).toBeNull();
    expect(await confinedRoot(source, join(base, 'allowed', 'escape', 'deeper'))).toBeNull();
    // A link to the allowed root reads at the real allowed path.
    expect(await confinedRoot(source, join(base, 'alias', 'inside'))).toBe(join(base, 'allowed', 'inside'));
    expect(await confinedRoot(source, join(base, 'allowed-other'))).toBeNull();
    expect(await confinedRoot(source, join(base, 'outside'))).toBeNull();
    expect(await confinedRoot(source, `${base}/allowed/../outside`)).toBeNull();
    expect(await confinedRoot(source, 'relative')).toBeNull();
    // An allowed root that is itself a link anchors at its real path.
    const linked = { ...defaultSourceSettings(), allowedRoots: [join(base, 'alias')] };
    expect(await confinedRoot(linked, join(base, 'allowed', 'inside'))).toBe(join(base, 'allowed', 'inside'));
    expect(expandRoot('~/x')).toBe(`${homedir()}/x`);
    expect(expandRoot('x')).toBe('');
  });

  it('builds connections only from complete local settings', () => {
    expect(openRigConnectionOf(defaultSourceSettings())).toBeNull();
    expect(viewConnectionsOf(defaultSourceSettings())).toBeNull();
    const source = { ...defaultSourceSettings(), openRigEndpoint: 'http://127.0.0.1:1', openRigHostId: 'host-one', openRigToken: 't',
      herdrSocketPaths: ['~/.config/herdr/herdr.sock'], tmuxSocketPath: '/tmp/tmux/default', tmuxExecutablePath: '/usr/bin/tmux' };
    expect(openRigConnectionOf(source)).toEqual({ endpoint: 'http://127.0.0.1:1', hostId: 'host-one', bearerToken: 't' });
    expect(viewConnectionsOf(source)).toEqual({ localHostId: 'host-one', herdrSocketPaths: [`${homedir()}/.config/herdr/herdr.sock`],
      tmux: [{ socketPath: '/tmp/tmux/default', executablePath: '/usr/bin/tmux' }] });
  });
});

describe('provider record locator', () => {
  it('derives the Claude Code record path from the working directory and conversation id', () => {
    expect(claudeRecordRelativePath('/Users/example/Project/repo', 'abc-123')).toBe('-Users-example-Project-repo/abc-123.jsonl');
    expect(() => claudeRecordRelativePath('relative', 'abc')).toThrow('absolute working directory');
    expect(() => claudeRecordRelativePath('/x', 'bad id')).toThrow('Invalid native conversation ID');
  });
});
