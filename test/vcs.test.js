import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectRepositoryType,
  inspectCodeRepositories,
  parseGitLog,
  parseHgLog,
  parseSvnLog,
  readCodeCommitsByDate
} from '../src/vcs.js';

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

test('detects repository type from metadata directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ds-oa-agent-vcs-'));
  try {
    const gitRepo = join(root, 'git-repo');
    const hgRepo = join(root, 'hg-repo');
    const svnRepo = join(root, 'svn-repo');
    await mkdir(join(gitRepo, '.git'), { recursive: true });
    await mkdir(join(hgRepo, '.hg'), { recursive: true });
    await mkdir(join(svnRepo, '.svn'), { recursive: true });

    assert.equal(await detectRepositoryType(gitRepo), 'git');
    assert.equal(await detectRepositoryType(hgRepo), 'hg');
    assert.equal(await detectRepositoryType(svnRepo), 'svn');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reports unsupported repository directories clearly', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ds-oa-agent-vcs-'));
  try {
    await assert.rejects(
      () => detectRepositoryType(root),
      /不是 Git、HG 或 SVN 工作目录/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ignores unsupported repository directories during inspection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ds-oa-agent-vcs-'));
  try {
    const result = await inspectCodeRepositories('auto', [root], '2026-07-06', '2026-07-10');

    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.repositories[0].ok, true);
    assert.equal(result.repositories[0].skipped, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ignores unsupported repository directories when reading commits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ds-oa-agent-vcs-'));
  try {
    const commitsByDate = await readCodeCommitsByDate('auto', [root], '2026-07-06', '2026-07-10');

    assert.deepEqual(commitsByDate, {});
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
