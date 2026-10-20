import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../packages/components/primitives/button';
import { copyText } from '../card/openNote';
import { clock } from '../card/timeLabels';
import { useActionSignal } from '../card/useActionSignal';
import { fileManagerName } from '../native/desktopOpen';
import { RECORD_WINDOW_MAX, RECORD_WINDOW_STEP, type RecordPin } from '../native/recordWindow';
import type { NativeSources } from '../NativeSources';
import { recordRoute } from '../nativeRoutes';
import { RECORD_LINE_MAX_BYTES } from './recordLines';
import { RecordEntryView } from './RecordEntryView';
import { RECORD_ENTRY_STEP, recordPage, type RecordPage } from './recordPage';
import type { RecordViewIdentity } from './recordViewState';

export type RecordSources = Pick<NativeSources, 'readRecordWindow' | 'revealConversationRecord'>;

interface ReadRequest { pin: RecordPin | null; windowBytes: number; entryLimit: number }
const FIRST_READ: ReadRequest = { pin: null, windowBytes: RECORD_WINDOW_STEP, entryLimit: RECORD_ENTRY_STEP };

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const count = (n: number, one: string, many: string): string => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** What the range covers: a total only when the read started at the record's first byte. */
function rangeSummary(page: RecordPage): string {
  const covered = page.complete ? `All ${count(page.parsedEntries, 'entry', 'entries')}` : `${count(page.parsedEntries, 'entry', 'entries')} from the last ${size(page.end - page.start)} of ${size(page.end)}`;
  return page.entries.length < page.parsedEntries ? `${covered} · showing the last ${page.entries.length.toLocaleString()}` : covered;
}

function rangeNotes(page: RecordPage): string[] {
  return [
    page.fileSizeBytes > page.end ? `The record has grown by ${size(page.fileSizeBytes - page.end)} since this read. Reload to read it.` : '',
    page.incompleteEnd ? 'The last line was still being written and is not shown.' : '',
    page.malformed ? `${count(page.malformed, 'malformed line', 'malformed lines')} not shown.` : '',
    page.oversized ? `${count(page.oversized, 'line', 'lines')} over ${size(RECORD_LINE_MAX_BYTES)} not shown.` : '',
  ].filter(Boolean);
}

/**
 * A dated, bounded read of one exact conversation record, rendered as plain text. Every read,
 * *Load earlier* and *Show in Finder* locates and checks the record again; nothing follows
 * the record in the background and nothing of it is written anywhere.
 */
export function RecordViewContent({ identity, sources }: { identity: RecordViewIdentity; sources: RecordSources }): React.ReactElement {
  const next = useActionSignal();
  const [page, setPage] = useState<RecordPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'reading' | 'revealing' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const request = useRef<ReadRequest>(FIRST_READ);
  const location = { runtime: identity.runtime, conversationId: identity.conversationId, ...(identity.cwd ? { cwd: identity.cwd } : {}) };

  const read = async (wanted: ReadRequest): Promise<void> => {
    const signal = next();
    setBusy('reading');
    setStatus(null);
    try {
      const window = await sources.readRecordWindow(identity.sourceKey, location, { windowBytes: wanted.windowBytes, pin: wanted.pin, signal });
      if (signal.aborted) return;
      const shown = recordPage(window, wanted.entryLimit);
      request.current = { ...wanted, pin: window.pin };
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

  const moreParsed = page ? page.parsedEntries > page.entries.length : false;
  const moreBytes = page ? !page.complete && request.current.windowBytes < RECORD_WINDOW_MAX : false;
  const loadEarlier = (): void => {
    const current = request.current;
    void read({ pin: current.pin, entryLimit: current.entryLimit + RECORD_ENTRY_STEP,
      windowBytes: moreParsed ? current.windowBytes : Math.min(current.windowBytes + RECORD_WINDOW_STEP, RECORD_WINDOW_MAX) });
  };
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
      {page && rangeNotes(page).map((note) => <p key={note} className="atlas-record-view__status">{note}</p>)}
    </header>
    {page && <section className="atlas-record-view__entries" aria-label="Record entries">
      {(moreParsed || moreBytes) && <Button variant="secondary" disabled={busy === 'reading'} onClick={loadEarlier}>Load earlier</Button>}
      {!moreParsed && !moreBytes && !page.complete && <p className="atlas-record-view__status">Earlier entries lie before the {size(RECORD_WINDOW_MAX)} this view reads.</p>}
      {page.entries.map((entry, index) => <RecordEntryView key={`${page.start}:${page.parsedEntries - page.entries.length + index}`} entry={entry} />)}
      {page.notShown.length > 0 && <details className="atlas-record-view__not-shown">
        <summary>Not shown: {count(page.notShown.reduce((sum, [, n]) => sum + n, 0), 'entry', 'entries')} without conversation text</summary>
        <ul>{page.notShown.map(([type, n]) => <li key={type}><code>{type}</code> × {n.toLocaleString()}</li>)}</ul>
      </details>}
    </section>}
  </div>;
}
