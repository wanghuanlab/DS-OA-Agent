import { app, BrowserWindow, Menu, nativeImage, shell, Tray } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureRuntimePaths } from '../src/runtime-paths.js';

const desktopDirectory = dirname(fileURLToPath(import.meta.url));
const applicationDirectory = join(desktopDirectory, '..');
const assetDirectory = join(applicationDirectory, 'public', 'assets');
const applicationIconPath = join(assetDirectory, 'logo.png');

app.setName('Zentao Log Agent');

let mainWindow;
let tray;
let server;
let quitting = false;
let baseUrl = '';

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    show: false,
    title: '禅道日志 Agent',
    icon: applicationIconPath,
    backgroundColor: '#f4f6f8',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.loadURL(baseUrl);
  mainWindow.once('ready-to-show', showMainWindow);
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(baseUrl)) event.preventDefault();
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(join(
    assetDirectory,
    process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'
  ));
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('禅道日志 Agent');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开禅道日志 Agent', click: showMainWindow },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('double-click', showMainWindow);
}

async function startApplication() {
  if (process.platform === 'darwin') app.dock?.setIcon(applicationIconPath);
  const extraExecutablePaths = process.platform === 'darwin'
    ? ['/opt/homebrew/bin', '/usr/local/bin']
    : process.platform === 'win32'
      ? [
          join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'cmd'),
          join(process.env.ProgramFiles ?? 'C:\\Program Files', 'TortoiseHg'),
          join(process.env.ProgramFiles ?? 'C:\\Program Files', 'TortoiseSVN', 'bin')
        ]
      : ['/usr/local/bin'];
  process.env.PATH = [...extraExecutablePaths, process.env.PATH ?? ''].join(process.platform === 'win32' ? ';' : ':');

  configureRuntimePaths({
    dataDir: app.getPath('userData'),
    staticDir: join(applicationDirectory, 'public')
  });

  const [{ setTaskListProvider }, { listTasksWithElectron }] = await Promise.all([
    import('../src/zentao.js'),
    import('./task-provider.js')
  ]);
  setTaskListProvider(listTasksWithElectron);
  const { createServer } = await import('../src/server.js');
  server = await createServer();
  await server.listen({ host: '127.0.0.1', port: 0 });
  const address = server.server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Zentao Log Agent desktop service running at ${baseUrl}`);

  createMainWindow();
  createTray();
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);
  app.whenReady().then(startApplication).catch((error) => {
    console.error(error);
    app.quit();
  });
}

app.on('activate', () => {
  if (mainWindow) showMainWindow();
  else if (baseUrl) createMainWindow();
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('will-quit', async (event) => {
  if (!server) return;
  event.preventDefault();
  const activeServer = server;
  server = null;
  await activeServer.close().catch(() => {});
  app.quit();
});
