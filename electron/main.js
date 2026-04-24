const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const isDev = require('electron-is-dev');
const fetch = require('node-fetch');

const execFileAsync = promisify(execFile);

let mainWindow;
let examContext = {
  sessionId: null,
  token: null,
  active: false,
};
let lastFocusViolationAt = 0;

const SAFE_EXAM_DEFAULT_ALLOWED_PROCESSES = new Set([
  'system idle process',
  'system',
  'registry',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'services.exe',
  'lsass.exe',
  'svchost.exe',
  'fontdrvhost.exe',
  'dwm.exe',
  'winlogon.exe',
  'explorer.exe',
  'taskhostw.exe',
  'sihost.exe',
  'ctfmon.exe',
  'runtimebroker.exe',
  'searchhost.exe',
  'startmenuexperiencehost.exe',
  'securityhealthservice.exe',
  'securityhealthsystray.exe',
  'audiodg.exe',
  'spoolsv.exe',
  'python.exe',
  'pythonw.exe',
  'powershell.exe',
  'windowsterminal.exe',
  'conhost.exe',
  'electron.exe',
  'code.exe',
]);

// Block only explicit cheating-risk apps by default.
// Set SAFE_EXAM_STRICT_MODE=1 to switch to strict allowlist mode.
const SAFE_EXAM_ALWAYS_BLOCKED_PROCESSES = new Set([
  'cmd.exe',
  'powershell.exe',
  'wt.exe',
  'chrome.exe',
  'msedge.exe',
  'firefox.exe',
  'opera.exe',
  'brave.exe',
  'telegram.exe',
  'discord.exe',
  'teams.exe',
  'zoom.exe',
  'whatsapp.exe',
  'slack.exe',
  'anydesk.exe',
  'teamviewer.exe',
  'obs64.exe',
  'obs32.exe',
]);

function normalizeProcessName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }
  return normalized.includes('.') ? normalized : `${normalized}.exe`;
}

function parseExtraProcessSet(value) {
  if (!value) {
    return new Set();
  }
  return new Set(
    String(value)
      .split(',')
      .map((item) => normalizeProcessName(item))
      .filter(Boolean)
  );
}

async function getInteractiveAppProcessesWindows() {
  if (process.platform !== 'win32') {
    return [];
  }

  const command = [
    '$ErrorActionPreference = "SilentlyContinue"',
    '$apps = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Trim().Length -gt 0 }',
    '$apps | Select-Object -Property ProcessName,Id | ConvertTo-Json -Compress',
  ].join('; ');

  const { stdout } = await execFileAsync('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    command,
  ]);

  const output = String(stdout || '').trim();
  if (!output) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    return [];
  }

  const records = Array.isArray(parsed) ? parsed : [parsed];
  return records
    .map((item) => ({
      name: normalizeProcessName(item && item.ProcessName),
      pid: Number(item && item.Id),
    }))
    .filter((item) => item.name && Number.isFinite(item.pid) && item.pid > 0);
}

async function runSafeExamGuardCheck() {
  if (process.platform !== 'win32') {
    return {
      ok: true,
      blockedApps: [],
      message: 'Safe Exam Guard runs in strict mode on Windows only.',
    };
  }

  const userAllowed = parseExtraProcessSet(process.env.SAFE_EXAM_USER_ALLOWED_PROCESSES || '');
  const userBlocked = parseExtraProcessSet(process.env.SAFE_EXAM_ALWAYS_BLOCKED_PROCESSES || '');
  const strictMode = String(process.env.SAFE_EXAM_STRICT_MODE || '').trim() === '1';
  const allowed = new Set([...SAFE_EXAM_DEFAULT_ALLOWED_PROCESSES, ...userAllowed]);
  const alwaysBlocked = new Set([...SAFE_EXAM_ALWAYS_BLOCKED_PROCESSES, ...userBlocked]);

  const apps = await getInteractiveAppProcessesWindows();
  const flaggedCounts = new Map();

  for (const appItem of apps) {
    if (appItem.pid === process.pid) {
      continue;
    }

    const processName = appItem.name;
    if (!processName) {
      continue;
    }

    if (alwaysBlocked.has(processName)) {
      flaggedCounts.set(processName, (flaggedCounts.get(processName) || 0) + 1);
      continue;
    }

    if (!strictMode) {
      // Default mode: only block explicit cheating-risk apps.
      continue;
    }

    if (allowed.has(processName)) {
      continue;
    }

    flaggedCounts.set(processName, (flaggedCounts.get(processName) || 0) + 1);
  }

  const blockedApps = [...flaggedCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  if (blockedApps.length === 0) {
    return {
      ok: true,
      blockedApps: [],
      message: 'Safe Exam Guard passed.',
    };
  }

  const appSummary = blockedApps
    .map((item) => `${item.name} (${item.count})`)
    .join(', ');

  return {
    ok: false,
    blockedApps,
    message: `Please close these applications before starting the exam: ${appSummary}`,
  };
}

async function logDesktopProctorEvent(eventType, eventData = {}) {
  if (!examContext.active || !examContext.sessionId || !examContext.token) {
    return;
  }

  try {
    await fetch(`${BACKEND_URL}/api/desktop-exam/proctor-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${examContext.token}`,
      },
      body: JSON.stringify({
        session_id: examContext.sessionId,
        event_type: eventType,
        event_data: {
          source: 'electron-main',
          timestamp: new Date().toISOString(),
          ...eventData,
        },
      }),
    });
  } catch (error) {
    console.warn('[WARN] Failed to log proctor event from Electron:', error.message);
  }
}

