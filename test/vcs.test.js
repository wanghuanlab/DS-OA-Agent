import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGitLog, parseHgLog, parseSvnLog } from '../src/vcs.js';

test('parses git log entries into common commit shape', () => {
  const commits = parseGitLog('2026-07-07\tWang Huan\tfeat: 支持Git\n');

  assert.deepEqual(commits, [
    {
      date: '2026-07-07',
      author: 'Wang Huan',
      message: 'feat: 支持Git',
      files: []
    }
  ]);
});

test('parses hg log entries into common commit shape', () => {
  const commits = parseHgLog('2026-07-07 10:12 +0800\tWang Huan\tfeat: 支持HG\tsrc/a.js src/b.js\n');

  assert.deepEqual(commits, [
    {
      date: '2026-07-07',
      author: 'Wang Huan',
      message: 'feat: 支持HG',
      files: ['src/a.js', 'src/b.js']
    }
  ]);
});

test('parses svn log entries into common commit shape', () => {
  const commits = parseSvnLog('r10 | Wang Huan | 2026-07-07 10:12:00 +0800 (二, 07 7月 2026) | 1 line\n\n支持SVN日志总结\n------------------------------------------------------------------------\n');

  assert.deepEqual(commits, [
    {
      date: '2026-07-07',
      author: 'Wang Huan',
      message: '支持SVN日志总结',
      files: []
    }
  ]);
});
