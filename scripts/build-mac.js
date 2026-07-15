import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.platform !== 'darwin') {
  throw new Error('macOS 安装包必须在 macOS 上构建。');
}

const requestedArchitecture = process.argv.find((argument) => ['--arm64', '--x64'].includes(argument));
const architecture = requestedArchitecture?.slice(2) ?? (process.arch === 'arm64' ? 'arm64' : 'x64');
run('npx', ['electron-builder', '--mac', 'zip', `--${architecture}`, '--publish', 'never']);

const appDirectory = join('dist', architecture === 'arm64' ? 'mac-arm64' : 'mac');
const appPath = join(appDirectory, 'Zentao Log Agent.app');
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const dmgPath = join('dist', `Zentao Log Agent-${version}-${architecture}.dmg`);
if (!existsSync(appPath)) throw new Error(`未找到已打包应用：${appPath}`);

run('hdiutil', [
  'create',
  '-volname', 'Zentao Log Agent',
  '-srcfolder', appDirectory,
  '-ov',
  '-format', 'UDZO',
  dmgPath
]);
