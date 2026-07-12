import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePreview,
  hasPreviewInputs,
  normalizePreview,
  normalizeRepositoryConfig,
  normalizeSupplementItems
} from '../src/generator.js';
import { collectCommitAuthors, filterCommitsByAuthors } from '../src/vcs.js';

const period = { startDate: '2026-07-06', endDate: '2026-07-10' };

test('preview generation requires code repositories or long text', async () => {
  const config = {
    report: {
      code: { type: 'git', repositories: [] },
      longText: ''
    }
  };

  await assert.rejects(
    () => generatePreview(config, { period }),
    /请填写代码库目录或长文本工作描述/
  );
});

test('detects available preview inputs from repositories and long text', () => {
  assert.deepEqual(hasPreviewInputs({ code: { repositories: [] }, longText: '' }), {
    hasCode: false,
    hasLongText: false
  });
  assert.deepEqual(hasPreviewInputs({ code: { repositories: ['/repo'] }, longText: '' }), {
    hasCode: true,
    hasLongText: false
  });
  assert.deepEqual(hasPreviewInputs({ code: { repositories: [] }, longText: '今天处理需求' }), {
    hasCode: false,
    hasLongText: true
  });
});

test('normalizes repository config with task associations', () => {
  assert.deepEqual(normalizeRepositoryConfig([
    '/repo/a',
    { path: '/repo/b', taskId: '28670', taskName: '原型开发', description: '补充联调' }
  ]), [
    { path: '/repo/a', taskId: '', taskName: '', description: '' },
    { path: '/repo/b', taskId: '28670', taskName: '原型开发', description: '补充联调' }
  ]);
});

test('normalizes supplement items and preserves task associations', () => {
  assert.deepEqual(normalizeSupplementItems([
    { content: '处理接口联调', taskId: '28670', taskName: '接口开发' },
    { content: '   ' }
  ], '历史长文本'), [
    { content: '处理接口联调', taskId: '28670', taskName: '接口开发' },
    { content: '历史长文本', taskId: '', taskName: '' }
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
