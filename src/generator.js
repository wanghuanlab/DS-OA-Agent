import { enumerateDates } from './period.js';
import { readCodeCommitsByDate } from './vcs.js';
import { generateJson } from './llm.js';

function emptyEntries(startDate, endDate) {
  return enumerateDates(startDate, endDate).map((date) => ({ date, items: [] }));
}

function getCodeConfig(config) {
  return config.report?.code ?? {
    type: 'auto',
    repositories: config.report?.hg?.repositories ?? []
  };
}

function inputError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function normalizeRepositoryConfig(repositories = []) {
  return repositories
    .map((repository) => {
      if (typeof repository === 'string') {
        return { path: repository.trim(), taskId: '', taskName: '' };
      }
      return {
        path: String(repository?.path ?? '').trim(),
        taskId: String(repository?.taskId ?? '').trim(),
        taskName: String(repository?.taskName ?? '').trim()
      };
    })
    .filter((repository) => repository.path);
}

export async function generateFromCode(config, period) {
  const code = getCodeConfig(config);
  const repositories = normalizeRepositoryConfig(code.repositories ?? []);
  if (repositories.length === 0) {
    throw inputError('请至少填写一个 Git、HG 或 SVN 代码库目录。');
  }
  const commitsByDate = await readCodeCommitsByDate('auto', repositories, period.startDate, period.endDate, code.authors ?? []);
  const entries = emptyEntries(period.startDate, period.endDate);
  const payload = entries.map((entry) => ({
    date: entry.date,
    commits: commitsByDate[entry.date] ?? []
  }));

  const result = await generateJson(config.llm, [
    {
      role: 'system',
      content: '你是工作日志助手。请根据 Git、HG 或 SVN 提交记录生成中文工作日志，返回严格 JSON，不要 Markdown。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        instruction: '按日期生成 entries，每个 entry 包含 date 和 items。items 是简洁中文工作描述，最多 5 条。没有提交的日期 items 为空数组。',
        entries: payload
      })
    }
  ]);

  return normalizePreview(result.entries, period, 'code');
}

export async function generatePreview(config, options = {}) {
  const period = options.period ?? options;
  const code = getCodeConfig(config);
  const repositories = normalizeRepositoryConfig(code.repositories ?? []);
  if (repositories.length === 0) {
    throw inputError('请至少添加一个代码库目录。');
  }

  const entries = emptyEntries(period.startDate, period.endDate);
  const payload = entries.map((entry) => ({ date: entry.date, commits: [] }));
  const commitsByDate = await readCodeCommitsByDate(
    'auto',
    repositories,
    period.startDate,
    period.endDate,
    code.authors ?? []
  );
  for (const entry of payload) {
    entry.commits = commitsByDate[entry.date] ?? [];
  }

  const result = await generateJson(config.llm, [
    {
      role: 'system',
      content: '你是工作日志助手。请根据代码提交记录生成中文工作日志，返回严格 JSON，不要 Markdown。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        instruction: '按日期和任务生成 entries，每个 entry 包含 date、taskId、taskName、items。items 是简洁中文工作描述，最多 5 条。相同任务的提交需要汇总去重；同一天多个任务必须输出多条 entries，不要合并成一个任务。没有工作的日期 items 为空数组。',
        period,
        entries: payload
      })
    }
  ]);

  return normalizePreview(result.entries, period, 'code');
}

export function normalizePreview(entries = [], period, source) {
  const meaningfulEntries = entries
    .map((entry) => ({
      date: entry.date,
      taskId: entry?.taskId ? String(entry.taskId) : '',
      taskName: entry?.taskName ? String(entry.taskName) : '',
      hours: entry?.hours ?? 8,
      items: Array.isArray(entry?.items) ? entry.items.map(String).filter(Boolean) : [],
      content: Array.isArray(entry?.items) ? entry.items.map(String).filter(Boolean).join('\n') : ''
    }))
    .filter((entry) => entry.date && (entry.items.length > 0 || entry.taskId || entry.taskName));
  const datesWithEntries = new Set(meaningfulEntries.map((entry) => entry.date));
  const emptyDateEntries = enumerateDates(period.startDate, period.endDate)
    .filter((date) => !datesWithEntries.has(date))
    .map((date) => ({ date, taskId: '', taskName: '', hours: 8, items: [], content: '' }));
  return {
    source,
    period,
    generatedAt: new Date().toISOString(),
    entries: [...meaningfulEntries, ...emptyDateEntries].sort((left, right) => left.date.localeCompare(right.date))
  };
}
