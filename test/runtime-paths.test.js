import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { configureRuntimePaths, dataPath, getRuntimePaths, staticPath } from '../src/runtime-paths.js';
import { DEFAULT_CONFIG } from '../src/config.js';

test('uses DeepSeek as the default LLM', () => {
  assert.equal(DEFAULT_CONFIG.llm.baseUrl, 'https://api.deepseek.com');
  assert.equal(DEFAULT_CONFIG.llm.model, 'deepseek-v4-flash');
});

test('configures desktop data and static paths independently', () => {
  const original = getRuntimePaths();
  try {
    configureRuntimePaths({ dataDir: '/tmp/zentao-data', staticDir: '/tmp/zentao-static' });
    assert.equal(dataPath('config', 'config.json'), resolve('/tmp/zentao-data', 'config', 'config.json'));
    assert.equal(staticPath('index.html'), resolve('/tmp/zentao-static', 'index.html'));
  } finally {
    configureRuntimePaths(original);
  }
});
