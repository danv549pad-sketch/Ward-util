import type { WardItem } from '@workspace/api-client-react';

const wardParts = (date: Date, parts: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...parts }).formatToParts(date).map(part => [part.type, part.value]));
export const localDay = (date: Date) => {
  const parts = wardParts(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${parts.year}-${parts.month}-${parts.day}`;
};
export const wardClock = (date: Date) => {
  const parts = wardParts(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${parts.hour}:${parts.minute}`;
};
const dayNumber = (day: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day
    ? Math.floor(date.getTime() / 86400000) : null;
};

/** Calendar-day arithmetic is in UTC; the date being matched is the Europe/London ward date. */
export function scheduleOccursOnDate(event: WardItem, day: string): boolean {
  const recurrence = event.recurrence || 'none';
  if (recurrence === 'none') return !event.date || event.date === day;
  const start = dayNumber(event.date || ''), target = dayNumber(day), end = dayNumber(event.recurrenceEndDate || '');
  if (start === null || target === null || end === null || target < start || target > end) return false;
  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') {
    const weekday = new Date(target * 86400000).getUTCDay();
    return weekday >= 1 && weekday <= 5;
  }
  return recurrence === 'weekly' && (target - start) % 7 === 0;
}

const allowed = (item: WardItem) =>
  item.active !== false &&
  item.published !== false &&
  !['draft', 'cancelled', 'declined', 'archived'].includes(item.status?.toLowerCase() || '');

/** Public schedule and activities only. Prefer the activity record for duplicate title/time pairs. */
export function todayEvents(schedule: WardItem[], activities: WardItem[], now: Date): WardItem[] {
  const today = localDay(now);
  const unique = new Map<string, WardItem>();
  for (const item of [...schedule, ...activities]) {
    if (!allowed(item) || (item.kind === 'schedule' ? !scheduleOccursOnDate(item, today) : !!item.date && item.date !== today)) continue;
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
  const [hour, minute] = wardClock(now).split(':').map(Number);
  const clock = hour * 60 + minute;
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