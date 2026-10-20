import type { App } from 'obsidian';

/** Opens a vault note the way pins do: by link text, in the active leaf context. */
export function openVaultNote(app: App, notePath: string): void {
  void app.workspace.openLinkText(notePath, '', false);
}

/** Copies a native route to the clipboard; the card confirms with a short status. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
