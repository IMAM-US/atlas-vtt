import { execFile } from 'child_process';

export interface ProcessReadOptions { signal?: AbortSignal; timeoutMs?: number }
export interface ProcessIdentity { pid: number; parentPid: number; started: string }

/** Argument-vector reads only. Callers supply fixed commands, never shell text from an account. */
export function runNativeRead(file: string, args: string[], options?: ProcessReadOptions): Promise<string> {
  options?.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    execFile(file, args, {
      timeout: Math.min(options?.timeoutMs ?? 3000, 3000), maxBuffer: 128 * 1024,
      env: { ...process.env, LC_ALL: 'C' }, ...(options?.signal ? { signal: options.signal } : {}),
    }, (error, stdout) => {
      if (error) reject(error.name === 'AbortError' ? error : new Error('Cannot read the configured native process.'));
      else resolve(stdout.replace(/\r?\n$/, ''));
    });
  });
}

export async function readProcessIdentity(pid: number, options?: ProcessReadOptions): Promise<ProcessIdentity> {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid native process identity.');
  // Inspect only this PID and the ancestry fields; no argv, command names or environment.
  const text = await runNativeRead('/bin/ps', ['-p', String(pid), '-o', 'pid=,ppid=,lstart='], options);
  const match = /^\s*(\d+)\s+(\d+)\s+([^\r\n]+)$/.exec(text);
  const parentPid = Number(match?.[2]);
  if (!match || Number(match[1]) !== pid || !Number.isSafeInteger(parentPid) || !match[3]?.trim()) {
    throw new Error('The native process identity is unavailable.');
  }
  return { pid, parentPid, started: match[3].trim() };
}

export function sameProcessIdentity(left: ProcessIdentity, right: ProcessIdentity): boolean {
  return left.pid === right.pid && left.parentPid === right.parentPid && left.started === right.started;
}

/** Proves a bounded child-to-root chain, then rereads every member to reject exits, PID reuse and reparenting. */
export async function readProcessAncestry(childPid: number, ancestorPid: number, options?: ProcessReadOptions): Promise<ProcessIdentity[]> {
  if (!Number.isSafeInteger(ancestorPid) || ancestorPid <= 0) throw new Error('Invalid native ancestor identity.');
  const chain: ProcessIdentity[] = [];
  let next = childPid;
  while (next > 0 && chain.length < 32 && !chain.some((entry) => entry.pid === next)) {
    options?.signal?.throwIfAborted();
    const identity = await readProcessIdentity(next, options);
    chain.push(identity);
    if (next === ancestorPid) {
      // Root first and the target process last, minimizing the final gap for the participant.
      for (const entry of [...chain].reverse()) {
        if (!sameProcessIdentity(entry, await readProcessIdentity(entry.pid, options))) {
          throw new Error('The native process ancestry changed during the read.');
        }
      }
      return chain;
    }
    next = identity.parentPid;
  }
  throw new Error('The verified participant does not belong to this native pane.');
}
