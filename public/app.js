const $ = (id) => document.getElementById(id);
let config;
let preview;
let taskOptions = [];

function setStatus(message) {
  $('status').textContent = message;
  $('status').className = 'status';
}

function setFeedback(message, type = 'info') {
  $('status').textContent = message;
  $('status').className = `status ${type}`;
}

function setHealth(id, label, state = 'unknown', detail = '') {
  const pill = $(id);
  pill.textContent = `${label}：${detail}`;
  pill.className = `health-pill ${state}`;
}

function renderZentaoStatus(status) {
  const vpnState = status.vpn?.ok ? 'ok' : 'error';
  const loginState = status.login?.ok ? 'ok' : 'error';
  const taskState = status.tasks?.ok ? 'ok' : 'error';

  setHealth('vpnStatus', 'VPN', vpnState, status.vpn?.ok ? '已连接' : '不可达');
  setHealth('loginStatus', '登录', loginState, status.login?.ok ? '已登录' : '未登录');
  setHealth('taskStatus', '任务', taskState, status.tasks?.ok ? `${status.tasks.count} 个` : '未获取');

  const tasks = status.tasks?.tasks ?? [];
  if (tasks.length > 0) {
    taskOptions = tasks;
    renderPreview();
  }

  const messages = [status.vpn, status.login, status.tasks]
    .map((item) => item?.message)
    .filter(Boolean);
  setFeedback(messages.join(' '), status.vpn?.ok && status.login?.ok && status.tasks?.ok ? 'success' : 'error');
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? response.statusText);
  return data;
}

async function runAction(loadingMessage, successMessage, action) {
  try {
    setFeedback(loadingMessage, 'info');
    const result = await action();
    setFeedback(successMessage, 'success');
    return result;
  } catch (error) {
    setFeedback(error.message || '操作失败，请检查配置后重试。', 'error');
    throw error;
  }
}

function readFormConfig() {
  config.zentao.loginUrl = $('zentaoLoginUrl').value.trim();
  config.zentao.username = $('zentaoUsername').value.trim();
  config.zentao.password = $('zentaoPassword').value;
  config.zentao.taskPageUrl = $('zentaoTaskPageUrl').value.trim();
  config.llm.baseUrl = $('llmBaseUrl').value.trim();
  config.llm.apiKey = $('llmApiKey').value;
  config.llm.model = $('llmModel').value.trim();
  config.report.defaultSource = $('source').value;
  config.report.code ??= {};
  config.report.code.type = $('repoType').value;
  config.report.code.repositories = $('repositories').value.split('\n').map((line) => line.trim()).filter(Boolean);
  config.report.hg ??= {};
  config.report.hg.repositories = config.report.code.repositories;
  config.report.longText = $('longText').value;
  return config;
}

function renderConfig() {
  $('zentaoLoginUrl').value = config.zentao.loginUrl ?? '';
  $('zentaoUsername').value = config.zentao.username ?? '';
  $('zentaoPassword').value = config.zentao.password ?? '';
  $('zentaoTaskPageUrl').value = config.zentao.taskPageUrl ?? 'http://192.168.0.216:30085/my-work-task.html';
  $('llmBaseUrl').value = config.llm.baseUrl ?? '';
  $('llmApiKey').value = config.llm.apiKey ?? '';
  $('llmModel').value = config.llm.model ?? '';
  $('source').value = config.report.defaultSource === 'hg' ? 'code' : (config.report.defaultSource ?? 'code');
  $('repoType').value = config.report.code?.type ?? 'hg';
  $('repositories').value = (config.report.code?.repositories ?? config.report.hg?.repositories ?? []).join('\n');
  $('longText').value = config.report.longText ?? '';
}

