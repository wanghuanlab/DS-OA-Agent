import open from 'open';
import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { startScheduler } from './scheduler.js';

const config = await loadConfig();
const app = await createServer();
const host = config.server?.host ?? '127.0.0.1';
const port = config.server?.port ?? 5173;
const baseUrl = `http://${host}:${port}`;

await app.listen({ host, port });
startScheduler({ config, baseUrl });

console.log(`Zentao Log Agent running at ${baseUrl}`);
if (config.server?.openBrowserOnStart) {
  await open(baseUrl);
}
