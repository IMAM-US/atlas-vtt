// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { homedir } from 'os';
import {
  defaultSourceSettings, expandRoot, isAllowedRoot, openRigConnectionOf, readAgentLinkSettings, viewConnectionsOf,
} from '../../src/app/agent-links/sourceSettings';
import { claudeRecordRelativePath } from '../../src/app/agent-links/native/providerRecordLocator';

describe('source settings', () => {
  it('reads stored settings field by field and falls back per field', () => {
    const read = readAgentLinkSettings({ sources: [{ key: 'local', openRigEndpoint: ' http://127.0.0.1:1 ', herdrSocketPaths: ['a', 7, ' b '], allowedRoots: 'not a list' }] });
    expect(read.sources).toEqual([{ ...defaultSourceSettings(), openRigEndpoint: 'http://127.0.0.1:1', herdrSocketPaths: ['a', 'b'] }]);
    expect(readAgentLinkSettings(undefined)).toEqual({ sources: [defaultSourceSettings()] });
    expect(readAgentLinkSettings({ sources: [] })).toEqual({ sources: [defaultSourceSettings()] });
  });

  it('confines artifact roots to the allowed roots', () => {
    const source = { ...defaultSourceSettings(), allowedRoots: ['~/Project/example', '/evidence'] };
    expect(isAllowedRoot(source, `${homedir()}/Project/example`)).toBe(true);
    expect(isAllowedRoot(source, `${homedir()}/Project/example/sub`)).toBe(true);
    expect(isAllowedRoot(source, `${homedir()}/Project/example-other`)).toBe(false);
    expect(isAllowedRoot(source, '/evidence/../etc')).toBe(false);
    expect(isAllowedRoot(source, 'relative')).toBe(false);
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