function firstExistingPath(candidates) {
  return candidates.find((p) => fs.existsSync(p));
}

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getConfiguredBackendUrl() {
  const fromEnv = normalizeUrl(process.env.PHEME_BACKEND_URL || process.env.BACKEND_URL);
  if (fromEnv) {
    return fromEnv;
  }

  const configCandidates = [
    path.join(process.cwd(), 'desktop-config.json'),
    path.join(path.dirname(process.execPath), 'desktop-config.json'),
    path.join(process.resourcesPath || '', 'desktop-config.json'),
  ];

  const configPath = firstExistingPath(configCandidates);
  if (configPath) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      const fromFile = normalizeUrl(parsed.backendUrl || parsed.apiBaseUrl);
      if (fromFile) {
        return fromFile;
      }
    } catch (error) {
      console.warn('[WARN] Failed to read desktop-config.json:', error.message);
    }
  }

  return 'http://127.0.0.1:8000';
}

const BACKEND_URL = getConfiguredBackendUrl();

async function urlIsReachable(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function resolveDevFrontendUrl() {
  const candidates = [
    process.env.VITE_DEV_SERVER_URL || '',
    'http://localhost:8081',
    'http://localhost:8080',
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      if (await urlIsReachable(url)) {
        console.log('[INFO] Found dev frontend at:', url);
        return url;
      }
    } catch (error) {
      console.warn('[WARN] Error checking', url, ':', error.message);
    }
  }

  console.warn('[WARN] No dev frontend found, falling back to localhost:8080');
  return 'http://localhost:8080';
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const productionIndex = firstExistingPath([
    path.join(__dirname, '../frontend/dist/index.html'),
    path.join(process.resourcesPath || '', 'frontend', 'dist', 'index.html'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'frontend', 'dist', 'index.html'),
  ]);

  if (!isDev && !productionIndex) {
    dialog.showErrorBox(
      'Frontend Build Missing',
      'Could not find frontend/dist/index.html in packaged resources. Build frontend before packaging.'
    );
    return;
  }

  let startUrl;
  if (isDev) {
    const devUrl = await resolveDevFrontendUrl();
    startUrl = `${devUrl}/#/desktop/exam`;
  } else {
    startUrl = `${pathToFileURL(productionIndex).href}#/desktop/exam`;
  }

  console.log('[INFO] Loading URL:', startUrl);
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    dialog.showErrorBox(
      'UI Load Failed',
      `Failed to load application UI.\nCode: ${errorCode}\nReason: ${errorDescription}\nURL: ${validatedURL}`
    );
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('blur', () => {
    const now = Date.now();
    if (now - lastFocusViolationAt < 1500) {
      return;
    }
    lastFocusViolationAt = now;
    void logDesktopProctorEvent('tab_switch', {
      reason: 'electron_window_blur',
    });
  });

  mainWindow.on('leave-full-screen', () => {
    if (!examContext.active) {
      return;
    }
    void logDesktopProctorEvent('exit_fullscreen', {
      reason: 'left_fullscreen',
    });
  });
}

ipcMain.handle('api-call', async (_event, method, endpoint, data) => {
  try {
    if (endpoint === '/api/desktop-exam/start-session' && String(method || '').toUpperCase() === 'POST') {
      const guardStatus = await runSafeExamGuardCheck();
      if (!guardStatus.ok) {
        return {
          success: false,
          error: guardStatus.message,
          data: {
            blocked_apps: guardStatus.blockedApps,
          },
        };
      }
    }

    const isFormPayload = Boolean(data && data.__form);
    const payload = { ...(data || {}) };
    delete payload.__form;
    delete payload.token;

    if (endpoint === '/api/proctoring/analyze-frame' && data?.session_id && data?.token) {
      examContext = {
        sessionId: String(data.session_id),
        token: String(data.token),
        active: true,
      };
    }

    const body =
      method !== 'GET'
        ? isFormPayload
          ? new URLSearchParams(payload).toString()
          : JSON.stringify(payload)
        : undefined;

    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': isFormPayload ? 'application/x-www-form-urlencoded' : 'application/json',
        Authorization: `Bearer ${data && data.token ? data.token : ''}`,
      },
      body,
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        error: (json && (json.detail || json.message)) || `HTTP ${response.status}`,
      };
    }

    if (endpoint === '/api/desktop-exam/start-session' && json?.session_id && data?.token) {
      examContext = {
        sessionId: String(json.session_id),
        token: String(data.token),
        active: true,
      };
    }

    if (endpoint === '/api/desktop-exam/submit') {
      examContext = {
        sessionId: null,
        token: null,
        active: false,
      };
    }

    return {
      success: true,
      data: json,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Request failed',
    };
  }
});

ipcMain.handle('logout', async () => {
  examContext = {
    sessionId: null,
    token: null,
    active: false,
  };
  return { success: true };
});

ipcMain.handle('set-exam-fullscreen', async (_event, enabled) => {
  if (!mainWindow) {
    return { success: false };
  }

  const shouldEnable = Boolean(enabled);
  if (!shouldEnable && examContext.active) {
    void logDesktopProctorEvent('exit_fullscreen', {
      reason: 'fullscreen_disabled',
    });
  }
  mainWindow.setFullScreen(shouldEnable);
  mainWindow.setKiosk(shouldEnable);
  return { success: true };
});

ipcMain.handle('get-system-info', async () => ({
  platform: process.platform,
  arch: process.arch,
  appVersion: app.getVersion(),
}));

ipcMain.handle('check-safe-exam-guard', async () => {
  try {
    return await runSafeExamGuardCheck();
  } catch (error) {
    return {
      ok: false,
      blockedApps: [],
      message: error && error.message ? error.message : 'Safe Exam Guard check failed.',
    };
  }
});

app.on('ready', async () => {
  await createWindow();

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.reload(),
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
