import { execFile } from 'node:child_process';
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
  if (repositoryType === 'git') return readGitCommits(repository, startDate, endDate);
  if (repositoryType === 'svn') return readSvnCommits(repository, startDate, endDate);
  if (repositoryType === 'hg') return readHgCommits(repository, startDate, endDate);
  throw new Error(`不支持的代码库类型：${repositoryType}`);
}

export async function readCodeCommitsByDate(repositoryType, repositories, startDate, endDate) {
  const grouped = {};
  for (const repository of repositories.filter(Boolean)) {
    const commits = await readCodeCommits(repositoryType, repository, startDate, endDate);
    for (const commit of commits) {
      grouped[commit.date] ??= [];
      grouped[commit.date].push(commit);
    }
  }
  return grouped;
}
