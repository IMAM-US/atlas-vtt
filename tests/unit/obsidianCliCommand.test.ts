import { spawnSync } from 'child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildObsidianArgs,
  parseWrapperArgs,
  resolveObsidianCliBinary,
} = require('../../scripts/obsidian-cli.js');

const WRAPPER = require.resolve('../../scripts/obsidian-cli.js');

describe('obsidian cli command helper', () => {
  it('prefers the explicit OBSIDIAN_CLI_BIN when it exists', () => {
    const binary = resolveObsidianCliBinary({
      env: {
        OBSIDIAN_CLI_BIN: '/custom/bin/obsidian',
        HOME: '/Users/tester',
      },
      isExecutable: (candidate: string) => candidate === '/custom/bin/obsidian',
      commandExists: () => false,
    });

    expect(binary).toBe('/custom/bin/obsidian');
  });

  it('falls back to the user Applications bundle before the system Applications bundle', () => {
    const binary = resolveObsidianCliBinary({
      env: {
        HOME: '/Users/tester',
      },
      isExecutable: (candidate: string) =>
        candidate === '/Users/tester/Applications/Obsidian.app/Contents/MacOS/Obsidian',
      commandExists: () => false,
    });

    expect(binary).toBe('/Users/tester/Applications/Obsidian.app/Contents/MacOS/Obsidian');
  });

  it('falls back to the local obsidian shim before app bundle discovery', () => {
    const binary = resolveObsidianCliBinary({
      env: {
        HOME: '/Users/tester',
      },
      isExecutable: (candidate: string) => candidate === '/Users/tester/.local/bin/obsidian',
      commandExists: () => false,
    });

    expect(binary).toBe('/Users/tester/.local/bin/obsidian');
  });

  it('prefers the concrete local shim path before a PATH lookup', () => {
    const binary = resolveObsidianCliBinary({
      env: {
        HOME: '/Users/tester',
      },
      isExecutable: (candidate: string) => candidate === '/Users/tester/.local/bin/obsidian',
      commandExists: () => true,
    });

    expect(binary).toBe('/Users/tester/.local/bin/obsidian');
  });

  it('returns the plain obsidian command when it is already installed on PATH', () => {
    const binary = resolveObsidianCliBinary({
      env: {
        HOME: '/Users/tester',
      },
      isExecutable: () => false,
      commandExists: (command: string) => command === 'obsidian',
    });

    expect(binary).toBe('obsidian');
  });

  it('puts the vault option before the command', () => {
    expect(buildObsidianArgs('plugin:reload', ['id=atlas-vtt'], 'test-vault')).toEqual([
      'vault=test-vault',
      'plugin:reload',
      'id=atlas-vtt',
    ]);
  });

  it('moves a literal vault argument before the command and prefers it to the option', () => {
    expect(buildObsidianArgs('eval', ['vault=other-vault', 'code=1'], 'test-vault')).toEqual([
      'vault=other-vault',
      'eval',
      'code=1',
    ]);
    expect(buildObsidianArgs('vault=other-vault', ['eval', 'code=1'])).toEqual([
      'vault=other-vault',
      'eval',
      'code=1',
    ]);
  });

  it('leaves the command first when no vault is named', () => {
    expect(buildObsidianArgs('dev:errors', [], null)).toEqual(['dev:errors']);
  });

  it('refuses a call that names two vaults', () => {
    expect(() => buildObsidianArgs('eval', ['vault=a', 'vault=b', 'code=1'])).toThrow('Name one vault');
  });

  it('never takes a leading vault argument for the command', () => {
    const options = parseWrapperArgs(['vault=test-vault', 'eval', 'code=1'], {});

    expect(options.command).toBe('eval');
    expect(options.args).toEqual(['vault=test-vault', 'code=1']);
  });
});

describe('obsidian cli wrapper', () => {
  /** Runs the wrapper against a stand-in binary that prints its argv and writes to stderr. */
  function runWrapper(argv: string[], exitCode = 0): { status: number | null; stdout: string; stderr: string } {
    const dir = mkdtempSync(join(tmpdir(), 'obsidian-cli-test-'));
    try {
      const binary = join(dir, 'obsidian');
      writeFileSync(binary, [
        `#!${process.execPath}`,
        'process.stdout.write(JSON.stringify(process.argv.slice(2)));',
        "process.stderr.write('binary warning\\n');",
        `process.exitCode = ${exitCode};`,
      ].join('\n'));
      chmodSync(binary, 0o755);
      const result = spawnSync(process.execPath, [WRAPPER, '--obsidian-bin', binary, ...argv], {
        encoding: 'utf8',
        env: { ...process.env, OBSIDIAN_CLI_VAULT: '' },
      });
      return { status: result.status, stdout: result.stdout, stderr: result.stderr };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it.each([
    ['--vault option', ['--vault', 'test-vault', 'eval', 'code=1']],
    ['vault argument after the command', ['eval', 'vault=test-vault', 'code=1']],
    ['vault argument before the command', ['vault=test-vault', 'eval', 'code=1']],
  ])('sends the vault first with the %s', (_form, argv) => {
    const { status, stdout } = runWrapper(argv);

    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toEqual(['vault=test-vault', 'eval', 'code=1']);
  });

  it('passes the binary\'s stderr through when it succeeds and when it fails', () => {
    expect(runWrapper(['dev:errors']).stderr).toBe('binary warning\n');

    const failed = runWrapper(['dev:errors'], 3);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain('binary warning\n');
    expect(failed.stderr).toContain('exited with 3');
  });
});
