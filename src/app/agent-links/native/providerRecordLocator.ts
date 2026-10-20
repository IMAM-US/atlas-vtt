import { readdir } from 'fs/promises';
import { join, relative, resolve } from 'path';
import { locateProviderRecord, type ProviderRecord } from './providerRecord';
import { configuredRoot, validateRelativeFilePath } from './localFiles';

export interface ProviderRecordLocation {
  runtime: 'claude-code' | 'codex';
  conversationId: string;
  cwd?: string;
}

const CONVERSATION_ID = /^[A-Za-z0-9_-]{1,256}$/;

/**
 * Claude Code keeps `<projects>/<cwd with every "/" as "-">/<conversation id>.jsonl`.
 * The path is derived, never searched, and the record's own session id is checked before use.
 */
export function claudeRecordRelativePath(cwd: string, conversationId: string): string {
  if (!cwd.startsWith('/')) throw new Error('A Claude Code record needs the participant\'s absolute working directory.');
  if (!CONVERSATION_ID.test(conversationId)) throw new Error('Invalid native conversation ID');
  return `${cwd.replace(/\//g, '-')}/${conversationId}.jsonl`;
}

/** Codex names records `rollout-<time>-<conversation id>.jsonl` under `<sessions>/YYYY/MM/DD`; only an exact id suffix matches. */
async function codexRecordRelativePath(root: string, conversationId: string): Promise<string> {
  if (!CONVERSATION_ID.test(conversationId)) throw new Error('Invalid native conversation ID');
  const suffix = `-${conversationId}.jsonl`;
  const base = await configuredRoot(root);
  const days = async (directory: string, depth: number): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true });
    if (depth === 3) {
      return entries.filter((entry) => entry.isFile() && entry.name.startsWith('rollout-') && entry.name.endsWith(suffix)).map((entry) => join(directory, entry.name));
    }
    const folders = entries.filter((entry) => entry.isDirectory() && /^\d{2,4}$/.test(entry.name)).slice(0, 400);
    const found: string[] = [];
    for (const folder of folders) found.push(...await days(join(directory, folder.name), depth + 1));
    return found;
  };
  const matches = await days(base, 0);
  if (matches.length !== 1) throw new Error(matches.length ? 'More than one Codex record carries this conversation id.' : 'No Codex record carries this conversation id.');
  return relative(base, resolve(matches[0]!));
}

/** The exact provider record file of a conversation: path validated against the record's own identity, no recency search. */
export async function locateConversationRecord(
  roots: { claudeProjectsRoot: string; codexSessionsRoot: string }, location: ProviderRecordLocation,
): Promise<ProviderRecord> {
  if (location.runtime === 'claude-code') {
    if (!location.cwd) throw new Error('The participant\'s working directory is unknown, so its record cannot be located.');
    const relativePath = claudeRecordRelativePath(location.cwd, location.conversationId);
    validateRelativeFilePath(relativePath);
    return locateProviderRecord({ providerRoot: roots.claudeProjectsRoot, relativePath, runtime: 'claude-code', conversationId: location.conversationId });
  }
  const relativePath = await codexRecordRelativePath(roots.codexSessionsRoot, location.conversationId);
  validateRelativeFilePath(relativePath);
  return locateProviderRecord({ providerRoot: roots.codexSessionsRoot, relativePath, runtime: 'codex', conversationId: location.conversationId });
}
