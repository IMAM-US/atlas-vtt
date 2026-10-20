import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import { CloseButton } from '../../packages/components/primitives/CloseButton';
import { useAtlasUI } from '../../react/root/AtlasUIContext';
import type { SourceReference } from '../../types';
import { subjectOf } from '../account/accountQueries';
import { NativeSources } from '../NativeSources';
import { CardContext, type CardContextValue } from './cardContext';
import { GroupCard } from './GroupCard';
import { SeatCard } from './SeatCard';
import { useAccount } from './useAccount';
import './agent-link-card.scss';

/**
 * The account card of one bound map object. It opens from the captured account at once and
 * navigates between subjects of the same account (members, relations) with a return path.
 * Nothing here focuses a terminal, sends input, starts a participant or creates work.
 */
export function AgentLinkCard({ reference, authoredLabel, style, onClose }: {
  reference: SourceReference; authoredLabel: string; style: React.CSSProperties; onClose: () => void;
}): React.ReactElement {
  const { app } = useAtlasUI();
  const { loaded, error, reload } = useAccount(app, reference.accountPath);
  const [stack, setStack] = useState<string[]>([reference.subjectId]);
  useEffect(() => setStack([reference.subjectId]), [reference.subjectId, reference.accountPath]);
  const subjectId = stack[stack.length - 1] ?? reference.subjectId;
  const subject = loaded ? subjectOf(loaded.account, subjectId) : null;
  const previous = stack.length > 1 && loaded ? subjectOf(loaded.account, stack[stack.length - 2]!) : null;
  const context = useMemo((): CardContextValue | null => loaded ? {
    app, sources: NativeSources.forApp(app), loaded,
    openSubject: (id) => setStack((current) => (current[current.length - 1] === id ? current : [...current, id])),
  } : null, [app, loaded]);
  const title = stack.length > 1 && subject ? subject.caption : authoredLabel;
  return <section className="agent-link-card" aria-label="Source account" style={style} onKeyDown={(event) => event.stopPropagation()}>
    <header className="agent-link-card__header atlas-close-header">
      {previous && <Button variant="ghost" size="sm" className="agent-link-card__back" onClick={() => setStack((current) => current.slice(0, -1))}>← {previous.caption}</Button>}
      <h3>{title}</h3>
      <CloseButton aria-label="Close account card" onClick={onClose} />
    </header>
    <div className="agent-link-card__content">
      {error && <>
        <p className="agent-link-headline agent-link-headline--unavailable">Account unavailable</p>
        <p className="agent-link-muted">{error}</p>
        <p className="agent-link-muted">{reference.accountPath} · subject {reference.subjectId}</p>
        <Button variant="secondary" onClick={reload}>Retry</Button>
      </>}
      {!error && !loaded && <p className="agent-link-muted">Reading the account…</p>}
      {context && !subject && <>
        <p className="agent-link-headline agent-link-headline--unavailable">Subject not in this account</p>
        <p className="agent-link-muted">{reference.accountPath} has no subject {subjectId}.</p>
      </>}
      {context && subject && <CardContext.Provider value={context}>
        {subject.kind === 'seat' ? <SeatCard key={subject.id} subject={subject} /> : <GroupCard key={subject.id} subject={subject} />}
      </CardContext.Provider>}
    </div>
  </section>;
}
