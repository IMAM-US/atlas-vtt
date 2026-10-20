// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { appendFile, mkdir, mkdtemp, rename, rm, truncate, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { readRecordWindow, type RecordPin } from '../../src/app/agent-links/native/recordWindow';
import { recordPage } from '../../src/app/agent-links/records/recordPage';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const CONVERSATION = 'conversation-example-1';
const CWD = '/work/example';

/** A synthetic Claude Code record below a temporary projects root, at the path the locator derives. */
async function claudeRecord(lines: string[]): Promise<{ roots: { claudeProjectsRoot: string; codexSessionsRoot: string }; file: string }> {
  const root = await mkdtemp(join(tmpdir(), 'atlas-record-window-'));
  roots.push(root);
  const projects = join(root, 'projects');
  const sessions = join(root, 'sessions');
  await mkdir(join(projects, '-work-example'), { recursive: true });
  await mkdir(sessions, { recursive: true });
  const file = join(projects, '-work-example', `${CONVERSATION}.jsonl`);
  await writeFile(file, lines.map((line) => `${line}\n`).join(''));
  return { roots: { claudeProjectsRoot: projects, codexSessionsRoot: sessions }, file };
}

const turn = (index: number, sessionId = CONVERSATION): string =>
  JSON.stringify({ type: 'user', sessionId, timestamp: `2026-01-01T10:00:${String(index).padStart(2, '0')}Z`, message: { role: 'user', content: `turn ${index}` } });

const location = { runtime: 'claude-code' as const, conversationId: CONVERSATION, cwd: CWD };

