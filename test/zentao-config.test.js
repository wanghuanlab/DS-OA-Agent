import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEffortPayload,
  checkZentaoStatus,
  combineSetCookies,
  getTaskPageUrl,
  getZentaoTokenUrl,
  groupEntriesByTask,
  normalizeTaskRows,
  resolveFormAction,
  splitWorkLines
} from '../src/zentao.js';

test('uses my task page as default task log page', () => {
  const url = getTaskPageUrl({
    zentao: {
      loginUrl: 'http://192.168.0.216:30085/user-login.html'
    }
  });

  assert.equal(url, 'http://192.168.0.216:30085/my-work-task.html');
});

test('supports configured absolute task page URL', () => {
  const url = getTaskPageUrl({
    zentao: {
      loginUrl: 'http://192.168.0.216:30085/user-login.html',
      taskPageUrl: 'http://example.test/tasks.html'
    }
  });

  assert.equal(url, 'http://example.test/tasks.html');
});

test('builds Zentao REST token URL from login URL', () => {
  const url = getZentaoTokenUrl({
    zentao: {
      loginUrl: 'http://192.168.0.216:30085/user-login.html'
    }
  });

  assert.equal(url, 'http://192.168.0.216:30085/api.php/v1/tokens');
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
