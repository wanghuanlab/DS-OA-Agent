import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { dataPath } from './runtime-paths.js';

export const CONFIG_PATH = 'config/config.json';

export const DEFAULT_CONFIG = {
  server: { host: '127.0.0.1', port: 5173, openBrowserOnStart: true },
  zentao: {
    loginUrl: '',
    username: '',
    password: '',
    taskPageUrl: '',
    taskId: '',
    taskName: ''
  },
  llm: {
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-v4-flash',
    temperature: 0.2
  },
  report: {
    defaultSource: 'code',
    period: { type: 'thisWeekToToday', weekendBehavior: 'mondayToFriday' },
    code: { type: 'auto', repositories: [], authors: [] },
    hg: { repositories: [] },
    longText: '',
    supplements: []
  },
  schedule: {
    enabled: true,
    timezone: 'Asia/Shanghai',
    previewCron: '0 16 * * 5',
    autoSubmitCron: '0 17 * * 5',
    confirmWindowMinutes: 60
  },
  automation: {
    autoSubmit: true,
    headless: false,
    keepBrowserOpenOnError: true
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
  return mergeConfig(DEFAULT_CONFIG, config);
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
