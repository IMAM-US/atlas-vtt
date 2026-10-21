import React, { useState } from 'react';
import { Notice } from 'obsidian';
import { Button } from '../../packages/components/primitives/button';
import type { SeatSubject } from '../account/accountSchema';
import { recordRoute } from '../nativeRoutes';
import type { ConversationRecord, CurrentSeat } from '../reads';
import { openRecordView } from '../records/openRecordView';
import { useCard } from './cardContext';
import { RouteRow } from './RouteRow';
import { clock, short } from './timeLabels';

interface RecordParticipant { runtime: 'claude-code' | 'codex'; conversationId: string; cwd: string | null }
interface RecordState { participant: RecordParticipant; read: ConversationRecord }

/** A record belongs to one conversation of one source; a row shows only the record of the identity it names now. */
function recordKey(sourceKey: string, participant: RecordParticipant): string {
  return JSON.stringify([sourceKey, participant.runtime, participant.conversationId]);
}

/**
 * The exact provider records of the map's conversation and of the seat's current one. Each
 * located record and its opener are bound to the source, runtime and conversation they were
 * read for, so neither a changed current identity nor a read that completes late can put one
 * conversation's record under another conversation's row.
 */
export function ConversationRecords({ subject, current, changed, pinnedElsewhere, startAction }: {
  subject: SeatSubject; current: CurrentSeat | null; changed: boolean; pinnedElsewhere: boolean;
  /** The section's one in-flight action: starting a record action aborts any other. */
  startAction: () => AbortSignal;
}): React.ReactElement | null {
  const { app, sources } = useCard();
  const [records, setRecords] = useState<ReadonlyMap<string, RecordState>>(new Map());
  const currentParticipant: RecordParticipant | null = current?.participant
    ? { runtime: current.participant.runtime === 'codex' ? 'codex' : 'claude-code', conversationId: current.participant.conversationId, cwd: current.cwd }
    : null;
  // The map's conversation is located by what the map captured, never through the seat's current occupant.
  const mapParticipant: RecordParticipant | null = subject.participant
    ? { runtime: subject.participant.runtime, conversationId: subject.participant.conversationId, cwd: subject.participant.cwd ?? null }
    : null;
  const locate = async (participant: RecordParticipant): Promise<void> => {
    const signal = startAction();
    const read = await sources.locateRecord(subject.sourceKey, participant, { signal });
    if (signal.aborted) return;
    setRecords((existing) => new Map(existing).set(recordKey(subject.sourceKey, participant), { participant, read }));
  };
  /** Opens the record inside Obsidian; the view locates and checks it again itself. */
  const open = (entry: RecordState): void => {
    const { runtime, conversationId, cwd } = entry.participant;
    openRecordView(app, { sourceKey: subject.sourceKey, runtime, conversationId, cwd, seatCaption: subject.caption })
      .catch((error: unknown) => new Notice(error instanceof Error ? error.message : 'The record could not be opened.'));
  };

  const row = (participant: RecordParticipant | null, label: string, detail: string, tone?: 'changed'): React.ReactElement | null => {
    if (!participant) return null;
    const key = recordKey(subject.sourceKey, participant);
    const entry = records.get(key);
    return <RouteRow key={label} label={label} onPress={() => { void locate(participant); }} detail={detail} tone={tone}
      route={entry?.read.state === 'current' ? recordRoute(entry.read.record.path) : null}>
      {entry && <RecordDetail entry={entry} onOpen={() => open(entry)} />}
    </RouteRow>;
  };
  // The first row is the map's conversation when the subject pins it elsewhere, otherwise the seat's current one.
  const first = changed && pinnedElsewhere ? mapParticipant : currentParticipant ?? mapParticipant;
  return <>
    {row(first, changed ? (pinnedElsewhere ? 'Pinned conversation record' : 'Current conversation record') : 'Conversation record', `${short(first?.conversationId)}… · growing record`)}
    {changed && !pinnedElsewhere && row(mapParticipant, 'Previous conversation record', `${short(mapParticipant?.conversationId)}… · map's conversation`)}
    {changed && pinnedElsewhere && row(currentParticipant, 'Current occupant: conversation record', `${short(currentParticipant?.conversationId)}… · another conversation`, 'changed')}
  </>;
}

function RecordDetail({ entry, onOpen }: { entry: RecordState; onOpen: () => void }): React.ReactElement {
  const { read } = entry;
  if (read.state === 'unavailable') return <p className="agent-link-muted agent-link-row--unavailable">{read.message}</p>;
  const { record } = read;
  return <div className="agent-link-list">
    <p className="agent-link-muted">Exact provider record · {record.validatedRecords} record{record.validatedRecords === 1 ? '' : 's'} checked · {Math.round(record.fileSizeBytes / 1024)} KB{record.complete ? '' : ' and growing'} · {clock(read.observedAt)}</p>
    <Button variant="secondary" onClick={onOpen}>Open record</Button>
  </div>;
}
