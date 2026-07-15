import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(executable, ['playwright', 'install', 'chromium'], {
  cwd: projectDirectory,
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
  stdio: 'inherit'
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
