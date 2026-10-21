import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import { copyText } from '../card/openNote';
import { clock } from '../card/timeLabels';
import { useActionSignal } from '../card/useActionSignal';
import { fileManagerName } from '../native/desktopOpen';
import { RECORD_WINDOW_MAX, RECORD_WINDOW_STEP, withShownLines, type RecordPin } from '../native/recordWindow';
import type { NativeSources } from '../NativeSources';
import { recordRoute } from '../nativeRoutes';
import { RECORD_ENTRY_MAX, type EntryCursor, type RecordEntry } from './recordEntries';
import { RECORD_LINE_MAX_BYTES } from './recordLines';
import { RecordEntryView } from './RecordEntryView';
import { RECORD_ENTRY_STEP, recordPage, type RecordPage } from './recordPage';
import type { RecordViewIdentity } from './recordViewState';

export type RecordSources = Pick<NativeSources, 'readRecordWindow' | 'revealConversationRecord' | 'watchSource'>;

/**
 * `end: null` reads up to the pin's boundary (or a new one without a pin). A page that moved
 * back ends at `before`, an entry inside the line that ends at `end`.
 */
interface ReadRequest { pin: RecordPin | null; end: number | null; before: EntryCursor | null; windowBytes: number; entryLimit: number }
const FIRST_READ: ReadRequest = { pin: null, end: null, before: null, windowBytes: RECORD_WINDOW_STEP, entryLimit: RECORD_ENTRY_STEP };

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const count = (n: number, one: string, many: string): string => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** A key per entry that survives a re-read: its line's byte and its place among that line's entries. */
const entryKey = (entry: RecordEntry): string => `${entry.offset}#${entry.ordinal}`;

/** Where the view scrolls once a read is shown: to the newest entry, or so the anchored entry stays where it was. */
type Scroll = { to: 'newest' } | { to: 'anchor'; key: string; top: number };

/**
 * The next *Load earlier*: show more of the range already read, then read further back while
 * the page has room, and once a cap is reached move back a page, dropping the newest one.
 * Room is counted in entries actually shown, so a range of oversized or unshown lines keeps
 * reading back instead of filling the cap with nothing. Null when nothing is earlier.
 */
function earlier(page: RecordPage, current: ReadRequest): ReadRequest | null {
  const shown = page.entries.length;
  const room = Math.min(shown + RECORD_ENTRY_STEP, RECORD_ENTRY_MAX);
  if (shown < RECORD_ENTRY_MAX && page.parsedEntries > shown) return { ...current, entryLimit: room };
  if (shown < RECORD_ENTRY_MAX && !page.complete && current.windowBytes < RECORD_WINDOW_MAX) {
    return { ...current, entryLimit: room, windowBytes: Math.min(current.windowBytes + RECORD_WINDOW_STEP, RECORD_WINDOW_MAX) };
  }
  if (page.complete && page.parsedEntries <= shown) return null;
  // The new page ends just before the first dropped entry, even inside a line holding many.
  const first = shown > 1 ? page.entries[shown - Math.min(RECORD_ENTRY_STEP, shown - 1)] : page.entries[0];
  if (first) return { ...current, end: first.lineEnd, before: { offset: first.offset, ordinal: first.ordinal } };
  // Nothing shown: end before the range's first whole line, or, inside one line longer than the range, where the range began.
  const end = page.firstLineOffset < page.end ? page.firstLineOffset : page.start;
  return end > 0 && end < page.end ? { ...current, end, before: null } : null;
}

/** What the range covers: a total only when the read started at the record's first byte. */
function rangeSummary(page: RecordPage): string {
  const shown = page.entries.length < page.parsedEntries ? ` · showing the last ${page.entries.length.toLocaleString()}` : '';
  if (!page.latest) return `Showing entries from a bounded earlier range: ${count(page.parsedEntries, 'entry', 'entries')} from ${size(page.end - page.start)}${shown}`;
  if (page.complete) return `All ${count(page.parsedEntries, 'entry', 'entries')}${shown}`;
  return `${count(page.parsedEntries, 'entry', 'entries')} from the last ${size(page.end - page.start)} of ${size(page.end)}${shown}`;
}

function rangeNotes(page: RecordPage, entryLimit: number): string[] {
  return [
    page.fileSizeBytes > page.boundary ? `The record has grown by ${size(page.fileSizeBytes - page.boundary)} since this read. Reload to read it.` : '',
    page.latest && page.incompleteEnd ? 'The last line was still being written and is not shown.' : '',
    page.malformed ? `${count(page.malformed, 'malformed line', 'malformed lines')} not shown.` : '',
    page.oversized ? `${count(page.oversized, 'line', 'lines')} over ${size(RECORD_LINE_MAX_BYTES)} not shown.` : '',
    entryLimit >= RECORD_ENTRY_MAX ? `At most ${RECORD_ENTRY_MAX.toLocaleString()} entries are shown at once; Load earlier now moves back a page and drops the newest.` : '',
  ].filter(Boolean);
}

/**
 * A dated, bounded read of one exact conversation record, rendered as plain text. Every read,
 * *Load earlier* and *Show in Finder* locates and checks the record again; nothing follows
 * the record in the background and nothing of it is written anywhere. A change to the
 * source's settings drops the read and any pending action until the person reloads.
 */
