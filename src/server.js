import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import Fastify from 'fastify';
import { loadConfig, normalizeConfig, saveConfig, redactConfig } from './config.js';
import { getDefaultPeriod } from './period.js';
import { generatePreview } from './generator.js';
import { loadPreview, savePreview } from './preview-store.js';
import { checkZentaoStatus, listZentaoTasks, submitToZentao } from './zentao.js';
import { inspectCodeRepositories } from './vcs.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

export async function createServer() {
  const app = Fastify({ logger: false });

  app.get('/api/config', async () => ({ config: await loadConfig() }));

  app.post('/api/config', async (request) => {
    const config = await saveConfig(request.body?.config ?? request.body);
    return { config: redactConfig(config) };
  });

  app.get('/api/default-period', async () => {
    const config = await loadConfig();
    return getDefaultPeriod(new Date(), config.schedule?.timezone ?? 'Asia/Shanghai');
  });

  app.get('/api/preview', async () => ({ preview: await loadPreview() }));

  app.post('/api/preview', async (request) => {
    const preview = await savePreview(request.body?.preview ?? request.body);
    return { preview };
  });

  app.post('/api/generate-preview', async (request) => {
    const config = normalizeConfig(request.body?.config ?? await loadConfig());
    const period = request.body?.period ?? getDefaultPeriod(new Date(), config.schedule.timezone);
    const preview = await generatePreview(config, {
      period,
      longText: request.body?.longText
    });
    return { preview: await savePreview(preview) };
  });

  app.post('/api/repositories/check', async (request) => {
    const config = normalizeConfig(request.body?.config ?? await loadConfig());
    const period = request.body?.period ?? getDefaultPeriod(new Date(), config.schedule.timezone);
    const code = config.report?.code ?? {};
    return {
      result: await inspectCodeRepositories(
        'auto',
        code.repositories ?? [],
        period.startDate,
        period.endDate
      )
    };
  });

  app.get('/api/directories', async (request) => {
    const requestedPath = typeof request.query?.path === 'string' && request.query.path.trim()
      ? request.query.path
      : homedir();
    const currentPath = resolve(requestedPath);
    const entries = await readdir(currentPath, { withFileTypes: true });
    return {
      currentPath,
      parentPath: dirname(currentPath),
      directories: entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => !name.startsWith('.') || ['.git', '.hg', '.svn'].includes(name))
        .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
        .map((name) => ({ name, path: join(currentPath, name) }))
    };
  });

  app.post('/api/submit', async (request) => {
    const config = normalizeConfig(request.body?.config ?? await loadConfig());
    const preview = request.body?.preview ? await savePreview(request.body.preview) : await loadPreview();
    return submitToZentao(config, preview);
  });

  app.post('/api/zentao/tasks', async (request) => {
    const config = normalizeConfig(request.body?.config ?? await loadConfig());
    return { tasks: await listZentaoTasks(config) };
  });

  app.post('/api/zentao/status', async (request) => {
    const config = normalizeConfig(request.body?.config ?? await loadConfig());
    return { status: await checkZentaoStatus(config) };
  });

  app.get('/*', async (request, reply) => {
    const requested = request.params['*'] || 'index.html';
    const file = requested === '' ? 'index.html' : requested;
    const path = join(process.cwd(), 'public', file);
    const content = await readFile(path);
    reply.type(TYPES[extname(path)] ?? 'application/octet-stream').send(content);
  });

  return app;
}
