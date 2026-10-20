import { expandRoot } from '../sourceSettings';
import { HerdrLive } from './HerdrLive';
import { OpenRigLive } from './OpenRigLive';
import type { LiveConfiguration } from './types';

/** Plugin-instance owner. Two views share subscribers; source keys never share native IDs. */
export class LiveSources {
  private readonly openRigModels = new Map<string, OpenRigLive>();
  private readonly herdrModels = new Map<string, { sourceKey: string; model: HerdrLive }>();
  private readonly fingerprints = new Map<string, string>();
  private readonly revisions = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;

  constructor(private readonly configuration: (sourceKey: string) => LiveConfiguration) {}

  openRig(sourceKey: string): OpenRigLive {
    let model = this.openRigModels.get(sourceKey);
    if (!model) {
      const configuration = this.configuration(sourceKey);
      model = new OpenRigLive(configuration);
      this.fingerprints.set(sourceKey, JSON.stringify(configuration.settings));
      this.openRigModels.set(sourceKey, model);
    }
    return model;
  }

  herdr(sourceKey: string): readonly HerdrLive[] {
    const configuration = this.configuration(sourceKey);
    this.fingerprints.set(sourceKey, JSON.stringify(configuration.settings));
    return [...new Set(configuration.settings.herdrSocketPaths.map(expandRoot).filter(Boolean))].map((path) => {
      const key = JSON.stringify([sourceKey, path]);
      let entry = this.herdrModels.get(key);
      if (!entry) { entry = { sourceKey, model: new HerdrLive(sourceKey, path) }; this.herdrModels.set(key, entry); }
      return entry.model;
    });
  }

  getRevision = (sourceKey?: string): number => sourceKey ? this.revisions.get(sourceKey) ?? 0 : this.revision;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  settingsChanged(): void {
    let changed = false;
    for (const [key, previous] of this.fingerprints) {
      const configuration = this.configuration(key);
      const fingerprint = JSON.stringify(configuration.settings);
      if (previous === fingerprint) continue;
      changed = true;
      this.fingerprints.set(key, fingerprint);
      this.openRigModels.get(key)?.configure(configuration);
      for (const [socketKey, entry] of this.herdrModels) {
        if (entry.sourceKey !== key) continue;
        entry.model.dispose(); this.herdrModels.delete(socketKey);
      }
      this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
    }
    if (!changed) return;
    this.revision++;
    for (const listener of this.listeners) listener();
  }

  dispose(): void {
    for (const model of this.openRigModels.values()) model.dispose();
    for (const { model } of this.herdrModels.values()) model.dispose();
    this.openRigModels.clear(); this.herdrModels.clear(); this.listeners.clear();
  }
}
