const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');

let serverProcess;
let mainWindow;
let workspaceRoot = null;

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'coverage', 'release', '.next', '.nuxt', '.svelte-kit', '.turbo', '.venv', 'venv', 'target']);
const MAX_WORKSPACE_FILES = 1000;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_WORKSPACE_BYTES = 8 * 1024 * 1024;
const SAFE_VALIDATION_COMMANDS = new Set([
  'npm test', 'npm run test', 'npm run build', 'npm run lint', 'npm run typecheck', 'npm run check',
  'pnpm test', 'pnpm run test', 'pnpm run build', 'pnpm run lint', 'pnpm run typecheck', 'pnpm run check',
  'yarn test', 'yarn build', 'yarn lint', 'yarn typecheck', 'yarn check',
  'bun test', 'bun run build', 'bun run lint', 'bun run typecheck',
  'pytest', 'python -m pytest', 'python3 -m pytest', 'cargo test', 'go test ./...',
]);

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function safeRelativePath(input) {
  if (typeof input !== 'string' || !input || input.length > 240) return null;
  const normalized = input.replaceAll(String.fromCharCode(92), '/');
  const parts = normalized.split('/');
  if (normalized.includes(String.fromCharCode(0)) || path.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized) || normalized.startsWith('/') || parts.some((part) => !part || part === '.' || part === '..')) return null;
  if (parts.some((part) => IGNORED_DIRECTORIES.has(part.toLowerCase()) || part.toLowerCase().startsWith('.env') || ['.npmrc', '.netrc', '.pypirc', 'credentials', 'credentials.json', 'id_rsa', 'id_ed25519'].includes(part.toLowerCase()))) return null;
  if (['.pem', '.key', '.p12', '.pfx'].includes(path.extname(normalized).toLowerCase())) return null;
  return parts.join(path.sep);
}

async function loadTextWorkspace(root) {
  const files = {};
  let totalBytes = 0;
  let skipped = 0;

  async function visit(directory, prefix = '') {
    const entries = await fsPromises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (Object.keys(files).length >= MAX_WORKSPACE_FILES || totalBytes >= MAX_WORKSPACE_BYTES) {
        skipped += 1;
        continue;
      }
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const safePath = safeRelativePath(relative);
      if (!safePath || entry.isSymbolicLink()) { skipped += 1; continue; }
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) { skipped += 1; continue; }
        await visit(path.join(directory, entry.name), relative);
        continue;
      }
      if (!entry.isFile()) { skipped += 1; continue; }
      try {
        const stat = await fsPromises.stat(path.join(directory, entry.name));
        if (stat.size > MAX_FILE_BYTES || totalBytes + stat.size > MAX_WORKSPACE_BYTES) { skipped += 1; continue; }
        const buffer = await fsPromises.readFile(path.join(directory, entry.name));
        if (buffer.includes(0)) { skipped += 1; continue; }
        const content = buffer.toString('utf8');
        files[relative] = content;
        totalBytes += buffer.length;
      } catch {
        skipped += 1;
      }
    }
  }

  await visit(root);
  return { files, skipped };
}

