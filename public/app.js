const $ = (id) => document.getElementById(id);

let config;
let preview;
let taskOptions = [];
let repositories = [];
let authorOptions = [];
let currentDirectoryPath = '';
let activeStep = 1;
let autoSaveTimer;
let autoSaveRunning = false;
let autoSavePending = false;
let autoSaveReady = false;

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  $('toastRoot').append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function setFeedback(message, type = 'info', toast = false) {
  $('status').textContent = message;
  $('status').className = `feedback ${type}`;
  if (toast) showToast(message, type);
}

function setHealth(id, label, state = 'unknown', detail = '') {
  const pill = $(id);
  pill.textContent = `${label}：${detail}`;
  pill.className = `health-pill ${state}`;
}

function setSettingsSaveState(message, state = '') {
  $('settingsSaveState').textContent = message;
  $('settingsSaveState').className = `settings-save-state ${state}`.trim();
}

function setButtonBusy(button, busy, busyLabel = '处理中...') {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
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
    if (document.querySelector('[data-preview-date]')) readPreviewFromDom();
    taskOptions = tasks;
    renderRepositories();
    renderPreview();
  }

  const messages = [status.vpn, status.login, status.tasks]
    .map((item) => item?.message)
    .filter(Boolean);
  const success = status.vpn?.ok && status.login?.ok && status.tasks?.ok;
  setFeedback(messages.join(' '), success ? 'success' : 'error', true);
}

function selectedAuthors() {
  return [...$('commitAuthors').selectedOptions]
    .map((option) => option.value)
    .filter(Boolean);
}

function repositoryDisplayName(path) {
  return String(path).split(/[\\/]/).filter(Boolean).at(-1) || path;
}

function renderRepositories() {
  const root = $('repositoryList');
  root.innerHTML = '';
  $('repositoryCount').textContent = repositories.length > 0 ? `已添加 ${repositories.length} 个代码库` : '尚未添加代码库';

  if (repositories.length === 0) {
    root.innerHTML = '<div class="empty-state">选择文件夹或粘贴目录后，代码库会显示在这里。</div>';
    updateReadiness();
    return;
  }

  rememberTaskOptions(repositories
    .filter((repository) => typeof repository !== 'string')
    .map((repository) => ({ id: repository.taskId, name: repository.taskName, left: repository.left })));

  for (const repository of repositories) {
    const path = typeof repository === 'string' ? repository : repository.path;
    const item = document.createElement('div');
    item.className = 'repo-item';
    item.dataset.repositoryPath = path;
    item.innerHTML = `
      <div class="repo-path">
        <strong title="${escapeHtml(path)}">${escapeHtml(repositoryDisplayName(path))}</strong>
        <small title="${escapeHtml(path)}">${escapeHtml(path)}</small>
      </div>
      <label><span class="sr-only">关联任务</span>${taskSelectHtml(typeof repository === 'string' ? '' : repository.taskId ?? '', 'repo-task-select')}</label>
      <button type="button" class="remove-repository" data-remove-repository="${escapeHtml(path)}">移除</button>
    `;
    root.append(item);
  }

  updateReadiness();
}

function readRepositoriesFromDom() {
  repositories = [...document.querySelectorAll('[data-repository-path]')].map((row) => ({
    path: row.dataset.repositoryPath,
    taskId: row.querySelector('.repo-task-select')?.value ?? '',
    taskName: row.querySelector('.repo-task-select')?.selectedOptions[0]?.dataset.name ?? '',
    left: row.querySelector('.repo-task-select')?.selectedOptions[0]?.dataset.left ?? ''
  }));
  return repositories;
}

function renderAuthors(selected = selectedAuthors()) {
  const select = $('commitAuthors');
  const selectedSet = new Set(selected);
  select.innerHTML = '<option value="">请选择提交人</option>';
  if (authorOptions.length === 0) {
    select.innerHTML = '<option value="">检查代码库后显示提交人</option>';
    updateReadiness();
    return;
  }
  for (const author of authorOptions) {
    const option = document.createElement('option');
    option.value = author.name;
    option.textContent = `${author.name}（${author.count}）`;
    option.selected = selectedSet.has(author.name);
    select.append(option);
  }
  updateReadiness();
}

