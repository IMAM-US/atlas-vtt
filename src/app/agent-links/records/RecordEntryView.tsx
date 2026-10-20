import React from 'react';
import { clock } from '../card/timeLabels';
import type { RecordEntry } from './recordEntries';
import { boundedText } from './recordPage';

const ROLE_LABEL: Record<Extract<RecordEntry, { kind: 'turn' }>['role'], string> = {
  user: 'User', assistant: 'Assistant', developer: 'Developer', agent: 'Agent',
};

/** Record text is rendered as plain text in a `pre`: markup, links and embeds in it stay inert. */
function EntryText({ text, empty }: { text: string; empty?: string }): React.ReactElement {
  if (!text) return <p className="atlas-record-entry__empty">{empty ?? 'No text.'}</p>;
  const bounded = boundedText(text);
  return <>
    <pre className="atlas-record-entry__text">{bounded.text}</pre>
    {bounded.omitted > 0 && <p className="atlas-record-entry__empty">{bounded.omitted.toLocaleString()} more characters not shown.</p>}
  </>;
}

function Collapsed({ title, at, tone, children }: { title: string; at: string | null; tone?: string | undefined; children: React.ReactNode }): React.ReactElement {
  return <details className={`atlas-record-entry atlas-record-entry--collapsed${tone ? ` atlas-record-entry--${tone}` : ''}`}>
    <summary><span>{title}</span>{at && <time>{clock(at)}</time>}</summary>
    {children}
  </details>;
}

/** One entry: turns read openly, tools, reasoning and anything unknown stay collapsed with their name showing. */
export function RecordEntryView({ entry }: { entry: RecordEntry }): React.ReactElement {
  switch (entry.kind) {
    case 'turn': {
      const title = `${ROLE_LABEL[entry.role]}${entry.label ? ` · ${entry.label}` : ''}`;
      if (entry.role === 'developer') return <Collapsed title={title} at={entry.at}><EntryText text={entry.text} /></Collapsed>;
      return <article className={`atlas-record-entry atlas-record-entry--turn atlas-record-entry--${entry.role}`}>
        <header><strong>{title}</strong>{entry.at && <time>{clock(entry.at)}</time>}</header>
        <EntryText text={entry.text} />
      </article>;
    }
    case 'tool-call':
      return <Collapsed title={`Tool call · ${entry.name}`} at={entry.at}><EntryText text={entry.text} /></Collapsed>;
    case 'tool-result':
      return <Collapsed title={`Tool result · ${entry.name ?? 'tool'}${entry.isError ? ' · error' : ''}`} at={entry.at} tone={entry.isError ? 'error' : undefined}>
        <EntryText text={entry.text} />
      </Collapsed>;
    case 'reasoning':
      return <Collapsed title="Reasoning" at={entry.at}><EntryText text={entry.text} empty="Not recorded in readable form." /></Collapsed>;
    case 'note':
      return <Collapsed title={entry.label} at={entry.at}><EntryText text={entry.text} /></Collapsed>;
    case 'raw':
      return <Collapsed title={`Entry · ${entry.type}`} at={entry.at} tone="raw"><EntryText text={entry.text} /></Collapsed>;
  }
}
