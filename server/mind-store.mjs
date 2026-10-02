import fs from 'node:fs/promises';
import { constants as FS_CONSTANTS } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const CAPABILITIES = ['read-workspace', 'use-memory', 'explain', 'plan', 'propose-edits', 'request-validation'];
const SEED_AGENTS = [
  { id: 'researcher', name: 'Researcher', mission: 'Gather relevant workspace evidence, distinguish facts from gaps, and produce a concise source-aware brief.', capabilities: ['read-workspace', 'use-memory', 'explain', 'plan'] },
  { id: 'critic', name: 'Critic', mission: 'Challenge assumptions, identify edge cases and risks, and recommend focused verification.', capabilities: ['read-workspace', 'use-memory', 'explain', 'plan'] },
  { id: 'tutor', name: 'Tutor', mission: 'Explain concepts step by step using the current project as the learning context.', capabilities: ['read-workspace', 'use-memory', 'explain', 'plan'] },
  { id: 'operator', name: 'Operator', mission: 'Prepare focused implementation proposals and request only allowlisted checks.', capabilities: ['read-workspace', 'use-memory', 'plan', 'propose-edits', 'request-validation'] },
];
const SEED_GOALS = [
  { id: 'learn-project', title: 'Understand this project', why: 'Build a useful, source-grounded map of the current workspace.', status: 'active', progress: 0 },
  { id: 'ship-safely', title: 'Ship changes safely', why: 'Keep patches reviewable and verify changes before calling a task complete.', status: 'active', progress: 0 },
  { id: 'improve-workflow', title: 'Improve the coding workflow', why: 'Capture deliberate feedback and repeatable project knowledge.', status: 'active', progress: 0 },
];
const MAX_MEMORIES = 5_000;
const MAX_MEMORY_CHARS = 4_000;
const MAX_TASKS = 250;
const MAX_NOTES = 300;
const MAX_STORE_BYTES = 128_000_000;
const STOPWORDS = new Set(['this', 'that', 'with', 'from', 'have', 'what', 'when', 'where', 'which', 'your', 'about', 'into', 'then', 'than', 'the', 'and', 'for']);

function clean(value, max = 4_000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function tokens(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) || [])
    .filter((word) => !STOPWORDS.has(word));
}

