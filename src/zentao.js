import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { dataPath } from './runtime-paths.js';

let taskListProvider;

export function setTaskListProvider(provider) {
  taskListProvider = provider;
}

function zentaoOrigin(loginUrl) {
  return new URL(loginUrl).origin;
}

function statusResult(ok, message, extra = {}) {
  return { ok, message, ...extra };
}

export function getTaskPageUrl(config) {
  const configured = config.zentao?.taskPageUrl || '/my-work-task.html';
  if (/^https?:\/\//i.test(configured)) return configured;
  return `${zentaoOrigin(config.zentao.loginUrl)}${configured.startsWith('/') ? configured : `/${configured}`}`;
}

function contentForEntry(entry) {
  return entry.content || (entry.items ?? []).join('\n');
}

export function splitWorkLines(content) {
  return String(content).split('\n').map((line) => line.trim()).filter(Boolean);
}

function filledEntries(entries) {
  return entries
    .map((entry) => ({
      date: entry.date,
      lines: splitWorkLines(contentForEntry(entry)),
      hours: String(entry.hours ?? entry.consumed ?? '8').trim() || '8',
      left: String(entry.left ?? '0').trim() || '0'
    }))
    .filter((entry) => entry.lines.length > 0)
    .slice(0, 5);
}

function formatHours(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function calculateTaskRemaining(estimate, consumed) {
  if (!String(estimate ?? '').trim() || !String(consumed ?? '').trim()) {
    throw new Error('禅道任务缺少有效的最初预计或累计消耗。');
  }
  const estimatedHours = Number(estimate);
  const consumedHours = Number(consumed);
  if (!Number.isFinite(estimatedHours) || !Number.isFinite(consumedHours)) {
    throw new Error('禅道任务缺少有效的最初预计或累计消耗。');
  }
  return Math.max(0, estimatedHours - consumedHours);
}

export function calculateRemainingHours(entries, initialRemaining) {
  const initial = entries.find((entry) => String(entry.left ?? '').trim() && Number.isFinite(Number(entry.left)));
  let remaining = initialRemaining === undefined ? Number(initial?.left ?? 0) : Number(initialRemaining);
  if (!Number.isFinite(remaining)) remaining = 0;
  return entries.map((entry) => {
    const consumed = Number(entry.hours ?? entry.consumed ?? 0);
    remaining = Math.max(0, remaining - (Number.isFinite(consumed) ? consumed : 0));
    return { ...entry, left: formatHours(remaining) };
  });
}

export function buildEffortPayload(taskId, entries) {
  const payload = new URLSearchParams();
  const rows = filledEntries(entries);
  for (let index = 0; index < rows.length; index += 1) {
    const row = String(index + 1);
    payload.set(`id[${row}]`, row);
    payload.set(`dates[${row}]`, rows[index].date);
    payload.set(`objectType[${row}]`, 'task');
    payload.set(`objectID[${row}]`, String(taskId));
    payload.set(`work[${row}]`, rows[index].lines.join('\n'));
    payload.set(`consumed[${row}]`, rows[index].hours);
    payload.set(`left[${row}]`, rows[index].left);
  }
  return payload;
}

export function groupEntriesByTask(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const taskId = String(entry.taskId ?? '').trim();
    const taskName = String(entry.taskName ?? '').trim();
    if (!taskId) continue;
    if (!groups.has(taskId)) {
      groups.set(taskId, { taskId, taskName, entries: [] });
    }
    groups.get(taskId).entries.push(entry);
  }
  return [...groups.values()];
}

export function combineSetCookies(setCookies = []) {
  return setCookies
    .filter(Boolean)
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

export function resolveFormAction(action, finalUrl) {
  if (!action) return finalUrl;
  return new URL(action, finalUrl).toString();
}

export function getZentaoTokenUrl(config) {
  return `${zentaoOrigin(config.zentao.loginUrl)}/api.php/v1/tokens`;
}

export function getZentaoTaskUrl(config, taskId) {
  return `${zentaoOrigin(config.zentao.loginUrl)}/api.php/v1/tasks/${taskId}`;
}

function parseFormAction(html, finalUrl) {
  const formOpen = html.match(/<form[^>]*id=["']createEffort["'][^>]*>/i)?.[0]
    ?? html.match(/<form[^>]*>/i)?.[0]
    ?? '';
  const action = formOpen.match(/\saction=["']([^"']*)["']/i)?.[1] ?? '';
  return resolveFormAction(action, finalUrl);
}

export function normalizeTaskRows(rows) {
  return rows
    .map((task) => ({
      id: String(task.id ?? '').trim(),
      name: String(task.name ?? '').trim(),
      execution: String(task.execution ?? '').trim(),
      left: String(task.left ?? '').trim(),
      logHref: String(task.logHref ?? '').trim()
    }))
    .filter((task) => task.id && task.name && task.logHref);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestZentaoToken(config, timeoutMs = 8000) {
  const tokenResponse = await fetchWithTimeout(getZentaoTokenUrl(config), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      account: config.zentao.username,
      password: config.zentao.password
    })
  }, timeoutMs);
  const tokenJson = await tokenResponse.json().catch(() => ({}));
  const setCookies = tokenResponse.headers.getSetCookie?.() ?? [tokenResponse.headers.get('set-cookie')].filter(Boolean);
  return {
    ok: tokenResponse.ok && Boolean(tokenJson.token),
    status: tokenResponse.status,
    token: tokenJson.token ?? '',
    cookie: combineSetCookies(setCookies)
  };
}

export async function requestZentaoTask(config, taskId, login, timeoutMs = 8000) {
  const response = await fetchWithTimeout(getZentaoTaskUrl(config, taskId), {
    headers: {
      Token: login.token,
      ...(login.cookie ? { cookie: login.cookie } : {})
    }
  }, timeoutMs);
  const body = await response.json().catch(() => ({}));
  const task = body.data ?? body;
  if (!response.ok || !task?.id) {
    throw new Error(`读取禅道任务 ${taskId} 的工时失败：HTTP ${response.status}`);
  }
  return {
    id: String(task.id),
    estimate: String(task.estimate ?? ''),
    consumed: String(task.consumed ?? ''),
    left: String(task.left ?? ''),
    remaining: calculateTaskRemaining(task.estimate, task.consumed)
  };
}

export async function checkZentaoStatus(config) {
  const status = {
    vpn: statusResult(false, '未检测'),
    login: statusResult(false, '未检测'),
    tasks: statusResult(false, '未检测', { count: 0, tasks: [] })
  };

  if (!config.zentao?.loginUrl) {
    status.vpn = statusResult(false, '请先填写禅道登录地址。');
    return status;
  }

  try {
    const response = await fetchWithTimeout(config.zentao.loginUrl, { method: 'GET' }, 5000);
    status.vpn = statusResult(true, `禅道地址可访问，HTTP ${response.status}。`);
  } catch (error) {
    status.vpn = statusResult(false, `禅道地址不可访问：${error.message}`);
    return status;
  }

  if (!config.zentao?.username || !config.zentao?.password) {
    status.login = statusResult(false, '请先填写禅道用户名和密码。');
    return status;
  }

  try {
    const login = await requestZentaoToken(config);
    status.login = login.ok
      ? statusResult(true, '已获取禅道 token。')
      : statusResult(false, `未获取到 token，HTTP ${login.status}。`);
    if (!login.ok) return status;
  } catch (error) {
    status.login = statusResult(false, `获取 token 失败：${error.message}`);
    return status;
  }

  try {
    const tasks = await listZentaoTasks(config);
    status.tasks = statusResult(tasks.length > 0, tasks.length > 0 ? `已读取 ${tasks.length} 个任务。` : '未读取到任务。', {
      count: tasks.length,
      tasks
    });
  } catch (error) {
    status.tasks = statusResult(false, `读取任务列表失败：${error.message}`, { count: 0, tasks: [] });
  }

  return status;
}

async function fillFirstVisible(locator, value) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.fill(value);
      return true;
    }
  }
  return false;
}

