import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_YUNZHIJIA_REPORT_URL,
  DEFAULT_ZENTAO_LOGIN_URL,
  DEFAULT_ZENTAO_TASK_PAGE_URL,
  normalizeConfig
} from '../src/config.js';

test('uses the Yunzhijia personal report page without embedding a ticket', () => {
  const config = normalizeConfig({});

  assert.equal(config.attendance.reportUrl, DEFAULT_YUNZHIJIA_REPORT_URL);
  assert.equal(config.attendance.reportUrl.includes('ticket='), false);
});

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

test('removes legacy supplemental description settings', () => {
  const config = normalizeConfig({
    report: {
      longText: '旧补充内容',
      supplements: [{ content: '旧附加描述' }],
      code: {
        repositories: [{ path: '/repo', description: '旧代码库描述' }]
      }
    }
  });

  assert.equal('longText' in config.report, false);
  assert.equal('supplements' in config.report, false);
  assert.equal('description' in config.report.code.repositories[0], false);
});

test('removes legacy scheduled execution settings', () => {
  const config = normalizeConfig({
    schedule: { enabled: true, previewCron: '0 16 * * 5' },
    automation: { autoSubmit: true },
    llm: { model: 'custom-model' }
  });

  assert.equal('schedule' in config, false);
  assert.equal('automation' in config, false);
  assert.equal(config.llm.model, 'custom-model');
});
