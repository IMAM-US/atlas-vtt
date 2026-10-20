import React from 'react';
import { Button } from '../../packages/components/primitives/button';
import type { AccountWork } from '../account/accountSchema';
import { subjectOf } from '../account/accountQueries';
import type { NativeObject } from '../native/openRigRead';
import { transitionsRoute } from '../nativeRoutes';
import { useCard } from './cardContext';
import { RouteRow } from './RouteRow';
import { clock, dateClock, short } from './timeLabels';
import { freshnessLabel } from './freshnessLabels';
import { useWorkRead } from './useWorkRead';

const text = (value: unknown): string => (typeof value === 'string' ? value : value === null || value === undefined ? '' : JSON.stringify(value));
const BODY_LIMIT = 4000;

function transitionLine(entry: NativeObject): string {
  const at = clock(text(entry.tsCreated || entry.at || entry.createdAt));
  const change = [text(entry.fromState || entry.from), text(entry.toState || entry.to || entry.state)].filter(Boolean).join(' → ');
  const note = text(entry.note || entry.message || entry.reason);
  return [at, change, note].filter(Boolean).join(' · ');
}

/** The native record of one work item: summary, state, custody and transitions. Closure is labelled closure, not acceptance. */
export function WorkDetail({ sourceKey, qitemId, authored }: { sourceKey: string; qitemId: string; authored: AccountWork | null }): React.ReactElement {
  const { sources, loaded, openSubject } = useCard();
  const observation = useWorkRead(sourceKey, qitemId);
  const work = observation?.value;
  const review = authored?.review;
  const reviewer = review?.reviewerSubjectId ? subjectOf(loaded.account, review.reviewerSubjectId) : null;
  if (!work) return <p className="agent-link-muted">{freshnessLabel(observation)}</p>;
  if (work.state === 'unavailable') return <p className="agent-link-muted agent-link-row--unavailable">Unavailable: {work.message}</p>;
  const { item } = work;
  const body = text(item.body);
  const closed = text(item.state) === 'done';
  const waiting = item.waiting && typeof item.waiting === 'object' ? item.waiting as NativeObject : null;
  const backstop = waiting?.nextBackstop && typeof waiting.nextBackstop === 'object' ? waiting.nextBackstop as NativeObject : null;
  const deadlineAt = dateClock(text(waiting?.deadlineAt)), backstopAt = dateClock(text(backstop?.dueAt));
  return <div className="agent-link-detail">
    <p className="agent-link-muted">{freshnessLabel(observation)}</p>
    <dl>
      <dt>State</dt><dd>{text(item.state)}{closed ? ` · closure: ${text(item.closureReason) || 'recorded'}${text(item.handedOffTo) ? ` to ${text(item.handedOffTo)}` : ''} (closure, not acceptance)` : ''}</dd>
      <dt>Owner</dt><dd>{text(item.destinationSession)} · from {text(item.sourceSession)}</dd>
      <dt>Times</dt><dd>created {clock(text(item.tsCreated))}{text(item.claimedAt) ? ` · claimed ${clock(text(item.claimedAt))}` : ''} · updated {clock(text(item.tsUpdated))} · read {clock(work.observedAt)}</dd>
      {text(item.blockedOn) && <><dt>Blocked on</dt><dd>{text(item.blockedOn)}</dd></>}
      {deadlineAt && <><dt>Closure due</dt><dd>{deadlineAt} · Read {clock(work.observedAt)}</dd></>}
      {backstopAt && <><dt>Backstop due</dt><dd>{backstopAt}{text(backstop?.mechanism) ? ` (${text(backstop?.mechanism)})` : ''} · Read {clock(work.observedAt)}</dd></>}
    </dl>
    {body && <pre className="agent-link-body">{body.length > BODY_LIMIT ? `${body.slice(0, BODY_LIMIT)}…` : body}</pre>}
    {review && <div className="agent-link-review">
      <p><strong>Review</strong> at {short(review.revision)} · {clock(review.observedAt)}{reviewer ? <> · by <Button variant="link" className="agent-link-inline" onClick={() => openSubject(reviewer.id)}>{reviewer.caption}</Button></> : ''}</p>
      <p className="agent-link-muted">{review.summary}</p>
      <p className="agent-link-muted">Applies to revision {review.revision}; later bytes, other work and other branches are not covered.</p>
    </div>}
    <RouteRow label="Transitions" detail={`${work.transitions.length} recorded`} route={transitionsRoute(sources.source(sourceKey), qitemId)} tone="muted">
      <ol className="agent-link-transitions">{work.transitions.slice(-12).map((entry, index) => <li key={index}>{transitionLine(entry)}</li>)}</ol>
    </RouteRow>
  </div>;
}