function updateReadiness() {
  if (!config) return;
  const hasPeriod = Boolean($('startDate').value && $('endDate').value);
  const associated = repositories.filter((repository) => typeof repository !== 'string' && repository.taskId).length;
  const authorCount = selectedAuthors().length;
  const summary = $('readinessSummary');
  const ready = hasPeriod && repositories.length > 0;
  summary.className = `readiness${ready ? ' ready' : ''}`;
  summary.querySelector('strong').textContent = ready ? '准备就绪' : '等待准备';

  if (!hasPeriod) {
    summary.querySelector('span').textContent = '请选择完整的填报日期。';
  } else if (repositories.length === 0) {
    summary.querySelector('span').textContent = '请至少添加一个代码库。';
  } else {
    const taskText = associated === repositories.length ? `${associated} 个任务已关联` : `${associated}/${repositories.length} 个任务已关联`;
    const authorText = authorCount > 0 ? `${authorCount} 位提交人` : '提交人待选择';
    summary.querySelector('span').textContent = `${repositories.length} 个代码库，${taskText}，${authorText}。`;
  }
}

function addRepository(path) {
  const repositoryPath = String(path ?? '').trim();
  if (!repositoryPath) {
    setFeedback('请先填写或选择代码库目录。', 'error', true);
    return false;
  }
  if (repositories.some((repository) => (typeof repository === 'string' ? repository : repository.path) === repositoryPath)) {
    setFeedback('这个代码库目录已经添加过。', 'info', true);
    return true;
  }
  repositories.push({ path: repositoryPath, taskId: '', taskName: '' });
  renderRepositories();
  scheduleAutoSave();
  setFeedback('代码库目录已添加，请继续关联任务。', 'success', true);
  return true;
}

async function openDirectoryBrowser(path = '') {
  $('directoryBrowser').hidden = false;
  await loadDirectories(path);
}

async function loadDirectories(path = '') {
  const data = await jsonFetch(`/api/directories${path ? `?path=${encodeURIComponent(path)}` : ''}`, { headers: {} });
  currentDirectoryPath = data.currentPath;
  $('directoryCurrent').textContent = data.currentPath;
  $('directoryParent').dataset.path = data.parentPath;
  const roots = $('directoryRoots');
  roots.innerHTML = '';
  const directoryRoots = data.roots ?? [];
  const currentPath = data.currentPath.toLowerCase();
  const activeRoot = directoryRoots
    .filter((directoryRoot) => currentPath.startsWith(directoryRoot.path.toLowerCase()))
    .sort((left, right) => right.path.length - left.path.length)[0];
  for (const directoryRoot of directoryRoots) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `directory-root${directoryRoot.path === activeRoot?.path ? ' active' : ''}`;
    button.dataset.path = directoryRoot.path;
    button.textContent = directoryRoot.name;
    roots.append(button);
  }

  const root = $('directoryList');
  root.innerHTML = '';
  if (data.directories.length === 0) {
    root.innerHTML = '<div class="empty-state">当前目录没有子目录。</div>';
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
    if (successMessage) setFeedback(successMessage, 'success', true);
    return result;
  } catch (error) {
    setFeedback(error.message || '操作失败，请检查配置后重试。', 'error', true);
    return null;
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
  return config;
}

async function persistConfigAutomatically() {
  if (!autoSaveReady || !config) return;
  if (autoSaveRunning) {
    autoSavePending = true;
    return;
  }
  autoSaveRunning = true;
  setSettingsSaveState('正在自动保存...', 'saving');
  try {
    await jsonFetch('/api/config', {
      method: 'POST',
      body: JSON.stringify({ config: readFormConfig() })
    });
    setSettingsSaveState('已自动保存', 'success');
  } catch (error) {
    setSettingsSaveState('自动保存失败', 'error');
    showToast(`配置自动保存失败：${error.message}`, 'error');
  } finally {
    autoSaveRunning = false;
    if (autoSavePending) {
      autoSavePending = false;
      scheduleAutoSave(0);
    }
  }
}

function scheduleAutoSave(delay = 700) {
  if (!autoSaveReady) return;
  window.clearTimeout(autoSaveTimer);
  setSettingsSaveState('有修改尚未保存', 'saving');
  autoSaveTimer = window.setTimeout(persistConfigAutomatically, delay);
}

