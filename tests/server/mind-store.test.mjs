import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MindStore } from '../../server/mind-store.mjs';

async function withStore(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codereo-mind-test-'));
  try { await run(await new MindStore(directory).load(), directory); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

test('Mind store persists seeded specialists and local goals', async () => {
  await withStore(async (store) => {
    assert.deepEqual(store.agents().map((agent) => agent.id), ['researcher', 'critic', 'tutor', 'operator']);
    assert.equal(store.data.goals.length, 3);
    const restored = await new MindStore(store.directory).load();
    assert.equal(restored.getAgent('operator').capabilities.includes('propose-edits'), true);
  });
});

test('memory search ranks relevant episodes and forgetting removes them', async () => {
  await withStore(async (store) => {
    const first = await store.addMemory({ title: 'Network policy', content: 'The project must never access external network services.', source: 'user' });
    await store.addMemory({ title: 'Colors', content: 'Use calm green accents in the dark editor.', source: 'note' });
    const results = store.searchMemories('external network access', 5);
    assert.equal(results[0].id, first.id);
    assert.equal(await store.deleteMemory(first.id), true);
    assert.equal(store.searchMemories('external network access', 5).length, 0);
  });
});

test('imported conversations become bounded, searchable memories without training', async () => {
  await withStore(async (store) => {
    const summary = await store.importThreads([{ title: 'Imported', source: 'chatgpt', turns: [
      { role: 'user', content: 'Use Python for the desktop shell.' },
      { role: 'agi', content: 'Imported turn.' },
    ] }], 'export.json');
    assert.equal(summary.imported, 2);
    assert.deepEqual(summary.sources, ['chatgpt']);
    assert.equal(store.searchMemories('Python desktop shell', 3)[0].source, 'import:chatgpt');
  });
});

test('custom specialists receive only known capabilities', async () => {
  await withStore(async (store) => {
    const agent = await store.addAgent({ name: 'Review Bot', mission: 'Find risks and gaps.', capabilities: ['read-workspace', 'propose-edits', 'arbitrary-shell'] });
    assert.deepEqual(agent.capabilities, ['read-workspace', 'propose-edits']);
    assert.equal(store.getAgent(agent.id).mission, 'Find risks and gaps.');
  });
});

test('invalid local data is preserved instead of overwritten with defaults', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codereo-mind-corrupt-'));
  const file = path.join(directory, 'mind.json');
  const original = '{not valid json';
  try {
    await fs.writeFile(file, original, 'utf8');
    const store = await new MindStore(directory).load();
    assert.equal(store.agents().length, 4);
    assert.equal(await fs.readFile(file, 'utf8'), original);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
