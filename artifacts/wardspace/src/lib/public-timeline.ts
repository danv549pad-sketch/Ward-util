import type { WardItem } from '@workspace/api-client-react';

export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const allowed = (item: WardItem) =>
  item.active !== false &&
  item.published !== false &&
  !['draft', 'cancelled', 'declined', 'archived'].includes(item.status?.toLowerCase() || '');

/** Public schedule and activities only. Prefer the activity record for duplicate title/time pairs. */
export function todayEvents(schedule: WardItem[], activities: WardItem[], now: Date): WardItem[] {
  const today = localDay(now);
  const unique = new Map<string, WardItem>();
  for (const item of [...schedule, ...activities]) {
    if (!allowed(item) || (item.date && item.date !== today)) continue;
    const key = `${item.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase()}|${item.time?.slice(0, 5) || ''}`;
    const previous = unique.get(key);
    // An activity exposes interest count; retain any end time only supplied on the schedule.
    unique.set(key, previous && item.kind === 'activities' ? { ...item, endTime: item.endTime || previous.endTime } : item);
  }
  return [...unique.values()].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

const minutes = (time: string) => {
  const [hours, mins] = time.slice(0, 5).split(':').map(Number);
  return hours * 60 + mins;
};

export function currentAndNext(events: WardItem[], now: Date) {
  const clock = now.getHours() * 60 + now.getMinutes();
  const current = events.filter((item, index) => {
    if (!item.time) return false;
    const start = minutes(item.time);
    const following = events.slice(index + 1).find(next => next.time && minutes(next.time) > start);
    // Without an end time, an item stays current until the next timed event or 90 minutes.
    const end = item.endTime ? minutes(item.endTime) : Math.min(start + 90, following?.time ? minutes(following.time) : Infinity);
    return start <= clock && clock < end;
  }).at(-1);
  const next = current || events.find(item => item.time && minutes(item.time) > clock) || events.find(item => !item.time);
  return { current, next };
}