function renderConfig() {
  $('zentaoLoginUrl').value = config.zentao.loginUrl ?? '';
  $('zentaoUsername').value = config.zentao.username ?? '';
  $('zentaoPassword').value = config.zentao.password ?? '';
  $('zentaoTaskPageUrl').value = config.zentao.taskPageUrl ?? '';
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
    const selected = String(task.id) === String(selectedId) ? ' selected' : '';
    const remaining = String(task.left ?? '').trim() ? `（剩余 ${escapeHtml(task.left)}h）` : '';
    options.push(`<option value="${escapeHtml(task.id)}" data-name="${escapeHtml(task.name)}" data-left="${escapeHtml(task.left ?? '')}"${selected}>[${escapeHtml(task.id)}] ${escapeHtml(task.name)}${remaining}</option>`);
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
  updatePreviewSummary();
  return preview;
}

function renderPreview() {
  const root = $('preview');
  root.innerHTML = '';
  if (!preview?.entries?.length) {
    root.innerHTML = '<div class="empty-state">暂无预览，请先完成准备工作并生成。</div>';
    updatePreviewSummary();
    return;
  }
  for (const entry of preview.entries) {
    rememberTaskOptions([{ id: entry.taskId ?? '', name: entry.taskName ?? '', left: entry.left ?? '' }]);
  }
  root.innerHTML = '<div class="preview-head"><div>日期</div><div>任务</div><div>工作描述</div><div>耗时(小时)</div><div>操作</div></div>';
  const renderedDates = new Set();
  preview.entries.forEach((entry, index) => {
    const firstForDate = !renderedDates.has(entry.date);
    renderedDates.add(entry.date);
    const row = document.createElement('div');
    row.className = 'preview-row';
    row.dataset.previewDate = entry.date;
    row.dataset.previewIndex = String(index);
    row.innerHTML = `
      <div class="preview-date-cell">${firstForDate ? `<span class="date">${escapeHtml(entry.date)}</span><button type="button" class="add-preview-entry" data-add-preview-date="${escapeHtml(entry.date)}">添加任务</button>` : ''}</div>
      <div>${taskSelectHtml(entry.taskId ?? '')}</div>
      <textarea rows="3" aria-label="工作描述">${escapeHtml(entry.content || (entry.items ?? []).join('\n'))}</textarea>
      <input class="hours-input" aria-label="耗时小时" type="number" min="0" step="0.5" value="${escapeHtml(entry.hours ?? 8)}">
      <button type="button" class="remove-preview-entry" data-remove-preview-index="${index}" aria-label="移除这条工作记录">移除</button>
    `;
    root.append(row);
  });
  updatePreviewSummary();
}

function updatePreviewSummary() {
  const entries = preview?.entries ?? [];
  const total = entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  const dates = new Set(entries.map((entry) => entry.date));
  $('previewTotal').textContent = `本周合计：${formatHours(total)} 小时`;
  $('previewMeta').textContent = entries.length > 0
    ? `${dates.size} 个工作日，${entries.length} 条任务记录。检查任务、描述和耗时后继续。`
    : '检查任务、工作描述和耗时后继续。';
}

