import { execFile } from 'child_process';
import { realpath } from 'fs/promises';
import { relative, resolve } from 'path';
import { promisify } from 'util';
import {
  configuredRoot, fileReadLimit, readLocalFile, requireContained, sha256, validateRelativeFilePath,
  type FileReadOptions, type LocalFileRead,
} from './localFiles';

const execute = promisify(execFile);
const GIT_TIMEOUT_MS = 5000;

/** `within`: a configured anchor the repository root must lie inside, checked on the real path at read time. */
export interface GitReadOptions extends FileReadOptions { within?: string }

export interface CheckoutFacts {
  repositoryPath: string;
  commonGitDirectory: string;
  headCommit: string;
  branch: string | null;
  comparedRevisionIsAncestor: boolean | null;
  observedAt: string;
}

export interface GitFileRead {
  repositoryPath: string;
  relativePath: string;
  revision: string;
  blobId: string;
  bytes: Buffer;
  sha256: string;
  sizeBytes: number;
  checkout: CheckoutFacts;
}

export function validateCommit(revision: string): void {
  if (!/^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(revision)) {
    throw new Error('Git revision must be a full hexadecimal commit ID');
  }
}

async function git(root: string, args: string[], maxBytes = 64 * 1024): Promise<Buffer> {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const { stdout } = await execute('git', ['--no-optional-locks', '-C', root, ...args], {
    encoding: 'buffer', maxBuffer: maxBytes, timeout: GIT_TIMEOUT_MS,
    env: {
      ...environment, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_NO_REPLACE_OBJECTS: '1',
      GIT_NO_LAZY_FETCH: '1', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    },
  });
  return stdout;
}

async function repositoryRoot(rootPath: string, within?: string): Promise<string> {
  const root = await configuredRoot(rootPath);
  if (within !== undefined) requireContained(await configuredRoot(within), root, true);
  const top = (await git(root, ['rev-parse', '--show-toplevel'])).toString('utf8').trim();
  if (await realpath(top) !== root) throw new Error('Configured repository root does not match the Git worktree root');
  await assertSameRoot(rootPath, root, within);
  return root;
}

/**
 * The repository path must still resolve to the same real directory, inside the anchor,
 * after every Git step: a path swapped for a link between two commands would otherwise
 * point the next command at another repository with the same history.
 */
async function assertSameRoot(rootPath: string, root: string, within?: string): Promise<void> {
  const current = await realpath(rootPath);
  if (current !== root) throw new Error('Repository root changed during the read');
  if (within !== undefined) requireContained(await configuredRoot(within), current, true);
}

function exitCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'number' ? error.code : undefined;
}

async function facts(root: string, comparedRevision?: string): Promise<CheckoutFacts> {
  const headCommit = (await git(root, ['rev-parse', '--verify', 'HEAD'])).toString('utf8').trim();
  validateCommit(headCommit);
  let branch: string | null = null;
  try {
    branch = (await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'])).toString('utf8').trim();
  } catch (error) {
    if (exitCode(error) !== 1) throw error;
  }
  let comparedRevisionIsAncestor: boolean | null = null;
  if (comparedRevision) {
    try {
      await git(root, ['merge-base', '--is-ancestor', comparedRevision, headCommit]);
      comparedRevisionIsAncestor = true;
    } catch (error) {
      if (exitCode(error) !== 1) throw error;
      comparedRevisionIsAncestor = false;
    }
  }
  const common = (await git(root, ['rev-parse', '--git-common-dir'])).toString('utf8').trim();
  const commonGitDirectory = await realpath(resolve(root, common));
  if ((await git(root, ['rev-parse', '--verify', 'HEAD'])).toString('utf8').trim() !== headCommit) {
    throw new Error('Git checkout changed during observation');
  }
  return { repositoryPath: root, commonGitDirectory, headCommit, branch, comparedRevisionIsAncestor, observedAt: new Date().toISOString() };
}

export async function readCheckoutFacts(rootPath: string, comparedRevision?: string, options: GitReadOptions = {}): Promise<CheckoutFacts> {
  if (comparedRevision) validateCommit(comparedRevision);
  const root = await repositoryRoot(rootPath, options.within);
  const checkout = await facts(root, comparedRevision?.toLowerCase());
  await assertSameRoot(rootPath, root, options.within);
  return checkout;
}

export async function readGitFile(
  rootPath: string, relativePath: string, revision: string, options: GitReadOptions = {},
): Promise<GitFileRead> {
  validateRelativeFilePath(relativePath);
  validateCommit(revision);
  const commit = revision.toLowerCase();
  const limit = fileReadLimit(options);
  const root = await repositoryRoot(rootPath, options.within);
  if ((await git(root, ['cat-file', '-t', commit])).toString('utf8').trim() !== 'commit') {
    throw new Error('Git revision is not a commit');
  }
  const entry = (await git(root, ['ls-tree', '-z', commit, '--', `:(literal)${relativePath}`])).toString('utf8');
  const separator = entry.indexOf('\t');
  const match = /^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})$/.exec(entry.slice(0, separator));
  const blobId = match?.[2];
  if (!blobId || entry.slice(separator + 1) !== `${relativePath}\0`) {
    throw new Error('Git artifact is missing or is not a regular file');
  }
  const sizeBytes = Number((await git(root, ['cat-file', '-s', blobId])).toString('utf8').trim());
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > limit) throw new Error('Git file exceeds the read limit');
  const bytes = await git(root, ['cat-file', 'blob', blobId], limit + 1);
  if (bytes.length !== sizeBytes) throw new Error('Git artifact size changed during the read');
  const checkout = await facts(root, commit);
  await assertSameRoot(rootPath, root, options.within);
  return { repositoryPath: root, relativePath, revision: commit, blobId, bytes, sha256: sha256(bytes), sizeBytes, checkout };
}

/**
 * The working bytes of a tracked path. With `within`, the file is read through that anchor
 * (the whole path below it is resolved again by the reader) and the repository's real path
 * is checked after each Git step, so a swap of the repository path cannot serve another
 * repository's bytes even when its HEAD and branch match.
 */
export async function readWorkingGitFile(
  rootPath: string, relativePath: string, options: GitReadOptions = {},
): Promise<LocalFileRead & { checkout: CheckoutFacts }> {
  validateRelativeFilePath(relativePath);
  const root = await repositoryRoot(rootPath, options.within);
  const before = await facts(root);
  await assertSameRoot(rootPath, root, options.within);
  const anchor = options.within === undefined ? root : await configuredRoot(options.within);
  const below = anchor === root ? relativePath : `${relative(anchor, root)}/${relativePath}`;
  const file = await readLocalFile(anchor, below, options);
  await assertSameRoot(rootPath, root, options.within);
  const checkout = await facts(root);
  await assertSameRoot(rootPath, root, options.within);
  if (checkout.headCommit !== before.headCommit || checkout.branch !== before.branch) {
    throw new Error('Git checkout changed during the file read');
  }
  return { ...file, relativePath, checkout };
}
