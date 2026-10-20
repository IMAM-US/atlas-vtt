import { expandRoot } from '../sourceSettings';
import { HerdrLive } from './HerdrLive';
import { OpenRigLive } from './OpenRigLive';
import type { LiveConfiguration } from './types';

/** Plugin-instance owner. Two views share subscribers; source keys never share native IDs. */
export class LiveSources {
  private readonly openRigModels = new Map<string, OpenRigLive>();
  private readonly herdrModels = new Map<string, HerdrLive>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;

  constructor(private readonly configuration: (sourceKey: string) => LiveConfiguration) {}

  openRig(sourceKey: string): OpenRigLive {
    let model = this.openRigModels.get(sourceKey);
    if (!model) {
      model = new OpenRigLive(this.configuration(sourceKey));
      this.openRigModels.set(sourceKey, model);
    }
    return model;
  }

  herdr(sourceKey: string): readonly HerdrLive[] {
    return [...new Set(this.configuration(sourceKey).settings.herdrSocketPaths.map(expandRoot).filter(Boolean))].map((path) => {
      const key = JSON.stringify([sourceKey, path]);
      let model = this.herdrModels.get(key);
      if (!model) { model = new HerdrLive(sourceKey, path); this.herdrModels.set(key, model); }
      return model;
    });
  }

  getRevision = (): number => this.revision;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };

  settingsChanged(): void {
    for (const [key, model] of this.openRigModels) model.configure(this.configuration(key));
    // Existing views rebuild their socket handles after the settings revision changes.
    for (const model of this.herdrModels.values()) model.dispose();
    this.herdrModels.clear();
    this.revision++;
    for (const listener of this.listeners) listener();
  }

  dispose(): void {
    for (const model of this.openRigModels.values()) model.dispose();
    for (const model of this.herdrModels.values()) model.dispose();
    this.openRigModels.clear(); this.herdrModels.clear(); this.listeners.clear();
  }
}
