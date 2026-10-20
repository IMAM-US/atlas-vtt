import { createHash } from 'crypto';
import { constants } from 'fs';
import { open, realpath, stat } from 'fs/promises';
import { isAbsolute, relative, resolve, sep } from 'path';

export const DEFAULT_FILE_LIMIT = 8 * 1024 * 1024;
const MAX_FILE_LIMIT = 32 * 1024 * 1024;

export interface FileReadOptions { maxBytes?: number }

export interface LocalFileRead {
  path: string;
  relativePath: string;
  bytes: Buffer;
  sha256: string;
  sizeBytes: number;
  modifiedAt: string;
  observedAt: string;
}

export interface LocalFilePrefix extends Omit<LocalFileRead, 'sha256' | 'sizeBytes'> {
  prefixSha256: string;
  fileSizeBytes: number;
  complete: boolean;
}

export function fileReadLimit(options: FileReadOptions = {}): number {
  const limit = options.maxBytes ?? DEFAULT_FILE_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_FILE_LIMIT) {
    throw new Error('File read limit must be between 1 byte and 32 MiB');
  }
  return limit;
}

export function validateRelativeFilePath(relativePath: string): void {
  if (!relativePath || isAbsolute(relativePath) || /[\0\\]/.test(relativePath)
    || relativePath.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('File path must be a safe relative path');
  }
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** `target` must lie below `root` (or equal it when `allowSame`); both are real paths. */
export function requireContained(root: string, target: string, allowSame = false): void {
  if (allowSame && root === target) return;
  const inside = relative(root, target);
  if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
    throw new Error('File path escapes its configured root');
  }
}

export async function configuredRoot(rootPath: string): Promise<string> {
  if (!isAbsolute(rootPath)) throw new Error('Configured file root must be absolute');
  const root = await realpath(rootPath);
  if (!(await stat(root)).isDirectory()) throw new Error('Configured file root is not a directory');
  return root;
}

async function readConfined(
  rootPath: string, relativePath: string, options: FileReadOptions, allowPrefix: boolean,
): Promise<LocalFilePrefix> {
  validateRelativeFilePath(relativePath);
  const limit = fileReadLimit(options);
  const root = await configuredRoot(rootPath);
  const requested = resolve(root, relativePath);
  const target = await realpath(requested);
  requireContained(root, target);
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    const witness = await stat(requested);
    const resolved = await realpath(requested);
    requireContained(root, resolved);
    if (resolved !== target || before.dev !== witness.dev || before.ino !== witness.ino) {
      throw new Error('File changed while its path was resolved');
    }
    if (!before.isFile()) throw new Error('File target is not a regular file');
    if (!allowPrefix && before.size > limit) throw new Error('File exceeds the read limit');
    const bytes = Buffer.alloc(Math.min(before.size, limit));
    let offset = 0;
    while (offset < bytes.length) {
      const read = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!read.bytesRead) break;
      offset += read.bytesRead;
    }
    const after = await handle.stat();
    const current = await stat(requested);
    const appended = allowPrefix && after.size > before.size;
    if (appended) {
      const repeated = Buffer.alloc(bytes.length);
      let repeatedOffset = 0;
      while (repeatedOffset < repeated.length) {
        const read = await handle.read(repeated, repeatedOffset, repeated.length - repeatedOffset, repeatedOffset);
        if (!read.bytesRead) break;
        repeatedOffset += read.bytesRead;
      }
      if (repeatedOffset !== repeated.length || !repeated.equals(bytes)) throw new Error('File prefix changed during the read');
    }
    if (offset !== bytes.length || (!appended && (after.size !== before.size || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs)) || current.dev !== before.dev || current.ino !== before.ino
      || await realpath(requested) !== target || await realpath(rootPath) !== root) {
      throw new Error('File changed during the read');
    }
    return {
      path: target, relativePath, bytes, prefixSha256: sha256(bytes),
      fileSizeBytes: after.size, complete: after.size === bytes.length,
      modifiedAt: after.mtime.toISOString(), observedAt: new Date().toISOString(),
    };
  } finally {
    await handle.close();
  }
}

export async function readLocalFile(
  rootPath: string, relativePath: string, options: FileReadOptions = {},
): Promise<LocalFileRead> {
  const { prefixSha256, fileSizeBytes, complete: _complete, ...file } = await readConfined(rootPath, relativePath, options, false);
  return { ...file, sha256: prefixSha256, sizeBytes: fileSizeBytes };
}

export async function readLocalFilePrefix(
  rootPath: string, relativePath: string, options: FileReadOptions = {},
): Promise<LocalFilePrefix> {
  return readConfined(rootPath, relativePath, options, true);
}

export async function readPreservedFile(
  rootPath: string, relativePath: string, expectedSha256: string, options: FileReadOptions = {},
): Promise<LocalFileRead> {
  if (!/^[a-fA-F0-9]{64}$/.test(expectedSha256)) throw new Error('Preserved file needs a SHA-256 hash');
  const file = await readLocalFile(rootPath, relativePath, options);
  if (file.sha256 !== expectedSha256.toLowerCase()) throw new Error('Preserved file SHA-256 mismatch');
  return file;
}