function taskSelectHtml(selectedId = '') {
  const options = ['<option value="">请选择任务</option>'];
  for (const task of taskOptions) {
    const selected = task.id === selectedId ? ' selected' : '';
    options.push(`<option value="${escapeHtml(task.id)}" data-name="${escapeHtml(task.name)}" data-left="${escapeHtml(task.left ?? '')}"${selected}>[${escapeHtml(task.id)}] ${escapeHtml(task.name)}</option>`);
  }
  return `<select class="task-select">${options.join('')}</select>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function rememberTaskOptions(tasks) {
  const byId = new Map(taskOptions.map((task) => [task.id, task]));
  for (const task of tasks) {
    if (task.id && task.name) byId.set(task.id, task);
  }
  taskOptions = [...byId.values()];
}

function readPreviewFromDom() {
  if (!preview) return null;
  preview.entries = [...document.querySelectorAll('[data-preview-date]')].map((row) => ({
    date: row.dataset.previewDate,
    taskId: row.querySelector('.task-select').value,
    taskName: row.querySelector('.task-select').selectedOptions[0]?.dataset.name ?? '',
    left: row.querySelector('.task-select').selectedOptions[0]?.dataset.left ?? '0',
    content: row.querySelector('textarea').value,
    hours: row.querySelector('.hours-input').value || '8',
    items: row.querySelector('textarea').value.split('\n').map((line) => line.trim()).filter(Boolean)
  }));
  return preview;
}

function renderPreview() {
  const root = $('preview');
  root.innerHTML = '';
  if (!preview?.entries?.length) {
    root.innerHTML = '<p class="empty">暂无预览。</p>';
    return;
  }
  root.innerHTML = '<div class="preview-head"><div>日期</div><div>任务</div><div>工作描述</div><div>耗时(小时)</div></div>';
  for (const entry of preview.entries) {
    rememberTaskOptions([{ id: entry.taskId ?? '', name: entry.taskName ?? '', left: entry.left ?? '' }]);
    const row = document.createElement('div');
    row.className = 'preview-row';
    row.dataset.previewDate = entry.date;
    row.innerHTML = `
      <div class="date">${escapeHtml(entry.date)}</div>
      <div>${taskSelectHtml(entry.taskId ?? '')}</div>
      <textarea rows="4">${escapeHtml(entry.content || (entry.items ?? []).join('\n'))}</textarea>
      <input class="hours-input" type="number" min="0" step="0.5" value="${escapeHtml(entry.hours ?? 8)}">
    `;
    root.append(row);
  }
}

async function boot() {
  const [{ config: loadedConfig }, period, { preview: loadedPreview }] = await Promise.all([
    jsonFetch('/api/config'),
    jsonFetch('/api/default-period'),
    jsonFetch('/api/preview')
  ]);
  config = loadedConfig;
  preview = loadedPreview;
  renderConfig();
  $('startDate').value = period.startDate;
  $('endDate').value = period.endDate;
  renderPreview();
  setFeedback('已加载配置和预览状态。', 'success');
}

$('saveConfig').addEventListener('click', async () => {
  await runAction(
    '正在保存配置...',
    '配置已保存。',
    () => jsonFetch('/api/config', { method: 'POST', body: JSON.stringify({ config: readFormConfig() }) })
  );
});

$('checkStatus').addEventListener('click', async () => {
  const data = await runAction('正在检测禅道状态...', '禅道状态检测完成。', () => jsonFetch('/api/zentao/status', {
    method: 'POST',
    body: JSON.stringify({ config: readFormConfig() })
  }));
  renderZentaoStatus(data.status);
});

$('generate').addEventListener('click', async () => {
  const data = await runAction('正在生成预览...', '预览已生成，可修改后保存或立即录入。', async () => {
    const formConfig = readFormConfig();
    if ($('source').value === 'code' && formConfig.report.code.repositories.length === 0) {
      throw new Error('请至少填写一个 Git、HG 或 SVN 代码库目录。');
    }
    if ($('source').value === 'longText' && !$('longText').value.trim()) {
      throw new Error('请输入长文本工作描述。');
    }
    return jsonFetch('/api/generate-preview', {
      method: 'POST',
      body: JSON.stringify({
        config: formConfig,
        source: $('source').value,
        longText: $('longText').value,
        period: { startDate: $('startDate').value, endDate: $('endDate').value }
      })
    });
  });
  preview = data.preview;
  renderPreview();
});

$('savePreview').addEventListener('click', async () => {
  await runAction('正在保存预览...', '预览已保存。', async () => {
    preview = readPreviewFromDom();
    if (!preview) throw new Error('当前没有可保存的预览，请先生成预览。');
    return jsonFetch('/api/preview', { method: 'POST', body: JSON.stringify({ preview }) });
  });
});

$('submitNow').addEventListener('click', async () => {
  await runAction('正在录入禅道...', '录入流程已执行，结果见 output/playwright。', async () => {
    preview = readPreviewFromDom();
    if (!preview) throw new Error('当前没有可录入的预览，请先生成预览。');
    if (preview.entries.some((entry) => entry.content.trim() && !entry.taskId)) throw new Error('请在预览中为每条工作记录选择任务。');
    return jsonFetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify({ config: readFormConfig(), preview })
    });
  });
});

boot().catch((error) => setFeedback(error.message || '页面初始化失败。', 'error'));
