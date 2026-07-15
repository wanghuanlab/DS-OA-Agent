import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ZENTAO_LOGIN_URL,
  DEFAULT_ZENTAO_TASK_PAGE_URL,
  normalizeConfig
} from '../src/config.js';

test('fills default Zentao addresses when stored values are empty', () => {
  const config = normalizeConfig({ zentao: { loginUrl: '', taskPageUrl: '' } });

  assert.equal(config.zentao.loginUrl, DEFAULT_ZENTAO_LOGIN_URL);
  assert.equal(config.zentao.taskPageUrl, DEFAULT_ZENTAO_TASK_PAGE_URL);
});

test('keeps customized Zentao addresses', () => {
  const config = normalizeConfig({
    zentao: {
      loginUrl: 'https://zentao.example.com/login',
      taskPageUrl: 'https://zentao.example.com/tasks'
    }
  });

  assert.equal(config.zentao.loginUrl, 'https://zentao.example.com/login');
  assert.equal(config.zentao.taskPageUrl, 'https://zentao.example.com/tasks');
});