function formatHours(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function addPreviewEntry(date) {
  preview = readPreviewFromDom();
  preview.entries.push({ date, taskId: '', taskName: '', left: '0', content: '', items: [], hours: 1 });
  preview.entries.sort((left, right) => left.date.localeCompare(right.date));
  renderPreview();
  showToast(`${date} 已添加一条任务记录。`, 'success');
}

function removePreviewEntry(index) {
  preview = readPreviewFromDom();
  const [removed] = preview.entries.splice(index, 1);
  if (removed && !preview.entries.some((entry) => entry.date === removed.date)) {
    preview.entries.push({ date: removed.date, taskId: '', taskName: '', left: '0', content: '', items: [], hours: 8 });
    preview.entries.sort((left, right) => left.date.localeCompare(right.date));
  }
  renderPreview();
  showToast('工作记录已移除。', 'success');
}

function setActiveStep(step) {
  if (step > 1 && !preview?.entries?.length) {
    setFeedback('请先生成日志预览，再进入后续步骤。', 'info', true);
    step = 1;
  }
  activeStep = step;
  for (const button of document.querySelectorAll('[data-step]')) {
    const buttonStep = Number(button.dataset.step);
    button.classList.toggle('active', buttonStep === step);
    button.classList.toggle('complete', buttonStep < step);
    button.setAttribute('aria-current', buttonStep === step ? 'step' : 'false');
  }
  for (const panel of document.querySelectorAll('[data-step-panel]')) {
    panel.hidden = Number(panel.dataset.stepPanel) !== step;
  }
  if (step === 3) renderSubmissionSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderSubmissionSummary() {
  preview = readPreviewFromDom() ?? preview;
  const entries = preview?.entries ?? [];
  const dates = new Set(entries.map((entry) => entry.date));
  const tasks = new Set(entries.map((entry) => entry.taskId).filter(Boolean));
  const total = entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  $('submissionSummary').innerHTML = `
    <dl>
      <div><dt>填报周期</dt><dd>${escapeHtml($('startDate').value)} 至 ${escapeHtml($('endDate').value)}</dd></div>
      <div><dt>工作日</dt><dd>${dates.size} 天</dd></div>
      <div><dt>任务记录</dt><dd>${entries.length} 条，关联 ${tasks.size} 个任务</dd></div>
      <div><dt>合计耗时</dt><dd>${formatHours(total)} 小时</dd></div>
    </dl>
  `;
}

function validatePreview() {
  preview = readPreviewFromDom();
  if (!preview?.entries?.length) throw new Error('当前没有可录入的预览，请先生成预览。');
  if (preview.entries.some((entry) => entry.content.trim() && !entry.taskId)) {
    throw new Error('请为每条有工作内容的记录选择禅道任务。');
  }
  if (preview.entries.some((entry) => entry.taskId && !entry.content.trim())) {
    throw new Error('请补充所选任务的工作描述。');
  }
  return preview;
}

function openSettingsView() {
  $('workspaceView').hidden = true;
  $('settingsView').hidden = false;
  $('openSettings').setAttribute('aria-pressed', 'true');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeSettingsView() {
  $('settingsView').hidden = true;
  $('workspaceView').hidden = false;
  $('openSettings').setAttribute('aria-pressed', 'false');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  $('startDate').value = preview?.period?.startDate ?? period.startDate;
  $('endDate').value = preview?.period?.endDate ?? period.endDate;
  renderPreview();
  updateReadiness();
  autoSaveReady = true;
  setSettingsSaveState('所有修改都会自动保存');
  setFeedback('配置和预览已加载。请确认本周工作来源。', 'success');
  await checkZentaoStatus();
}

async function checkZentaoStatus() {
  const button = $('checkStatus');
  setButtonBusy(button, true, '正在刷新...');
  setHealth('vpnStatus', 'VPN', 'unknown', '更新中');
  setHealth('loginStatus', '登录', 'unknown', '等待中');
  setHealth('taskStatus', '任务', 'unknown', '等待中');
  const data = await runAction('正在检测禅道连接并更新任务列表...', '', () => jsonFetch('/api/zentao/status', {
    method: 'POST',
    body: JSON.stringify({ config: readFormConfig() })
  }));
  setButtonBusy(button, false);
  if (data) renderZentaoStatus(data.status);
}

$('checkStatus').addEventListener('click', checkZentaoStatus);
$('openSettings').addEventListener('click', openSettingsView);
$('closeSettings').addEventListener('click', closeSettingsView);

for (const step of document.querySelectorAll('[data-step]')) {
  step.addEventListener('click', () => setActiveStep(Number(step.dataset.step)));
}

for (const id of ['startDate', 'endDate']) {
  $(id).addEventListener('change', () => {
    updateReadiness();
    scheduleAutoSave();
  });
}

$('chooseDirectory').addEventListener('click', async () => {
  try {
    await openDirectoryBrowser($('repositoryPath').value.trim());
  } catch (error) {
    setFeedback(`打开目录浏览器失败：${error.message}`, 'error', true);
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
  scheduleAutoSave();
  setFeedback('代码库目录已移除。', 'success', true);
});

$('repositoryList').addEventListener('input', () => {
  readRepositoriesFromDom();
  renderSupplementSummary();
  updateReadiness();
  scheduleAutoSave();
});
$('repositoryList').addEventListener('change', () => {
  readRepositoriesFromDom();
  updateReadiness();
  scheduleAutoSave();
});
$('commitAuthors').addEventListener('change', () => {
  updateReadiness();
  scheduleAutoSave();
});

for (const id of ['zentaoLoginUrl', 'zentaoUsername', 'zentaoPassword', 'zentaoTaskPageUrl', 'llmBaseUrl', 'llmApiKey', 'llmModel']) {
  $(id).addEventListener('input', () => scheduleAutoSave());
  $(id).addEventListener('change', () => scheduleAutoSave());
}

$('preview').addEventListener('click', (event) => {
  const addDate = event.target.dataset.addPreviewDate;
  if (addDate) {
    addPreviewEntry(addDate);
    return;
  }
  const removeIndex = event.target.dataset.removePreviewIndex;
  if (removeIndex !== undefined) removePreviewEntry(Number(removeIndex));
});
$('preview').addEventListener('input', () => readPreviewFromDom());
$('preview').addEventListener('change', () => readPreviewFromDom());

$('closeDirectoryBrowser').addEventListener('click', () => { $('directoryBrowser').hidden = true; });
$('directoryParent').addEventListener('click', async () => { await loadDirectories($('directoryParent').dataset.path); });
$('directoryRoots').addEventListener('click', async (event) => {
  const path = event.target.dataset.path;
  if (path) await loadDirectories(path);
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
  if (path) await loadDirectories(path);
});
$('directoryBrowser').addEventListener('click', (event) => {
  if (event.target === $('directoryBrowser')) $('directoryBrowser').hidden = true;
});

$('checkRepositories').addEventListener('click', async () => {
  if ($('repositoryPath').value.trim()) {
    readRepositoriesFromDom();
    addRepository($('repositoryPath').value);
    $('repositoryPath').value = '';
  }
  const formConfig = readFormConfig();
  if (formConfig.report.code.repositories.length === 0) {
    setFeedback('请先添加至少一个代码库目录。', 'error', true);
    return;
  }
  const button = $('checkRepositories');
  setButtonBusy(button, true, '正在检查...');
  const data = await runAction('正在检查代码库和提交人...', '代码库检查完成。', () => jsonFetch('/api/repositories/check', {
    method: 'POST',
    body: JSON.stringify({
      config: formConfig,
      period: { startDate: $('startDate').value, endDate: $('endDate').value }
    })
  }));
  setButtonBusy(button, false);
  if (!data) return;

  const previous = selectedAuthors();
  authorOptions = data.result.authors ?? [];
  for (const name of previous) {
    if (!authorOptions.some((author) => author.name === name)) authorOptions.push({ name, count: 0 });
  }
  renderAuthors(previous);
  scheduleAutoSave();
  const failed = data.result.errors?.length ?? 0;
  const skipped = (data.result.repositories ?? []).filter((repository) => repository.skipped).length;
  const commitCount = data.result.commits?.length ?? 0;
  const authorCount = authorOptions.length;
  setFeedback(`检查完成：${commitCount} 条提交，${authorCount} 位提交人${skipped ? `，${skipped} 个普通目录已忽略` : ''}${failed ? `，${failed} 个目录失败` : ''}。`, failed ? 'error' : 'success', true);
});

$('generate').addEventListener('click', async () => {
  const button = $('generate');
  setButtonBusy(button, true, '正在生成...');
  const data = await runAction('正在理解提交记录并生成本周预览...', '预览已生成，请检查任务、描述和耗时。', async () => {
    const formConfig = readFormConfig();
    const hasInput = formConfig.report.code.repositories.some((repository) => repository.path);
    if (!hasInput) throw new Error('请至少添加一个代码库目录。');
    return jsonFetch('/api/generate-preview', {
      method: 'POST',
      body: JSON.stringify({
        config: formConfig,
        period: { startDate: $('startDate').value, endDate: $('endDate').value }
      })
    });
  });
  setButtonBusy(button, false);
  if (!data) return;
  preview = data.preview;
  renderPreview();
  setActiveStep(2);
});

$('backToPrepare').addEventListener('click', () => setActiveStep(1));
$('backToPreview').addEventListener('click', () => setActiveStep(2));

$('savePreview').addEventListener('click', async () => {
  const button = $('savePreview');
  setButtonBusy(button, true, '正在保存...');
  await runAction('正在保存预览...', '预览已保存。', async () => {
    preview = readPreviewFromDom();
    if (!preview) throw new Error('当前没有可保存的预览，请先生成预览。');
    return jsonFetch('/api/preview', { method: 'POST', body: JSON.stringify({ preview }) });
  });
  setButtonBusy(button, false);
});

$('reviewSubmit').addEventListener('click', () => {
  try {
    validatePreview();
    setActiveStep(3);
  } catch (error) {
    setFeedback(error.message, 'error', true);
  }
});

$('submitNow').addEventListener('click', async () => {
  const button = $('submitNow');
  setButtonBusy(button, true, '正在录入...');
  await runAction('正在录入禅道，请不要关闭客户端...', '禅道日志录入完成。', async () => {
    validatePreview();
    return jsonFetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify({ config: readFormConfig(), preview })
    });
  });
  setButtonBusy(button, false);
});

boot().catch((error) => setFeedback(error.message || '页面初始化失败。', 'error', true));
