import type { LoadedAccount } from '../reads';

interface Entry { version: number; value: LoadedAccount | null; error: string | null; dirty: boolean; controller: AbortController | null }
export type AccountLoader = (path: string, signal: AbortSignal) => Promise<LoadedAccount>;

/** A current-scene queue, independently bounded from native observation concurrency. */
export class AccountLoads {
  private readonly entries = new Map<string, Entry>();
  private running = 0;
  private timer: number | null = null;
  private disposed = false;

  constructor(private readonly load: AccountLoader, private readonly changed: () => void, private readonly delay = 120) {}

  get(path: string): Readonly<Entry> | undefined { return this.entries.get(path); }

  setPaths(paths: ReadonlySet<string>): void {
    for (const [path, entry] of this.entries) if (!paths.has(path)) { entry.controller?.abort(); this.entries.delete(path); }
    for (const path of paths) if (!this.entries.has(path)) this.entries.set(path, { version: 0, value: null, error: null, dirty: true, controller: null });
    this.schedule();
  }

  invalidate(path: string): void {
    const entry = this.entries.get(path);
    if (!entry) return;
    entry.version++; entry.value = null; entry.error = null; entry.dirty = true; entry.controller?.abort();
    this.changed(); this.schedule();
  }

  private schedule(): void {
    if (this.disposed || this.timer || this.running >= 4 || ![...this.entries.values()].some((entry) => entry.dirty && !entry.controller)) return;
    this.timer = window.setTimeout(() => { this.timer = null; this.drain(); }, this.delay);
  }

  private drain(): void {
    if (this.disposed) return;
    for (const [path, entry] of this.entries) {
      if (this.running >= 4) break;
      if (!entry.dirty || entry.controller) continue;
      const controller = new AbortController(), version = entry.version;
      entry.controller = controller; entry.dirty = false; this.running++;
      void Promise.resolve().then(() => { controller.signal.throwIfAborted(); return this.load(path, controller.signal); }).then((value) => {
        if (this.current(path, entry, controller, version)) { entry.value = value; entry.error = null; this.changed(); }
      }, (error: unknown) => {
        if (this.current(path, entry, controller, version)) { entry.value = null; entry.error = error instanceof Error ? error.message : 'Account could not be read.'; this.changed(); }
      }).finally(() => {
        entry.controller = null; this.running--;
        this.schedule();
      });
    }
  }

  private current(path: string, entry: Entry, controller: AbortController, version: number): boolean {
    return !this.disposed && !controller.signal.aborted && this.entries.get(path) === entry && entry.version === version;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    for (const entry of this.entries.values()) entry.controller?.abort();
    this.entries.clear();
  }
}
