import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function readHgCommits(repository, startDate, endDate) {
  const template = '{date|isodate}\\t{author|person}\\t{desc|firstline}\\t{files}\\n';
  const { stdout } = await execFileAsync(
    'hg',
    ['log', '--date', `${startDate} to ${endDate}`, '--template', template],
    { cwd: repository, maxBuffer: 10 * 1024 * 1024 }
  );

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [dateTime, author, message, files = ''] = line.split('\t');
      return {
        repository,
        date: dateTime.slice(0, 10),
        author,
        message,
        files: files.split(' ').filter(Boolean)
      };
    });
}

export async function readHgCommitsByDate(repositories, startDate, endDate) {
  const grouped = {};
  for (const repository of repositories.filter(Boolean)) {
    const commits = await readHgCommits(repository, startDate, endDate);
    for (const commit of commits) {
      grouped[commit.date] ??= [];
      grouped[commit.date].push(commit);
    }
  }
  return grouped;
}
