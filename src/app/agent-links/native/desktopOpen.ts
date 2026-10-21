import { isAbsolute } from 'path';

interface ElectronShell {
  openPath: (path: string) => Promise<string>;
  showItemInFolder: (path: string) => void;
}

/**
 * What the desktop did with a file: opened it with its default application, or, when the
 * system refused, showed that same file in its folder (`shownIn`) with the system's reason.
 */
export type LocalOpen = { state: 'opened' } | { state: 'revealed'; reason: string; shownIn: string };

/** Obsidian desktop exposes Electron to plugins; a missing shell means this is not the desktop app. */
function electronShell(): ElectronShell | null {
  const required = (window as Window & { require?: (name: string) => unknown }).require;
  if (!required) return null;
  try {
    const electron = required('electron') as { shell?: Partial<ElectronShell> };
    const shell = electron.shell;
    return shell && typeof shell.openPath === 'function' && typeof shell.showItemInFolder === 'function' ? shell as ElectronShell : null;
  } catch {
    return null;
  }
}

export function fileManagerName(): string {
  return process.platform === 'darwin' ? 'Finder' : process.platform === 'win32' ? 'File Explorer' : 'the file manager';
}

function absolute(path: string): string {
  if (!isAbsolute(path)) throw new Error('Only an absolute local path can be opened.');
  return path;
}

/**
 * Opens a local file with the system's default application; the document is opened, never
 * executed. `validate` confines and reads the file again now and returns its absolute path,
 * so a path retained from an earlier read is never used as is. When the system refuses (on
 * macOS, "Failed to open path"), the file is validated once more and shown in its folder,
 * keeping the system's reason. Cancellation is checked before each desktop effect; an effect
 * already handed to the system cannot be recalled.
 */
export async function openLocalFile(validate: () => Promise<string>, signal?: AbortSignal): Promise<LocalOpen> {
  const shell = electronShell();
  if (!shell) throw new Error('Opening local files needs the desktop app.');
  signal?.throwIfAborted();
  const path = absolute(await validate());
  signal?.throwIfAborted();
  const failure = await shell.openPath(path);
  if (!failure) return { state: 'opened' };
  signal?.throwIfAborted();
  const revalidated = absolute(await validate());
  signal?.throwIfAborted();
  shell.showItemInFolder(revalidated);
  return { state: 'revealed', reason: failure, shownIn: fileManagerName() };
}

/**
 * Shows a local file in its folder. `validate` confines and checks the file again now and
 * returns its absolute path; cancellation is checked right before the desktop effect.
 * Returns where the file is shown.
 */
export async function revealLocalFile(validate: () => Promise<string>, signal?: AbortSignal): Promise<string> {
  const shell = electronShell();
  if (!shell) throw new Error('Showing local files needs the desktop app.');
  signal?.throwIfAborted();
  const path = absolute(await validate());
  signal?.throwIfAborted();
  shell.showItemInFolder(path);
  return fileManagerName();
}
