import { afterEach, describe, expect, it, vi } from 'vitest';
import { openLocalFile } from '../../src/app/agent-links/native/desktopOpen';

type Required = (name: string) => unknown;
const withRequire = window as Window & { require?: Required };

/** Electron's shell as Obsidian desktop exposes it; the test controls what the system opener answers. */
function desktopShell(openPath: (path: string) => Promise<string>): { openPath: ReturnType<typeof vi.fn>; showItemInFolder: ReturnType<typeof vi.fn> } {
  const shell = { openPath: vi.fn(openPath), showItemInFolder: vi.fn() };
  withRequire.require = (name) => (name === 'electron' ? { shell } : undefined);
  return shell;
}

afterEach(() => {
  delete withRequire.require;
});

describe('opening a local file on the desktop', () => {
  it('opens the freshly validated file and reveals nothing when the system opener succeeds', async () => {
    const shell = desktopShell(async () => '');
    const validate = vi.fn(async () => '/records/current.jsonl');
    await expect(openLocalFile(validate)).resolves.toEqual({ state: 'opened' });
    expect(shell.openPath).toHaveBeenCalledWith('/records/current.jsonl');
    expect(validate).toHaveBeenCalledTimes(1);
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
  });

  it('keeps the system reason and reveals the file validated again, not the path from before the refusal', async () => {
    const shell = desktopShell(async () => 'Failed to open path');
    const validate = vi.fn().mockResolvedValueOnce('/records/before.jsonl').mockResolvedValueOnce('/records/revalidated.jsonl');
    const result = await openLocalFile(validate);
    expect(result).toMatchObject({ state: 'revealed', reason: 'Failed to open path' });
    expect(validate).toHaveBeenCalledTimes(2);
    expect(shell.showItemInFolder).toHaveBeenCalledWith('/records/revalidated.jsonl');
  });

  it('reveals nothing when the card is closed while the system opener is answering', async () => {
    const controller = new AbortController();
    const shell = desktopShell(async () => {
      controller.abort();
      return 'Failed to open path';
    });
    const validate = vi.fn(async () => '/records/current.jsonl');
    await expect(openLocalFile(validate, controller.signal)).rejects.toThrow();
    expect(validate).toHaveBeenCalledTimes(1);
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
  });

  it('reveals nothing when the card is closed during revalidation or the file no longer validates', async () => {
    const controller = new AbortController();
    const shell = desktopShell(async () => 'Failed to open path');
    const closing = vi.fn().mockResolvedValueOnce('/records/current.jsonl').mockImplementationOnce(async () => {
      controller.abort();
      return '/records/current.jsonl';
    });
    await expect(openLocalFile(closing, controller.signal)).rejects.toThrow();
    const gone = vi.fn().mockResolvedValueOnce('/records/current.jsonl').mockRejectedValueOnce(new Error('Provider record not found'));
    await expect(openLocalFile(gone)).rejects.toThrow('Provider record not found');
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
  });

  it('never reaches the desktop after an earlier cancellation or for a relative path', async () => {
    const shell = desktopShell(async () => '');
    const controller = new AbortController();
    controller.abort();
    const validate = vi.fn(async () => '/records/current.jsonl');
    await expect(openLocalFile(validate, controller.signal)).rejects.toThrow();
    expect(validate).not.toHaveBeenCalled();
    await expect(openLocalFile(async () => 'records/current.jsonl')).rejects.toThrow('absolute');
    expect(shell.openPath).not.toHaveBeenCalled();
  });
});
