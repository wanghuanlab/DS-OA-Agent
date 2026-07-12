const $ = (id) => document.getElementById(id);
let config;
let preview;
let taskOptions = [];
let repositories = [];
let authorOptions = [];
let currentDirectoryPath = '';

function setStatus(message) {
  $('status').textContent = message;
  $('status').className = 'status';
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  $('toastRoot').append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function setFeedback(message, type = 'info') {
  $('status').textContent = message;
  $('status').className = `status ${type}`;
  showToast(message, type);
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
    if (document.querySelector('[data-repository-path]')) readRepositoriesFromDom();
    taskOptions = tasks;
    renderPreview();
    renderRepositories();
  }

  const messages = [status.vpn, status.login, status.tasks]
    .map((item) => item?.message)
    .filter(Boolean);
  setFeedback(messages.join(' '), status.vpn?.ok && status.login?.ok && status.tasks?.ok ? 'success' : 'error');
}

function selectedAuthors() {
  return [...$('commitAuthors').selectedOptions]
    .map((option) => option.value)
    .filter(Boolean);
}

function renderRepositories() {
  const root = $('repositoryList');
  root.innerHTML = '';
  if (repositories.length === 0) {
    root.innerHTML = '<p class="empty">暂无代码库目录。</p>';
    return;
  }
  for (const repository of repositories) {
    const path = typeof repository === 'string' ? repository : repository.path;
    const item = document.createElement('div');
    item.className = 'repo-item';
    item.dataset.repositoryPath = path;
    item.innerHTML = `
      <div>
        <div class="repo-path">${escapeHtml(path)}</div>
        <label>关联任务${taskSelectHtml(typeof repository === 'string' ? '' : repository.taskId ?? '', 'repo-task-select')}</label>
        <label>附加描述<textarea class="repo-description" rows="3" placeholder="可补充这个代码库对应的工作内容">${escapeHtml(typeof repository === 'string' ? '' : repository.description ?? '')}</textarea></label>
      </div>
      <button type="button" data-remove-repository="${escapeHtml(path)}">移除</button>
    `;
    root.append(item);
  }
}

function readRepositoriesFromDom() {
  repositories = [...document.querySelectorAll('[data-repository-path]')].map((row) => ({
    path: row.dataset.repositoryPath,
    taskId: row.querySelector('.repo-task-select')?.value ?? '',
    taskName: row.querySelector('.repo-task-select')?.selectedOptions[0]?.dataset.name ?? '',
    description: row.querySelector('.repo-description')?.value ?? ''
  }));
  return repositories;
}

function renderAuthors(selected = selectedAuthors()) {
  const select = $('commitAuthors');
  const selectedSet = new Set(selected);
  select.innerHTML = '';
  if (authorOptions.length === 0) {
    select.innerHTML = '<option value="">检查代码库后显示提交人</option>';
    return;
  }
  for (const author of authorOptions) {
    const option = document.createElement('option');
    option.value = author.name;
    option.textContent = `${author.name}（${author.count}）`;
    option.selected = selectedSet.has(author.name);
    select.append(option);
  }
}

function addRepository(path) {
  const repositoryPath = String(path ?? '').trim();
  if (!repositoryPath) {
    setFeedback('请先填写代码库目录。', 'error');
    return false;
  }
  if (repositories.some((repository) => (typeof repository === 'string' ? repository : repository.path) === repositoryPath)) {
    setFeedback('这个代码库目录已经添加过。', 'info');
    return true;
  }
  repositories.push({ path: repositoryPath, taskId: '', taskName: '', description: '' });
  renderRepositories();
  setFeedback('代码库目录已添加。', 'success');
  return true;
}

async function openDirectoryBrowser(path = '') {
  $('directoryBrowser').hidden = false;
  await loadDirectories(path);
}

async function loadDirectories(path = '') {
  const data = await jsonFetch(`/api/directories${path ? `?path=${encodeURIComponent(path)}` : ''}`, {
    headers: {}
  });
  currentDirectoryPath = data.currentPath;
  $('directoryCurrent').textContent = data.currentPath;
  $('directoryParent').dataset.path = data.parentPath;
  const root = $('directoryList');
  root.innerHTML = '';
  if (data.directories.length === 0) {
    root.innerHTML = '<p class="empty">当前目录没有子目录。</p>';
    return;
  }
  for (const directory of data.directories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'directory-entry';
    button.dataset.path = directory.path;
    button.textContent = directory.name;
    root.append(button);
  }
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
  config.report.code ??= {};
  config.report.code.type = 'auto';
  config.report.code.repositories = readRepositoriesFromDom();
  config.report.code.authors = selectedAuthors();
  config.report.hg ??= {};
  config.report.hg.repositories = config.report.code.repositories;
  config.report.longText = '';
  config.report.supplements = [];
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
  repositories = [...(config.report.code?.repositories ?? config.report.hg?.repositories ?? [])];
  authorOptions = (config.report.code?.authors ?? []).map((name) => ({ name, count: 0 }));
  renderRepositories();
  renderAuthors(config.report.code?.authors ?? []);
}

