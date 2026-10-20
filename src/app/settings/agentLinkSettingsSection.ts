import type { SettingsService } from '../services/SettingsService';
import { LOCAL_SOURCE_KEY, type AgentLinkSourceSettings } from '../agent-links/sourceSettings';
import type { AtlasSettingRow, AtlasSettingSection } from './settingSections';

type TextKey = 'openRigEndpoint' | 'openRigHostId' | 'openRigToken' | 'tmuxSocketPath' | 'tmuxExecutablePath' | 'claudeProjectsRoot' | 'codexSessionsRoot';
type ListKey = 'herdrSocketPaths' | 'allowedRoots';

/**
 * Connection settings of the local native source that source-linked tokens read through.
 * They stay on this machine: collections and accounts never carry them.
 */
export function agentLinkSettingsSection(settingsService: SettingsService): AtlasSettingSection {
  const current = (): AgentLinkSourceSettings => settingsService.getAgentLinkSource(LOCAL_SOURCE_KEY);
  const update = (patch: Partial<AgentLinkSourceSettings>): void => settingsService.setAgentLinkSource(LOCAL_SOURCE_KEY, patch);
  const textRow = (name: string, desc: string, key: TextKey, placeholder: string, secret = false): AtlasSettingRow => ({
    name, desc, aliases: ['openrig', 'herdr', 'agent'],
    render: (setting) => {
      setting.addText((input) => {
        input.setPlaceholder(placeholder).setValue(current()[key]).onChange((value) => update({ [key]: value.trim() }));
        if (secret) input.inputEl.type = 'password';
      });
    },
  });
  const listRow = (name: string, desc: string, key: ListKey, placeholder: string): AtlasSettingRow => ({
    name, desc, aliases: ['openrig', 'herdr', 'agent'],
    render: (setting) => {
      setting.addTextArea((area) => {
        area.setPlaceholder(placeholder).setValue(current()[key].join('\n'))
          .onChange((value) => update({ [key]: value.split('\n').map((line) => line.trim()).filter(Boolean) }));
        area.inputEl.rows = 3;
      });
    },
  });
  return {
    heading: 'Agent links',
    rows: [
      textRow('OpenRig endpoint', 'Local daemon URL that seat and work reads use.', 'openRigEndpoint', 'http://127.0.0.1:port'),
      textRow('OpenRig host id', 'The daemon\'s own host id; reads from another host are refused.', 'openRigHostId', 'host-…'),
      textRow('OpenRig token', 'Bearer token, if the daemon requires one. Stored only on this machine.', 'openRigToken', '', true),
      listRow('Herdr sockets', 'Herdr Unix sockets to find existing views on, one per line.', 'herdrSocketPaths', '~/.config/herdr/herdr.sock'),
      textRow('tmux socket', 'The tmux server socket the seats are attached through.', 'tmuxSocketPath', '/private/tmp/tmux-…/default'),
      textRow('tmux executable', 'Absolute path of the tmux binary.', 'tmuxExecutablePath', '/opt/homebrew/bin/tmux'),
      listRow('Allowed roots', 'Repositories and evidence folders artifact reads may open, one per line. Paths outside them are refused.', 'allowedRoots', '~/Project/example'),
      textRow('Claude Code projects', 'Where Claude Code keeps conversation records.', 'claudeProjectsRoot', '~/.claude/projects'),
      textRow('Codex sessions', 'Where Codex keeps conversation records.', 'codexSessionsRoot', '~/.codex/sessions'),
    ],
  };
}
