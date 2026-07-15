import { join, resolve } from 'node:path';

const defaults = {
  dataDir: process.cwd(),
  staticDir: resolve(process.cwd(), 'public')
};

let paths = { ...defaults };

export function configureRuntimePaths(options = {}) {
  paths = {
    dataDir: options.dataDir ? resolve(options.dataDir) : paths.dataDir,
    staticDir: options.staticDir ? resolve(options.staticDir) : paths.staticDir
  };
  return getRuntimePaths();
}

export function getRuntimePaths() {
  return { ...paths };
}

export function dataPath(...parts) {
  return join(paths.dataDir, ...parts);
}

export function staticPath(...parts) {
  return join(paths.staticDir, ...parts);
}
