import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { dataPath } from './runtime-paths.js';

export const CONFIG_PATH = 'config/config.json';
export const DEFAULT_ZENTAO_LOGIN_URL = 'http://192.168.0.216:30085/user-login.html';
export const DEFAULT_ZENTAO_TASK_PAGE_URL = 'http://192.168.0.216:30085/my-work-task.html';
export const DEFAULT_YUNZHIJIA_REPORT_URL = 'https://yunzhijia.com/smartatt-web/#/record/personal-report';

export const DEFAULT_CONFIG = {
  server: { host: '127.0.0.1', port: 5173, openBrowserOnStart: true },
  zentao: {
    loginUrl: DEFAULT_ZENTAO_LOGIN_URL,
    username: '',
    password: '',
    taskPageUrl: DEFAULT_ZENTAO_TASK_PAGE_URL,
    taskId: '',
    taskName: ''
  },
  llm: {
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-v4-flash',
    temperature: 0.2
  },
  attendance: {
    reportUrl: DEFAULT_YUNZHIJIA_REPORT_URL
  },
  report: {
    defaultSource: 'code',
    period: { type: 'thisWeekToToday', weekendBehavior: 'mondayToFriday' },
    code: { type: 'auto', repositories: [], authors: [] },
    hg: { repositories: [] }
  }
};

function mergeConfig(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (!base || typeof base !== 'object') return override ?? base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    result[key] = mergeConfig(base[key], value);
  }
  return result;
}

export function normalizeConfig(config) {
  const normalized = mergeConfig(DEFAULT_CONFIG, config);
  delete normalized.schedule;
  delete normalized.automation;
  delete normalized.report.longText;
  delete normalized.report.supplements;
  for (const repositoryList of [normalized.report.code?.repositories, normalized.report.hg?.repositories]) {
    for (const repository of repositoryList ?? []) {
      if (repository && typeof repository === 'object') delete repository.description;
    }
  }
  if (!String(normalized.zentao.loginUrl ?? '').trim()) {
    normalized.zentao.loginUrl = DEFAULT_ZENTAO_LOGIN_URL;
  }
  if (!String(normalized.zentao.taskPageUrl ?? '').trim()) {
    normalized.zentao.taskPageUrl = DEFAULT_ZENTAO_TASK_PAGE_URL;
  }
  return normalized;
}

export async function loadConfig(path = dataPath(CONFIG_PATH)) {
  try {
    const raw = await readFile(path, 'utf8');
    return normalizeConfig(JSON.parse(raw));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await saveConfig(DEFAULT_CONFIG, path);
    return structuredClone(DEFAULT_CONFIG);
  }
}

export async function saveConfig(config, path = dataPath(CONFIG_PATH)) {
  await mkdir(dirname(path), { recursive: true });
  const normalized = normalizeConfig(config);
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

export function redactConfig(config) {
  const copy = structuredClone(config);
  if (copy.zentao?.password) copy.zentao.password = '******';
  if (copy.llm?.apiKey) copy.llm.apiKey = '******';
  return copy;
}
