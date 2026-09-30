import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleOccursOnDate, todayEvents, localDay, wardClock } from '../src/lib/public-timeline.ts';

const event = (recurrence, recurrenceEndDate) => ({
  id: 1, kind: 'schedule', title: 'Recurring Test Breakfast', date: '2026-09-30',
  time: '08:00', recurrence, recurrenceEndDate, active: true, published: true,
});

test('daily repeats inclusively, but not after the end date', () => {
  const item = event('daily', '2026-10-03');
  for (const day of ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'])
    assert.equal(scheduleOccursOnDate(item, day), true, day);
  for (const day of ['2026-09-29', '2026-10-04'])
    assert.equal(scheduleOccursOnDate(item, day), false, day);
});

test('weekdays skip Saturday/Sunday and resume Monday', () => {
  const item = event('weekdays', '2026-10-06');
  for (const day of ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'])
    assert.equal(scheduleOccursOnDate(item, day), true, day);
  for (const day of ['2026-10-03', '2026-10-04', '2026-10-07'])
    assert.equal(scheduleOccursOnDate(item, day), false, day);
});

test('weekly repeats on the starting weekday across multiple weeks', () => {
  const item = event('weekly', '2026-10-22');
  for (const day of ['2026-09-30', '2026-10-07', '2026-10-14', '2026-10-21'])
    assert.equal(scheduleOccursOnDate(item, day), true, day);
  for (const day of ['2026-10-01', '2026-10-22', '2026-10-28'])
    assert.equal(scheduleOccursOnDate(item, day), false, day);
});

test('old non-recurring records and activity filtering remain unchanged', () => {
  const old = { ...event('none', ''), recurrence: undefined };
  assert.equal(scheduleOccursOnDate(old, '2026-09-30'), true);
  assert.equal(scheduleOccursOnDate(old, '2026-10-01'), false);
  const now = new Date('2026-10-01T08:00:00+01:00');
  const activities = [{ ...old, id: 2, kind: 'activities', date: '2026-09-30' }];
  assert.deepEqual(todayEvents([event('daily', '2026-10-03')], activities, now).map(item => item.kind), ['schedule']);
});

test('public timeline includes the fixture on matching days only', () => {
  for (const [recurrence, end, visible, hidden] of [
    ['daily', '2026-10-03', ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'], ['2026-10-04']],
    ['weekdays', '2026-10-06', ['2026-10-02', '2026-10-05'], ['2026-10-03', '2026-10-04']],
    ['weekly', '2026-10-22', ['2026-10-07', '2026-10-14', '2026-10-21'], ['2026-10-08', '2026-10-28']],
  ]) {
    const item = event(recurrence, end);
    for (const day of visible)
      assert.equal(todayEvents([item], [], new Date(`${day}T12:00:00Z`)).length, 1, `${recurrence} ${day}`);
    for (const day of hidden)
      assert.equal(todayEvents([item], [], new Date(`${day}T12:00:00Z`)).length, 0, `${recurrence} ${day}`);
  }
});

test('London calendar day and clock cross UTC midnight and DST correctly', () => {
  assert.equal(localDay(new Date('2026-09-30T23:30:00Z')), '2026-10-01');
  assert.equal(wardClock(new Date('2026-09-30T23:30:00Z')), '00:30');
  const item = { ...event('daily', '2026-10-30'), date: '2026-10-24' };
  assert.equal(scheduleOccursOnDate(item, localDay(new Date('2026-10-25T01:30:00Z'))), true);
  assert.equal(localDay(new Date('2026-10-25T01:30:00Z')), '2026-10-25');
});