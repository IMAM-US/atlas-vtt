import type { ViewAtlasState } from '../../storeFactory';
import type { AccountSubject, SeatSubject } from '../account/accountSchema';
import { accountPathOf } from '../account/references';
import type { AccountLoads } from './AccountLoads';
import type { BoundAppearance } from './types';

export interface AppearanceReference { id: string; path: string; subjectId: string; caption: string; token: boolean }

/** Geometry can move during a hold; authored binding or account replacement invalidates the relation. */
export function appearanceBinding(appearance: BoundAppearance): string {
  return JSON.stringify([appearance.path, appearance.subjectId, appearance.revision]);
}

export function appearanceReferences(state: ViewAtlasState): AppearanceReference[] {
  return [...Object.values(state.objects.tokens), ...Object.values(state.objects.texts)].flatMap((object) => {
    const path = accountPathOf(object);
    if (!path || !object.sourceReference) return [];
    const caption = 'text' in object ? object.text : 'name' in object ? object.name : object.sourceReference.subjectId;
    return [{ id: object.id, path, subjectId: object.sourceReference.subjectId, caption: caption || object.sourceReference.subjectId, token: !('text' in object) }];
  });
}

export function resolvedAppearances(references: readonly AppearanceReference[], loads: AccountLoads): BoundAppearance[] {
  return references.flatMap((reference) => {
    const loaded = loads.get(reference.path)?.value;
    return loaded ? [{ ...reference, account: loaded.account, revision: loaded.sha256 }] : [];
  });
}

export function appearanceSubject(appearance: BoundAppearance): AccountSubject | null {
  return appearance.account.subjects.find((subject) => subject.id === appearance.subjectId) ?? null;
}

export function groupSeats(appearance: BoundAppearance): { subject: SeatSubject | null; lens: string; id: string }[] {
  const group = appearanceSubject(appearance);
  if (group?.kind !== 'group') return [];
  return group.members.map((member) => {
    const subject = appearance.account.subjects.find((entry) => entry.id === member.subjectId);
    return { subject: subject?.kind === 'seat' ? subject : null, lens: member.lens, id: member.subjectId };
  });
}
