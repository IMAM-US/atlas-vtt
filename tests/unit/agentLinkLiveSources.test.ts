// @vitest-environment node
import { expect, it } from 'vitest';
import { LiveSources } from '../../src/app/agent-links/live/LiveSources';
import { defaultSourceSettings } from '../../src/app/agent-links/sourceSettings';

it('reconfigures only the changed source and preserves unrelated socket owners and revisions', () => {
  const configurations = new Map(['a', 'b'].map((key) => [key, { settings: { ...defaultSourceSettings(key), herdrSocketPaths: [`/synthetic/${key}.sock`] }, backend: {
    readSeat: async (): Promise<never> => { throw new Error('No read requested'); },
    readOwned: async (): Promise<never> => { throw new Error('No read requested'); },
    readWork: async (): Promise<never> => { throw new Error('No read requested'); },
  } }]));
  const registry = new LiveSources((key) => configurations.get(key)!);
  const a = registry.openRig('a'), b = registry.openRig('b');
  const ha = registry.herdr('a')[0], hb = registry.herdr('b')[0];
  const previous = configurations.get('a')!;
  configurations.set('a', { ...previous, settings: { ...previous.settings, openRigHostId: 'replacement-host' } });
  registry.settingsChanged();
  expect(registry.openRig('a')).toBe(a);
  expect(registry.openRig('b')).toBe(b);
  expect(registry.herdr('a')[0]).not.toBe(ha);
  expect(registry.herdr('b')[0]).toBe(hb);
  expect(registry.getRevision('a')).toBe(1);
  expect(registry.getRevision('b')).toBe(0);
  registry.settingsChanged();
  expect(registry.getRevision('a')).toBe(1);
  registry.dispose();
});
