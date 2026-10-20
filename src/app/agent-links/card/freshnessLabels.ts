import type { InventoryRead } from '../live/OpenRigLive';
import type { ConnectionState, Observation } from '../live/types';
import type { SeatSubject } from '../account/accountSchema';
import { clock } from './timeLabels';

export function freshnessLabel<T>(fact: Observation<T> | null | undefined, exceptionsOnly = false): string {
  if (!fact) return 'Refreshing…';
  const at = clock(fact.observedAt);
  switch (fact.freshness) {
    case 'live': return exceptionsOnly ? '' : `Live · ${fact.observedAt ? new Date(fact.observedAt).toISOString().slice(11, 19) + 'Z' : ''}`;
    case 'read': return exceptionsOnly ? '' : `Read ${at}`;
    case 'last-known': return `Last known ${at}${fact.message ? ` · ${fact.message}` : ''}`;
    case 'refreshing': return `Refreshing…${at ? ` · previous ${at}` : ''}`;
    case 'refused': return `Refused${fact.message ? `: ${fact.message}` : ''}${at ? ` · last known ${at}` : ''}`;
    case 'unavailable': return `Unavailable${fact.message ? `: ${fact.message}` : ''}`;
  }
}

/** The oracle's display is authoritative; raw agentActivity does not substitute for it. */
export function activityLabel(subject: SeatSubject, fact: Observation<InventoryRead> | null | undefined): string | null {
  const node = fact?.value?.nodes.find((entry) => entry.nodeId === subject.seat.nodeId);
  const oracle = node?.activityState;
  const display = oracle && typeof oracle === 'object' && 'display' in oracle ? oracle.display : null;
  return typeof display === 'string' && display !== 'unknown' ? display.replace(/_/g, ' ') : null;
}

export function connectionLabel(name: string, connection: ConnectionState, lastKnown: string | null, views = false): string {
  const what = views ? 'views' : 'facts';
  switch (connection.status) {
    case 'connected': return views ? `${name} · connected; views are dated reads` : `${name} · connected since ${clock(connection.since)}`;
    case 'connecting': return `${name} · connecting`;
    case 'reconnecting': return `${name} · reconnecting${lastKnown ? `, ${what} last known ${clock(lastKnown)}` : ''}`;
    case 'unavailable': return `${name} · unavailable: ${connection.message ?? 'source could not be read'}`;
    case 'closed': return `${name} · unavailable: ${connection.message ?? 'source is closed'}`;
  }
}
