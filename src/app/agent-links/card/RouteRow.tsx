import React, { useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import { LabelTooltip } from '../../packages/components/primitives/tooltip';
import type { NativeRoute } from '../nativeRoutes';
import { copyText } from './openNote';

export interface RouteRowProps {
  /** The action, verb first ("Read screen"), or a plain label when there is nothing to press. */
  label: string;
  /** What the row shows beside the label: a target, a status word with its time, a value. */
  detail?: React.ReactNode;
  /** Why the action is disabled; shown as the row's status. */
  disabledReason?: string | null | undefined;
  onPress?: (() => void) | undefined;
  route?: NativeRoute | null;
  tone?: 'same' | 'changed' | 'unavailable' | 'muted' | undefined;
  children?: React.ReactNode;
}

/**
 * One row of the card: an action or a fact on the left, its detail and state on the right,
 * and *Copy native route* where a native route exists. Every state word carries its time.
 */
export function RouteRow({ label, detail, disabledReason, onPress, route, tone, children }: RouteRowProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    if (!route) return;
    setCopied(await copyText(route.text));
    window.setTimeout(() => setCopied(false), 1500);
  };
  return <div className={`agent-link-row${tone ? ` agent-link-row--${tone}` : ''}`}>
    <div className="agent-link-row__main">
      {onPress
        ? <Button variant="ghost" className="agent-link-row__action" disabled={Boolean(disabledReason)} onClick={onPress}>{label}</Button>
        : <span className="agent-link-row__label">{label}</span>}
      <span className="agent-link-row__detail">{disabledReason ?? detail}</span>
      {route && <LabelTooltip label={`Copy native route: ${route.label}`}>
        <Button variant="ghost" size="sm" className="agent-link-row__copy" aria-label={`Copy native route: ${route.label}`} onClick={() => { void copy(); }}>{copied ? 'Copied' : 'Copy'}</Button>
      </LabelTooltip>}
    </div>
    {children && <div className="agent-link-row__body">{children}</div>}
  </div>;
}
