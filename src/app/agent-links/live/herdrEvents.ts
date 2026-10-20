import { randomUUID } from 'crypto';
import { createConnection } from 'net';
import { clearTimeout, setTimeout } from 'timers';
import { nativeObject } from '../native/openRigRead';
import type { EventSubscription } from './types';

const GENERAL_EVENTS = [
  'workspace.created', 'workspace.updated', 'workspace.metadata_updated', 'workspace.renamed', 'workspace.moved',
  'workspace.reordered', 'workspace.closed', 'workspace.focused', 'worktree.created', 'worktree.opened', 'worktree.removed',
  'tab.created', 'tab.closed', 'tab.focused', 'tab.renamed', 'tab.moved', 'pane.created', 'pane.closed', 'pane.updated',
  'pane.focused', 'pane.moved', 'pane.exited', 'pane.agent_detected', 'layout.updated',
];

/** Dotted requests, underscored general delivery, dotted status delivery. No output subscriptions. */
export function subscribeHerdr(
  socketPath: string, paneIds: readonly string[], signal: AbortSignal,
  onEvent: (event: string) => void, onDisconnect: (error: Error) => void,
): Promise<EventSubscription> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    const id = randomUUID();
    let pending = '';
    let acknowledged = false;
    let closed = false;
    const finish = (error: Error): void => {
      if (closed) return;
      closed = true; clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      socket.destroy();
      if (!acknowledged) reject(error);
      else if (!signal.aborted) onDisconnect(error);
    };
    const cancel = (): void => finish(new Error('Herdr subscription cancelled.'));
    const timer = setTimeout(() => finish(new Error('Herdr subscription acknowledgement timed out.')), 5000);
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    socket.setEncoding('utf8');
    socket.once('connect', () => {
      const subscriptions = [...GENERAL_EVENTS.map((type) => ({ type })),
        ...paneIds.map((pane_id) => ({ type: 'pane.agent_status_changed', pane_id }))];
      socket.write(`${JSON.stringify({ id, method: 'events.subscribe', params: { subscriptions } })}\n`);
    });
    socket.on('data', (chunk: string) => {
      if (closed) return;
      pending += chunk;
      if (Buffer.byteLength(pending) > 256 * 1024) { finish(new Error('Herdr event buffer overflow.')); return; }
      let newline: number;
      try {
        while ((newline = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
          if (!line.trim()) continue;
          const value: unknown = JSON.parse(line);
          if (!nativeObject(value)) throw new Error('Invalid Herdr event envelope.');
          if (value.id === id) {
            if (!nativeObject(value.result) || value.result.type !== 'subscription_started') throw new Error('Herdr refused the event subscription.');
            if (!acknowledged) {
              acknowledged = true; clearTimeout(timer);
              resolve({ close: (): void => { closed = true; signal.removeEventListener('abort', cancel); socket.destroy(); } });
            }
          } else if (typeof value.event === 'string' && nativeObject(value.data)) onEvent(value.event);
          else throw new Error('Invalid Herdr event envelope.');
        }
      } catch (error) { finish(error instanceof Error ? error : new Error('Herdr event parsing failed.')); }
    });
    socket.once('error', finish);
    socket.once('close', () => finish(new Error('Herdr event connection closed.')));
  });
}