async function loginToZentao(page, config, log = []) {
  await page.goto(config.zentao.loginUrl, { waitUntil: 'domcontentloaded' });
  log.push(`Opened ${config.zentao.loginUrl}`);

  await fillFirstVisible(page.locator('input[name="account"], input#account, input[type="text"]'), config.zentao.username);
  await fillFirstVisible(page.locator('input[name="password"], input#password, input[type="password"]'), config.zentao.password);
  await page.locator('button[type="submit"], input[type="submit"], #submit').first().click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  log.push('Submitted login form');
}

export async function listZentaoTasks(config) {
  if (!config.zentao?.loginUrl || !config.zentao?.username || !config.zentao?.password) {
    throw new Error('请先填写禅道地址、用户名和密码。');
  }

  if (taskListProvider) {
    return normalizeTaskRows(await taskListProvider(config));
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await loginToZentao(page, config);
    await page.goto(getTaskPageUrl(config), { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    const frame = await taskFrame(page);
    const rows = await frame.evaluate(() => Array.from(document.querySelectorAll('tbody tr')).map((row) => {
      const taskLink = row.querySelector('a[href*="task-view-"]');
      const logLink = row.querySelector('a[href*="task-recordEstimate-"]');
      const executionLink = row.querySelector('a[href*="execution-task-"]');
      return {
        id: taskLink?.getAttribute('href')?.match(/task-view-(\d+)/)?.[1] ?? '',
        name: taskLink?.textContent?.trim() ?? '',
        execution: executionLink?.getAttribute('href')?.match(/execution-task-(\d+)/)?.[1] ?? '',
        left: row.children[9]?.textContent?.trim().replace(/h$/i, '') ?? '',
        logHref: logLink?.getAttribute('href') ?? ''
      };
    }));
    return normalizeTaskRows(rows);
  } finally {
    await browser.close();
  }
}

export async function submitToZentao(config, preview) {
  if (!config.zentao?.loginUrl || !config.zentao?.username || !config.zentao?.password) {
    throw new Error('Zentao loginUrl, username, and password are required.');
  }
  if (!preview?.entries?.length) {
    throw new Error('No preview entries available for submission.');
  }

  const log = [];

  try {
    const result = await submitTaskLogsByHttp(config, preview.entries, log);
    const outputDirectory = dataPath('output', 'playwright');
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(dataPath('output', 'playwright', 'zentao-submit.log'), `${log.join('\n')}\n`);
    return result;
  } catch (error) {
    const outputDirectory = dataPath('output', 'playwright');
    await mkdir(outputDirectory, { recursive: true });
    log.push(`ERROR: ${error.message}`);
    await writeFile(dataPath('output', 'playwright', 'zentao-submit.log'), `${log.join('\n')}\n`);
    throw error;
  }
}

async function submitTaskLogsByHttp(config, entries, log) {
  const taskGroups = groupEntriesByTask(entries).filter((group) => filledEntries(group.entries).length > 0);
  if (taskGroups.length === 0) {
    throw new Error('请在预览中为每条工作记录选择任务，并填写工作内容。');
  }
  if (entries.some((entry) => splitWorkLines(contentForEntry(entry)).length > 0 && !String(entry.taskId ?? '').trim())) {
    throw new Error('预览中存在未选择任务的工作记录。');
  }
  if (entries.every((entry) => splitWorkLines(contentForEntry(entry)).length === 0)) {
    throw new Error('没有可录入的工作内容。');
  }

  const origin = zentaoOrigin(config.zentao.loginUrl);
  const tokenUrl = getZentaoTokenUrl(config);
  const login = await requestZentaoToken(config);
  if (!login.ok || !login.cookie) {
    throw new Error(`禅道HTTP登录失败：${login.status}`);
  }
  log.push(`HTTP login succeeded with token endpoint ${tokenUrl}`);

  let submittedRows = 0;
  for (const group of taskGroups) {
    const task = await requestZentaoTask(config, group.taskId, login);
    log.push(`Task ${group.taskId} effort: estimate=${task.estimate}, consumed=${task.consumed}, calculatedRemaining=${formatHours(task.remaining)}`);
    const chunks = chunkEntries(calculateRemainingHours(group.entries, task.remaining), 5);
    for (const chunk of chunks) {
      const formUrl = `${origin}/task-recordEstimate-${group.taskId}.html?onlybody=yes`;
      const formResponse = await fetch(formUrl, {
        headers: {
          cookie: login.cookie,
          Token: login.token
        }
      });
      const formHtml = await formResponse.text();
      if (!formResponse.ok || /用户登录|user-login/i.test(formHtml)) {
        throw new Error(`读取禅道日志表单失败：${formResponse.status}`);
      }
      const submitUrl = parseFormAction(formHtml, formResponse.url);
      log.push(`Loaded effort form ${formResponse.url}`);

      const payload = buildEffortPayload(group.taskId, chunk);
      const submitResponse = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
          cookie: login.cookie,
          Token: login.token,
          referer: formResponse.url
        },
        body: payload
      });
      const body = await submitResponse.text();
      log.push(`POST ${submitUrl} for task ${group.taskId} returned ${submitResponse.status}`);

      if (!submitResponse.ok || /用户登录|user-login/i.test(body)) {
        throw new Error(`禅道HTTP表单提交失败：${submitResponse.status}`);
      }
      if (/error|失败|出错|必填|不能为空/i.test(body)) {
        throw new Error(`禅道返回疑似失败响应：${body.slice(0, 200)}`);
      }
      submittedRows += filledEntries(chunk).length;
    }
  }

  return {
    ok: true,
    mode: 'http-form',
    submittedRows,
    log
  };
}

