import { access } from 'node:fs/promises';
import { homedir } from 'node:os';

const WINDOWS_DRIVE_ROOTS = Array.from({ length: 26 }, (_, index) => `${String.fromCharCode(65 + index)}:\\`);

export async function listDirectoryRoots(options = {}) {
  const platform = options.platform ?? process.platform;
  const homePath = options.homePath ?? homedir();
  const canAccess = options.canAccess ?? access;

  if (platform !== 'win32') {
    return [
      { name: '主目录', path: homePath },
      { name: '根目录 /', path: '/' }
    ];
  }

  const available = await Promise.all(WINDOWS_DRIVE_ROOTS.map(async (path) => {
    try {
      await canAccess(path);
      return { name: path.slice(0, 2), path };
    } catch {
      return null;
    }
  }));
  return available.filter(Boolean);
}
