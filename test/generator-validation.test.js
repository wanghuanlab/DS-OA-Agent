import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePreview,
  normalizePreview,
  normalizeRepositoryConfig
} from '../src/generator.js';
import { collectCommitAuthors, filterCommitsByAuthors } from '../src/vcs.js';

const period = { startDate: '2026-07-06', endDate: '2026-07-10' };

test('preview generation requires a code repository', async () => {
  const config = {
    report: {
      code: { type: 'git', repositories: [] }
    }
  };

  await assert.rejects(
    () => generatePreview(config, { period }),
    /请至少添加一个代码库目录/
  );
});

test('normalizes repository config with task associations', () => {
  assert.deepEqual(normalizeRepositoryConfig([
    '/repo/a',
    { path: '/repo/b', taskId: '28670', taskName: '原型开发', description: '补充联调' }
  ]), [
    { path: '/repo/a', taskId: '', taskName: '' },
    { path: '/repo/b', taskId: '28670', taskName: '原型开发' }
  ]);
});

test('normalizes preview entries without collapsing same-day different tasks', () => {
  const preview = normalizePreview([
    { date: '2026-07-06', taskId: '1', taskName: '任务A', items: ['A'] },
    { date: '2026-07-06', taskId: '2', taskName: '任务B', items: ['B'] }
  ], { startDate: '2026-07-06', endDate: '2026-07-06' }, 'mixed');

  assert.equal(preview.entries.length, 2);
  assert.equal(preview.entries[0].taskId, '1');
  assert.equal(preview.entries[1].taskId, '2');
});

test('filters commits by selected authors', () => {
  const commits = [
    { author: 'Wang Huan', message: 'A' },
    { author: 'Li Lei', message: 'B' }
  ];

  assert.deepEqual(filterCommitsByAuthors(commits, []), commits);
  assert.deepEqual(filterCommitsByAuthors(commits, ['Wang Huan']), [commits[0]]);
});

test('collects commit authors with counts', () => {
  const authors = collectCommitAuthors([
    { author: 'Wang Huan' },
    { author: 'Li Lei' },
    { author: 'Wang Huan' },
    { author: '' }
  ]);

  assert.deepEqual(authors, [
    { name: 'Wang Huan', count: 2 },
    { name: 'Li Lei', count: 1 }
  ]);
});
