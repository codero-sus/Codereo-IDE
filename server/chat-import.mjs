import { spawn } from 'node:child_process';
import path from 'node:path';

const MAX_INPUT = 25_000_000;
const MAX_OUTPUT = 16_000_000;

export function parseChatExport({ root, filename, data }) {
  if (!Buffer.isBuffer(data) || data.length > MAX_INPUT) return Promise.reject(new Error('Import is limited to 25 MB.'));
  const importer = process.env.CODEREO_CHAT_IMPORTER || path.join(root, 'python', 'codereo_capabilities', 'chat_importer.py');
  const python = process.env.CODEREO_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  return new Promise((resolve, reject) => {
    const env = {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || '',
      USERPROFILE: process.env.USERPROFILE || '',
      SystemRoot: process.env.SystemRoot || '',
      WINDIR: process.env.WINDIR || '',
      TEMP: process.env.TEMP || '',
      TMP: process.env.TMP || '',
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
    };
    const child = spawn(python, [importer, path.basename(filename)], { env, stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeout;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      reject(error);
    };
    child.stdout.on('data', (chunk) => {
      if (stdout.length + chunk.length > MAX_OUTPUT) {
        child.kill('SIGKILL');
        fail(new Error('Import parser output exceeded the safety limit.'));
      } else stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => { if (stderr.length < 2_000) stderr += chunk.toString('utf8').slice(0, 2_000 - stderr.length); });
    child.on('error', (error) => fail(Object.assign(new Error(`Python chat import is unavailable: ${error.message}`), { code: 'PYTHON_UNAVAILABLE' })));
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) return fail(new Error(stderr.trim() || 'The chat export could not be parsed.'));
      try {
        const parsed = JSON.parse(stdout);
        settled = true;
        if (timeout) clearTimeout(timeout);
        resolve(parsed);
      } catch { fail(new Error('The chat importer returned invalid data.')); }
    });
    timeout = setTimeout(() => {
      child.kill('SIGKILL');
      fail(new Error('Chat import exceeded the 20-second time limit.'));
    }, 20_000);
    timeout.unref?.();
    child.stdin.on('error', () => {});
    child.stdin.end(data);
  });
}