export function RecordViewContent({ identity, sources }: { identity: RecordViewIdentity; sources: RecordSources }): React.ReactElement {
  const next = useActionSignal();
  const [page, setPage] = useState<RecordPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'reading' | 'revealing' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const request = useRef<ReadRequest>(FIRST_READ);
  const scroller = useRef<HTMLDivElement | null>(null);
  const scroll = useRef<Scroll | null>(null);
  const location = { runtime: identity.runtime, conversationId: identity.conversationId, ...(identity.cwd ? { cwd: identity.cwd } : {}) };

  /** The first entry on screen and its distance from the top of the view, so *Load earlier* keeps the reader's place. */
  const anchor = (): Scroll => {
    const view = scroller.current;
    const first = view?.querySelector<HTMLElement>('[data-entry-key]');
    if (!view || !first?.dataset.entryKey) return { to: 'newest' };
    return { to: 'anchor', key: first.dataset.entryKey, top: first.getBoundingClientRect().top - view.getBoundingClientRect().top };
  };
  const read = async (wanted: ReadRequest, then: Scroll = { to: 'newest' }): Promise<void> => {
    const signal = next();
    setBusy('reading');
    setStatus(null);
    try {
      const window = await sources.readRecordWindow(identity.sourceKey, location, {
        windowBytes: wanted.windowBytes, pin: wanted.pin, ...(wanted.end !== null ? { end: wanted.end } : {}), signal,
      });
      if (signal.aborted) return;
      const shown = recordPage(window, wanted.entryLimit, wanted.before);
      request.current = { ...wanted, pin: withShownLines(window.pin, shown.shownLines) };
      scroll.current = then;
      setPage(shown);
      setError(null);
    } catch (failure) {
      if (signal.aborted) return;
      setError(failure instanceof Error && failure.message ? failure.message : 'The record could not be read.');
    }
    setBusy(null);
  };
  const reveal = async (): Promise<void> => {
    const signal = next();
    setBusy('revealing');
    try {
      const shownIn = await sources.revealConversationRecord(identity.sourceKey, location, { signal });
      if (signal.aborted) return;
      setStatus(`Shown in ${shownIn}.`);
    } catch (failure) {
      if (signal.aborted) return;
      setStatus(failure instanceof Error && failure.message ? failure.message : 'The record could not be shown.');
    }
    setBusy(null);
  };
  const copy = async (): Promise<void> => {
    if (!page) return;
    setStatus(await copyText(recordRoute(page.path).text) ? 'Copied the native route.' : 'Could not copy the native route.');
  };
  // The view reads once when it opens for an identity; everything after is the person's explicit action.
  useEffect(() => { void read(FIRST_READ); }, []);
  useEffect(() => sources.watchSource(identity.sourceKey, () => {
    next();
    request.current = FIRST_READ;
    setPage(null);
    setBusy(null);
    setStatus(null);
    setError('The source settings changed. Reload to read the record with them.');
  }), [sources, identity.sourceKey, next]);

  useLayoutEffect(() => {
    const view = scroller.current;
    const wanted = scroll.current;
    scroll.current = null;
    if (!view || !wanted || !page) return;
    if (wanted.to === 'newest') {
      view.scrollTop = view.scrollHeight;
      return;
    }
    const kept = view.querySelector<HTMLElement>(`[data-entry-key="${wanted.key}"]`);
    if (kept) view.scrollTop += kept.getBoundingClientRect().top - view.getBoundingClientRect().top - wanted.top;
  }, [page]);

  const before = page ? earlier(page, request.current) : null;
  // The header stays put above the entries' own scroller, so identity, read time and Reload are always in view.
  return <div className="atlas-record-view__content">
    <header className="atlas-record-view__header">
      <h2>{identity.seatCaption || 'Conversation record'}</h2>
      <p className="atlas-record-view__identity">{identity.runtime === 'codex' ? 'Codex' : 'Claude Code'} · conversation <code>{identity.conversationId}</code></p>
      {page && <p className="atlas-record-view__path">{page.path}</p>}
      <div className="atlas-record-view__actions">
        <span className="atlas-record-view__read">{busy === 'reading' ? 'Reading…' : page ? `Read ${clock(page.observedAt)}` : ''}</span>
        <Button variant="secondary" disabled={busy === 'reading'} onClick={() => { void read(FIRST_READ); }}>Reload</Button>
        <Button variant="secondary" disabled={busy === 'revealing'} onClick={() => { void reveal(); }}>Show in {fileManagerName()}</Button>
        <Button variant="secondary" disabled={!page} onClick={() => { void copy(); }}>Copy native route</Button>
      </div>
      {status && <p className="atlas-record-view__status">{status}</p>}
      {error && <p className="atlas-record-view__status atlas-record-view__status--error">{error}</p>}
      {page && <p className="atlas-record-view__summary">{rangeSummary(page)}</p>}
      {page && rangeNotes(page, request.current.entryLimit).map((note) => <p key={note} className="atlas-record-view__status">{note}</p>)}
    </header>
    <div ref={scroller} className="atlas-record-view__scroller">
      {page && <section className="atlas-record-view__entries" aria-label="Record entries">
        {before && <Button variant="secondary" disabled={busy === 'reading'} onClick={() => { void read(before, anchor()); }}>Load earlier</Button>}
        {page.entries.map((entry) => <RecordEntryView key={entryKey(entry)} entryKey={entryKey(entry)} entry={entry} />)}
        {!page.latest && <Button variant="secondary" disabled={busy === 'reading'}
          onClick={() => { void read({ ...FIRST_READ, pin: request.current.pin }); }}>Back to latest</Button>}
        {page.notShown.length > 0 && <details className="atlas-record-view__not-shown">
          <summary>Not shown: {count(page.notShown.reduce((sum, [, n]) => sum + n, 0), 'entry', 'entries')} without conversation text</summary>
          <ul>{page.notShown.map(([type, n]) => <li key={type}><code>{type}</code> × {n.toLocaleString()}</li>)}</ul>
        </details>}
      </section>}
    </div>
  </div>;
}