function taskSelectHtml(selectedId = '', className = 'task-select') {
  const options = ['<option value="">请选择任务</option>'];
  for (const task of taskOptions) {
    const selected = task.id === selectedId ? ' selected' : '';
    options.push(`<option value="${escapeHtml(task.id)}" data-name="${escapeHtml(task.name)}" data-left="${escapeHtml(task.left ?? '')}"${selected}>[${escapeHtml(task.id)}] ${escapeHtml(task.name)}</option>`);
  }
  return `<select class="${escapeHtml(className)}">${options.join('')}</select>`;
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
  await checkZentaoStatus();
}

$('saveConfig').addEventListener('click', async () => {
  await runAction(
    '正在保存配置...',
    '配置已保存。',
    () => jsonFetch('/api/config', { method: 'POST', body: JSON.stringify({ config: readFormConfig() }) })
  );
});

async function checkZentaoStatus() {
  setHealth('vpnStatus', 'VPN', 'unknown', '更新中');
  setHealth('loginStatus', '登录', 'unknown', '等待中');
  setHealth('taskStatus', '任务', 'unknown', '等待中');
  const data = await runAction('正在检测禅道状态...', '禅道状态检测完成。', () => jsonFetch('/api/zentao/status', {
    method: 'POST',
    body: JSON.stringify({ config: readFormConfig() })
  }));
  renderZentaoStatus(data.status);
}

$('checkStatus').addEventListener('click', checkZentaoStatus);

$('chooseDirectory').addEventListener('click', async () => {
  try {
    await openDirectoryBrowser($('repositoryPath').value.trim());
  } catch (error) {
    setFeedback(`打开目录浏览器失败：${error.message}`, 'error');
  }
});

$('directoryPicker').addEventListener('change', () => {
  const file = $('directoryPicker').files?.[0];
  const path = file?.path ?? file?.webkitRelativePath?.split('/')[0] ?? '';
  $('repositoryPath').value = path;
  if (addRepository(path)) $('repositoryPath').value = '';
});

$('addRepository').addEventListener('click', () => {
  readRepositoriesFromDom();
  addRepository($('repositoryPath').value);
  $('repositoryPath').value = '';
});

$('repositoryList').addEventListener('click', (event) => {
  const path = event.target.dataset.removeRepository;
  if (!path) return;
  readRepositoriesFromDom();
  repositories = repositories.filter((repository) => (typeof repository === 'string' ? repository : repository.path) !== path);
  renderRepositories();
  setFeedback('代码库目录已移除。', 'success');
});

$('closeDirectoryBrowser').addEventListener('click', () => {
  $('directoryBrowser').hidden = true;
});

$('directoryParent').addEventListener('click', async () => {
  await loadDirectories($('directoryParent').dataset.path);
});

$('selectDirectory').addEventListener('click', () => {
  readRepositoriesFromDom();
  if (addRepository(currentDirectoryPath)) {
    $('repositoryPath').value = '';
    $('directoryBrowser').hidden = true;
  }
});

$('directoryList').addEventListener('click', async (event) => {
  const path = event.target.dataset.path;
  if (!path) return;
  await loadDirectories(path);
});

$('checkRepositories').addEventListener('click', async () => {
  if ($('repositoryPath').value.trim()) {
    readRepositoriesFromDom();
    addRepository($('repositoryPath').value);
    $('repositoryPath').value = '';
  }
  const formConfig = readFormConfig();
  if (formConfig.report.code.repositories.length === 0) {
    setFeedback('请先添加至少一个代码库目录。', 'error');
    return;
  }
  const data = await runAction('正在检查代码库和提交人...', '代码库检查完成。', () => jsonFetch('/api/repositories/check', {
    method: 'POST',
    body: JSON.stringify({
      config: formConfig,
      period: { startDate: $('startDate').value, endDate: $('endDate').value }
    })
  }));
  const previous = selectedAuthors();
  authorOptions = data.result.authors ?? [];
  renderAuthors(previous);
  const failed = data.result.errors?.length ?? 0;
  const skipped = (data.result.repositories ?? []).filter((repository) => repository.skipped).length;
  const commitCount = data.result.commits?.length ?? 0;
  const authorCount = authorOptions.length;
  const repoSummary = (data.result.repositories ?? [])
    .map((repository) => repository.ok
      ? `${repository.path}：${repository.skipped ? '已忽略' : `${repository.type.toUpperCase()}，${repository.commitCount} 条提交`}`
      : `${repository.path}：失败，${repository.message}`)
    .join('；');
  setFeedback(`代码库检查完成：${commitCount} 条提交，${authorCount} 个提交人${skipped ? `，${skipped} 个普通目录已忽略` : ''}${failed ? `，${failed} 个目录失败` : ''}。${repoSummary}`, failed ? 'error' : 'success');
});

$('generate').addEventListener('click', async () => {
  const data = await runAction('正在生成预览...', '预览已生成，可修改后保存或立即录入。', async () => {
    const formConfig = readFormConfig();
    const hasInput = formConfig.report.code.repositories.some((repository) => repository.path || repository.description.trim());
    if (!hasInput) {
      throw new Error('请添加代码库目录，或在代码库中填写附加描述，否则无法生成预览。');
    }
    return jsonFetch('/api/generate-preview', {
      method: 'POST',
      body: JSON.stringify({
        config: formConfig,
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
