import { isRecord } from '../../services/assetMetadataGuards';
import {
  ACCOUNT_FORMAT, ACCOUNT_VERSION,
  type AccountArtifact, type AccountDocument, type AccountSource, type AccountSubject, type AccountWork,
  type ArtifactLocator, type CapturedArtifact, type CapturedParticipant, type CapturedWorkState, type EarlierParticipation,
  type GroupMember, type GroupSubject, type NativeSeatIdentity, type ReviewedArtifact, type SeatSubject, type WorkReview,
} from './accountSchema';

export class AccountValidationError extends Error {
  constructor(public readonly at: string, detail: string) {
    super(`${at}: ${detail}`);
    this.name = 'AccountValidationError';
  }
}

const fail = (at: string, detail: string): never => { throw new AccountValidationError(at, detail); };
const REVISION = /^[a-f0-9]{40}$|^[a-f0-9]{64}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;

/** Reads typed fields of one record; unknown fields are kept untouched beside them. */
class Fields {
  constructor(readonly raw: Record<string, unknown>, readonly at: string) {}

  string(key: string): string {
    const value = this.raw[key];
    return typeof value === 'string' && value.trim() !== '' ? value : fail(`${this.at}.${key}`, 'must be a non-empty string');
  }

  optionalString(key: string): string | undefined {
    const value = this.raw[key];
    if (value === undefined) return undefined;
    return typeof value === 'string' && value.trim() !== '' ? value : fail(`${this.at}.${key}`, 'must be a non-empty string when present');
  }

  time(key: string): string {
    const value = this.string(key);
    return Number.isFinite(Date.parse(value)) ? value : fail(`${this.at}.${key}`, 'must be an ISO 8601 time');
  }

  optionalTime(key: string): string | undefined {
    const value = this.optionalString(key);
    return value === undefined || Number.isFinite(Date.parse(value)) ? value : fail(`${this.at}.${key}`, 'must be an ISO 8601 time');
  }

  strings(key: string, required: boolean): string[] | undefined {
    const value = this.raw[key];
    if (value === undefined && !required) return undefined;
    if (!Array.isArray(value) || !value.every((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')) {
      return fail(`${this.at}.${key}`, 'must be a list of non-empty strings');
    }
    return value;
  }

  record(key: string): Record<string, unknown> {
    const value = this.raw[key];
    return isRecord(value) ? value : fail(`${this.at}.${key}`, 'must be an object');
  }

  optionalRecord(key: string): Record<string, unknown> | undefined {
    const value = this.raw[key];
    if (value === undefined) return undefined;
    return isRecord(value) ? value : fail(`${this.at}.${key}`, 'must be an object when present');
  }

  records(key: string): Record<string, unknown>[] {
    const value = this.raw[key];
    return Array.isArray(value) && value.every(isRecord) ? value : fail(`${this.at}.${key}`, 'must be a list of objects');
  }

  optionalRecords(key: string): Record<string, unknown>[] | undefined {
    return this.raw[key] === undefined ? undefined : this.records(key);
  }

  enum<T extends string>(key: string, allowed: readonly T[]): T {
    const value = this.string(key);
    return (allowed as readonly string[]).includes(value) ? value as T : fail(`${this.at}.${key}`, `must be one of ${allowed.join(', ')}`);
  }
}

const withUnknown = <T>(raw: Record<string, unknown>, typed: T): T => ({ ...raw, ...typed });
type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };
/** Keeps only the fields that are present, so an absent optional never becomes an explicit `undefined`. */
const optional = <T extends object>(entries: T): Defined<T> =>
  Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined)) as Defined<T>;

function source(raw: Record<string, unknown>, at: string): AccountSource {
  const f = new Fields(raw, at);
  return withUnknown(raw, { id: f.string('id'), description: f.string('description'), observedAt: f.time('observedAt'), ...optional({ command: f.optionalString('command') }) });
}

function seatIdentity(raw: Record<string, unknown>, at: string): NativeSeatIdentity {
  const f = new Fields(raw, at);
  return withUnknown(raw, {
    rigId: f.string('rigId'), nodeId: f.string('nodeId'), logicalId: f.string('logicalId'),
    ...optional({ rigName: f.optionalString('rigName'), sessionAddress: f.optionalString('sessionAddress'), hostId: f.optionalString('hostId') }),
  });
}

function participant(raw: Record<string, unknown>, at: string): CapturedParticipant {
  const f = new Fields(raw, at);
  return withUnknown(raw, {
    runtime: f.enum('runtime', ['claude-code', 'codex'] as const), conversationId: f.string('conversationId'), observedAt: f.time('observedAt'),
    ...optional({ generation: f.optionalString('generation'), cwd: f.optionalString('cwd'), evidence: f.optionalString('evidence') }),
  });
}

function seat(raw: Record<string, unknown>, f: Fields): SeatSubject {
  const captured = f.optionalRecord('participant');
  return withUnknown(raw, {
    id: f.string('id'), kind: 'seat' as const, caption: f.string('caption'), sourceKey: f.string('sourceKey'),
    seat: seatIdentity(f.record('seat'), `${f.at}.seat`),
    policy: f.enum('policy', ['current-seat', 'captured-conversation'] as const),
    workIds: f.strings('workIds', true) ?? [], observedAt: f.time('observedAt'),
    ...optional({
      participant: captured && participant(captured, `${f.at}.participant`),
      notePath: f.optionalString('notePath'), sourceIds: f.strings('sourceIds', false),
    }),
  });
}

