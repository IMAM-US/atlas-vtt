import { createHash } from 'crypto';
import { constants, type Stats } from 'fs';
import { open, realpath, stat, type FileHandle } from 'fs/promises';
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

interface ConfinedFile { handle: FileHandle; root: string; requested: string; target: string; before: Stats }

/** Opens a regular file below `rootPath` without following a final symlink, and checks the handle is the file its path names. */
async function openConfined(rootPath: string, relativePath: string): Promise<ConfinedFile> {
  validateRelativeFilePath(relativePath);
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
    return { handle, root, requested, target, before };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

/** Reads up to `length` bytes at `position`; a shorter result means the file ended first. */
async function readAt(handle: FileHandle, length: number, position: number): Promise<Buffer> {
  const bytes = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const read = await handle.read(bytes, offset, length - offset, position + offset);
    if (!read.bytesRead) break;
    offset += read.bytesRead;
  }
  return offset === length ? bytes : bytes.subarray(0, offset);
}

/** The path still names the opened file below the same root. */
async function stillNamed(file: ConfinedFile, rootPath: string): Promise<boolean> {
  const current = await stat(file.requested);
  return current.dev === file.before.dev && current.ino === file.before.ino
    && await realpath(file.requested) === file.target && await realpath(rootPath) === file.root;
}

async function readConfined(
  rootPath: string, relativePath: string, options: FileReadOptions, allowPrefix: boolean,
): Promise<LocalFilePrefix> {
  validateRelativeFilePath(relativePath);
  const limit = fileReadLimit(options);
  const file = await openConfined(rootPath, relativePath);
  const { handle, before } = file;
  try {
    if (!allowPrefix && before.size > limit) throw new Error('File exceeds the read limit');
    const length = Math.min(before.size, limit);
    const bytes = await readAt(handle, length, 0);
    const after = await handle.stat();
    const appended = allowPrefix && after.size > before.size;
    if (appended && !(await readAt(handle, length, 0)).equals(bytes)) throw new Error('File prefix changed during the read');
    if (bytes.length !== length || (!appended && (after.size !== before.size || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs)) || !await stillNamed(file, rootPath)) {
      throw new Error('File changed during the read');
    }
    return {
      path: file.target, relativePath, bytes, prefixSha256: sha256(bytes),
      fileSizeBytes: after.size, complete: after.size === bytes.length,
      modifiedAt: after.mtime.toISOString(), observedAt: new Date().toISOString(),
    };
  } finally {
    await handle.close();
  }
}

export interface FileIdentity { dev: number; ino: number }

export interface FileRangeOptions {
  prefixBytes: number;
  rangeBytes: number;
  /** Where the range ends; the file's size when omitted. */
  end?: number;
  /** A file read before: it must still be that same file and at least that long. */
  expect?: { identity: FileIdentity; minSize: number };
}

export interface LocalFileRange {
  path: string;
  relativePath: string;
  identity: FileIdentity;
  /** The size when the read began; bytes appended later lie outside this read. */
  fileSizeBytes: number;
  prefix: Buffer;
  /** The bytes of `[start, end)`. */
  bytes: Buffer;
  start: number;
  end: number;
  modifiedAt: string;
  observedAt: string;
}

/**
 * Reads a file's prefix and one byte range through the same confined handle, so both come
 * from one file. Bytes appended after the read began are outside it; a replaced, truncated
 * or rewritten file is refused.
 */
export async function readLocalFileRange(rootPath: string, relativePath: string, options: FileRangeOptions): Promise<LocalFileRange> {
  validateRelativeFilePath(relativePath);
  const prefixLimit = fileReadLimit({ maxBytes: options.prefixBytes });
  const rangeLimit = fileReadLimit({ maxBytes: options.rangeBytes });
  const file = await openConfined(rootPath, relativePath);
  const { handle, before } = file;
  try {
    if (options.expect) {
      if (before.dev !== options.expect.identity.dev || before.ino !== options.expect.identity.ino) throw new Error('File was replaced since it was read');
      if (before.size < options.expect.minSize) throw new Error('File was truncated since it was read');
    }
    const end = options.end ?? before.size;
    if (!Number.isSafeInteger(end) || end < 0 || end > before.size) throw new Error('File range lies outside the file');
    const start = Math.max(0, end - rangeLimit);
    const prefixLength = Math.min(before.size, prefixLimit);
    const prefix = await readAt(handle, prefixLength, 0);
    const bytes = await readAt(handle, end - start, start);
    const after = await handle.stat();
    if (prefix.length !== prefixLength || bytes.length !== end - start || after.size < before.size) throw new Error('File was truncated during the read');
    const rewritten = after.size === before.size
      ? after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs
      : !(await readAt(handle, prefixLength, 0)).equals(prefix) || !(await readAt(handle, end - start, start)).equals(bytes);
    if (rewritten || !await stillNamed(file, rootPath)) throw new Error('File changed during the read');
    return {
      path: file.target, relativePath, identity: { dev: before.dev, ino: before.ino }, fileSizeBytes: before.size,
      prefix, bytes, start, end, modifiedAt: after.mtime.toISOString(), observedAt: new Date().toISOString(),
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
