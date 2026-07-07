import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultPeriod } from '../src/period.js';

test('uses Monday through today on a weekday', () => {
  const period = getDefaultPeriod(new Date('2026-07-07T12:00:00+08:00'), 'Asia/Shanghai');

  assert.deepEqual(period, {
    startDate: '2026-07-06',
    endDate: '2026-07-07'
  });
});

test('uses Monday through Friday when today is Saturday', () => {
  const period = getDefaultPeriod(new Date('2026-07-11T12:00:00+08:00'), 'Asia/Shanghai');

  assert.deepEqual(period, {
    startDate: '2026-07-06',
    endDate: '2026-07-10'
  });
});

test('uses Monday through Friday when today is Sunday', () => {
  const period = getDefaultPeriod(new Date('2026-07-12T12:00:00+08:00'), 'Asia/Shanghai');

  assert.deepEqual(period, {
    startDate: '2026-07-06',
    endDate: '2026-07-10'
  });
});