function member(raw: Record<string, unknown>, at: string): GroupMember {
  const f = new Fields(raw, at);
  return withUnknown(raw, { subjectId: f.string('subjectId'), lens: f.string('lens'), ...optional({ summary: f.optionalString('summary') }) });
}

function earlier(raw: Record<string, unknown>, at: string): EarlierParticipation {
  const f = new Fields(raw, at);
  return withUnknown(raw, {
    caption: f.string('caption'), lenses: f.strings('lenses', true) ?? [], attribution: f.string('attribution'),
    ...optional({ sourceIds: f.strings('sourceIds', false) }),
  });
}

function group(raw: Record<string, unknown>, f: Fields): GroupSubject {
  const membershipRaw = f.record('membership');
  const membership = new Fields(membershipRaw, `${f.at}.membership`);
  const members = f.records('members').map((entry, index) => member(entry, `${f.at}.members[${index}]`));
  if (members.length === 0) fail(`${f.at}.members`, 'must name at least one member');
  return withUnknown(raw, {
    id: f.string('id'), kind: 'group' as const, caption: f.string('caption'), purpose: f.string('purpose'), members,
    membership: withUnknown(membershipRaw, { basis: membership.string('basis'), observedAt: membership.time('observedAt') }),
    observedAt: f.time('observedAt'),
    ...optional({
      convenerId: f.optionalString('convenerId'), artifactIds: f.strings('artifactIds', false),
      earlierParticipation: f.optionalRecords('earlierParticipation')?.map((entry, index) => earlier(entry, `${f.at}.earlierParticipation[${index}]`)),
      notePath: f.optionalString('notePath'), sourceIds: f.strings('sourceIds', false),
    }),
  });
}

function subject(raw: Record<string, unknown>, at: string): AccountSubject {
  const f = new Fields(raw, at);
  const kind = f.enum('kind', ['seat', 'group'] as const);
  return kind === 'seat' ? seat(raw, f) : group(raw, f);
}

function workState(raw: Record<string, unknown>, at: string): CapturedWorkState {
  const f = new Fields(raw, at);
  return withUnknown(raw, {
    state: f.string('state'), sourceSession: f.string('sourceSession'), destinationSession: f.string('destinationSession'), observedAt: f.time('observedAt'),
    ...optional({
      claimedAt: f.optionalTime('claimedAt'), blockedOn: f.optionalString('blockedOn'),
      handedOffTo: f.optionalString('handedOffTo'), closureReason: f.optionalString('closureReason'),
    }),
  });
}

function review(raw: Record<string, unknown>, at: string): WorkReview {
  const f = new Fields(raw, at);
  const revision = f.string('revision');
  if (!REVISION.test(revision)) fail(`${at}.revision`, 'must be a full commit id');
  return withUnknown(raw, {
    revision: revision.toLowerCase(), summary: f.string('summary'), observedAt: f.time('observedAt'),
    ...optional({ reviewerSubjectId: f.optionalString('reviewerSubjectId'), qitemId: f.optionalString('qitemId'), reportArtifactId: f.optionalString('reportArtifactId') }),
  });
}

function work(raw: Record<string, unknown>, at: string): AccountWork {
  const f = new Fields(raw, at);
  const reviewRecord = f.optionalRecord('review');
  return withUnknown(raw, {
    id: f.string('id'), caption: f.string('caption'), sourceKey: f.string('sourceKey'), qitemId: f.string('qitemId'),
    captured: workState(f.record('captured'), `${at}.captured`), artifactIds: f.strings('artifactIds', true) ?? [],
    ...optional({
      handedOffToSubjectId: f.optionalString('handedOffToSubjectId'),
      review: reviewRecord && review(reviewRecord, `${at}.review`), sourceIds: f.strings('sourceIds', false),
    }),
  });
}

function locator(raw: Record<string, unknown>, at: string): ArtifactLocator {
  const f = new Fields(raw, at);
  const root = f.string('root');
  if (!root.startsWith('/')) fail(`${at}.root`, 'must be an absolute local directory');
  return withUnknown(raw, { root, path: f.string('path') });
}

function capturedArtifact(raw: Record<string, unknown>, at: string): CapturedArtifact {
  const f = new Fields(raw, at);
  const sha256 = f.string('sha256');
  if (!SHA256.test(sha256)) fail(`${at}.sha256`, 'must be a SHA-256 hex digest');
  return { ...locator(raw, at), sha256: sha256.toLowerCase(), capturedAt: f.time('capturedAt') };
}

