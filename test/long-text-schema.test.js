import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonObject } from '../src/llm.js';

test('extracts JSON object from fenced model output', () => {
  const parsed = extractJsonObject('```json\n{"entries":[{"date":"2026-07-07","items":["开发Agent"]}]}\n```');

  assert.deepEqual(parsed, {
    entries: [
      {
        date: '2026-07-07',
        items: ['开发Agent']
      }
    ]
  });
});

test('extracts first JSON object surrounded by prose', () => {
  const parsed = extractJsonObject('结果如下：{"entries":[{"date":"2026-07-08","items":["调试禅道"]}]}请确认');

  assert.equal(parsed.entries[0].date, '2026-07-08');
  assert.equal(parsed.entries[0].items[0], '调试禅道');
});
