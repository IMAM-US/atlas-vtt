import type { AccountArtifact, AccountDocument, AccountSubject, AccountWork, GroupSubject, SeatSubject } from './accountSchema';

/** Lookups over a validated account; every miss is a null, never a guess by caption. */
export function subjectOf(account: AccountDocument, subjectId: string): AccountSubject | null {
  return account.subjects.find((entry) => entry.id === subjectId) ?? null;
}

export function seatOf(account: AccountDocument, subjectId: string): SeatSubject | null {
  const subject = subjectOf(account, subjectId);
  return subject?.kind === 'seat' ? subject : null;
}

export function groupOf(account: AccountDocument, subjectId: string): GroupSubject | null {
  const subject = subjectOf(account, subjectId);
  return subject?.kind === 'group' ? subject : null;
}

export function workOf(account: AccountDocument, workId: string): AccountWork | null {
  return account.work.find((entry) => entry.id === workId) ?? null;
}

/** The authored entry for a native queue item of one source, so a live row can offer its authored artifacts. */
export function workByQitem(account: AccountDocument, sourceKey: string, qitemId: string): AccountWork | null {
  return account.work.find((entry) => entry.sourceKey === sourceKey && entry.qitemId === qitemId) ?? null;
}

export function artifactOf(account: AccountDocument, artifactId: string): AccountArtifact | null {
  return account.artifacts.find((entry) => entry.id === artifactId) ?? null;
}

export function artifactsOf(account: AccountDocument, ids: readonly string[] | undefined): AccountArtifact[] {
  return (ids ?? []).flatMap((id) => { const found = artifactOf(account, id); return found ? [found] : []; });
}

/** The seat a session address names within one source; addresses are locators, so this is for navigation only. */
export function seatBySessionAddress(account: AccountDocument, sourceKey: string, sessionAddress: string): SeatSubject | null {
  return account.subjects.find((entry): entry is SeatSubject => entry.kind === 'seat' && entry.sourceKey === sourceKey && entry.seat.sessionAddress === sessionAddress) ?? null;
}

/** The map's work for a seat, in authored order. */
export function mapWorkOf(account: AccountDocument, seat: SeatSubject): AccountWork[] {
  return seat.workIds.flatMap((id) => { const found = workOf(account, id); return found ? [found] : []; });
}

/** Groups that list the seat, for a member card's return link. */
export function groupsContaining(account: AccountDocument, subjectId: string): GroupSubject[] {
  return account.subjects.filter((entry): entry is GroupSubject => entry.kind === 'group' && entry.members.some((member) => member.subjectId === subjectId));
}
