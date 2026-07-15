import { BrowserWindow, session } from 'electron';

async function authenticateSession(browserSession, config) {
  const origin = new URL(config.zentao.loginUrl).origin;
  await browserSession.clearStorageData({ origin, storages: ['cookies'] });
  const response = await fetch(`${origin}/api.php/v1/tokens`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      account: config.zentao.username,
      password: config.zentao.password
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) {
    throw new Error(`禅道桌面会话登录失败：HTTP ${response.status}`);
  }

  const setCookies = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie')].filter(Boolean);
  for (const setCookie of setCookies) {
    const [pair] = setCookie.split(';');
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    await browserSession.cookies.set({
      url: origin,
      name: pair.slice(0, separator),
      value: pair.slice(separator + 1)
    });
  }
  return { token: body.token, origin };
}

async function readTaskRows(window) {
  const frames = [window.webContents.mainFrame, ...window.webContents.mainFrame.frames];
  for (const frame of frames) {
    const rows = await frame.executeJavaScript(`Array.from(document.querySelectorAll('tbody tr')).map((row) => {
      const taskLink = row.querySelector('a[href*="task-view-"]');
      const logLink = row.querySelector('a[href*="task-recordEstimate-"]');
      const executionLink = row.querySelector('a[href*="execution-task-"]');
      return {
        id: taskLink?.getAttribute('href')?.match(/task-view-(\\d+)/)?.[1] ?? '',
        name: taskLink?.textContent?.trim() ?? '',
        execution: executionLink?.getAttribute('href')?.match(/execution-task-(\\d+)/)?.[1] ?? '',
        left: row.children[9]?.textContent?.trim().replace(/h$/i, '') ?? '',
        logHref: logLink?.getAttribute('href') ?? ''
      };
    }).filter((task) => task.id && task.name && task.logHref)`).catch(() => []);
    if (rows.length > 0) return rows;
  }
  return [];
}

export async function listTasksWithElectron(config) {
  const browserSession = session.fromPartition('persist:zentao-agent');
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      session: browserSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  try {
    const { token, origin } = await authenticateSession(browserSession, config);
    const requestFilter = { urls: [`${origin}/*`] };
    browserSession.webRequest.onBeforeSendHeaders(requestFilter, (details, callback) => {
      details.requestHeaders.Token = token;
      callback({ requestHeaders: details.requestHeaders });
    });
    const taskPageUrl = new URL(config.zentao.taskPageUrl || '/my-work-task.html', config.zentao.loginUrl).toString();
    await window.loadURL(taskPageUrl, { extraHeaders: `Token: ${token}` });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await readTaskRows(window);
  } finally {
    browserSession.webRequest.onBeforeSendHeaders(null);
    window.destroy();
  }
}
