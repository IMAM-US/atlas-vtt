import type { AccountDocument, SeatSubject } from '../account/accountSchema';
import type { Freshness } from '../live/types';
import type { NativeRefusal } from '../reads';

export type Activity = 'working' | 'idle' | 'needs-input' | 'unknown' | 'absent';
export interface FactStamp {
  sourceKey: string; epoch: number; revision: number; freshness: Freshness; observedAt: string | null; message: string | null; refusal?: NativeRefusal;
}
export interface Halo extends FactStamp {
  key: string;
  activity: Activity;
  label: string;
}
export interface Pip extends FactStamp { count: number | null; truncated: boolean; blocked: number; label: string }
export interface Tether {
  key: string; targetId: string; label: string; freshness: Freshness; evidence: readonly FactStamp[];
  bindings: readonly { appearanceId: string; binding: string }[];
}
export interface AppearanceMark {
  id: string;
  binding: string;
  halos: readonly Halo[];
  pip: Pip | null;
  tethers: readonly Tether[];
  lines: readonly string[];
}
export interface BoundAppearance {
  id: string;
  caption: string;
  token: boolean;
  path: string;
  subjectId: string;
  account: AccountDocument;
  revision: string;
}
export interface SeatBinding { subject: SeatSubject; appearance: BoundAppearance; lens?: string }

/** Presentation keys include immutable native identity; captions never join native facts. */
export function subjectKey(subject: SeatSubject): string {
  return JSON.stringify([subject.sourceKey, subject.seat.rigId, subject.seat.nodeId, subject.seat.logicalId]);
}
