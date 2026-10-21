// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nodeRoute, ownedWorkRoute, paneFocusRoute, reviewedFileRoute, screenRoute, shellQuote, workRoute } from '../../src/app/agent-links/nativeRoutes';

const local = { key: 'local', openRigEndpoint: 'http://127.0.0.1:1/' };
const other = { key: 'studio', openRigEndpoint: 'http://10.0.0.2:18764' };
const seat = { rigId: 'rig one', nodeId: 'node', logicalId: 'team.builder' };

describe('native routes', () => {
  it('copies typed requests that name the source endpoint, so two sources never copy the same text', () => {
    expect(workRoute(local, 'qitem-1').text).toBe('GET http://127.0.0.1:1/api/queue/qitem-1  # source local');
    expect(workRoute(other, 'qitem-1').text).toBe('GET http://10.0.0.2:18764/api/queue/qitem-1  # source studio');
    expect(workRoute(local, 'qitem-1').text).not.toBe(workRoute(other, 'qitem-1').text);
    expect(screenRoute(other, seat).text).toBe('GET http://10.0.0.2:18764/api/rigs/rig%20one/nodes/team.builder/preview?lines=40  # source studio');
    expect(nodeRoute(local, seat).label).toBe('OpenRig node read · source local');
    expect(ownedWorkRoute(local, 'builder@example').text).toContain('destinationSession=builder%40example');
    expect(workRoute({ key: 'unset', openRigEndpoint: '' }, 'q').text).toBe('GET <endpoint of source unset>/api/queue/q  # source unset');
  });

  it('keeps pane focus a socket request and quotes git routes for a shell', () => {
    expect(paneFocusRoute(local, '/tmp/herdr.sock', 'w1:p2').text).toBe('/tmp/herdr.sock ← {"id":"atlas","method":"pane.focus","params":{"pane_id":"w1:p2"}}  # source local');
    expect(reviewedFileRoute({ id: 'a', caption: 'A', sourceKey: 'local', working: { root: '/repo/my repo', path: 'docs/x.md' }, reviewed: { revision: 'f'.repeat(40) } })?.text)
      .toBe(`git -C '/repo/my repo' show ${'f'.repeat(40)}:docs/x.md`);
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });
});
