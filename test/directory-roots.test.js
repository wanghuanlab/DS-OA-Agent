import assert from 'node:assert/strict';
import test from 'node:test';
import { listDirectoryRoots } from '../src/directory-roots.js';

test('lists every accessible Windows drive', async () => {
  const roots = await listDirectoryRoots({
    platform: 'win32',
    canAccess: async (path) => {
      if (!['C:\\', 'D:\\', 'Z:\\'].includes(path)) throw new Error('Unavailable');
    }
  });

  assert.deepEqual(roots, [
    { name: 'C:', path: 'C:\\' },
    { name: 'D:', path: 'D:\\' },
    { name: 'Z:', path: 'Z:\\' }
  ]);
});

test('lists home and filesystem roots outside Windows', async () => {
  const roots = await listDirectoryRoots({ platform: 'darwin', homePath: '/Users/demo' });

  assert.deepEqual(roots, [
    { name: '主目录', path: '/Users/demo' },
    { name: '根目录 /', path: '/' }
  ]);
});
