/** Clock labels in UTC, the time the native sources and the team's records keep ("20:31Z"). */
export function clock(iso: string | null | undefined): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  const date = new Date(time);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}Z`;
}

/** A short hash or revision for a label. */
export const short = (value: string | null | undefined, length = 8): string => (value ? value.slice(0, length) : '');
