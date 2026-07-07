import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePreview } from '../src/generator.js';

const period = { startDate: '2026-07-06', endDate: '2026-07-10' };

test('code summary source requires at least one repository path', async () => {
  const config = {
    report: {
      defaultSource: 'code',
      code: { type: 'git', repositories: [] },
      longText: ''
    }
  };

  await assert.rejects(
    () => generatePreview(config, { period, source: 'code' }),
    /请至少填写一个 Git、HG 或 SVN 代码库目录/
  );
});

test('long text source requires work description', async () => {
  const config = {
    report: {
      defaultSource: 'longText',
      code: { type: 'git', repositories: ['/tmp/repo'] },
      longText: ''
    }
  };

  await assert.rejects(
    () => generatePreview(config, { period, source: 'longText', longText: '' }),
    /请输入长文本工作描述/
  );
});
