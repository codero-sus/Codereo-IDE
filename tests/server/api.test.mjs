import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function availablePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('Mind API imports chats, gates recalled context, and enforces specialist capabilities', { timeout: 25_000 }, async () => {
  const originalFetch = globalThis.fetch;
  let capturedPrompt = '';
  let capturedAuthorization = '';
  const provider = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const payload = JSON.parse(body);
    capturedPrompt = payload.messages[0].content;
    capturedAuthorization = request.headers.authorization;
    if (payload.messages.at(-1)?.content === 'simulate provider error') {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'Rejected fixture-secret for this request.' } }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      message: 'Read-only specialist response.',
      plan: ['Review the supplied evidence.'],
      changes: [{ path: 'src/unauthorized.js', content: 'must not apply' }],
      commands: [{ command: 'npm test' }, { command: 'rm -rf /' }],
    }) } }] }));
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codereo-api-test-'));
  const port = await availablePort();
  const python = process.env.CODEREO_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const child = spawn(process.execPath, ['server/index.mjs', '--production'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      CODEREO_APP_ROOT: process.cwd(),
      CODEREO_DATA_DIR: path.join(directory, 'mind'),
      DOTENV_CONFIG_PATH: path.join(directory, 'empty.env'),
      CODEREO_PYTHON: python,
      OPENAI_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1`,
      OPENAI_MODEL: 'fixture-model',
      OPENAI_API_KEY: 'fixture-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLogs = '';
  child.stdout.on('data', (chunk) => { serverLogs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { serverLogs += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`API server exited early with code ${child.exitCode}: ${serverLogs}`);
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) { ready = true; break; }
      } catch { /* Wait for the local API to bind. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, 'API server did not become ready');

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const health = await healthResponse.json();
    assert.equal(health.aiConfigured, true);
    assert.equal(JSON.stringify(health).includes('fixture-secret'), false);

    const initial = await fetch(`${baseUrl}/api/mind/state`).then((response) => response.json());
    assert.deepEqual(initial.agents.map((agent) => agent.id), ['researcher', 'critic', 'tutor', 'operator']);
    const saved = await fetch(`${baseUrl}/api/mind/memories`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Project boundary', content: 'Do not use external network access for local builds.' }),
    }).then((response) => response.json());
    assert.equal(saved.ok, true);
    const search = await fetch(`${baseUrl}/api/mind/memories?q=external%20network%20build`).then((response) => response.json());
    assert.equal(search.results[0].title, 'Project boundary');

    const importPayload = Buffer.from(JSON.stringify({ title: 'Personal export', messages: [
      { role: 'user', content: 'Keep imported history local.' },
      { role: 'assistant', content: 'Imported history is not model training data.' },
    ] }));
    const importedResponse = await fetch(`${baseUrl}/api/mind/import?filename=chat.json`, {
      method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: importPayload,
    });
    const imported = await importedResponse.json();
    assert.equal(importedResponse.status, 201, JSON.stringify(imported));
    assert.equal(imported.imported, 2);

    const customResponse = await fetch(`${baseUrl}/api/mind/agents`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Reader', mission: 'Explain supplied code only.', capabilities: ['read-workspace', 'use-memory'] }),
    });
    const custom = await customResponse.json();
    assert.equal(customResponse.status, 201);

    const answerResponse = await fetch(`${baseUrl}/api/assistant`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'agent', agentId: custom.agent.id, includeMemory: true,
        messages: [{ role: 'user', content: 'What is the local network boundary?' }],
        files: [
          { path: 'AGENTS.md', content: 'Use focused edits and preserve public APIs.' },
          { path: 'src/main.py', content: 'print("trusted project context")' },
          { path: '.env', content: 'DO_NOT_SEND_THIS_SECRET' },
          { path: '.git/config', content: 'DO_NOT_SEND_GIT_CREDENTIALS' },
        ],
      }),
    });
    const answer = await answerResponse.json();
    assert.equal(answerResponse.status, 200);
    assert.deepEqual(answer.changes, []);
    assert.deepEqual(answer.commands, []);
    assert.match(capturedPrompt, /remembered_context/i);
    assert.match(capturedPrompt, /Project boundary/);
    assert.match(capturedPrompt, /trusted project context/);
    assert.match(capturedPrompt, /project_instructions/i);
    assert.match(capturedPrompt, /preserve public APIs/);
    assert.doesNotMatch(capturedPrompt, /DO_NOT_SEND/);
    assert.equal(capturedAuthorization, 'Bearer fixture-secret');

    const noRecallResponse = await fetch(`${baseUrl}/api/assistant`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'ask', agentId: custom.agent.id, includeMemory: false, messages: [{ role: 'user', content: 'Answer without recall.' }] }),
    });
    assert.equal(noRecallResponse.status, 200);
    assert.doesNotMatch(capturedPrompt, /remembered_context/i);

    const errorResponse = await fetch(`${baseUrl}/api/assistant`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'ask', messages: [{ role: 'user', content: 'simulate provider error' }] }),
    });
    const providerError = await errorResponse.json();
    assert.equal(errorResponse.status, 502);
    assert.match(providerError.message, /\[redacted\]/);
    assert.doesNotMatch(providerError.message, /fixture-secret/);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2_000))]);
    await new Promise((resolve) => provider.close(resolve));
    globalThis.fetch = originalFetch;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
