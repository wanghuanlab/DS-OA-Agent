import { enumerateDates } from './period.js';
import { readCodeCommitsByDate } from './vcs.js';
import { generateJson } from './llm.js';

function emptyEntries(startDate, endDate) {
  return enumerateDates(startDate, endDate).map((date) => ({ date, items: [] }));
}

function getCodeConfig(config) {
  return config.report?.code ?? {
    type: 'hg',
    repositories: config.report?.hg?.repositories ?? []
  };
}

function inputError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export async function generateFromCode(config, period) {
  const code = getCodeConfig(config);
  const repositoryType = code.type ?? 'hg';
  const repositories = code.repositories ?? [];
  if (repositories.length === 0) {
    throw inputError('请至少填写一个 Git、HG 或 SVN 代码库目录。');
  }
  const commitsByDate = await readCodeCommitsByDate(repositoryType, repositories, period.startDate, period.endDate);
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

export async function generateFromLongText(config, period, longText) {
  if (!longText?.trim()) {
    throw inputError('请输入长文本工作描述。');
  }
  const result = await generateJson(config.llm, [
    {
      role: 'system',
      content: '你是工作日志解析助手。请把用户输入拆分为日期明确的中文工作日志，返回严格 JSON，不要 Markdown。'
    },
    {
      role: 'user',
      content: JSON.stringify({
        instruction: '仅输出 { "entries": [{ "date": "YYYY-MM-DD", "items": ["..."] }] }。日期必须落在给定范围内。',
        period,
        text: longText
      })
    }
  ]);
  return normalizePreview(result.entries, period, 'longText');
}

export async function generatePreview(config, options = {}) {
  const period = options.period ?? options;
  const source = options.source ?? config.report?.defaultSource ?? 'code';
  if (source === 'longText') {
    return generateFromLongText(config, period, options.longText ?? config.report?.longText ?? '');
  }
  return generateFromCode(config, period);
}

export function normalizePreview(entries = [], period, source) {
  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  return {
    source,
    period,
    generatedAt: new Date().toISOString(),
    entries: enumerateDates(period.startDate, period.endDate).map((date) => {
      const entry = byDate.get(date);
      return {
        date,
        taskId: entry?.taskId ? String(entry.taskId) : '',
        taskName: entry?.taskName ? String(entry.taskName) : '',
        hours: entry?.hours ?? 8,
        items: Array.isArray(entry?.items) ? entry.items.map(String).filter(Boolean) : [],
        content: Array.isArray(entry?.items) ? entry.items.map(String).filter(Boolean).join('\n') : ''
      };
    })
  };
}
