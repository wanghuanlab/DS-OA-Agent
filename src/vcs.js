import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function parseGitLog(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [date, author, message] = line.split('\t');
      return { date, author, message, files: [] };
    });
}

export function parseHgLog(stdout) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [dateTime, author, message, files = ''] = line.split('\t');
      return {
        date: dateTime.slice(0, 10),
        author,
        message,
        files: files.split(' ').filter(Boolean)
      };
    });
}

export function parseSvnLog(stdout) {
  return stdout
    .split('------------------------------------------------------------------------')
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [header, ...messageLines] = block.split('\n');
      const [, author = '', datePart = ''] = header.split('|').map((part) => part.trim());
      return {
        date: datePart.slice(0, 10),
        author,
        message: messageLines.join('\n').trim().split('\n')[0] ?? '',
        files: []
      };
    })
    .filter((commit) => commit.date && commit.message);
}

export function filterCommitsByAuthors(commits, authors = []) {
  const selected = new Set(authors.map((author) => String(author).trim()).filter(Boolean));
  if (selected.size === 0) return commits;
  return commits.filter((commit) => selected.has(String(commit.author ?? '').trim()));
}

export function collectCommitAuthors(commits = []) {
  const counts = new Map();
  for (const commit of commits) {
    const author = String(commit.author ?? '').trim();
    if (!author) continue;
    counts.set(author, (counts.get(author) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function detectRepositoryType(repository) {
  if (await pathExists(join(repository, '.git'))) return 'git';
  if (await pathExists(join(repository, '.hg'))) return 'hg';
  if (await pathExists(join(repository, '.svn'))) return 'svn';
  throw new Error(`不是 Git、HG 或 SVN 工作目录：${repository}`);
}

function isUnsupportedRepositoryError(error) {
  return /不是 Git、HG 或 SVN 工作目录/.test(error.message);
}

async function readGitCommits(repository, startDate, endDate) {
  const { stdout } = await execFileAsync(
    'git',
    ['log', `--since=${startDate} 00:00:00`, `--until=${endDate} 23:59:59`, '--date=short', '--pretty=format:%ad%x09%an%x09%s'],
    { cwd: repository, maxBuffer: 10 * 1024 * 1024 }
  );
  return parseGitLog(stdout).map((commit) => ({ ...commit, repository, type: 'git' }));
}

async function readHgCommits(repository, startDate, endDate) {
  const template = '{date|isodate}\\t{author|person}\\t{desc|firstline}\\t{files}\\n';
  const { stdout } = await execFileAsync(
    'hg',
    ['log', '--date', `${startDate} to ${endDate}`, '--template', template],
    { cwd: repository, maxBuffer: 10 * 1024 * 1024 }
  );
  return parseHgLog(stdout).map((commit) => ({ ...commit, repository, type: 'hg' }));
}

async function readSvnCommits(repository, startDate, endDate) {
  const { stdout } = await execFileAsync(
    'svn',
    ['log', '-r', `{${startDate}}:{${endDate}}`],
    { cwd: repository, maxBuffer: 10 * 1024 * 1024 }
  );
  return parseSvnLog(stdout).map((commit) => ({ ...commit, repository, type: 'svn' }));
}

export async function readCodeCommits(repositoryType, repository, startDate, endDate) {
  const detectedType = repositoryType && repositoryType !== 'auto'
    ? repositoryType
    : await detectRepositoryType(repository);
  if (detectedType === 'git') return readGitCommits(repository, startDate, endDate);
  if (detectedType === 'svn') return readSvnCommits(repository, startDate, endDate);
  if (detectedType === 'hg') return readHgCommits(repository, startDate, endDate);
  throw new Error(`不支持的代码库类型：${detectedType}`);
}

export async function readCodeCommitsByDate(repositoryType, repositories, startDate, endDate, authors = []) {
  const grouped = {};
  for (const repository of repositories.filter(Boolean)) {
    const repositoryPath = typeof repository === 'string' ? repository : repository.path;
    let rawCommits = [];
    try {
      rawCommits = await readCodeCommits(repositoryType ?? 'auto', repositoryPath, startDate, endDate);
    } catch (error) {
      if (isUnsupportedRepositoryError(error)) continue;
      throw error;
    }
    const commits = filterCommitsByAuthors(rawCommits, authors)
      .map((commit) => ({
        ...commit,
        taskId: typeof repository === 'string' ? '' : String(repository.taskId ?? ''),
        taskName: typeof repository === 'string' ? '' : String(repository.taskName ?? '')
      }));
    for (const commit of commits) {
      grouped[commit.date] ??= [];
      grouped[commit.date].push(commit);
    }
  }
  return grouped;
}

export async function inspectCodeRepositories(repositoryType, repositories, startDate, endDate) {
  const result = {
    ok: true,
    commits: [],
    authors: [],
    repositories: [],
    errors: []
  };

  for (const repository of repositories.filter(Boolean)) {
    const repositoryPath = typeof repository === 'string' ? repository : repository.path;
    try {
      const type = repositoryType && repositoryType !== 'auto'
        ? repositoryType
        : await detectRepositoryType(repositoryPath);
      const commits = await readCodeCommits(type, repositoryPath, startDate, endDate);
      result.commits.push(...commits);
      result.repositories.push({ path: repositoryPath, type, ok: true, commitCount: commits.length });
    } catch (error) {
      if (isUnsupportedRepositoryError(error)) {
        result.repositories.push({
          path: repositoryPath,
          ok: true,
          skipped: true,
          commitCount: 0,
          message: '已忽略：不是 Git、HG 或 SVN 工作目录'
        });
        continue;
      }
      result.ok = false;
      result.errors.push({ path: repositoryPath, message: error.message });
      result.repositories.push({ path: repositoryPath, ok: false, commitCount: 0, message: error.message });
    }
  }

  result.authors = collectCommitAuthors(result.commits);
  return result;
}
