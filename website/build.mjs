import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const client = join(dist, 'client');

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'server'), { recursive: true });
await mkdir(client, { recursive: true });

for (const entry of ['index.html', 'manual.html', 'styles.css', 'app.js', 'assets']) {
  await cp(join(root, entry), join(client, entry), { recursive: true });
}

await writeFile(join(dist, 'server', 'index.js'), `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url, request));
  }
};
`);

console.log('Static Sites build created in website/dist');
