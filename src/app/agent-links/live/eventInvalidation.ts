import type { NativeEvent } from './types';

/** Notification scope only. The event payload never becomes a current observation. */
export function invalidatedFacets(event: NativeEvent): ReadonlySet<string> {
  const { type } = event;
  if (type === 'view.changed' || type === 'snapshot.created' || type === 'transport.prompt_override') return new Set();
  if (type.startsWith('queue.') || type.startsWith('qitem.') || type.startsWith('inbox.')) return new Set(['owned', 'work', 'inventory']);
  if (type === 'seat.activity_changed' || type === 'seat.rung_health' || type.startsWith('proof.') || type === 'agent.activity') return new Set(['inventory']);
  if (type.startsWith('node.') || type.startsWith('seat.') || type.startsWith('binding.') || type.startsWith('session.')
    || type.startsWith('rig.') || type.startsWith('pod.') || type.startsWith('topology.') || type.startsWith('restore.') || type === 'agent.session_identity') {
    return new Set(['seat', 'owned', 'inventory']);
  }
  if (type.startsWith('watchdog.')) return new Set(['work']);
  // Unknown source events conservatively dirty bound facts, without assigning any state.
  return new Set(['seat', 'owned', 'work', 'inventory']);
}