function chunkEntries(entries, size) {
  const chunks = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

async function taskFrame(page) {
  for (const frame of page.frames()) {
    const taskLinks = await frame.locator('a[href*="task-view-"]').count().catch(() => 0);
    if (taskLinks > 0) return frame;
  }
  return page.frames().find((candidate) => candidate.url().includes('/my-work-task')) ?? page.mainFrame();
}

function modalFrame(page) {
  return page.frames().find((candidate) => candidate.url().includes('/task-recordEstimate-'));
}

async function fillTaskLogEntries(page, config, entries, log) {
  const taskPageUrl = getTaskPageUrl(config);
  const firstTaskEntry = entries.find((entry) => String(entry.taskId ?? '').trim());
  if (!firstTaskEntry) {
    throw new Error('请在预览中为每条工作记录选择任务。');
  }
  const targetTask = {
    id: String(firstTaskEntry.taskId).trim(),
    name: String(firstTaskEntry.taskName ?? '').trim()
  };

  await page.goto(taskPageUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  log.push(`Opened task page ${taskPageUrl}`);

  const frame = await taskFrame(page);
  const taskRow = targetTask.id
    ? frame.locator(`tbody tr:has(a[href*="task-view-${targetTask.id}"])`).first()
    : frame.locator('tbody tr').filter({ hasText: targetTask.name }).first();
  if (!(await taskRow.isVisible().catch(() => false))) {
    throw new Error(targetTask.id ? `未找到任务ID：${targetTask.id}` : `未找到任务名称：${targetTask.name}`);
  }

  const logLink = taskRow.locator('a[href*="task-recordEstimate"]').first();
  if (!(await logLink.isVisible().catch(() => false))) {
    throw new Error(`任务 "${targetTask.name || targetTask.id}" 没有找到日志按钮。`);
  }
  await logLink.click();

  await page.waitForTimeout(800);
  const recordFrame = modalFrame(page);
  if (!recordFrame) {
    throw new Error('日志弹窗未打开。');
  }

  await fillRecordEstimateForm(recordFrame, entries, log);
}

async function fillRecordEstimateForm(frame, entries, log) {
  const filledEntries = entries
    .map((entry) => ({ date: entry.date, lines: splitWorkLines(contentForEntry(entry)) }))
    .filter((entry) => entry.lines.length > 0)
    .slice(0, 5);

  if (filledEntries.length === 0) {
    throw new Error('没有可录入的工作内容。');
  }

  const rows = frame.locator('tbody tr').filter({ has: frame.locator('input[type="text"]') });
  for (let index = 0; index < filledEntries.length; index += 1) {
    const row = rows.nth(index);
    const inputs = row.locator('input[type="text"]');
    if (await inputs.count() < 4) {
      throw new Error('日志弹窗字段结构不符合预期。');
    }
    await inputs.nth(0).fill(filledEntries[index].date);
    await inputs.nth(1).fill(filledEntries[index].lines.join('\n'));
    await inputs.nth(2).fill(index === 0 ? '8' : '0');
    await inputs.nth(3).fill('');
    log.push(`Prepared task log ${filledEntries[index].date}`);
  }

  await frame.getByRole('button', { name: '保存' }).click();
  await page.waitForTimeout(1000);
  log.push(`Submitted ${filledEntries.length} task log row(s).`);
}