async function safeDestination(root, relativePath) {
  const safePath = safeRelativePath(relativePath);
  if (!safePath) return null;
  const parts = safePath.split(path.sep);
  const destination = path.resolve(root, ...parts);
  if (!isPathInside(root, destination) || destination === root) return null;

  let cursor = root;
  for (const part of parts.slice(0, -1)) {
    cursor = path.join(cursor, part);
    try {
      const stat = await fsPromises.lstat(cursor);
      if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
  try {
    const stat = await fsPromises.lstat(destination);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return destination;
}

function normalizeValidationCommand(raw) {
  const forbidden = [';', '|', '&', '<', '>', '`', '$', String.fromCharCode(92), String.fromCharCode(10), String.fromCharCode(13)];
  if (typeof raw !== 'string' || raw.length > 160 || forbidden.some((token) => raw.includes(token))) return null;
  const normalized = raw.trim().split(' ').filter(Boolean).join(' ');
  return SAFE_VALIDATION_COMMANDS.has(normalized) ? normalized : null;
}

function validationEnvironment() {
  const keys = ['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'PATHEXT', 'ComSpec', 'APPDATA', 'LOCALAPPDATA'];
  const env = Object.fromEntries(keys.filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  env.CI = '1';
  env.NODE_ENV = 'test';
  env.npm_config_offline = 'true';
  return env;
}

function confirmedCommandEnvironment() {
  const env = validationEnvironment();
  delete env.npm_config_offline;
  return env;
}

function runValidationCommand(root, command) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const [executable, ...args] = command.split(' ');
    const child = spawn(
      isWindows ? (process.env.ComSpec || 'cmd.exe') : executable,
      isWindows ? ['/d', '/s', '/c', command] : args,
      { cwd: root, env: validationEnvironment(), shell: false, windowsHide: true, detached: !isWindows },
    );
    let output = '';
    let timedOut = false;
    const append = (chunk) => { if (output.length < 14_000) output += chunk.toString().slice(0, 14_000 - output.length); };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (!isWindows && child.pid) process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
      } catch { child.kill('SIGKILL'); }
    }, 120_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ command, exitCode: -1, timedOut: false, output: `Could not start command: ${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ command, exitCode: code ?? -1, timedOut, output: output || (timedOut ? 'Timed out after 120 seconds.' : '') });
    });
  });
}

function parseConfirmedCommand(raw) {
  if (typeof raw !== 'string' || raw.length > 220) return null;
  const forbidden = [';', '|', '&', '<', '>', '`', '$', '%', '!', '^', '(', ')', '"', "'", String.fromCharCode(92), String.fromCharCode(0), String.fromCharCode(10), String.fromCharCode(13)];
  if (forbidden.some((token) => raw.includes(token))) return null;
  const parts = raw.trim().split(' ').filter(Boolean);
  return parts.length ? parts : null;
}

function runConfirmedCommand(root, raw) {
  const parts = parseConfirmedCommand(raw);
  if (!parts) return Promise.resolve({ ok: false, command: raw, exitCode: -1, output: 'Command rejected: use a plain executable and arguments without shell operators or quoting.' });
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const child = spawn(
      isWindows ? (process.env.ComSpec || 'cmd.exe') : parts[0],
      isWindows ? ['/d', '/s', '/c', raw] : parts.slice(1),
      { cwd: root, env: confirmedCommandEnvironment(), shell: false, windowsHide: true, detached: !isWindows },
    );
    let output = '';
    let timedOut = false;
    const append = (chunk) => { if (output.length < 14_000) output += chunk.toString().slice(0, 14_000 - output.length); };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (!isWindows && child.pid) process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
      } catch { child.kill('SIGKILL'); }
    }, 120_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, command: raw, exitCode: -1, output: `Could not start command: ${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut, command: raw, exitCode: code ?? -1, timedOut, output: output || (timedOut ? 'Timed out after 120 seconds.' : '') });
    });
  });
}

function getServerEntry() {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'server', 'index.mjs');
  }
  return path.join(__dirname, '..', 'server', 'index.mjs');
}

function startLocalServer() {
  const port = Number(process.env.CODEREO_DESKTOP_PORT || 4174);
  const envFile = path.join(app.getPath('userData'), '.env');
  if (!fs.existsSync(envFile)) {
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    fs.writeFileSync(envFile, [
      '# Codereo IDE local AI provider settings',
      'AI_PROVIDER=openai-compatible',
      'OPENAI_BASE_URL=https://api.openai.com/v1',
      'OPENAI_MODEL=gpt-4o-mini',
      'OPENAI_API_KEY=',
      'ANTHROPIC_API_KEY=',
      'GEMINI_API_KEY=',
      'OLLAMA_BASE_URL=http://127.0.0.1:11434/v1',
      'OLLAMA_MODEL=qwen2.5-coder:7b',
      '',
    ].join('\n'), { mode: 0o600 });
  }

  const serverEntry = getServerEntry();
  serverProcess = spawn(process.execPath, [serverEntry, ...(app.isPackaged ? ['--production'] : [])], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: app.isPackaged ? 'production' : 'development',
      DOTENV_CONFIG_PATH: envFile,
      CODEREO_APP_ROOT: app.getAppPath(),
      CODEREO_DATA_DIR: path.join(app.getPath('userData'), 'codereo-mind'),
      CODEREO_CHAT_IMPORTER: app.isPackaged ? path.join(process.resourcesPath, 'codereo_python', 'chat_importer.py') : path.join(__dirname, '..', 'python', 'codereo_capabilities', 'chat_importer.py'),
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  serverProcess.on('error', (error) => console.error('Codereo local server failed to start:', error));
  return { port, envFile };
}

ipcMain.handle('codereo:open-workspace', async () => {
  if (!mainWindow) return { canceled: true };
  const selection = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  if (selection.canceled || !selection.filePaths?.[0]) return { canceled: true };
  workspaceRoot = await fsPromises.realpath(selection.filePaths[0]);
  const { files, skipped } = await loadTextWorkspace(workspaceRoot);
  return { canceled: false, root: workspaceRoot, name: path.basename(workspaceRoot), files, skipped };
});

ipcMain.handle('codereo:save-workspace', async (_event, files, expectedBaselines) => {
  if (!workspaceRoot) return { ok: false, message: 'Open a folder before saving to disk.' };
  if (!files || typeof files !== 'object' || Array.isArray(files)) return { ok: false, message: 'Invalid workspace payload.' };
  const root = await fsPromises.realpath(workspaceRoot);
  const expectedNewPaths = new Set();
  if (expectedBaselines !== undefined && expectedBaselines !== null) {
    if (!expectedBaselines || typeof expectedBaselines !== 'object' || Array.isArray(expectedBaselines) || Object.keys(expectedBaselines).length > MAX_WORKSPACE_FILES) {
      return { ok: false, message: 'Invalid workspace baseline payload.' };
    }
    for (const [relativePath, expected] of Object.entries(expectedBaselines)) {
      if (expected !== null && typeof expected !== 'string') return { ok: false, message: 'Invalid workspace baseline content.' };
      const destination = await safeDestination(root, relativePath);
      if (!destination) return { ok: false, message: 'The workspace changed since this task was reviewed. Reload the folder and request a fresh patch.' };
      const existing = await fsPromises.lstat(destination).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
      if (expected === null) {
        if (existing) return { ok: false, message: 'The workspace changed since this task was reviewed. Reload the folder and request a fresh patch.' };
        expectedNewPaths.add(safeRelativePath(relativePath).split(path.sep).join('/'));
        continue;
      }
      const expectedBytes = Buffer.from(expected, 'utf8');
      if (!existing || !existing.isFile() || existing.isSymbolicLink() || existing.size > MAX_FILE_BYTES || existing.size !== expectedBytes.length) {
        return { ok: false, message: 'The workspace changed since this task was reviewed. Reload the folder and request a fresh patch.' };
      }
      let handle;
      try {
        handle = await fsPromises.open(destination, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        const current = await handle.readFile();
        if (!current.equals(expectedBytes)) return { ok: false, message: 'The workspace changed since this task was reviewed. Reload the folder and request a fresh patch.' };
      } catch {
        return { ok: false, message: 'The workspace changed since this task was reviewed. Reload the folder and request a fresh patch.' };
      } finally {
        await handle?.close().catch(() => {});
      }
    }
  }
  const prepared = [];
  let totalBytes = 0;
  let skipped = 0;

  for (const [relativePath, content] of Object.entries(files).slice(0, MAX_WORKSPACE_FILES)) {
    if (typeof content !== 'string') { skipped += 1; continue; }
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_FILE_BYTES || totalBytes + bytes > MAX_WORKSPACE_BYTES) { skipped += 1; continue; }
    const destination = await safeDestination(root, relativePath);
    if (!destination) { skipped += 1; continue; }
    prepared.push({ destination, content, relativePath: safeRelativePath(relativePath).split(path.sep).join('/') });
    totalBytes += bytes;
  }
  if (expectedNewPaths.size) prepared.sort((left, right) => Number(expectedNewPaths.has(right.relativePath)) - Number(expectedNewPaths.has(left.relativePath)));

  let written = 0;
  for (const { destination, content, relativePath } of prepared) {
    await fsPromises.mkdir(path.dirname(destination), { recursive: true });
    const parent = await fsPromises.realpath(path.dirname(destination));
    if (!isPathInside(root, parent)) { skipped += 1; continue; }
    const existing = await fsPromises.lstat(destination).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (existing && (!existing.isFile() || existing.isSymbolicLink())) { skipped += 1; continue; }
    await fsPromises.writeFile(destination, content, { encoding: 'utf8', mode: 0o600, flag: expectedNewPaths.has(relativePath) ? 'wx' : 'w' });
    written += 1;
  }

  return { ok: true, written, skipped };
});

ipcMain.handle('codereo:delete-workspace-files', async (_event, requestedPaths) => {
  if (!workspaceRoot) return { ok: false, message: 'Open a folder before undoing task-created files.', deleted: 0, skipped: 0 };
  if (!Array.isArray(requestedPaths)) return { ok: false, message: 'Invalid workspace delete list.', deleted: 0, skipped: 0 };
  const root = await fsPromises.realpath(workspaceRoot);
  let deleted = 0;
  let skipped = Math.max(0, requestedPaths.length - MAX_WORKSPACE_FILES);
  for (const relativePath of requestedPaths.slice(0, MAX_WORKSPACE_FILES)) {
    const destination = await safeDestination(root, relativePath);
    if (!destination) { skipped += 1; continue; }
    try {
      const existing = await fsPromises.lstat(destination).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
      if (!existing) continue;
      if (!existing.isFile() || existing.isSymbolicLink()) { skipped += 1; continue; }
      await fsPromises.unlink(destination);
      deleted += 1;
    } catch { skipped += 1; }
  }
  return { ok: true, deleted, skipped };
});

ipcMain.handle('codereo:run-validation', async (_event, requestedCommands) => {
  if (!workspaceRoot) return { ok: false, message: 'Open a folder before running project checks.', results: [] };
  if (!Array.isArray(requestedCommands)) return { ok: false, message: 'Invalid validation command list.', results: [] };
  const safeCommands = requestedCommands.slice(0, 4).map((item) => normalizeValidationCommand(typeof item === 'string' ? item : item?.command)).filter(Boolean);
  const skipped = Math.max(0, requestedCommands.length - safeCommands.length);
  if (!safeCommands.length) return { ok: false, message: 'No allowlisted local test/build commands were provided.', results: [], skipped };
  const root = await fsPromises.realpath(workspaceRoot);
  const results = [];
  for (const command of safeCommands) results.push(await runValidationCommand(root, command));
  return { ok: results.every((result) => result.exitCode === 0 && !result.timedOut), results, skipped };
});


ipcMain.handle('codereo:run-confirmed-command', async (_event, rawCommand) => {
  if (!workspaceRoot) return { ok: false, command: rawCommand, output: 'Open a folder before running a command.' };
  if (!parseConfirmedCommand(rawCommand)) return { ok: false, command: rawCommand, output: 'Command rejected: use a plain executable and arguments without shell operators or quoting.' };
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, command: rawCommand, output: 'The desktop window is not available for command approval.' };
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Approve agent-requested command',
    message: 'Run this command in the selected project folder?',
    detail: `${rawCommand}\n\nThis command is outside the automatic test/build allowlist. It may change files or access the network. Review it carefully before approving.`,
    buttons: ['Cancel', 'Run once'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (choice.response !== 1) return { ok: false, canceled: true, command: rawCommand, output: 'Canceled by user.' };
  const root = await fsPromises.realpath(workspaceRoot);
  return runConfirmedCommand(root, rawCommand);
});

async function waitForServer(url, child) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`Codereo local server exited with code ${child.exitCode}.`);
    }
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return;
    } catch {
      // The local app is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Codereo local server did not become ready in time.');
}

async function createMainWindow() {
  const { port } = startLocalServer();
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url, serverProcess);

  mainWindow = new BrowserWindow({
    width: 1512,
    height: 960,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: '#101216',
    title: 'Codereo IDE',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('https://')) shell.openExternal(target);
    return { action: 'deny' };
  });
  const localOrigin = new URL(url).origin;
  mainWindow.webContents.on('will-navigate', (event, target) => {
    try {
      if (new URL(target).origin !== localOrigin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  await mainWindow.loadURL(url);
}

app.whenReady().then(createMainWindow).catch((error) => {
  console.error(error);
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow().catch(console.error);
});

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
