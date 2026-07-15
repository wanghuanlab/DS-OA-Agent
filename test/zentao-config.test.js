import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEffortPayload,
  calculateRemainingHours,
  calculateTaskRemaining,
  checkZentaoStatus,
  combineSetCookies,
  getTaskPageUrl,
  getZentaoTaskUrl,
  getZentaoTokenUrl,
  groupEntriesByTask,
  normalizeTaskRows,
  resolveFormAction,
  splitWorkLines
} from '../src/zentao.js';

test('uses my task page as default task log page', () => {
  const url = getTaskPageUrl({
    zentao: {
      loginUrl: 'http://zentao.test/user-login.html'
    }
  });

  assert.equal(url, 'http://zentao.test/my-work-task.html');
});

test('supports configured absolute task page URL', () => {
  const url = getTaskPageUrl({
    zentao: {
      loginUrl: 'http://zentao.test/user-login.html',
      taskPageUrl: 'http://example.test/tasks.html'
    }
  });

  assert.equal(url, 'http://example.test/tasks.html');
});

test('builds Zentao REST token URL from login URL', () => {
  const url = getZentaoTokenUrl({
    zentao: {
      loginUrl: 'http://zentao.test/user-login.html'
    }
  });

  assert.equal(url, 'http://zentao.test/api.php/v1/tokens');
});

test('builds Zentao task detail URL from login URL', () => {
  assert.equal(
    getZentaoTaskUrl({ zentao: { loginUrl: 'http://zentao.test/user-login.html' } }, '28670'),
    'http://zentao.test/api.php/v1/tasks/28670'
  );
});

test('status check reports missing Zentao address without probing network', async () => {
  const status = await checkZentaoStatus({ zentao: {} });

  assert.equal(status.vpn.ok, false);
  assert.equal(status.login.ok, false);
  assert.equal(status.tasks.count, 0);
  assert.match(status.vpn.message, /登录地址/);
});

test('splits work content into log lines', () => {
  assert.deepEqual(splitWorkLines('  A  \n\nB\n  '), ['A', 'B']);
});

test('normalizes parsed task rows for dropdown use', () => {
  const tasks = normalizeTaskRows([
    {
      id: '28670',
      name: '长江电力原型开发和设计',
      execution: '2429',
      left: '940',
      logHref: '/task-recordEstimate-28670.html?onlybody=yes'
    },
    {
      id: '',
      name: '缺少ID',
      execution: '',
      logHref: ''
    }
  ]);

  assert.deepEqual(tasks, [
    {
      id: '28670',
      name: '长江电力原型开发和设计',
      execution: '2429',
      left: '940',
      logHref: '/task-recordEstimate-28670.html?onlybody=yes'
    }
  ]);
});

test('combines set-cookie headers for later form requests', () => {
  assert.equal(
    combineSetCookies([
      'zentaosid=abc; path=/; HttpOnly',
      'lang=zh-cn; expires=Thu, 06-Aug-2026 03:46:28 GMT; path=/'
    ]),
    'zentaosid=abc; lang=zh-cn'
  );
});

test('resolves missing form action to final form URL', () => {
  assert.equal(
    resolveFormAction('', 'http://zentao.test/effort-createForObject-task-28670--.html?onlybody=yes'),
    'http://zentao.test/effort-createForObject-task-28670--.html?onlybody=yes'
  );
});

test('builds effort form payload for task logs', () => {
  const payload = buildEffortPayload('28670', [
    { date: '2026-07-06', content: 'A\nB', hours: 6, left: 940 },
    { date: '2026-07-07', items: ['C'], hours: 2 }
  ]);

  assert.equal(payload.get('id[1]'), '1');
  assert.equal(payload.get('dates[1]'), '2026-07-06');
  assert.equal(payload.get('objectType[1]'), 'task');
  assert.equal(payload.get('objectID[1]'), '28670');
  assert.equal(payload.get('work[1]'), 'A\nB');
  assert.equal(payload.get('consumed[1]'), '6');
  assert.equal(payload.get('left[1]'), '940');
  assert.equal(payload.get('work[2]'), 'C');
  assert.equal(payload.get('consumed[2]'), '2');
  assert.equal(payload.get('left[2]'), '0');
});

test('calculates remaining task hours cumulatively', () => {
  assert.deepEqual(calculateRemainingHours([
    { date: '2026-07-06', hours: 3, left: 20 },
    { date: '2026-07-07', hours: 2, left: 20 },
    { date: '2026-07-08', hours: 30, left: 20 }
  ]).map((entry) => entry.left), ['17', '15', '0']);
});

test('calculates task remaining from estimate and total consumed', () => {
  const initialRemaining = calculateTaskRemaining('1000', '135');
  assert.equal(initialRemaining, 865);
  assert.deepEqual(calculateRemainingHours([
    { date: '2026-07-06', hours: 8, left: 0 },
    { date: '2026-07-07', hours: 4, left: 0 }
  ], initialRemaining).map((entry) => entry.left), ['857', '853']);
});

test('groups preview entries by selected task', () => {
  const groups = groupEntriesByTask([
    { date: '2026-07-06', taskId: '28670', taskName: 'A', content: 'work A' },
    { date: '2026-07-07', taskId: '21097', taskName: 'B', content: 'work B' },
    { date: '2026-07-08', taskId: '28670', taskName: 'A', content: 'work C' }
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].taskId, '28670');
  assert.equal(groups[0].entries.length, 2);
  assert.equal(groups[1].taskId, '21097');
});
