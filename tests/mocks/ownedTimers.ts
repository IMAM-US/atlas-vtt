import { vi } from 'vitest';

/**
 * Tracks the timers and animation frames one source file starts, by id, until they are cleared
 * or fire. jsdom's internal timers (input selection, focus) are not the component's to clear and
 * are left out. Restore with `vi.restoreAllMocks()`.
 */
export function trackOwnedTimers(sourceFile: string): { live: () => string[] } {
  const live = new Set<string>();
  const own = (): boolean => (new Error().stack ?? '').includes(sourceFile);
  const { setTimeout: set, clearTimeout: clear, requestAnimationFrame: frame, cancelAnimationFrame: cancel } = window;
  vi.spyOn(window, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
    let key = '';
    const id = set(() => { live.delete(key); fn(); }, ms);
    key = `timeout ${id}`;
    if (own()) live.add(key);
    return id;
  }) as typeof window.setTimeout);
  vi.spyOn(window, 'clearTimeout').mockImplementation((id?: number) => { live.delete(`timeout ${id}`); clear(id); });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
    let key = '';
    const id = frame((time) => { live.delete(key); fn(time); });
    key = `frame ${id}`;
    if (own()) live.add(key);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { live.delete(`frame ${id}`); cancel(id); });
  return { live: () => [...live] };
}