describe('reading a bounded window of an exact record', () => {
  it('reads the identity prefix and the last bytes from one file, and says whether the window starts at a line', async () => {
    const { roots: providerRoots } = await claudeRecord([turn(1), turn(2), turn(3)]);
    const whole = await readRecordWindow(providerRoots, location, { windowBytes: 1024 * 1024 });
    expect(whole).toMatchObject({ start: 0, startsAtLine: true, conversationId: CONVERSATION });
    expect(whole.bytes.toString()).toContain('turn 1');
    const lineLength = turn(3).length + 1;
    const lastLine = await readRecordWindow(providerRoots, location, { windowBytes: lineLength });
    expect(lastLine.startsAtLine).toBe(true);
    expect(lastLine.bytes.toString()).toBe(`${turn(3)}\n`);
    const cut = await readRecordWindow(providerRoots, location, { windowBytes: lineLength - 5 });
    expect(cut.startsAtLine).toBe(false);
  });

  it('keeps bytes appended after the read boundary outside a pinned read, and takes them on a new read', async () => {
    const { roots: providerRoots, file } = await claudeRecord([turn(1), turn(2)]);
    const first = await readRecordWindow(providerRoots, location, { windowBytes: turn(2).length + 1 });
    await appendFile(file, `${turn(3)}\n${turn(4).slice(0, 20)}`);
    const earlier = await readRecordWindow(providerRoots, location, { windowBytes: 1024 * 1024, pin: first.pin });
    expect(earlier.end).toBe(first.end);
    expect(earlier.start).toBe(0);
    expect(earlier.bytes.toString()).not.toContain('turn 3');
    const fresh = await readRecordWindow(providerRoots, location, { windowBytes: 1024 * 1024 });
    expect(fresh.bytes.toString()).toContain('turn 3');
  });

  it('refuses a pinned read once the record was truncated, replaced or rewritten', async () => {
    const { roots: providerRoots, file } = await claudeRecord([turn(1), turn(2), turn(3)]);
    const read = (pin: RecordPin): Promise<unknown> => readRecordWindow(providerRoots, location, { windowBytes: 1024 * 1024, pin });
    const first = await readRecordWindow(providerRoots, location, { windowBytes: turn(3).length + 1 });

    await truncate(file, first.end - 4);
    await expect(read(first.pin)).rejects.toThrow('truncated');

    await writeFile(`${file}.next`, [turn(1), turn(2), turn(3)].map((line) => `${line}\n`).join(''));
    await rename(`${file}.next`, file);
    await expect(read(first.pin)).rejects.toThrow('replaced');

    const second = await readRecordWindow(providerRoots, location, { windowBytes: turn(3).length + 1 });
    await writeFile(file, [turn(1).replace('turn 1', 'TURN 1'), turn(2), turn(3)].map((line) => `${line}\n`).join(''));
    await expect(read(second.pin)).rejects.toThrow('beginning changed');
  });

  it('refuses a pinned read once bytes already shown were rewritten beyond the identity prefix', async () => {
    const many = Array.from({ length: 3000 }, (_, index) => turn(index % 60));
    const { roots: providerRoots, file } = await claudeRecord(many);
    const first = await readRecordWindow(providerRoots, location, { windowBytes: 4096 });
    expect(first.start).toBeGreaterThan(256 * 1024);
    const rewritten = [...many.slice(0, -1), many[many.length - 1]!.replace('"turn', '"TURN')];
    await writeFile(file, rewritten.map((line) => `${line}\n`).join(''));
    await expect(readRecordWindow(providerRoots, location, { windowBytes: 8192, pin: first.pin })).rejects.toThrow('already shown changed');
  });

  it('pages back with the same pin and refuses a rewrite of bytes it showed before', async () => {
    const many = Array.from({ length: 3000 }, (_, index) => turn(index % 60));
    const { roots: providerRoots, file } = await claudeRecord(many);
    const latest = await readRecordWindow(providerRoots, location, { windowBytes: 65536 });
    expect(latest.start).toBeGreaterThan(256 * 1024);
    const end = latest.end - 32768;
    const earlier = await readRecordWindow(providerRoots, location, { windowBytes: 65536, pin: latest.pin, end });
    expect(earlier).toMatchObject({ end, start: end - 65536 });
    expect(earlier.pin.boundary).toBe(latest.end);
    const text = many.map((line) => `${line}\n`).join('');
    const at = latest.start + 100;
    await writeFile(file, `${text.slice(0, at)}${text[at] === 'x' ? 'y' : 'x'}${text.slice(at + 1)}`);
    await expect(readRecordWindow(providerRoots, location, { windowBytes: 65536, pin: latest.pin, end })).rejects.toThrow('already shown changed');
  });

  it('reads an earlier range only from a pinned read and never past its boundary', async () => {
    const { roots: providerRoots } = await claudeRecord([turn(1), turn(2)]);
    const first = await readRecordWindow(providerRoots, location, { windowBytes: 1024 });
    await expect(readRecordWindow(providerRoots, location, { windowBytes: 1024, end: 10 })).rejects.toThrow('pin');
    await expect(readRecordWindow(providerRoots, location, { windowBytes: 1024, pin: first.pin, end: first.end + 1 })).rejects.toThrow('pin');
  });

  it('counts a malformed complete line after a verified Claude identity instead of refusing the record', async () => {
    const { roots: providerRoots } = await claudeRecord([turn(1), 'not json', turn(2)]);
    const window = await readRecordWindow(providerRoots, location, { windowBytes: 4096 });
    expect(recordPage(window, 200)).toMatchObject({ malformed: 1, parsedEntries: 2 });
  });

  it("refuses a record whose own entries name another conversation or a sidechain", async () => {
    const other = await claudeRecord([turn(1), turn(2, 'conversation-other-2')]);
    await expect(readRecordWindow(other.roots, location, { windowBytes: 1024 })).rejects.toThrow('conversation ID mismatch');
    const sidechain = await claudeRecord([JSON.stringify({ type: 'user', sessionId: CONVERSATION, isSidechain: true, message: { role: 'user', content: 'x' } })]);
    await expect(readRecordWindow(sidechain.roots, location, { windowBytes: 1024 })).rejects.toThrow('sidechain');
  });

  it('checks identity past an unfinished final line instead of failing on it', async () => {
    const { roots: providerRoots, file } = await claudeRecord([turn(1)]);
    await appendFile(file, turn(2).slice(0, 15));
    const read = await readRecordWindow(providerRoots, location, { windowBytes: 1024 });
    expect(read.bytes.toString().endsWith('\n')).toBe(false);
  });

  it('locates a Codex record by its exact id suffix and checks its session_meta', async () => {
    const root = await mkdtemp(join(tmpdir(), 'atlas-record-window-'));
    roots.push(root);
    const day = join(root, 'sessions', '2026', '01', '01');
    await mkdir(day, { recursive: true });
    await mkdir(join(root, 'projects'));
    const meta = JSON.stringify({ timestamp: '2026-01-01T10:00:00Z', type: 'session_meta', payload: { id: CONVERSATION } });
    await writeFile(join(day, `rollout-2026-01-01T10-00-00-${CONVERSATION}.jsonl`), `${meta}\n`);
    const providerRoots = { claudeProjectsRoot: join(root, 'projects'), codexSessionsRoot: join(root, 'sessions') };
    const read = await readRecordWindow(providerRoots, { runtime: 'codex', conversationId: CONVERSATION }, { windowBytes: 1024 });
    expect(read.runtime).toBe('codex');
    await writeFile(join(day, `rollout-2026-01-01T10-00-00-${CONVERSATION}.jsonl`), `${meta.replace(CONVERSATION, 'conversation-other-2')}\n`);
    await expect(readRecordWindow(providerRoots, { runtime: 'codex', conversationId: CONVERSATION }, { windowBytes: 1024 })).rejects.toThrow('mismatch');
  });

  it('never reads after the person cancelled', async () => {
    const { roots: providerRoots } = await claudeRecord([turn(1)]);
    const controller = new AbortController();
    controller.abort();
    await expect(readRecordWindow(providerRoots, location, { windowBytes: 1024, signal: controller.signal })).rejects.toThrow();
  });
});
