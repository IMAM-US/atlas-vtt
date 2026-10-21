import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import { CloseButton } from '../../packages/components/primitives/CloseButton';
import { clock } from '../card/timeLabels';
import { fileName } from './applyReport';
import type { ChosenRow, ProposalsSnapshot } from './MapmakingSession';
import type { NotOnMap } from './proposals';
import './proposals.scss';

export interface ProposalsPanelProps {
  snapshot: ProposalsSnapshot;
  onPreview: (chosen: readonly ChosenRow[]) => void;
  /** `consent` is the basis a reformat was agreed for, or null. */
  onApply: (chosen: readonly ChosenRow[], consent: string | null) => void;
  onDismiss: (key: string) => void;
  onChooseTarget: (path: string) => void;
  onClose: () => void;
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** What Apply will do, said before it is pressed. */
export function applyLabel(chosen: readonly NotOnMap[], targetFile: string): string {
  const created = chosen.filter((row) => !row.reuse).length;
  const tokens = `Add ${count(chosen.length, 'token', 'tokens')} (hidden)`;
  return created ? `${tokens} · adds ${count(created, 'seat', 'seats')} to ${targetFile}` : tokens;
}

/** The DM's list of the scene's proposed map edits. Nothing is written until Apply. */
export function ProposalsPanel(props: ProposalsPanelProps): React.ReactElement {
  const { set, placements, targetPath, busy } = props.snapshot;
  const targetFile = targetPath ? fileName(targetPath) : '';
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [captions, setCaptions] = useState<ReadonlyMap<string, string>>(new Map());
  const [consented, setConsented] = useState<string | null>(null);
  const rows = set.notOnMap;
  const chosen = useMemo(() => rows.filter((row) => selected.has(row.key) && placements.get(row.key)), [rows, selected, placements]);
  const choice = useMemo((): ChosenRow[] => chosen.map((row) => ({ key: row.key, caption: (captions.get(row.key) ?? row.node.logicalId).trim() || row.node.logicalId })), [chosen, captions]);
  const { onPreview } = props;
  useEffect(() => onPreview(choice), [choice, onPreview]);
  const toggle = (key: string): void => setSelected((current) => {
    const next = new Set(current);
    if (!next.delete(key)) next.add(key);
    return next;
  });
  // A consent counts only for the account exactly as loaded when it was given.
  const { basis, layout } = props.snapshot;
  const writes = chosen.some((row) => !row.reuse);
  const checking = writes && layout === 'checking';
  const needsConsent = writes && layout === 'reformat' && consented !== basis;
  const apply = (): void => {
    if (needsConsent) { setConsented(basis); return; }
    props.onApply(choice, consented === basis ? basis : null);
  };
  return <section className="atlas-proposals" aria-label="Proposals" onKeyDown={(event) => event.stopPropagation()}>
    <header className="atlas-proposals__header">
      <h3>Proposals</h3>
      <CloseButton aria-label="Close proposals" onClick={props.onClose} />
    </header>
    <div className="atlas-proposals__content">
      {props.snapshot.scope.map((line) => <p key={line} className="atlas-proposals__muted">{line}</p>)}
      {props.snapshot.targets.length > 1 && <label className="atlas-proposals__target">
        <span>New seats go to</span>
        <select value={targetPath ?? ''} disabled={busy} onChange={(event) => props.onChooseTarget(event.target.value)}>
          {!targetPath && <option value="" disabled>Choose an account</option>}
          {props.snapshot.targets.map((path) => <option key={path} value={path}>{fileName(path)}</option>)}
        </select>
      </label>}
      {set.status.kind === 'blocked' && <p className="atlas-proposals__note">{set.status.reason}</p>}
      {set.waiting.map((entry) => <p key={`${entry.sourceKey}:${entry.rigId}`} className="atlas-proposals__muted">{entry.rigId}: {entry.reason}</p>)}
      {props.snapshot.status && <p className="atlas-proposals__note" role="status">{props.snapshot.status}</p>}
      {rows.length > 0 && <section aria-label="Not on map">
        <h4>Not on map</h4>
        {rows.map((row) => {
          const place = placements.get(row.key);
          return <div key={row.key} className="atlas-proposals__row">
            <input type="checkbox" aria-label={`Add ${row.node.logicalId}`} checked={selected.has(row.key)} disabled={!place || busy} onChange={() => toggle(row.key)} />
            <input type="text" aria-label={`Caption for ${row.node.logicalId}`} value={captions.get(row.key) ?? row.node.logicalId} disabled={busy}
              onChange={(event) => { const value = event.target.value; setCaptions((current) => new Map(current).set(row.key, value)); }} />
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => props.onDismiss(row.key)}>Dismiss</Button>
            <span className="atlas-proposals__muted atlas-proposals__detail">
              {row.node.podId ? `pod ${row.node.podId}` : 'no pod'}
              {row.reuse ? ` · in ${targetFile} as ${row.reuse.caption}` : row.pinnedEarlier ? ` · ${targetFile} pins this seat's earlier conversation as ${row.pinnedEarlier.caption}` : ''}
              {place ? '' : ' · No free space on the map'}
            </span>
          </div>;
        })}
        <Button variant="secondary" disabled={!chosen.length || busy || checking} onClick={apply}>
          {checking ? `Checking the layout of ${targetFile}…` : needsConsent ? `Apply will reformat ${targetFile} once` : applyLabel(chosen, targetFile)}
        </Button>
      </section>}
      {set.notInOpenRig.length > 0 && <section aria-label="Not in OpenRig now">
        <h4>Not in OpenRig now</h4>
        {set.notInOpenRig.map((row) => <div key={row.key} className="atlas-proposals__row">
          <span>{row.subject.caption}<span className="atlas-proposals__muted">{row.observedAt ? ` · inventory ${clock(row.observedAt)}` : ''}</span></span>
          <Button variant="ghost" size="sm" onClick={() => props.onDismiss(row.key)}>Dismiss</Button>
        </div>)}
      </section>}
      {set.differentSeatNow.length > 0 && <section aria-label="Different seat now">
        <h4>Different seat now</h4>
        {set.differentSeatNow.map((row) => <p key={row.key} className="atlas-proposals__muted">{row.subject.caption}: {row.node?.logicalId} is a different seat now. Atlas never rebinds a token to it.</p>)}
      </section>}
      {set.newInGroupPod.length > 0 && <section aria-label="New in a group's pod">
        <h4>New in a group's pod</h4>
        {set.newInGroupPod.map((row) => <p key={row.key} className="atlas-proposals__muted">{row.node.logicalId} is not a member of {row.group.caption}. Membership changes only by an authored update.</p>)}
      </section>}
      {set.cantPropose.length > 0 && <section aria-label="Can't propose">
        <h4>Can't propose</h4>
        {set.cantPropose.map((row) => <p key={row.key} className="atlas-proposals__muted">{row.reason}</p>)}
      </section>}
      {set.unused.length > 0 && <section aria-label="Unused seats added by Atlas">
        <h4>Unused seats added by Atlas</h4>
        {set.unused.map((row) => <p key={row.subject.id} className="atlas-proposals__muted">{row.subject.caption}: {row.reason}</p>)}
      </section>}
    </div>
  </section>;
}
