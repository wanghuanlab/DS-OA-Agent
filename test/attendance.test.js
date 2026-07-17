import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAttendanceHours,
  enrichPreviewWithAttendance,
  fetchAttendance,
  parseAttendanceReportUrl,
  summarizeAttendanceRecords
} from '../src/attendance.js';

test('extracts a valid ticket and expiry from the report URL', () => {
  const parsed = parseAttendanceReportUrl(
    'https://yunzhijia.com/smartatt-web/?ticket=temporary&expire_time=2000#/record/personal-report',
    1000
  );

  assert.equal(parsed.origin, 'https://yunzhijia.com');
  assert.equal(parsed.ticket, 'temporary');
  assert.equal(parsed.expiresAt, 2000);
});

test('rejects a report URL without a signed-in ticket', () => {
  assert.throws(
    () => parseAttendanceReportUrl('https://yunzhijia.com/smartatt-web/#/record/personal-report'),
    /没有临时 ticket/
  );
});

test('calculates rounded hours from the earliest and latest valid records', () => {
  const summary = summarizeAttendanceRecords([
    { clockInTime: '18:16', status: 1 },
    { clockInTime: '08:43', status: 1 },
    { clockInTime: '07:00', status: 0 }
  ]);

  assert.deepEqual(summary, {
    first: '08:43',
    last: '18:16',
    hours: 9.5,
    recordCount: 2
  });
});

test('requires two valid records before calculating hours', () => {
  assert.deepEqual(summarizeAttendanceRecords([{ clockInTime: '09:00', status: 1 }]), {
    first: '09:00',
    last: '',
    hours: null,
    recordCount: 1
  });
});

test('distributes daily attendance hours across multiple task entries', () => {
  const preview = {
    entries: [
      { date: '2026-07-16', taskId: '1', hours: 8 },
      { date: '2026-07-16', taskId: '2', hours: 8 },
      { date: '2026-07-17', taskId: '3', hours: 8 }
    ]
  };
  const result = applyAttendanceHours(preview, {
    fetchedAt: '2026-07-16T10:00:00.000Z',
    days: { '2026-07-16': { first: '09:00', last: '18:30', hours: 9.5, recordCount: 2 } }
  });

  assert.deepEqual(result.entries.map((entry) => entry.hours), [5, 4.5, 8]);
  assert.equal(result.attendance.days['2026-07-16'].hours, 9.5);
  assert.deepEqual(preview.entries.map((entry) => entry.hours), [8, 8, 8]);
});

test('fetches the current user and selected attendance records', async () => {
  const requests = [];
  const responses = [
    new Response(JSON.stringify({ success: true, errorCode: 200, data: { longNumber: 'user-1' } }), {
      status: 200,
      headers: { 'set-cookie': 'sid=session; Path=/' }
    }),
    new Response(JSON.stringify({
      success: true,
      errorCode: 200,
      data: {
        list: [{
          '2026-07-16': [
            { clockInTime: '09:00', status: 1 },
            { clockInTime: '18:00', status: 1 }
          ]
        }]
      }
    }), { status: 200 })
  ];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    return responses.shift();
  };

  const result = await fetchAttendance({
    attendance: {
      reportUrl: 'https://yunzhijia.com/smartatt-web/?ticket=temporary&expire_time=2000#/record/personal-report'
    }
  }, { startDate: '2026-07-16', endDate: '2026-07-16' }, { fetchImpl, now: 1000 });

  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /user\/userInfo/);
  assert.match(requests[1].url, /statistics\/personList/);
  assert.equal(JSON.parse(requests[1].options.body).longNumbers[0], 'user-1');
  assert.equal(result.days['2026-07-16'].hours, 9);
});

test('keeps the original preview when attendance is unavailable', async () => {
  const preview = { entries: [{ date: '2026-07-16', hours: 8 }] };
  const result = await enrichPreviewWithAttendance({}, {}, preview, async () => {
    throw new Error('云之家未登录');
  });

  assert.equal(result.preview, preview);
  assert.equal(result.preview.entries[0].hours, 8);
  assert.match(result.warning, /未登录/);
});
