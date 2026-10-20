import React from 'react';
import { Button } from '../../packages/components/primitives/button';
import { CloseButton } from '../../packages/components/primitives/CloseButton';
import type { SourceReference } from '../../types';

export interface ChooserEntry { objectId: string; label: string; reference: SourceReference }

/** Several bound objects are selected: choose one subject first; no native read happens before that. */
export function ChooserCard({ entries, onChoose, onClose, style }: {
  entries: readonly ChooserEntry[]; onChoose: (objectId: string) => void; onClose: () => void; style: React.CSSProperties;
}): React.ReactElement {
  return <section className="agent-link-card" aria-label="Choose a subject" style={style} onKeyDown={(event) => event.stopPropagation()}>
    <header className="agent-link-card__header atlas-close-header">
      <h3>{entries.length} selected</h3>
      <CloseButton aria-label="Close" onClick={onClose} />
    </header>
    <div className="agent-link-card__content">
      <p className="agent-link-muted">Choose a subject to open its card.</p>
      <div className="agent-link-list">
        {entries.map((entry) => <Button key={entry.objectId} variant="secondary" onClick={() => onChoose(entry.objectId)}>{entry.label}<span className="agent-link-muted">{entry.reference.subjectId}</span></Button>)}
      </div>
    </div>
  </section>;
}
