import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const PREVIEW_PATH = 'output/preview/current.json';

export async function savePreview(preview, path = PREVIEW_PATH) {
  await mkdir(dirname(path), { recursive: true });
  const normalized = {
    ...preview,
    updatedAt: new Date().toISOString()
  };
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

export async function loadPreview(path = PREVIEW_PATH) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
