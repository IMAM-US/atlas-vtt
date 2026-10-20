import { isAbsolute } from 'path';

interface ElectronShell { openPath: (path: string) => Promise<string> }

/** Obsidian desktop exposes Electron to plugins; a missing shell means this is not the desktop app. */
function electronShell(): ElectronShell | null {
  const required = (window as Window & { require?: (name: string) => unknown }).require;
  if (!required) return null;
  try {
    const electron = required('electron') as { shell?: ElectronShell };
    return electron.shell && typeof electron.shell.openPath === 'function' ? electron.shell : null;
  } catch {
    return null;
  }
}

/**
 * Opens a local file with the system's default application. The caller passes a path a
 * confined reader has just validated; the document is opened, never executed.
 */
export async function openLocalFile(path: string): Promise<void> {
  if (!isAbsolute(path)) throw new Error('Only an absolute local path can be opened.');
  const shell = electronShell();
  if (!shell) throw new Error('Opening local files needs the desktop app.');
  const failure = await shell.openPath(path);
  if (failure) throw new Error(failure);
}
