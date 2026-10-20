/** Clock labels in UTC, the time the native sources and the team's records keep ("20:31Z"). */
export function clock(iso: string | null | undefined): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  const date = new Date(time);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}Z`;
}

/** A native deadline/backstop with a day as well as the card's UTC clock. Invalid dates are not clocks. */
export function dateClock(iso: string | null | undefined): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '';
  const date = new Date(iso);
  const month = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${date.getUTCDate()} ${month} ${clock(iso)}`;
}

/** A short hash or revision for a label. */
export const short = (value: string | null | undefined, length = 8): string => (value ? value.slice(0, length) : '');