export class MindStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, 'mind.json');
    this.data = { version: 1, memories: [], notes: [], tasks: [], goals: [], agents: [] };
    this.writeQueue = Promise.resolve();
  }

  async load() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    try { await fs.chmod(this.directory, 0o700); } catch { /* Some platforms do not expose POSIX directory modes. */ }
    let preserveExistingFile = false;
    try {
      const stat = await fs.lstat(this.file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Mind data file is not a regular file.');
      if (stat.size > MAX_STORE_BYTES) throw new Error('Mind data file exceeds the size limit.');
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.data.memories = (Array.isArray(parsed.memories) ? parsed.memories : []).filter((item) => item && typeof item === 'object' && typeof item.content === 'string').slice(-MAX_MEMORIES).map((item) => ({
        id: clean(item.id, 80) || randomUUID(), title: clean(item.title, 120) || 'Saved memory',
        content: clean(item.content, MAX_MEMORY_CHARS), source: clean(item.source, 40) || 'user',
        role: clean(item.role, 20) || 'note', created: Number.isFinite(item.created) ? item.created : Date.now(),
      }));
      this.data.notes = (Array.isArray(parsed.notes) ? parsed.notes : []).filter((item) => item && typeof item === 'object' && typeof item.title === 'string' && typeof item.content === 'string').slice(0, MAX_NOTES).map((item) => ({
        id: clean(item.id, 80) || randomUUID(), title: clean(item.title, 120), content: clean(item.content, 20_000),
        created: Number.isFinite(item.created) ? item.created : Date.now(), updated: Number.isFinite(item.updated) ? item.updated : Date.now(),
      }));
      this.data.tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : []).filter((item) => item && typeof item === 'object' && typeof item.title === 'string').slice(0, MAX_TASKS).map((item) => ({
        id: clean(item.id, 80) || randomUUID(), title: clean(item.title, 200), done: item.done === true,
        source: clean(item.source, 80) || 'user', created: Number.isFinite(item.created) ? item.created : Date.now(),
      }));
      this.data.goals = (Array.isArray(parsed.goals) ? parsed.goals : []).filter((item) => item && typeof item === 'object' && typeof item.title === 'string').slice(0, 40).map((item) => ({
        id: clean(item.id, 80) || randomUUID(), title: clean(item.title, 160), why: clean(item.why, 400),
        status: item.status === 'done' ? 'done' : 'active', progress: Math.max(0, Math.min(1, Number(item.progress) || 0)),
        created: Number.isFinite(item.created) ? item.created : Date.now(),
      }));
      this.data.agents = Array.isArray(parsed.agents) ? parsed.agents.slice(0, 24) : [];
    } catch (error) {
      if (error.code !== 'ENOENT') {
        preserveExistingFile = true;
        console.warn('Mind data could not be loaded; starting with safe defaults without replacing the existing file.');
      }
    }
    this.data.agents = this.data.agents.map((agent) => this.#normalizeAgent(agent)).filter(Boolean);
    for (const seeded of SEED_AGENTS) {
      if (!this.data.agents.some((agent) => agent.id === seeded.id)) this.data.agents.push(seeded);
    }
    if (!this.data.goals.length) this.data.goals = SEED_GOALS.map((goal) => ({ ...goal, created: Date.now() }));
    if (!preserveExistingFile) await this.save();
    return this;
  }

  async save() {
    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      const temporary = `${this.file}.tmp`;
      const noFollow = FS_CONSTANTS.O_NOFOLLOW || 0;
      const handle = await fs.open(temporary, FS_CONSTANTS.O_WRONLY | FS_CONSTANTS.O_CREAT | FS_CONSTANTS.O_TRUNC | noFollow, 0o600);
      try {
        await handle.chmod(0o600);
        await handle.writeFile(JSON.stringify(this.data), 'utf8');
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, this.file);
    });
    return this.writeQueue;
  }

  #normalizeAgent(agent) {
    if (!agent || typeof agent !== 'object') return null;
    const id = clean(agent.id, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const name = clean(agent.name, 40);
    const mission = clean(agent.mission, 500);
    if (!id || !name || !mission) return null;
    const capabilities = Array.isArray(agent.capabilities)
      ? [...new Set(agent.capabilities.filter((capability) => CAPABILITIES.includes(capability)))].slice(0, CAPABILITIES.length)
      : [];
    return { id, name, mission, capabilities };
  }

  getAgent(id) {
    return this.data.agents.find((agent) => agent.id === id) || this.data.agents.find((agent) => agent.id === 'operator');
  }

  agents() {
    return this.data.agents.map((agent) => ({ ...agent, capabilities: [...agent.capabilities] }));
  }

  async addAgent(input) {
    const name = clean(input?.name, 40).replace(/[^\p{L}\p{N}_ -]/gu, '').trim();
    const mission = clean(input?.mission, 500);
    if (!name || !mission) throw new Error('Give the specialist a name and a short mission.');
    const capabilities = Array.isArray(input?.capabilities)
      ? [...new Set(input.capabilities.filter((capability) => CAPABILITIES.includes(capability)))].slice(0, CAPABILITIES.length)
      : [];
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (!id) throw new Error('Choose a name that includes a letter or number.');
    const profile = { id, name, mission, capabilities };
    const index = this.data.agents.findIndex((agent) => agent.id === id);
    if (index >= 0) this.data.agents[index] = profile;
    else if (this.data.agents.length < 24) this.data.agents.push(profile);
    else throw new Error('The specialist roster is full (24 agents).');
    await this.save();
    return profile;
  }

  async addMemory(input) {
    const content = clean(input?.content, MAX_MEMORY_CHARS);
    if (content.length < 3) throw new Error('Memory needs at least three characters.');
    const memory = {
      id: randomUUID(),
      title: clean(input?.title, 120) || content.split(/\s+/).slice(0, 8).join(' '),
      content,
      source: clean(input?.source, 40) || 'user',
      role: clean(input?.role, 20) || 'note',
      created: Date.now(),
    };
    this.data.memories.push(memory);
    this.data.memories = this.data.memories.slice(-MAX_MEMORIES);
    await this.save();
    return memory;
  }

  async importThreads(threads, filename) {
    const imported = [];
    let skipped = 0;
    for (const thread of threads.slice(0, 300)) {
      for (const turn of (thread.turns || []).slice(0, 5_000)) {
        if (imported.length >= 5_000) { skipped += 1; continue; }
        const content = clean(turn?.content, MAX_MEMORY_CHARS);
        if (content.length < 2) { skipped += 1; continue; }
        imported.push({
          id: randomUUID(),
          title: clean(thread.title, 120) || clean(filename, 120) || 'Imported conversation',
          content,
          source: `import:${clean(thread.source, 24) || 'chat'}`,
          role: turn.role === 'agi' || turn.role === 'assistant' ? 'assistant' : 'user',
          created: Number.isFinite(turn.ts) ? turn.ts * 1000 : Date.now(),
        });
      }
    }
    this.data.memories.push(...imported);
    this.data.memories = this.data.memories.slice(-MAX_MEMORIES);
    await this.save();
    return { imported: imported.length, skipped, threads: threads.length, sources: [...new Set(threads.map((thread) => thread.source).filter(Boolean))] };
  }

  searchMemories(query, limit = 5) {
    const queryTokens = [...new Set(tokens(clean(query, 500)))];
    if (!queryTokens.length) return [];
    const docs = this.data.memories.map((memory) => ({ memory, words: tokens(`${memory.title} ${memory.content}`) }));
    const df = new Map(queryTokens.map((token) => [token, docs.reduce((count, doc) => count + (doc.words.includes(token) ? 1 : 0), 0)]));
    const now = Date.now();
    return docs.map(({ memory, words }) => {
      const counts = new Map();
      for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
      let score = 0;
      for (const token of queryTokens) {
        const frequency = counts.get(token) || 0;
        if (!frequency) continue;
        const idf = Math.log(1 + docs.length / (1 + (df.get(token) || 0)));
        score += idf * (frequency / Math.sqrt(Math.max(words.length, 1)));
      }
      const ageDays = Math.max(0, (now - memory.created) / 86_400_000);
      score += 0.04 / (1 + ageDays / 14);
      return { ...memory, score };
    }).filter((memory) => memory.score > 0.04).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(10, limit)));
  }

  async deleteMemory(id) {
    const before = this.data.memories.length;
    this.data.memories = this.data.memories.filter((memory) => memory.id !== id);
    if (this.data.memories.length !== before) await this.save();
    return this.data.memories.length !== before;
  }

  async addNote(input) {
    const title = clean(input?.title, 120);
    const content = clean(input?.content, 20_000);
    if (!title || !content) throw new Error('A note needs a title and content.');
    const note = { id: randomUUID(), title, content, created: Date.now(), updated: Date.now() };
    this.data.notes.unshift(note);
    this.data.notes = this.data.notes.slice(0, MAX_NOTES);
    await this.save();
    return note;
  }

  async deleteNote(id) {
    const before = this.data.notes.length;
    this.data.notes = this.data.notes.filter((note) => note.id !== id);
    if (before !== this.data.notes.length) await this.save();
    return before !== this.data.notes.length;
  }

  async addTask(input) {
    const title = clean(input?.title, 200);
    if (title.length < 2) throw new Error('Task needs a short title.');
    const existing = this.data.tasks.find((task) => !task.done && task.title.toLowerCase() === title.toLowerCase());
    if (existing) return existing;
    const task = { id: randomUUID(), title, done: false, source: clean(input?.source, 80) || 'user', created: Date.now() };
    this.data.tasks.unshift(task);
    this.data.tasks = this.data.tasks.slice(0, MAX_TASKS);
    await this.save();
    return task;
  }

  async patchTask(id, input) {
    const task = this.data.tasks.find((item) => item.id === id);
    if (!task) return null;
    if (typeof input?.done === 'boolean') task.done = input.done;
    await this.save();
    return task;
  }

  async deleteTask(id) {
    const before = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((task) => task.id !== id);
    if (before !== this.data.tasks.length) await this.save();
    return before !== this.data.tasks.length;
  }

  async patchGoal(id, input) {
    const goal = this.data.goals.find((item) => item.id === id);
    if (!goal) return null;
    if (typeof input?.progress === 'number' && Number.isFinite(input.progress)) {
      goal.progress = Math.max(0, Math.min(1, input.progress));
      goal.status = goal.progress >= 1 ? 'done' : 'active';
    }
    await this.save();
    return goal;
  }

  async addGoal(input) {
    const title = clean(input?.title, 160);
    if (title.length < 2) throw new Error('Goal needs a short title.');
    const existing = this.data.goals.find((goal) => goal.title.toLowerCase() === title.toLowerCase());
    if (existing) return existing;
    const goal = { id: randomUUID(), title, why: clean(input?.why, 400), status: 'active', progress: 0, created: Date.now() };
    this.data.goals.unshift(goal);
    this.data.goals = this.data.goals.slice(0, 40);
    await this.save();
    return goal;
  }

  state() {
    return {
      memoryCount: this.data.memories.length,
      memories: this.data.memories.slice(-12).reverse().map(({ id, title, content, source, role, created }) => ({ id, title, content, source, role, created })),
      notes: this.data.notes.slice(0, 20),
      tasks: this.data.tasks.slice(0, 40),
      goals: this.data.goals.slice(0, 12),
      agents: this.agents(),
    };
  }
}

export { CAPABILITIES };
