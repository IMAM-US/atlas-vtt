import { homedir } from 'os';
import { isAbsolute, resolve } from 'path';
import { isRecord } from '../services/assetMetadataGuards';
import type { OpenRigConnection } from './native/openRigRead';
import type { NativeViewConnections } from './native/viewResolution';

/**
 * Machine-local connection settings for one native source. They live in Atlas's settings
 * file, never in a collection or an account: an imported account selects a source by `key`
 * and can never name an endpoint, socket, root or credential.
 */
export interface AgentLinkSourceSettings {
  key: string;
  openRigEndpoint: string;
  openRigHostId: string;
  openRigToken: string;
  /** Herdr Unix sockets to discover views on, one per line in the settings tab. */
  herdrSocketPaths: string[];
  tmuxSocketPath: string;
  tmuxExecutablePath: string;
  /** Repository and evidence roots artifact reads are confined to. */
  allowedRoots: string[];
  claudeProjectsRoot: string;
  codexSessionsRoot: string;
}

export interface AgentLinkSettings {
  sources: AgentLinkSourceSettings[];
}

export const LOCAL_SOURCE_KEY = 'local';

export function defaultSourceSettings(key = LOCAL_SOURCE_KEY): AgentLinkSourceSettings {
  return {
    key, openRigEndpoint: '', openRigHostId: '', openRigToken: '', herdrSocketPaths: [],
    tmuxSocketPath: '', tmuxExecutablePath: '', allowedRoots: [], claudeProjectsRoot: '~/.claude/projects', codexSessionsRoot: '~/.codex/sessions',
  };
}

export const DEFAULT_AGENT_LINK_SETTINGS: AgentLinkSettings = { sources: [defaultSourceSettings()] };

const text = (value: unknown, fallback: string): string => (typeof value === 'string' ? value.trim() : fallback);
const lines = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean) : [];

/** Stored settings as this version understands them; a malformed entry falls back field by field. */
export function readAgentLinkSettings(stored: unknown): AgentLinkSettings {
  const entries = isRecord(stored) && Array.isArray(stored.sources) ? stored.sources.filter(isRecord) : [];
  const sources = entries.map((entry) => {
    const defaults = defaultSourceSettings(text(entry.key, LOCAL_SOURCE_KEY) || LOCAL_SOURCE_KEY);
    return {
      ...defaults,
      openRigEndpoint: text(entry.openRigEndpoint, ''), openRigHostId: text(entry.openRigHostId, ''), openRigToken: text(entry.openRigToken, ''),
      herdrSocketPaths: lines(entry.herdrSocketPaths), tmuxSocketPath: text(entry.tmuxSocketPath, ''), tmuxExecutablePath: text(entry.tmuxExecutablePath, ''),
      allowedRoots: lines(entry.allowedRoots), claudeProjectsRoot: text(entry.claudeProjectsRoot, defaults.claudeProjectsRoot),
      codexSessionsRoot: text(entry.codexSessionsRoot, defaults.codexSessionsRoot),
    };
  });
  return { sources: sources.length ? sources : [defaultSourceSettings()] };
}

/** `~` stands for the home directory; everything else must already be absolute. */
export function expandRoot(root: string): string {
  const expanded = root === '~' ? homedir() : root.startsWith('~/') ? resolve(homedir(), root.slice(2)) : root;
  return isAbsolute(expanded) ? resolve(expanded) : '';
}

/** Whether `root` is one of the allowed roots or lies below one. */
export function isAllowedRoot(source: AgentLinkSourceSettings, root: string): boolean {
  const target = expandRoot(root);
  if (!target) return false;
  return source.allowedRoots.map(expandRoot).some((allowed) => allowed && (target === allowed || target.startsWith(`${allowed}/`)));
}

export function openRigConnectionOf(source: AgentLinkSourceSettings): OpenRigConnection | null {
  if (!source.openRigEndpoint || !source.openRigHostId) return null;
  return { endpoint: source.openRigEndpoint, hostId: source.openRigHostId, ...(source.openRigToken ? { bearerToken: source.openRigToken } : {}) };
}

export function viewConnectionsOf(source: AgentLinkSourceSettings): NativeViewConnections | null {
  if (!source.openRigHostId || !source.herdrSocketPaths.length || !source.tmuxSocketPath || !source.tmuxExecutablePath) return null;
  return {
    localHostId: source.openRigHostId,
    herdrSocketPaths: source.herdrSocketPaths.map(expandRoot).filter(Boolean),
    tmux: [{ socketPath: expandRoot(source.tmuxSocketPath), executablePath: expandRoot(source.tmuxExecutablePath) }],
  };
}