function reviewedArtifact(raw: Record<string, unknown>, at: string): ReviewedArtifact {
  const f = new Fields(raw, at);
  const revision = f.string('revision');
  if (!REVISION.test(revision)) fail(`${at}.revision`, 'must be a full commit id');
  const sha256 = f.optionalString('sha256');
  if (sha256 !== undefined && !SHA256.test(sha256)) fail(`${at}.sha256`, 'must be a SHA-256 hex digest');
  const root = f.optionalString('root');
  if (root !== undefined && !root.startsWith('/')) fail(`${at}.root`, 'must be an absolute local directory');
  return withUnknown(raw, { revision: revision.toLowerCase(), ...optional({ root, path: f.optionalString('path'), sha256: sha256?.toLowerCase() }) });
}

function artifact(raw: Record<string, unknown>, at: string): AccountArtifact {
  const f = new Fields(raw, at);
  const working = f.optionalRecord('working');
  const captured = f.optionalRecord('captured');
  const reviewed = f.optionalRecord('reviewed');
  if (!working && !captured && !reviewed) fail(at, 'must locate a working, captured or reviewed file');
  const result = withUnknown(raw, {
    id: f.string('id'), caption: f.string('caption'), sourceKey: f.string('sourceKey'),
    ...optional({
      working: working && locator(working, `${at}.working`), captured: captured && capturedArtifact(captured, `${at}.captured`),
      reviewed: reviewed && reviewedArtifact(reviewed, `${at}.reviewed`), sourceIds: f.strings('sourceIds', false),
    }),
  });
  if (result.reviewed && !result.working && (!result.reviewed.root || !result.reviewed.path)) {
    fail(`${at}.reviewed`, 'needs root and path when there is no working file');
  }
  return result;
}

function uniqueIds(entries: readonly { id: string }[], at: string): void {
  const seen = new Set<string>();
  for (const { id } of entries) {
    if (seen.has(id)) fail(at, `duplicate id ${id}`);
    seen.add(id);
  }
}

function checkReferences(account: AccountDocument): void {
  const subjects = new Set(account.subjects.map((entry) => entry.id));
  const work = new Set(account.work.map((entry) => entry.id));
  const artifacts = new Set(account.artifacts.map((entry) => entry.id));
  const sources = new Set(account.sources.map((entry) => entry.id));
  const known = (ids: readonly string[] | undefined, set: Set<string>, at: string, what: string): void => {
    for (const id of ids ?? []) if (!set.has(id)) fail(at, `unknown ${what} ${id}`);
  };
  for (const entry of account.subjects) {
    known(entry.sourceIds, sources, entry.id, 'source');
    if (entry.kind === 'seat') known(entry.workIds, work, entry.id, 'work');
    else {
      known(entry.members.map((member) => member.subjectId), subjects, entry.id, 'member');
      if (entry.convenerId !== undefined) known([entry.convenerId], subjects, entry.id, 'convener');
      known(entry.artifactIds, artifacts, entry.id, 'artifact');
      if (entry.members.some((member) => member.subjectId === entry.id)) fail(entry.id, 'a group cannot be its own member');
    }
  }
  for (const entry of account.work) {
    known(entry.artifactIds, artifacts, entry.id, 'artifact');
    known(entry.sourceIds, sources, entry.id, 'source');
    if (entry.handedOffToSubjectId !== undefined) known([entry.handedOffToSubjectId], subjects, entry.id, 'subject');
    if (entry.review?.reviewerSubjectId !== undefined) known([entry.review.reviewerSubjectId], subjects, entry.id, 'reviewer');
    if (entry.review?.reportArtifactId !== undefined) known([entry.review.reportArtifactId], artifacts, entry.id, 'report artifact');
  }
  for (const entry of account.artifacts) known(entry.sourceIds, sources, entry.id, 'source');
}

/**
 * Validates an account document. Every typed field is checked, every reference resolves
 * within the document, and fields this version does not know are kept untouched so a
 * newer account survives an older Atlas. Nothing here reads a native source.
 */
export function validateAccount(value: unknown): AccountDocument {
  if (!isRecord(value)) throw new AccountValidationError('account', 'must be a JSON object');
  const f = new Fields(value, 'account');
  if (value.format !== ACCOUNT_FORMAT) fail('account.format', `must be ${ACCOUNT_FORMAT}`);
  if (value.version !== ACCOUNT_VERSION) fail('account.version', `must be ${ACCOUNT_VERSION}; this Atlas cannot read other versions`);
  const account: AccountDocument = withUnknown(value, {
    format: ACCOUNT_FORMAT, version: ACCOUNT_VERSION, capturedAt: f.time('capturedAt'),
    sources: f.records('sources').map((entry, index) => source(entry, `account.sources[${index}]`)),
    subjects: f.records('subjects').map((entry, index) => subject(entry, `account.subjects[${index}]`)),
    work: f.records('work').map((entry, index) => work(entry, `account.work[${index}]`)),
    artifacts: f.records('artifacts').map((entry, index) => artifact(entry, `account.artifacts[${index}]`)),
    ...optional({ title: f.optionalString('title'), author: f.optionalString('author') }),
  });
  uniqueIds(account.sources, 'account.sources');
  uniqueIds(account.subjects, 'account.subjects');
  uniqueIds(account.work, 'account.work');
  uniqueIds(account.artifacts, 'account.artifacts');
  checkReferences(account);
  return account;
}
