import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  Bot,
  BookOpen,
  Braces,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  Code2,
  Copy,
  File,
  FileCode2,
  FilePlus2,
  Files,
  Folder,
  FolderOpen,
  GitBranch,
  Globe2,
  HelpCircle,
  Info,
  LayoutGrid,
  ListChecks,
  LoaderCircle,
  Maximize2,
  MessageSquareText,
  Minimize2,
  PanelBottom,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Terminal,
  X,
} from 'lucide-react';
import MindPanel from './MindPanel.jsx';
import { createChangeReview, findStaleProposalPaths, selectProposalChanges } from './change-review.mjs';
import { rankWorkspaceFiles, searchWorkspace } from './workspace-index.mjs';
import './styles.css';

const STORAGE_KEY = 'codereo.ide.workspace.v1';
const PROVIDER_STORAGE_KEY = 'codereo.ide.provider.v1';
const AGENT_STORAGE_KEY = 'codereo.ide.agent.v1';
const MEMORY_CONTEXT_KEY = 'codereo.ide.memory-context.v1';
const PROVIDER_OPTIONS = [
  { id: 'openai-compatible', label: 'OpenAI-compatible', secret: 'OPENAI_API_KEY' },
  { id: 'anthropic', label: 'Anthropic', secret: 'ANTHROPIC_API_KEY' },
  { id: 'gemini', label: 'Google Gemini', secret: 'GEMINI_API_KEY' },
  { id: 'ollama', label: 'Ollama (local)', secret: 'OLLAMA_BASE_URL' },
];
const DEFAULT_FILES = {
  'index.html': String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Launchpad</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <main class="launchpad">
    <div class="eyebrow"><span class="eyebrow-dot"></span> YOUR NEXT IDEA STARTS HERE</div>
    <h1>Make room<br />for <span>what's next.</span></h1>
    <p class="intro">A small, calm place to turn ambitious ideas into real things. Start with one good step.</p>
    <button class="start-button" id="counter-button">
      <span id="button-label">Start building</span>
      <span class="button-arrow">↗</span>
    </button>
    <div class="footnote"><span class="pulse"></span> Local preview, ready when you are</div>
  </main>
  <footer class="preview-footer"><span>MADE IN CODEREO</span><span id="year"></span></footer>
  <script src="/src/main.js"></script>
</body>
</html>`,
  'src/main.js': String.raw`const button = document.querySelector('#counter-button');
const label = document.querySelector('#button-label');
let clicks = 0;

button?.addEventListener('click', () => {
  clicks += 1;
  if (label) {
    label.textContent = clicks === 1 ? 'You just started' : 'You took step ' + clicks;
  }
});

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();`,
  'src/style.css': String.raw`:root {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #f0f2ed;
  background: #101310;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; overflow: hidden; }
.launchpad {
  position: relative; display: flex; min-height: 100vh; flex-direction: column;
  justify-content: center; padding: 12vh clamp(30px, 11vw, 170px); overflow: hidden;
  background: radial-gradient(ellipse at 77% 47%, rgba(91, 119, 63, .24), transparent 38%), #101310;
}
.launchpad::before { content: ''; position: absolute; width: 440px; height: 440px; right: 9%; top: 15%; border: 1px solid rgba(208, 225, 168, .08); border-radius: 50%; box-shadow: 0 0 0 48px rgba(208, 225, 168, .018), 0 0 0 96px rgba(208, 225, 168, .014); }
.eyebrow { display: flex; align-items: center; gap: 10px; color: #afb89c; font: 10px ui-monospace, monospace; letter-spacing: .18em; }
.eyebrow-dot, .pulse { width: 7px; height: 7px; border-radius: 50%; background: #c3ef86; box-shadow: 0 0 14px rgba(195, 239, 134, .75); }
h1 { z-index: 1; max-width: 780px; margin: 26px 0 20px; font-size: clamp(54px, 8vw, 112px); line-height: .99; font-weight: 600; letter-spacing: -.075em; }
h1 span { color: #c3ef86; }
.intro { max-width: 420px; margin: 0 0 34px; color: #a3a89e; font-size: 14px; line-height: 1.8; }
.start-button { z-index: 1; display: inline-flex; width: fit-content; align-items: center; gap: 28px; padding: 14px 16px 14px 20px; border: 1px solid #c3ef86; border-radius: 4px; background: #c3ef86; color: #101310; font: 700 12px ui-sans-serif, system-ui, sans-serif; cursor: pointer; transition: .2s ease; }
.start-button:hover { transform: translateY(-2px); background: #d3ffa0; box-shadow: 0 12px 30px rgba(195, 239, 134, .16); }
.button-arrow { font-size: 18px; line-height: 1; }
.footnote { display: flex; align-items: center; gap: 9px; margin-top: 48px; color: #70796b; font: 10px ui-monospace, monospace; letter-spacing: .06em; }
.pulse { width: 5px; height: 5px; }
.preview-footer { position: fixed; right: 26px; bottom: 20px; left: 26px; display: flex; justify-content: space-between; color: #586052; font: 9px ui-monospace, monospace; letter-spacing: .12em; }
@media (max-width: 640px) { .launchpad { padding-inline: 28px; } .launchpad::before { right: -300px; } h1 { font-size: clamp(52px, 17vw, 76px); } }`,
  'README.md': String.raw`# Launchpad

A tiny, interactive starter page. Edit src/main.js or src/style.css, then choose Run preview to see your changes.
`,
};

function readWorkspace() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object' && Object.keys(saved).length) {
      const safe = Object.fromEntries(Object.entries(saved).filter(([key, value]) =>
        typeof key === 'string' && typeof value === 'string' && !key.startsWith('/') && !key.split('/').includes('..')
      ));
      if (Object.keys(safe).length) return { ...DEFAULT_FILES, ...safe };
    }
  } catch {
    // A damaged local workspace should never prevent the IDE from opening.
  }
  return { ...DEFAULT_FILES };
}

function createTree(paths) {
  const root = { children: new Map() };
  for (const filePath of paths) {
    const pieces = filePath.split('/').filter(Boolean);
    let current = root;
    pieces.forEach((piece, index) => {
      const isFile = index === pieces.length - 1;
      const nodePath = pieces.slice(0, index + 1).join('/');
      if (!current.children.has(piece)) {
        current.children.set(piece, {
          name: piece,
          path: nodePath,
          type: isFile ? 'file' : 'folder',
          children: new Map(),
        });
      }
      current = current.children.get(piece);
    });
  }
  const sortNodes = (nodes) => [...nodes.values()]
    .map((node) => ({ ...node, children: sortNodes(node.children) }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  return sortNodes(root.children);
}

function getLanguage(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
    return javascript({ jsx: ['jsx', 'tsx'].includes(ext), typescript: ['ts', 'tsx'].includes(ext) });
  }
  if (ext === 'css' || ext === 'scss') return css();
  if (ext === 'html' || ext === 'xml' || ext === 'svg') return html();
  if (ext === 'json') return json();
  if (ext === 'md' || ext === 'mdx') return markdown();
  if (ext === 'py' || ext === 'pyw') return python();
  return [];
}

function IconForFile({ name, size = 14 }) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'html') return <Globe2 size={size} className="file-icon html-icon" />;
  if (ext === 'css' || ext === 'scss') return <Braces size={size} className="file-icon css-icon" />;
  if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') return <Code2 size={size} className="file-icon js-icon" />;
  if (ext === 'json') return <Braces size={size} className="file-icon json-icon" />;
  if (ext === 'md' || ext === 'mdx') return <FileCode2 size={size} className="file-icon md-icon" />;
  if (ext === 'py' || ext === 'pyw') return <FileCode2 size={size} className="file-icon python-icon" />;
  return <File size={size} className="file-icon" />;
}

function buildPreviewDocument(files) {
  let documentText = files['index.html'] || '<!doctype html><html><head><meta charset="UTF-8"></head><body><main id="app"></main></body></html>';
  const styleSource = files['src/style.css'] || '';
  const scriptSource = files['src/main.js'] || '';
  const styleTag = `<style>\n${styleSource}\n</style>`;
  const safeScript = scriptSource.replace(/<\/script/gi, '<\\/script');
  const scriptTag = `<script>\n${safeScript}\n</script>`;

  documentText = documentText.replace(/<link\b[^>]*href=["'][^"']*style\.css[^"']*["'][^>]*\/?\s*>/gi, '');
  documentText = documentText.replace(/<script\b[^>]*src=["'][^"']*main\.js[^"']*["'][^>]*>\s*<\/script>/gi, '');
  if (/<\/head>/i.test(documentText)) documentText = documentText.replace(/<\/head>/i, `${styleTag}\n</head>`);
  else documentText = `${styleTag}\n${documentText}`;
  if (/<\/body>/i.test(documentText)) documentText = documentText.replace(/<\/body>/i, `${scriptTag}\n</body>`);
  else documentText += scriptTag;
  return documentText;
}

function inferValidationCommands(files) {
  const commands = [];
  let packageJson = {};
  try { packageJson = JSON.parse(files['package.json'] || '{}'); } catch { /* Invalid package metadata is ignored. */ }
  const scripts = packageJson.scripts || {};
  const manager = files['pnpm-lock.yaml'] ? 'pnpm' : files['yarn.lock'] ? 'yarn' : files['bun.lockb'] || files['bun.lock'] ? 'bun' : 'npm';
  if (scripts.test) {
    commands.push(manager === 'npm' ? 'npm test' : manager === 'pnpm' ? 'pnpm test' : manager === 'yarn' ? 'yarn test' : 'bun test');
  }
  if (scripts.build) commands.push(manager === 'npm' ? 'npm run build' : manager === 'pnpm' ? 'pnpm run build' : manager === 'yarn' ? 'yarn build' : 'bun run build');
  if (scripts.lint) commands.push(manager === 'npm' ? 'npm run lint' : manager === 'pnpm' ? 'pnpm run lint' : manager === 'yarn' ? 'yarn lint' : 'bun run lint');
  const paths = Object.keys(files);
  if (files['Cargo.toml']) commands.push('cargo test');
  else if (files['go.mod']) commands.push('go test ./...');
  else if (files['pyproject.toml'] || files['pytest.ini'] || paths.some((filePath) => (filePath.startsWith('tests/') || filePath.includes('/tests/')) && filePath.endsWith('.py'))) commands.push('pytest');
  return [...new Set(commands)].slice(0, 3);
}

function buildAssistantContextFiles(files, preferredPaths = [], query = '') {
  return rankWorkspaceFiles(files, query, { preferredPaths });
}

function timeLabel() {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

function createTaskTimeline(message) {
  const events = [];
  if (message.taskApprovedAt) {
    events.push({ id: 'approved', title: 'Task approved', detail: `${message.approvedFileCount || message.changeSummary?.files || message.changes?.length || 0} file changes selected`, time: message.taskApprovedAt, state: 'done' });
  }
  if (message.patchAppliedAt) {
    events.push({ id: 'applied', title: 'Changes applied', detail: `${message.changeSummary?.files ?? message.changes?.length ?? 0} files saved to the workspace`, time: message.patchAppliedAt, state: 'done' });
  }
  if (message.repairIterations) {
    events.push({ id: 'repairs', title: 'Agent repair passes', detail: `${message.repairIterations} repair pass${message.repairIterations === 1 ? '' : 'es'} completed under the original approval`, state: 'done' });
  }
  const results = message.verification?.results || [];
  results.forEach((result, index) => {
    const state = result.exitCode === 0 && !result.timedOut ? 'done' : 'error';
    events.push({ id: `check-${index}`, title: result.command || `Check ${index + 1}`, detail: result.timedOut ? 'Timed out' : `Exit code ${result.exitCode ?? -1}`, state });
  });
  if (message.verification && !results.length) {
    const verificationMessage = message.verification.message || '';
    const title = !message.verification.ok
      ? 'Verification needs attention'
      : /preview/i.test(verificationMessage)
        ? 'Preview refreshed'
        : /no safe|no .* command/i.test(verificationMessage)
          ? 'No automated check detected'
          : 'Verification completed';
    events.push({
      id: 'verification',
      title,
      detail: verificationMessage || 'No check output was returned.',
      state: message.verification.ok ? 'done' : 'error',
    });
  }
  if (message.proposalState === 'applied') {
    const checked = results.length > 0 || /preview/i.test(message.verification?.message || '');
    events.push({ id: 'complete', title: checked ? 'Task verified' : 'Task applied', detail: checked ? 'The available checks completed successfully.' : 'No automated validation was available for this workspace.', time: message.appliedAt, state: 'done' });
  }
  else if (message.proposalState === 'needs-attention') events.push({ id: 'attention', title: 'Checks need attention', detail: 'Review the verification output before continuing.', time: message.appliedAt, state: 'error' });
  else if (message.proposalState === 'running') events.push({ id: 'running', title: 'Working on the approved task', detail: 'Applying changes and checking the workspace.', state: 'running' });
  if (message.proposalState === 'undone') events.push({ id: 'undone', title: 'Task changes undone', detail: 'The pre-approval snapshot was restored.', time: message.undoneAt, state: 'undone' });
  return events;
}

function App() {
  const [files, setFiles] = useState(readWorkspace);
  const [savedFiles, setSavedFiles] = useState(readWorkspace);
  const [activeFile, setActiveFile] = useState('index.html');
  const [workspaceName, setWorkspaceName] = useState('codereo-starter');
  const [desktopWorkspaceRoot, setDesktopWorkspaceRoot] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [pendingSearchLocation, setPendingSearchLocation] = useState(null);
  const [openTabs, setOpenTabs] = useState(['index.html', 'src/main.js', 'src/style.css']);
  const [viewMode, setViewMode] = useState('code');
  const [previewDocument, setPreviewDocument] = useState(() => buildPreviewDocument(readWorkspace()));
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('terminal');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLines, setTerminalLines] = useState([
    { type: 'muted', text: 'Codereo workspace terminal · browser sandbox' },
    { type: 'muted', text: 'Type help to see available read-only commands.' },
  ]);
  const [activeActivity, setActiveActivity] = useState('explorer');
  const [expandedFolders, setExpandedFolders] = useState(() => new Set(['src']));
  const [fileSearch, setFileSearch] = useState('');
  const deferredFileSearch = useDeferredValue(fileSearch);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [assistantVisible, setAssistantVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [health, setHealth] = useState({ ok: false, aiConfigured: false, defaultProvider: 'openai-compatible', providers: [] });
  const [activeProvider, setActiveProvider] = useState(() => {
    try { return window.localStorage.getItem(PROVIDER_STORAGE_KEY) || 'openai-compatible'; } catch { return 'openai-compatible'; }
  });
  const [activeAgentId, setActiveAgentId] = useState(() => {
    try { return window.localStorage.getItem(AGENT_STORAGE_KEY) || 'operator'; } catch { return 'operator'; }
  });
  const [memoryEnabled, setMemoryEnabled] = useState(() => {
    try { return window.localStorage.getItem(MEMORY_CONTEXT_KEY) === 'true'; } catch { return false; }
  });
  const [mindState, setMindState] = useState({ memoryCount: 0, memories: [], notes: [], tasks: [], goals: [], agents: [] });
  const [desktopBridgeReady, setDesktopBridgeReady] = useState(() => Boolean(window.codereoDesktop?.isAvailable));
  const [assistantMode, setAssistantMode] = useState('agent');
  const [assistantDraft, setAssistantDraft] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [savingQuestId, setSavingQuestId] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hey, I’m Codereo. I can explain this workspace, plan a change, or prepare a code patch for your review.',
      time: 'now',
      suggestions: ['Explain this project', 'Add a theme toggle', 'Make the landing page more playful'],
    },
  ]);
  const paletteInputRef = useRef(null);
  const editorViewRef = useRef(null);
  const terminalInputRef = useRef(null);
  const chatInputRef = useRef(null);

  const localChanges = useMemo(() => {
    const filePaths = new Set([...Object.keys(files), ...Object.keys(savedFiles)]);
    return [...filePaths].filter((filePath) => files[filePath] !== savedFiles[filePath]).sort();
  }, [files, savedFiles]);
  const isActiveFileDirty = files[activeFile] !== savedFiles[activeFile];
  const fileTree = useMemo(() => createTree(Object.keys(files)), [files]);
  const allFilePaths = useMemo(() => Object.keys(files).sort(), [files]);
  const taskHistory = useMemo(() => messages.flatMap((message, index) => {
    if (message.role !== 'assistant' || message.proposalState === 'auto-applied' || (!message.changes?.length && !message.spec)) return [];
    const prompt = [...messages.slice(0, index)].reverse().find((item) => item.role === 'user')?.content || 'Agent task';
    return [{ id: message.id, prompt, state: message.proposalState || 'ready', files: message.changeSummary?.files ?? message.changes?.length ?? 0, time: message.appliedAt || message.time }];
  }).reverse().slice(0, 16), [messages]);
  const desktopAvailable = desktopBridgeReady || Boolean(window.codereoDesktop?.isAvailable);
  const activeProviderMetadata = PROVIDER_OPTIONS.find((provider) => provider.id === activeProvider) || PROVIDER_OPTIONS[0];
  const activeProviderStatus = health.providers?.find((provider) => provider.id === activeProvider);
  const activeAgentProfile = mindState.agents.find((agent) => agent.id === activeAgentId);
  const activeAgentCanUseMemory = !activeAgentProfile || activeAgentProfile.capabilities.includes('use-memory');
  const selectProvider = (providerId) => {
    setActiveProvider(providerId);
    try { window.localStorage.setItem(PROVIDER_STORAGE_KEY, providerId); } catch { /* Keep the choice for this session. */ }
  };
  const selectAgent = (agentId) => {
    setActiveAgentId(agentId);
    try { window.localStorage.setItem(AGENT_STORAGE_KEY, agentId); } catch { /* Keep the selection for this session. */ }
  };
  const updateMemoryEnabled = (enabled) => {
    setMemoryEnabled(enabled);
    try { window.localStorage.setItem(MEMORY_CONTEXT_KEY, String(enabled)); } catch { /* Keep the setting for this session. */ }
  };

  useEffect(() => {
    const ready = () => setDesktopBridgeReady(Boolean(window.codereoDesktop?.isAvailable));
    window.addEventListener('codereo-desktop-ready', ready);
    if (window.codereoDesktop?.isAvailable) setDesktopBridgeReady(true);
    return () => window.removeEventListener('codereo-desktop-ready', ready);
  }, []);

  useEffect(() => {
    if (desktopWorkspaceRoot) return undefined;
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
      } catch {
        setToast('Workspace storage is full. Export or remove some files.');
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [files, desktopWorkspaceRoot]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setHealth(data);
        try { if (!window.localStorage.getItem(PROVIDER_STORAGE_KEY) && data.defaultProvider) setActiveProvider(data.defaultProvider); } catch { /* Provider selection can stay in memory. */ }
      })
      .catch(() => { if (!cancelled) setHealth({ ok: false, aiConfigured: false, provider: 'offline', model: '' }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/mind/state')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Mind service unavailable.')))
      .then((data) => { if (!cancelled) setMindState(data); })
      .catch(() => { if (!cancelled) setMindState({ memoryCount: 0, memories: [], notes: [], tasks: [], goals: [], agents: [] }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (paletteOpen) window.setTimeout(() => paletteInputRef.current?.focus(), 0);
  }, [paletteOpen]);

  useEffect(() => {
    setPaletteIndex(0);
  }, [paletteQuery, paletteOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setPaletteQuery('');
        setPaletteOpen(true);
      } else if (command && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveWorkspace();
      } else if (command && event.key === 'Enter') {
        event.preventDefault();
        runPreview();
      } else if (event.key === 'Escape') {
        setPaletteOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const persistWorkspaceSnapshot = useCallback(async (snapshot, removePaths = [], expectedBaselines = null) => {
    if (desktopWorkspaceRoot && window.codereoDesktop?.isAvailable) {
      const bridge = window.codereoDesktop;
      const result = await bridge.saveWorkspace(snapshot, expectedBaselines);
      if (!result?.ok) throw new Error(result?.message || 'Could not save to the selected folder.');
      if (removePaths.length) {
        if (typeof bridge.deleteWorkspaceFiles !== 'function') throw new Error('This desktop bridge cannot safely remove task-created files.');
        const removed = await bridge.deleteWorkspaceFiles(removePaths);
        if (!removed?.ok || removed.skipped) throw new Error(removed?.message || `Could not remove ${removed?.skipped || removePaths.length} task-created file(s).`);
      }
      setSavedFiles({ ...snapshot });
      return result;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    setSavedFiles({ ...snapshot });
    return { ok: true, written: Object.keys(snapshot).length, skipped: 0 };
  }, [desktopWorkspaceRoot]);

  const saveWorkspace = useCallback(async () => {
    try {
      const result = await persistWorkspaceSnapshot(files);
      setToast(desktopWorkspaceRoot
        ? `Saved ${result.written} files${result.skipped ? ` · ${result.skipped} skipped` : ''}`
        : 'Workspace saved in this browser');
    } catch (error) {
      setToast(error.message || 'Could not save workspace');
    }
  }, [files, desktopWorkspaceRoot, persistWorkspaceSnapshot]);

  const runPreview = useCallback(() => {
    setPreviewDocument(buildPreviewDocument(files));
    setViewMode('preview');
    setPanelTab('output');
    setPanelOpen(true);
    setTerminalLines((lines) => [...lines, { type: 'success', text: 'Preview refreshed from the current workspace.' }].slice(-80));
  }, [files]);

  const openFile = useCallback((filePath) => {
    setActiveFile(filePath);
    setCursorPosition({ line: 1, column: 1 });
    setViewMode('code');
    setOpenTabs((tabs) => tabs.includes(filePath) ? tabs : [...tabs, filePath]);
  }, []);

  const openSearchResult = (result) => {
    openFile(result.path);
    setPendingSearchLocation(result.line ? { path: result.path, line: result.line } : null);
  };

  useEffect(() => {
    const view = editorViewRef.current;
    if (!pendingSearchLocation || pendingSearchLocation.path !== activeFile || viewMode !== 'code' || !view) return;
    const lineNumber = Math.min(Math.max(1, pendingSearchLocation.line), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    view.focus();
    setCursorPosition({ line: lineNumber, column: 1 });
    setPendingSearchLocation(null);
  }, [pendingSearchLocation, activeFile, viewMode, files]);

  const openWorkspace = useCallback(async () => {
    const bridge = window.codereoDesktop;
    if (!bridge?.isAvailable) {
      setToast('Open a folder from the desktop app. Browser workspaces stay in browser storage.');
      return;
    }
    try {
      const result = await bridge.openWorkspace();
      if (result?.canceled) { if (result.error) setToast(result.error); return; }
      const incomingFiles = result?.files && Object.keys(result.files).length
        ? result.files
        : { 'README.md': ['# New workspace', '', 'Start by adding a file.'].join(String.fromCharCode(10)) };
      const paths = Object.keys(incomingFiles).sort();
      const entryFile = paths.includes('index.html')
        ? 'index.html'
        : paths.find((filePath) => ['.js', '.jsx', '.ts', '.tsx', '.py', '.rs', '.go', '.md'].some((extension) => filePath.toLowerCase().endsWith(extension))) || paths[0];
      setFiles(incomingFiles);
      setSavedFiles({ ...incomingFiles });
      setWorkspaceName(result?.name || 'workspace');
      setDesktopWorkspaceRoot(result?.root || '');
      setOpenTabs([entryFile, ...paths.filter((filePath) => filePath !== entryFile).slice(0, 2)]);
      setActiveFile(entryFile);
      setCursorPosition({ line: 1, column: 1 });
      setActiveActivity('explorer');
      setViewMode('code');
      setToast(`Opened ${result?.name || 'workspace'}${result?.skipped ? ` · ${result.skipped} unsupported or large files skipped` : ''}`);
    } catch (error) {
      setToast(error.message || 'Could not open that folder');
    }
  }, []);

  useEffect(() => {
    const onOpenWorkspace = () => openWorkspace();
    const onSaveWorkspace = () => saveWorkspace();
    window.addEventListener('codereo-open-workspace', onOpenWorkspace);
    window.addEventListener('codereo-save-workspace', onSaveWorkspace);
    return () => {
      window.removeEventListener('codereo-open-workspace', onOpenWorkspace);
      window.removeEventListener('codereo-save-workspace', onSaveWorkspace);
    };
  }, [openWorkspace, saveWorkspace]);

  const updateFile = useCallback((filePath, value) => {
    setFiles((current) => ({ ...current, [filePath]: value }));
  }, []);

  const createFile = () => {
    const requested = window.prompt('New file path, for example src/utils.js');
    if (!requested) return;
    const filePath = requested.trim().replaceAll('\\', '/').replace(/^\.\//, '');
    if (!filePath || filePath.startsWith('/') || filePath.split('/').some((part) => !part || part === '..' || part.startsWith('.env'))) {
      setToast('Choose a safe relative file path');
      return;
    }
    if (Object.hasOwn(files, filePath)) {
      setToast('That file already exists');
      openFile(filePath);
      return;
    }
    setFiles((current) => ({ ...current, [filePath]: '' }));
    openFile(filePath);
    setToast(`Created ${filePath}`);
  };

  const closeTab = (event, filePath) => {
    event.stopPropagation();
    const nextTabs = openTabs.filter((tab) => tab !== filePath);
    setOpenTabs(nextTabs);
    if (activeFile === filePath) {
      if (nextTabs.length) openFile(nextTabs[nextTabs.length - 1]);
      else setViewMode('preview');
    }
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const handleTerminalSubmit = (event) => {
    event.preventDefault();
    const command = terminalInput.trim();
    if (!command) return;
    const [verb, ...args] = command.split(/\s+/);
    const argument = args.join(' ');
    let response = [];
    if (verb === 'help') {
      response = [{ type: 'muted', text: 'Read-only commands: help, pwd, ls, cat <file>, clear' }];
    } else if (verb === 'pwd') {
      response = [{ type: 'normal', text: '/workspace/codereo-starter' }];
    } else if (verb === 'ls') {
      response = [{ type: 'normal', text: allFilePaths.join('   ') || '(empty workspace)' }];
    } else if (verb === 'cat') {
      response = [{ type: files[argument] ? 'normal' : 'error', text: files[argument] ?? `No workspace file found at ${argument || '(missing path)'}` }];
    } else if (verb === 'clear') {
      setTerminalLines([]);
      setTerminalInput('');
      return;
    } else {
      response = [{ type: 'error', text: 'Shell execution is disabled in the browser workspace. Use Run preview for the sandboxed app.' }];
    }
    setTerminalLines((current) => [...current, { type: 'command', text: `$ ${command}` }, ...response].slice(-80));
    setTerminalInput('');
  };

  const sendAssistantMessage = async (text = assistantDraft) => {
    const prompt = text.trim();
    if (!prompt || assistantBusy) return;
    const userMessage = { id: crypto.randomUUID(), role: 'user', content: prompt, time: timeLabel() };
    const outgoingMessages = [...messages, userMessage].map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setAssistantDraft('');
    setAssistantBusy(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: assistantMode,
          provider: activeProvider,
          agentId: activeAgentId,
          includeMemory: memoryEnabled,
          messages: outgoingMessages,
          files: buildAssistantContextFiles(files, [activeFile, ...openTabs], prompt),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'The assistant could not complete that request.');
      const proposedChanges = Array.isArray(data.changes) ? data.changes : [];
      const changeBaselines = Object.fromEntries(proposedChanges.map(({ path }) => [path, Object.hasOwn(files, path) ? files[path] : null]));
      const changeReviews = Object.fromEntries(proposedChanges.map(({ path, content }) => [path, createChangeReview(changeBaselines[path], content)]));
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message || 'I could not generate a response.',
        plan: Array.isArray(data.plan) ? data.plan : [],
        spec: data.spec && typeof data.spec === 'object' ? data.spec : null,
        changes: proposedChanges,
        changeBaselines,
        changeReviews,
        commands: Array.isArray(data.commands) ? data.commands : [],
        blockedCommands: Array.isArray(data.blockedCommands) ? data.blockedCommands : [],
        time: timeLabel(),
      }]);
    } catch (error) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error.message || 'The assistant is unavailable. Check your AI provider settings.',
        error: true,
        time: timeLabel(),
      }]);
    } finally {
      setAssistantBusy(false);
    }
  };


  const runConfirmedAgentCommand = async (messageId, command) => {
    const bridge = window.codereoDesktop;
    if (!desktopWorkspaceRoot || !bridge?.runConfirmedCommand) {
      setToast('Open a desktop workspace to review this command.');
      return;
    }
    if (assistantBusy) return;
    setAssistantBusy(true);
    try {
      const result = await bridge.runConfirmedCommand(command);
      setMessages((current) => current.map((item) => item.id === messageId
        ? { ...item, manualCommandResults: [...(item.manualCommandResults || []), result] }
        : item));
      setPanelTab('terminal');
      setPanelOpen(true);
      setTerminalLines((current) => [...current,
        { type: 'command', text: `$ ${command}` },
        { type: result.ok ? 'success' : result.canceled ? 'muted' : 'error', text: result.output || (result.ok ? `Exited with code ${result.exitCode}.` : `Exited with code ${result.exitCode ?? -1}.`) },
      ].slice(-80));
      setToast(result.ok ? 'Approved command finished.' : result.canceled ? 'Command canceled.' : 'Approved command failed.');
    } catch (error) {
      setToast(error.message || 'The desktop could not run this command.');
    } finally {
      setAssistantBusy(false);
    }
  };

  const approveAgentTask = async (message) => {
    if (assistantBusy) return;
    const selectedChanges = selectProposalChanges(message.changes, message.excludedChangePaths);
    if (!selectedChanges.length) {
      setToast('Select at least one file change before approving this task.');
      return;
    }
    const stalePaths = findStaleProposalPaths(selectedChanges, message.changeBaselines, files);
    if (stalePaths.length) {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, proposalState: 'stale', stalePaths } : item));
      setToast(`Workspace changed after this diff was prepared (${stalePaths.slice(0, 2).join(', ')}). Ask for a fresh patch to review current contents.`);
      return;
    }
    const validChanges = selectedChanges.filter(({ path, content }) =>
      typeof content === 'string' && !path.startsWith('/') && !path.split('/').includes('..') && !path.split('/').some((part) => part.startsWith('.env'))
    );
    if (!validChanges.length) {
      setToast('No safe file changes remain in this task.');
      return;
    }

    const rollbackSnapshot = Object.fromEntries(validChanges.map(({ path }) => [path, Object.hasOwn(files, path) ? files[path] : null]));
    const diskBaselines = Object.fromEntries(validChanges.map(({ path }) => [path, Object.hasOwn(savedFiles, path) ? savedFiles[path] : null]));
    let workingFiles = { ...files };
    validChanges.forEach(({ path, content }) => { workingFiles[path] = content; });
    const captureAppliedPatch = () => {
      const appliedSnapshot = Object.fromEntries(Object.keys(rollbackSnapshot).map((path) => [path, Object.hasOwn(workingFiles, path) ? workingFiles[path] : null]));
      const changedPaths = Object.keys(rollbackSnapshot).filter((path) => rollbackSnapshot[path] !== appliedSnapshot[path]);
      const changes = changedPaths.filter((path) => appliedSnapshot[path] !== null).map((path) => ({ path, content: appliedSnapshot[path] }));
      const changeBaselines = Object.fromEntries(changedPaths.map((path) => [path, rollbackSnapshot[path]]));
      const changeReviews = Object.fromEntries(changedPaths.map((path) => [path, createChangeReview(rollbackSnapshot[path], appliedSnapshot[path] ?? '')]));
      const reviews = Object.values(changeReviews);
      return {
        changes,
        changeBaselines,
        changeReviews,
        changeSummary: { files: changedPaths.length, added: reviews.reduce((sum, review) => sum + review.added, 0), removed: reviews.reduce((sum, review) => sum + review.removed, 0) },
        rollbackSnapshot: { ...rollbackSnapshot },
        appliedSnapshot,
      };
    };
    const firstPath = validChanges[0].path;
    setFiles(workingFiles);
    setOpenTabs((current) => [...new Set([...current, ...validChanges.map(({ path }) => path)])]);
    openFile(firstPath);
    const taskApprovedAt = timeLabel();
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, proposalState: 'running', rollbackSnapshot: { ...rollbackSnapshot }, taskApprovedAt, approvedFileCount: validChanges.length, activityOpen: true } : item));
    setAssistantBusy(true);
    let iterations = 0;
    let verification = { ok: false, results: [], message: '' };
    let workspacePersisted = false;

    try {
      await persistWorkspaceSnapshot(workingFiles, [], diskBaselines);
      workspacePersisted = true;
      const patchAppliedAt = timeLabel();
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, patchAppliedAt } : item));
      if (workingFiles['index.html']) {
        setPreviewDocument(buildPreviewDocument(workingFiles));
        setPanelTab('output');
        setPanelOpen(true);
        setViewMode('preview');
      }

      const desktopBridge = window.codereoDesktop;
      const selectedAgent = mindState.agents.find((agent) => agent.id === activeAgentId);
      const excludedPaths = new Set(message.excludedChangePaths || []);
      const agentCanValidate = !selectedAgent || selectedAgent.capabilities.includes('request-validation');
      const canRunDesktopChecks = Boolean(agentCanValidate && desktopWorkspaceRoot && desktopBridge?.isAvailable && desktopBridge.runValidation);
      let commands = (message.commands || []).map((item) => typeof item === 'string' ? item : item.command).filter(Boolean);
      if (!commands.length && agentCanValidate) commands = inferValidationCommands(workingFiles);

      if (canRunDesktopChecks && commands.length) {
        verification = await desktopBridge.runValidation(commands);
        const taskPrompt = [...messages].reverse().find((item) => item.role === 'user')?.content || 'Complete the approved coding task.';
        const agentHistory = messages.filter((item) => ['user', 'assistant'].includes(item.role)).map(({ role, content }) => ({ role, content }));

        while (!verification.ok && iterations < 2) {
          const outputSummary = (verification.results || []).map((result) =>
            `${result.command} — exit ${result.exitCode}${result.timedOut ? ' (timed out)' : ''}\n${(result.output || '').slice(-6000)}`
          ).join('\n\n');
          agentHistory.push({
            role: 'user',
            content: `The user approved this task: ${taskPrompt}\n\n${excludedPaths.size ? `User-excluded paths (keep unchanged and never include in repairs): ${[...excludedPaths].join(', ')}.\n\n` : ''}I applied the current patch and ran the approved local checks. They failed:\n${outputSummary || verification.message || 'No output was captured.'}\n\nInspect the current workspace and make the smallest useful repair. This task approval covers up to two repair passes. Return the normal JSON agent response; do not suggest commands outside the safe test/build allowlist.`,
          });
          const response = await fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'agent',
              provider: activeProvider,
              agentId: activeAgentId,
              includeMemory: memoryEnabled,
              messages: agentHistory,
              files: buildAssistantContextFiles(workingFiles, [firstPath, activeFile, ...openTabs], agentHistory.at(-1)?.content || taskPrompt),
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || 'The repair pass could not reach the selected provider.');
          agentHistory.push({ role: 'assistant', content: data.message || 'I could not find a safe repair.' });
          const repairs = selectProposalChanges(data.changes, [...excludedPaths]).filter(({ path, content }) =>
            typeof content === 'string' && !path.startsWith('/') && !path.split('/').includes('..') && !path.split('/').some((part) => part.startsWith('.env'))
          );
          if (!repairs.length) {
            setMessages((current) => [...current, {
              id: crypto.randomUUID(), role: 'assistant', content: data.message || 'I could not find a safe repair for the failing check.',
              time: timeLabel(), error: true,
            }]);
            break;
          }

          for (const { path } of repairs) {
            if (!Object.hasOwn(rollbackSnapshot, path)) rollbackSnapshot[path] = Object.hasOwn(workingFiles, path) ? workingFiles[path] : null;
          }
          const repairBaselines = Object.fromEntries(repairs.map(({ path }) => [path, Object.hasOwn(workingFiles, path) ? workingFiles[path] : null]));
          const repairReviews = Object.fromEntries(repairs.map(({ path, content }) => [path, createChangeReview(repairBaselines[path], content)]));
          const beforeRepairFiles = { ...workingFiles };
          repairs.forEach(({ path, content }) => { workingFiles[path] = content; });
          setFiles({ ...workingFiles });
          setOpenTabs((current) => [...new Set([...current, ...repairs.map(({ path }) => path)])]);
          try {
            await persistWorkspaceSnapshot(workingFiles, [], repairBaselines);
          } catch (error) {
            workingFiles = beforeRepairFiles;
            setFiles(beforeRepairFiles);
            throw error;
          }
          setMessages((current) => [...current, {
            id: crypto.randomUUID(), role: 'assistant', content: data.message || 'Applied a repair pass within the task you approved.',
            plan: Array.isArray(data.plan) ? data.plan : [], changes: repairs, changeBaselines: repairBaselines, changeReviews: repairReviews, proposalState: 'auto-applied', time: timeLabel(),
          }]);
          if (workingFiles['index.html']) setPreviewDocument(buildPreviewDocument(workingFiles));
          const newCommands = (data.commands || []).map((item) => typeof item === 'string' ? item : item.command).filter(Boolean);
          verification = await desktopBridge.runValidation(newCommands.length ? newCommands : commands);
          iterations += 1;
        }
      } else if (canRunDesktopChecks) {
        verification = { ok: true, results: [], message: 'No safe test/build command was detected for this project.' };
      } else {
        verification = {
          ok: true,
          results: workingFiles['index.html'] ? [{ command: 'Sandboxed preview', exitCode: 0, output: 'Preview refreshed. Run project tests from the desktop IDE to validate this workspace.' }] : [],
          message: workingFiles['index.html'] ? 'Browser preview refreshed; host test execution is available in desktop mode.' : 'Edits applied. Open this workspace in the desktop IDE to run project checks.',
        };
      }

      const appliedPatch = captureAppliedPatch();
      setMessages((current) => current.map((item) => item.id === message.id ? {
        ...item,
        ...appliedPatch,
        excludedChangePaths: [],
        proposalState: verification.ok ? 'applied' : 'needs-attention',
        verification,
        repairIterations: iterations,
        appliedAt: timeLabel(),
      } : item));
      setToast(verification.ok ? (iterations ? `Task verified after ${iterations} repair pass${iterations === 1 ? '' : 'es'}` : 'Approved task applied') : 'Task applied; checks still need attention');
    } catch (error) {
      verification = { ok: false, results: [], message: error.message || 'Task verification failed.' };
      if (!workspacePersisted) {
        setFiles(files);
        setOpenTabs(openTabs);
        setActiveFile(activeFile);
        const wasStale = /workspace changed since this task was reviewed/i.test(verification.message);
        setMessages((current) => current.map((item) => item.id === message.id ? {
          ...item,
          proposalState: wasStale ? 'stale' : 'apply-failed',
          stalePaths: wasStale ? validChanges.map(({ path }) => path) : [],
          verification,
        } : item));
        setToast(`Task was not saved: ${verification.message}`);
      } else {
        const appliedPatch = captureAppliedPatch();
        setMessages((current) => current.map((item) => item.id === message.id ? {
          ...item,
          ...appliedPatch,
          excludedChangePaths: [],
          proposalState: 'needs-attention',
          verification,
          appliedAt: timeLabel(),
        } : item));
        setToast(error.message || 'Task applied, but verification did not complete');
      }
    } finally {
      setAssistantBusy(false);
    }
  };

  const undoApprovedTask = async (message) => {
    if (assistantBusy) return;
    const rollbackSnapshot = message.rollbackSnapshot;
    const appliedSnapshot = message.appliedSnapshot;
    if (!rollbackSnapshot || !appliedSnapshot) {
      setToast('Undo data is unavailable for this task.');
      return;
    }
    const paths = Object.keys(rollbackSnapshot);
    const conflicts = findStaleProposalPaths(paths.map((path) => ({ path })), appliedSnapshot, files);
    if (conflicts.length) {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, undoConflictPaths: conflicts } : item));
      setToast(`Undo stopped because these files changed after the task: ${conflicts.slice(0, 2).join(', ')}.`);
      return;
    }
    const restoredFiles = { ...files };
    for (const [path, content] of Object.entries(rollbackSnapshot)) {
      if (content === null) delete restoredFiles[path];
      else restoredFiles[path] = content;
    }
    const removePaths = paths.filter((path) => rollbackSnapshot[path] === null);
    setAssistantBusy(true);
    try {
      await persistWorkspaceSnapshot(restoredFiles, removePaths, appliedSnapshot);
      setFiles(restoredFiles);
      setOpenTabs((current) => current.filter((path) => Object.hasOwn(restoredFiles, path)));
      if (!Object.hasOwn(restoredFiles, activeFile)) {
        const nextFile = Object.keys(restoredFiles)[0];
        if (nextFile) openFile(nextFile);
        else setActiveFile('');
      }
      setPreviewDocument(buildPreviewDocument(restoredFiles));
      const undoneAt = timeLabel();
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, proposalState: 'undone', undoConflictPaths: [], undoneAt, activityOpen: true } : item));
      setToast(`Undid changes to ${paths.length} task file${paths.length === 1 ? '' : 's'}`);
    } catch (error) {
      setToast(error.message || 'Could not undo this task. Review the workspace and try again.');
    } finally {
      setAssistantBusy(false);
    }
  };

  const toggleProposalReview = (messageId) => {
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, reviewOpen: !item.reviewOpen } : item));
  };

  const toggleProposalFileList = (messageId) => {
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, filesExpanded: !item.filesExpanded } : item));
  };

  const discardProposal = (messageId) => {
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, proposalState: 'discarded' } : message));
  };

  const toggleProposalChange = (messageId, filePath) => {
    setMessages((current) => current.map((message) => {
      if (message.id !== messageId || ['applied', 'auto-applied', 'discarded', 'running', 'stale', 'needs-attention', 'apply-failed', 'undone'].includes(message.proposalState)) return message;
      const excluded = new Set(message.excludedChangePaths || []);
      if (excluded.has(filePath)) excluded.delete(filePath);
      else excluded.add(filePath);
      return { ...message, excludedChangePaths: [...excluded] };
    }));
  };

  const saveQuestToDesk = async (message) => {
    if (!message.spec || savingQuestId) return;
    setSavingQuestId(message.id);
    const spec = message.spec;
    const list = (items) => Array.isArray(items) && items.length ? items.map((item) => `- ${item}`).join('\n') : '- None';
    const content = [
      `# ${spec.goal || 'Quest implementation spec'}`,
      '',
      '## Requirements',
      list(spec.requirements),
      '',
      '## Design',
      spec.design || 'No design notes supplied.',
      '',
      '## Acceptance criteria',
      list(spec.acceptanceCriteria),
      '',
      '## Steps',
      list(spec.steps?.length ? spec.steps : message.plan),
      '',
      '## Risks',
      list(spec.risks),
    ].join('\n').slice(0, 19_500);
    const steps = (Array.isArray(spec.steps) && spec.steps.length ? spec.steps : message.plan || []).slice(0, 16);
    try {
      const noteResponse = await fetch('/api/mind/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Quest: ${spec.goal || 'Implementation plan'}`, content }),
      });
      const noteData = await noteResponse.json().catch(() => ({}));
      if (!noteResponse.ok) throw new Error(noteData.message || 'Could not save the Quest note.');
      for (const step of steps) {
        const taskResponse = await fetch('/api/mind/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: step, source: `quest:${message.id}` }),
        });
        const taskData = await taskResponse.json().catch(() => ({}));
        if (!taskResponse.ok) throw new Error(taskData.message || 'Quest note saved, but one or more Desk tasks could not be added.');
      }
      const stateResponse = await fetch('/api/mind/state');
      if (stateResponse.ok) setMindState(await stateResponse.json());
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, questSaved: true } : item));
      setToast(`Quest saved to Mind Desk · ${steps.length} step${steps.length === 1 ? '' : 's'}`);
    } catch (error) {
      setToast(error.message || 'Could not save this Quest to Mind Desk.');
    } finally {
      setSavingQuestId('');
    }
  };

  const copyEnvSnippet = async () => {
    const snippets = {
      'openai-compatible': ['AI_PROVIDER=openai-compatible', 'OPENAI_BASE_URL=https://api.openai.com/v1', 'OPENAI_MODEL=gpt-4o-mini', 'OPENAI_API_KEY=your-key-here'],
      anthropic: ['AI_PROVIDER=anthropic', 'ANTHROPIC_BASE_URL=https://api.anthropic.com/v1', 'ANTHROPIC_MODEL=claude-sonnet-4-5', 'ANTHROPIC_API_KEY=your-key-here'],
      gemini: ['AI_PROVIDER=gemini', 'GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta', 'GEMINI_MODEL=gemini-2.5-flash', 'GEMINI_API_KEY=your-key-here'],
      ollama: ['AI_PROVIDER=ollama', 'OLLAMA_BASE_URL=http://127.0.0.1:11434/v1', 'OLLAMA_MODEL=qwen2.5-coder:7b'],
    };
    const snippet = (snippets[activeProvider] || snippets['openai-compatible']).join(String.fromCharCode(10));
    try {
      await navigator.clipboard.writeText(snippet);
      setToast('Setup snippet copied');
    } catch {
      setToast('Copy is unavailable in this browser');
    }
  };

  const runPaletteAction = (action) => {
    setPaletteOpen(false);
    if (action.type === 'file') openFile(action.value);
    if (action.type === 'preview') runPreview();
    if (action.type === 'terminal') { setPanelTab('terminal'); setPanelOpen(true); window.setTimeout(() => terminalInputRef.current?.focus(), 50); }
    if (action.type === 'assistant') setAssistantVisible((current) => !current);
    if (action.type === 'save') saveWorkspace();
    if (action.type === 'new-file') createFile();
  };

  const paletteActions = useMemo(() => {
    const actions = [
      { label: 'Run preview', detail: 'Build and open the sandboxed app preview', icon: <Play size={15} />, type: 'preview' },
      { label: 'Show terminal', detail: 'Open the read-only workspace terminal', icon: <SquareTerminal size={15} />, type: 'terminal' },
      { label: 'Toggle AI assistant', detail: 'Show or hide the assistant panel', icon: <Bot size={15} />, type: 'assistant' },
      { label: 'Save workspace', detail: 'Save this workspace in the browser', icon: <ArrowDownToLine size={15} />, type: 'save' },
      { label: 'New file…', detail: 'Add a file to this workspace', icon: <FilePlus2 size={15} />, type: 'new-file' },
      ...allFilePaths.map((filePath) => ({ label: filePath, detail: 'Open file', icon: <IconForFile name={filePath} />, type: 'file', value: filePath })),
    ];
    const query = paletteQuery.toLowerCase().trim();
    return query ? actions.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(query)) : actions;
  }, [allFilePaths, paletteQuery]);

  const renderTree = (nodes, depth = 0) => nodes.map((node) => {
    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.path);
      return (
        <div key={node.path}>
          <button className="tree-row folder-row" style={{ paddingLeft: `${12 + depth * 14}px` }} onClick={() => toggleFolder(node.path)}>
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {isExpanded ? <FolderOpen size={14} className="folder-icon" /> : <Folder size={14} className="folder-icon" />}
            <span>{node.name}</span>
          </button>
          {isExpanded && renderTree(node.children, depth + 1)}
        </div>
      );
    }
    const isActive = activeFile === node.path && viewMode === 'code';
    const changed = files[node.path] !== savedFiles[node.path];
    return (
      <button key={node.path} className={`tree-row file-row ${isActive ? 'active' : ''}`} style={{ paddingLeft: `${27 + depth * 14}px` }} onClick={() => openFile(node.path)}>
        <IconForFile name={node.name} />
        <span className="tree-file-name">{node.name}</span>
        {changed && <span className="dirty-dot" title="Unsaved change" />}
      </button>
    );
  });

  const contentSearchResults = useMemo(() => searchWorkspace(files, deferredFileSearch, 40), [files, deferredFileSearch]);
  const filteredTree = activeActivity === 'search'
    ? deferredFileSearch.trim()
      ? contentSearchResults.length
        ? contentSearchResults.map((result) => (
          <button key={`${result.path}:${result.line}`} className={`search-result-row ${activeFile === result.path && viewMode === 'code' ? 'active' : ''}`} onClick={() => openSearchResult(result)}>
            <IconForFile name={result.path} />
            <span className="search-result-copy"><strong title={result.path}>{result.path}</strong><small>{result.line ? `Line ${result.line}` : 'Path match'} · {result.excerpt}</small></span>
          </button>
        ))
        : <div className="search-empty-state">No code or path matches for “{deferredFileSearch}”.</div>
      : renderTree(fileTree)
    : fileSearch.trim()
      ? allFilePaths.filter((filePath) => filePath.toLowerCase().includes(fileSearch.toLowerCase())).map((filePath) => (
        <button key={filePath} className={`tree-row file-row ${activeFile === filePath && viewMode === 'code' ? 'active' : ''}`} onClick={() => openFile(filePath)}>
          <IconForFile name={filePath} /><span className="tree-file-name">{filePath}</span>
        </button>
      ))
      : renderTree(fileTree);

  return (
    <div className={`app-shell ${assistantVisible ? '' : 'assistant-hidden'}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Sparkles size={15} strokeWidth={2.4} /></div>
          <span className="brand-name">codereo</span>
          <span className="brand-badge">IDE</span>
        </div>
        <div className="topbar-divider" />
        <button className="project-switcher" title={desktopAvailable ? 'Open local folder' : 'Open local folders in the desktop app'} onClick={openWorkspace}>
          <span className="project-icon"><LayoutGrid size={14} /></span>
          <span>{workspaceName}</span>
          <ChevronDown size={13} />
        </button>
        <div className="topbar-center">
          <button className="command-trigger" onClick={() => { setPaletteQuery(''); setPaletteOpen(true); }}>
            <Search size={14} /><span>Quick open or run a command</span><kbd>⌘ P</kbd>
          </button>
        </div>
        <div className="topbar-actions">
          <div className={`connection-indicator ${activeProviderStatus?.configured ? 'connected' : ''}`} title={activeProviderStatus?.configured ? `${activeProviderMetadata.label} is configured` : `${activeProviderMetadata.label} is not configured`}>
            <span className="connection-dot" />
            <span>{activeProviderStatus?.configured ? activeProviderMetadata.label : `${activeProviderMetadata.label} setup`}</span>
          </div>
          <button className="icon-button assistant-toggle" title={assistantVisible ? 'Hide assistant' : 'Show assistant'} onClick={() => setAssistantVisible((current) => !current)}>
            <Bot size={16} />
          </button>
          <button className="icon-button" title="AI settings" onClick={() => setSettingsOpen(true)}><Settings2 size={16} /></button>
          <div className="profile-avatar" title="Local workspace">C</div>
        </div>
      </header>

      <div className="workspace-grid">
        <nav className="activity-bar" aria-label="Primary navigation">
          <div className="activity-group">
            <button className={`activity-button ${activeActivity === 'explorer' ? 'active' : ''}`} title="Explorer" onClick={() => setActiveActivity('explorer')}><Files size={19} /></button>
            <button className={`activity-button ${activeActivity === 'search' ? 'active' : ''}`} title="Search files" onClick={() => { setActiveActivity('search'); setTimeout(() => document.querySelector('.file-search-input')?.focus(), 0); }}><Search size={19} /></button>
            <button className={`activity-button ${activeActivity === 'source' ? 'active' : ''}`} title="Source control" onClick={() => setActiveActivity('source')}><GitBranch size={19} /></button>
            <button className={`activity-button ${activeActivity === 'activity' ? 'active' : ''}`} title="Workspace activity" onClick={() => setActiveActivity('activity')}><Activity size={19} /></button>
            <button className={`activity-button ${activeActivity === 'mind' ? 'active' : ''}`} title="Codereo Mind — memory, agents, research" onClick={() => setActiveActivity('mind')}><BrainCircuit size={19} /></button>
          </div>
          <div className="activity-group activity-bottom">
            <button className="activity-button" title="AI settings" onClick={() => setSettingsOpen(true)}><Settings2 size={19} /></button>
            <button className="activity-button help-activity" title="Keyboard shortcuts" onClick={() => { setPaletteQuery(''); setPaletteOpen(true); }}><HelpCircle size={18} /></button>
          </div>
        </nav>

        <aside className="explorer-panel">
          {activeActivity === 'explorer' || activeActivity === 'search' ? (
            <>
              <div className="panel-title-row">
                <span>{activeActivity === 'search' ? 'SEARCH' : 'EXPLORER'}</span>
                <div className="panel-title-actions">
                  <button className="mini-icon-button" title="New file" onClick={createFile}><FilePlus2 size={15} /></button>
                  <button className="mini-icon-button" title="Collapse folders" onClick={() => setExpandedFolders(new Set())}><PanelLeftClose size={15} /></button>
                  <button className="mini-icon-button" title="Close explorer" onClick={() => setActiveActivity('activity')}><X size={14} /></button>
                </div>
              </div>
              {activeActivity === 'search' && (
                <div className="search-files-wrap"><Search size={14} /><input className="file-search-input" value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} placeholder="Search code and paths" /></div>
              )}
              <div className="workspace-folder-row">
                <ChevronDown size={13} /><span className="workspace-folder-name">CODEREO-STARTER</span>
                <button className="mini-icon-button folder-add" title="New file" onClick={createFile}><Plus size={15} /></button>
              </div>
              <div className="file-tree">{filteredTree}</div>
              <div className="explorer-footer">
                <div className="explorer-footer-icon"><ShieldCheck size={14} /></div>
                <div><strong>{desktopWorkspaceRoot ? 'Disk workspace' : 'Private workspace'}</strong><span>{desktopWorkspaceRoot ? 'Save writes to your selected folder' : desktopAvailable ? 'Open a folder to edit on disk' : 'Files stay in this browser'}</span></div>
              </div>
            </>
          ) : activeActivity === 'mind' ? (
            <MindPanel files={files} workspaceName={workspaceName} onOpenFile={openFile} selectedAgentId={activeAgentId} onSelectAgent={selectAgent} memoryEnabled={memoryEnabled} onMemoryToggle={updateMemoryEnabled} onStateChange={setMindState} mindState={mindState} />
          ) : activeActivity === 'source' ? (
            <div className="utility-panel source-control-panel">
              <div className="panel-title-row"><span>SOURCE CONTROL</span><button className="mini-icon-button" title="Back to files" onClick={() => setActiveActivity('explorer')}><X size={14} /></button></div>
              <div className="source-branch-card"><span>WORKSPACE BRANCH</span><div className="branch-chip"><GitBranch size={13} /> main <span className="branch-dot" /></div><small>{desktopWorkspaceRoot ? 'Local desktop folder' : 'Browser workspace'}</small></div>
              <div className="source-change-heading"><strong>UNSAVED FILES</strong><span>{localChanges.length}</span></div>
              {localChanges.length ? <div className="source-change-list">{localChanges.map((filePath) => {
                const kind = !Object.hasOwn(savedFiles, filePath) ? 'A' : !Object.hasOwn(files, filePath) ? 'D' : 'M';
                return <button type="button" key={filePath} onClick={() => openFile(filePath)}><IconForFile name={filePath} size={13} /><span title={filePath}>{filePath}</span><i className={`change-kind change-${kind.toLowerCase()}`}>{kind}</i></button>;
              })}</div> : <div className="source-clean-state"><CircleCheck size={17} /><span>No unsaved file changes</span></div>}
              <button className="subtle-button source-save-button" onClick={saveWorkspace}><ArrowDownToLine size={14} /> Save workspace</button>
              <div className="utility-note">Saving writes only to this workspace. Git commit and push actions are not run from this panel.</div>
            </div>
          ) : (
            <div className="utility-panel activity-feed-panel">
              <div className="panel-title-row"><span>ACTIVITY</span><button className="mini-icon-button" title="Back to files" onClick={() => setActiveActivity('explorer')}><X size={14} /></button></div>
              <div className="activity-feed-heading"><div><span>CODEREO AGENT</span><strong>Task history</strong></div><span className="activity-count">{taskHistory.length}</span></div>
              <p className="activity-feed-description">Recent coding tasks, reviews, verification, and undo checkpoints for this conversation.</p>
              {taskHistory.length ? <div className="task-history-list">{taskHistory.map((task) => {
                const labels = { applied: 'Applied', 'needs-attention': 'Needs review', undone: 'Undone', stale: 'Out of date', running: 'In progress', discarded: 'Discarded', 'auto-applied': 'Repair applied', 'apply-failed': 'Save failed', ready: 'Ready to review' };
                return <button type="button" className="task-history-item" key={task.id} onClick={() => document.getElementById(`assistant-message-${task.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                  <span className={`task-history-dot status-${task.state}`} />
                  <span className="task-history-copy"><strong title={task.prompt}>{task.prompt}</strong><small>{task.files ? `${task.files} file${task.files === 1 ? '' : 's'}` : 'Quest specification'} · {task.time || 'now'}</small></span>
                  <span className={`task-history-status status-${task.state}`}>{labels[task.state] || 'Ready'}</span>
                </button>;
              })}</div> : <div className="activity-empty-state"><div className="utility-hero-icon"><Activity size={21} /></div><strong>No tasks yet</strong><span>Approved coding tasks and their checkpoints will appear here.</span><button className="subtle-button" onClick={() => { setAssistantVisible(true); setAssistantMode('agent'); window.setTimeout(() => chatInputRef.current?.focus(), 30); }}><Sparkles size={13} /> Start a task</button></div>}
              <div className="activity-feed-footer"><ShieldCheck size={13} /><span>Task history stays in this conversation.</span></div>
            </div>
          )}
        </aside>

        <main className="main-column">
          <div className="editor-toolbar">
            <div className="breadcrumbs">
              <span className="breadcrumb-root">{workspaceName}</span><ChevronRight size={13} />
              {viewMode === 'preview' ? <><Globe2 size={13} className="crumb-icon" /><span>Preview</span></> : <><IconForFile name={activeFile} size={13} /><span>{activeFile}</span></>}
              {viewMode === 'code' && isActiveFileDirty && <span className="breadcrumb-dirty" title="Unsaved changes" />}
            </div>
            <div className="editor-actions">
              <div className="branch-chip toolbar-branch"><GitBranch size={13} /> main</div>
              <span className="toolbar-separator" />
              <button className="toolbar-button run-button" onClick={runPreview}><Play size={13} fill="currentColor" /> <span>Run preview</span><kbd>⌘ ↵</kbd></button>
              <button className="toolbar-icon-button" title="Save workspace (⌘S)" onClick={saveWorkspace}><ArrowDownToLine size={15} /></button>
              <button className="toolbar-icon-button" title="Toggle bottom panel" onClick={() => setPanelOpen((current) => !current)}><PanelBottom size={15} /></button>
              <button className="toolbar-icon-button hide-mobile" title="Toggle assistant" onClick={() => setAssistantVisible((current) => !current)}><PanelRightClose size={15} /></button>
            </div>
          </div>

          <div className="tab-strip">
            {openTabs.map((filePath) => (
              <button key={filePath} className={`editor-tab ${viewMode === 'code' && activeFile === filePath ? 'active' : ''}`} onClick={() => openFile(filePath)}>
                <IconForFile name={filePath} size={13} /><span>{filePath.split('/').pop()}</span>
                {files[filePath] !== savedFiles[filePath] && <span className="tab-dirty" />}
                <span className="tab-close" onClick={(event) => closeTab(event, filePath)}><X size={12} /></span>
              </button>
            ))}
            <button className={`editor-tab preview-editor-tab ${viewMode === 'preview' ? 'active' : ''}`} onClick={() => setViewMode('preview')}><Globe2 size={13} /><span>Preview</span></button>
            <button className="tab-add-button" title="New file" onClick={createFile}><Plus size={15} /></button>
            <div className="tab-strip-spacer" />
            <button className="toolbar-icon-button tab-side-button" title="Open assistant" onClick={() => setAssistantVisible(true)}><Bot size={15} /></button>
          </div>

          {viewMode === 'code' ? (
            <section className="code-area">
              <div className="code-caption"><div className="code-caption-path"><span className="muted-path">codereo-starter</span><ChevronRight size={12} />{activeFile.split('/').map((part, index) => <span key={`${part}-${index}`} className={index === activeFile.split('/').length - 1 ? 'current-path' : 'muted-path'}>{part}</span>)}</div><div className="code-caption-right"><span className="code-language">{(activeFile.split('.').pop() || 'text').toUpperCase()}</span><button className="mini-icon-button" title="Save this file" onClick={saveWorkspace}><ArrowDownToLine size={14} /></button></div></div>
              <div className="code-editor-wrap">
                <CodeMirror
                  value={files[activeFile] ?? ''}
                  height="100%"
                  theme={oneDark}
                  extensions={[getLanguage(activeFile)]}
                  onCreateEditor={(view) => { editorViewRef.current = view; }}
                  onChange={(value) => updateFile(activeFile, value)}
                  onUpdate={(update) => {
                    const head = update.state.selection.main.head;
                    const line = update.state.doc.lineAt(head);
                    setCursorPosition({ line: line.number, column: head - line.from + 1 });
                  }}
                  basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, highlightSelectionMatches: true, autocompletion: true, bracketMatching: true, closeBrackets: true }}
                  className="codemirror-root"
                />
              </div>
              <div className="editor-info-row"><span><span className="editor-info-dot" /> Ready</span><span>UTF-8</span><span>Spaces: 2</span><span>Ln {cursorPosition.line} · Col {cursorPosition.column}</span></div>
            </section>
          ) : (
            <section className="preview-area">
              <div className="preview-toolbar">
                <div className="preview-device-controls"><button className="device-button active" title="Desktop"><LayoutGrid size={14} /></button><button className="device-button" title="Responsive"><Globe2 size={14} /></button></div>
                <div className="preview-address"><ShieldCheck size={13} /><span>codereo-preview.local</span><span className="preview-address-path">/</span></div>
                <button className="mini-icon-button" title="Refresh preview" onClick={runPreview}><RefreshCw size={14} /></button>
                <button className="mini-icon-button" title="Refresh preview" onClick={runPreview}><Maximize2 size={14} /></button>
              </div>
              <div className="preview-frame-wrap"><iframe title="Workspace preview" sandbox="allow-scripts" srcDoc={previewDocument} /></div>
            </section>
          )}

          {panelOpen && (
            <section className="bottom-panel">
              <div className="bottom-panel-header">
                <div className="bottom-tabs">
                  <button className={panelTab === 'terminal' ? 'active' : ''} onClick={() => setPanelTab('terminal')}><Terminal size={13} /> TERMINAL</button>
                  <button className={panelTab === 'output' ? 'active' : ''} onClick={() => setPanelTab('output')}><MessageSquareText size={13} /> OUTPUT</button>
                  <button className={panelTab === 'problems' ? 'active' : ''} onClick={() => setPanelTab('problems')}><CircleCheck size={13} /> PROBLEMS <span className="problem-count">0</span></button>
                </div>
                <div className="bottom-panel-actions"><button className="mini-icon-button" title="Maximize panel" onClick={() => setPanelOpen(false)}><Minimize2 size={14} /></button><button className="mini-icon-button" title="Close panel" onClick={() => setPanelOpen(false)}><X size={14} /></button></div>
              </div>
              {panelTab === 'terminal' ? (
                <div className="terminal-view">
                  <div className="terminal-output">{terminalLines.map((line, index) => <pre key={`${index}-${line.text.slice(0, 12)}`} className={`terminal-line ${line.type}`}>{line.text}</pre>)}</div>
                  <form className="terminal-prompt" onSubmit={handleTerminalSubmit}><span className="terminal-prompt-glyph">›</span><input ref={terminalInputRef} value={terminalInput} onChange={(event) => setTerminalInput(event.target.value)} placeholder="Type a read-only command…" autoComplete="off" spellCheck="false" /><span className="terminal-hint">browser sandbox</span></form>
                </div>
              ) : panelTab === 'output' ? (
                <div className="panel-empty-state"><div className="empty-state-icon success"><CircleCheck size={18} /></div><div><strong>Preview output</strong><p>Run preview to rebuild the sandboxed browser view. JavaScript runs inside an isolated iframe.</p></div><button className="subtle-button compact" onClick={runPreview}><Play size={13} /> Run now</button></div>
              ) : (
                <div className="panel-empty-state"><div className="empty-state-icon success"><CircleCheck size={18} /></div><div><strong>No problems detected</strong><p>Diagnostics will appear here as language and build integrations are added.</p></div></div>
              )}
            </section>
          )}
        </main>

        {assistantVisible && (
          <aside className="assistant-panel">
            <div className="assistant-header">
              <div className="assistant-title"><div className="assistant-mark"><Sparkles size={14} /></div><div><strong>Codereo Agent</strong><span>Agentic coding partner</span></div></div>
              <div className="assistant-header-actions"><button className="mini-icon-button" title="New conversation" onClick={() => setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: 'New conversation ready. What should we work on?', time: 'now', suggestions: ['Explain this project', 'Add a feature'] }])}><Plus size={15} /></button><button className="mini-icon-button" title="Hide assistant" onClick={() => setAssistantVisible(false)}><PanelRightClose size={15} /></button></div>
            </div>
            <div className="assistant-model-row" title="Choose provider in AI settings"><div className={`model-status-dot ${activeProviderStatus?.configured ? 'online' : ''}`} /><span>{activeProviderStatus?.configured ? `${activeProviderMetadata.label} · ${activeProviderStatus.model}` : `${activeProviderMetadata.label} setup required`}</span><ChevronDown size={13} onClick={() => setSettingsOpen(true)} /></div>
            <div className="assistant-mode-switch" aria-label="Assistant mode">
              <button className={assistantMode === 'ask' ? 'active' : ''} onClick={() => setAssistantMode('ask')}><MessageSquareText size={13} /> Ask</button>
              <button className={assistantMode === 'plan' ? 'active' : ''} onClick={() => setAssistantMode('plan')}><Circle size={13} /> Plan</button>
              <button className={assistantMode === 'agent' ? 'active' : ''} onClick={() => setAssistantMode('agent')}><Sparkles size={13} /> Agent</button>
              <button className={assistantMode === 'quest' ? 'active' : ''} onClick={() => setAssistantMode('quest')} title="Quest: spec, milestones, and a reviewable patch"><ListChecks size={13} /> Quest</button>
            </div>
            <div className="assistant-profile-row"><BrainCircuit size={13} /><label htmlFor="assistant-agent-profile">Specialist</label><select id="assistant-agent-profile" value={activeAgentId} onChange={(event) => selectAgent(event.target.value)}>{(mindState.agents.length ? mindState.agents : [{ id: 'operator', name: 'Operator' }]).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><button type="button" title="Manage memory, agents, and research" onClick={() => setActiveActivity('mind')}><BrainCircuit size={12} /></button></div>
            <div className="agent-safety-note"><ShieldCheck size={13} /><span>Approve once · agent edits and safe checks · risky commands withheld</span></div>
            <div className="chat-transcript">
              <div className="conversation-date"><span /> TODAY <span /></div>
              {messages.map((message) => (
                <article key={message.id} id={`assistant-message-${message.id}`} className={`chat-message ${message.role === 'user' ? 'user-message' : 'assistant-message'} ${message.error ? 'message-error' : ''}`}>
                  {message.role === 'assistant' && <div className="message-avatar"><Sparkles size={12} /></div>}
                  <div className="message-content-wrap">
                    <div className="message-meta"><span>{message.role === 'user' ? 'You' : 'Codereo'}</span><time>{message.time}</time></div>
                    <div className="message-bubble">{message.content}</div>
                    {message.plan?.length > 0 && <ol className="plan-list">{message.plan.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol>}
                    {message.spec && <section className="quest-spec-card">
                      <div className="quest-spec-heading"><div className="proposal-icon"><ListChecks size={14} /></div><div><strong>Quest specification</strong><span>Outcome · design · acceptance · delivery steps</span></div></div>
                      {message.spec.goal && <p className="quest-goal">{message.spec.goal}</p>}
                      {message.spec.requirements?.length > 0 && <div className="quest-spec-section"><strong>Requirements</strong><ul>{message.spec.requirements.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
                      {message.spec.design && <div className="quest-spec-section"><strong>Design</strong><p>{message.spec.design}</p></div>}
                      {message.spec.acceptanceCriteria?.length > 0 && <div className="quest-spec-section"><strong>Acceptance criteria</strong><ul>{message.spec.acceptanceCriteria.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
                      {message.spec.steps?.length > 0 && <div className="quest-spec-section"><strong>Steps</strong><ol>{message.spec.steps.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ol></div>}
                      {message.spec.risks?.length > 0 && <div className="quest-spec-section"><strong>Risks</strong><ul>{message.spec.risks.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
                      <div className="quest-save-row">{message.questSaved ? <span className="quest-saved"><Check size={12} /> Saved to Mind Desk</span> : <button type="button" disabled={Boolean(savingQuestId)} onClick={() => saveQuestToDesk(message)}>{savingQuestId === message.id ? <LoaderCircle size={12} className="spin" /> : <BookOpen size={12} />} Save spec &amp; steps to Desk</button>}</div>
                    </section>}
                    {message.changes?.length > 0 && (
                      <div className="proposal-card">
                        <div className="proposal-heading">
                          <div className="proposal-icon"><FileCode2 size={14} /></div>
                          <div>
                            <strong>{['applied', 'needs-attention'].includes(message.proposalState) ? `Edited ${message.changeSummary?.files ?? message.changes.length} file${(message.changeSummary?.files ?? message.changes.length) === 1 ? '' : 's'}` : message.proposalState === 'undone' ? 'Task changes undone' : message.proposalState === 'apply-failed' ? 'Task not saved' : message.proposalState === 'auto-applied' ? 'Repair applied' : message.spec ? 'Quest patch ready' : 'Agent task ready'}</strong>
                            <span>{['applied', 'needs-attention', 'undone'].includes(message.proposalState)
                              ? <><i className="diff-added-count">+{message.changeSummary?.added || 0}</i> <i className="diff-removed-count">−{message.changeSummary?.removed || 0}</i> · {message.undoneAt || message.appliedAt || 'now'}</>
                              : message.proposalState === 'auto-applied' ? `${message.changes.length} file${message.changes.length === 1 ? '' : 's'} · covered by the original task approval` : message.proposalState === 'apply-failed' ? 'No task changes were confirmed as saved · request a fresh patch before retrying' : `${message.changes.length - (message.excludedChangePaths?.length || 0)} of ${message.changes.length} file${message.changes.length === 1 ? '' : 's'} selected · inspect each diff, then approve once`}</span>
                          </div>
                          {['applied', 'needs-attention', 'undone'].includes(message.proposalState) && <div className="proposal-header-actions">
                            {message.proposalState !== 'undone' && message.changeSummary?.files > 0 && <button type="button" disabled={assistantBusy} onClick={() => undoApprovedTask(message)}>Undo</button>}
                            <button type="button" onClick={() => toggleProposalReview(message.id)}>{message.reviewOpen ? 'Hide review' : 'Review'}</button>
                          </div>}
                        </div>
                        <div className="proposal-files">{(message.filesExpanded ? message.changes : message.changes.slice(0, 3)).map((change) => <div className="proposal-file" key={change.path}><IconForFile name={change.path} size={13} /><span>{change.path}</span><span className="proposal-change-label">{message.changeReviews?.[change.path]?.isNewFile ? 'A' : 'M'}</span></div>)}</div>
                        {message.changes.length > 3 && <button type="button" className="proposal-expand-files" onClick={() => toggleProposalFileList(message.id)}>{message.filesExpanded ? 'Show fewer files' : `Show ${message.changes.length - 3} more files`} <ChevronDown size={12} /></button>}
                        {(!['applied', 'needs-attention', 'undone'].includes(message.proposalState) || message.reviewOpen) && <div className="proposal-diff-list">{message.changes.map((change) => {
                          const review = message.changeReviews?.[change.path] || createChangeReview(message.changeBaselines?.[change.path] ?? null, change.content);
                          const included = !(message.excludedChangePaths || []).includes(change.path);
                          const selectionLocked = ['applied', 'auto-applied', 'discarded', 'running', 'stale', 'needs-attention', 'apply-failed', 'undone'].includes(message.proposalState);
                          return <section className={`proposal-diff-file ${included ? '' : 'excluded'}`} key={change.path}>
                            <div className="proposal-diff-title"><code title={change.path}>{change.path}</code><label className="proposal-diff-selection" title={`${included ? 'Exclude' : 'Include'} this file ${included ? 'from' : 'in'} the approved task`}><input type="checkbox" checked={included} disabled={assistantBusy || selectionLocked} onChange={() => toggleProposalChange(message.id, change.path)} /><span>Include</span></label><span><i className="diff-added-count">+{review.added}</i> <i className="diff-removed-count">−{review.removed}</i></span></div>
                            <div className="proposal-diff-lines">{review.lines.map((line, index) => <div className={`proposal-diff-line diff-${line.type}`} key={`${line.type}-${index}`}><span>{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : line.type === 'omitted' ? '…' : ' '}</span><code>{line.type === 'omitted' ? `${line.count} lines omitted` : line.text || ' '}</code></div>)}</div>
                          </section>;
                        })}</div>}
                        {message.commands?.length > 0 ? <div className="proposal-check-list"><strong>Checks after approval</strong>{message.commands.map((item) => <div key={item.command}><Terminal size={11} /><code>{item.command}</code></div>)}</div> : <div className="proposal-check-hint">After approval, Codereo will detect safe test/build checks in the project and run them in desktop mode.</div>}
                        {message.blockedCommands?.length > 0 && <div className="blocked-command-note"><strong>Requires explicit approval · never auto-run</strong>{message.blockedCommands.map((command, index) => <div className="blocked-command-row" key={`${command}-${index}`}><code title={command}>{command}</code>{window.codereoDesktop?.runConfirmedCommand ? <button type="button" disabled={assistantBusy || !desktopWorkspaceRoot} title={!desktopWorkspaceRoot ? 'Open a desktop workspace first' : 'Review in the desktop confirmation dialog'} onClick={() => runConfirmedAgentCommand(message.id, command)}>Review &amp; run</button> : <span>Desktop only</span>}</div>)}{message.manualCommandResults?.map((result, index) => <div className="manual-command-result" key={`${result.command}-${index}`}><span className={result.ok ? 'check-pass' : result.canceled ? '' : 'check-fail'}>{result.canceled ? 'Canceled' : result.timedOut ? 'Timed out' : result.ok ? 'Finished' : `Exit ${result.exitCode ?? -1}`}</span><code>{result.command}</code><pre>{result.output || (result.ok ? 'Command completed.' : '')}</pre></div>)}</div>}
                        {message.proposalState === 'applied' || message.proposalState === 'auto-applied' ? <div className="proposal-result applied"><Check size={13} /> {message.proposalState === 'auto-applied' ? 'Repair applied within approved task' : 'Approved task applied'}</div> : message.proposalState === 'discarded' ? <div className="proposal-result">Task discarded</div> : message.proposalState === 'undone' ? <div className="proposal-result"><RefreshCw size={13} /> Task changes restored to the pre-approval snapshot</div> : message.proposalState === 'stale' ? <div className="proposal-result needs-attention"><AlertCircle size={13} /> Workspace files changed after review{message.stalePaths?.length ? `: ${message.stalePaths.join(', ')}` : ''}. Request a fresh patch before applying.</div> : message.proposalState === 'running' ? <div className="proposal-result"><LoaderCircle size={13} className="spin" /> Applying task and running checks…</div> : message.proposalState === 'needs-attention' ? <div className="proposal-result needs-attention"><AlertCircle size={13} /> Applied; review the failing checks below</div> : message.proposalState === 'apply-failed' ? <div className="proposal-result needs-attention"><AlertCircle size={13} /> The save could not be confirmed. Inspect the workspace, save it, then request a fresh patch.<button type="button" className="discard-proposal" disabled={assistantBusy} onClick={() => discardProposal(message.id)}>Dismiss</button></div> : <div className="proposal-actions"><button className="apply-proposal" disabled={assistantBusy || message.changes.length <= (message.excludedChangePaths?.length || 0)} onClick={() => approveAgentTask(message)}><Check size={13} /> {'Approve task & verify'}</button><button className="discard-proposal" disabled={assistantBusy} onClick={() => discardProposal(message.id)}>Discard</button></div>}
                        {message.taskApprovedAt && <section className="task-activity-card">
                          <button type="button" className="task-activity-toggle" aria-expanded={message.activityOpen !== false} onClick={() => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, activityOpen: item.activityOpen === false } : item))}>
                            <span><Activity size={13} /> Task activity <small>{createTaskTimeline(message).length} checkpoints</small></span><ChevronDown size={13} className={message.activityOpen === false ? 'collapsed' : ''} />
                          </button>
                          {message.activityOpen !== false && <ol className="task-timeline-list">{createTaskTimeline(message).map((event) => <li className={`task-timeline-event timeline-${event.state}`} key={event.id}>
                            <span className="task-timeline-marker">{event.state === 'error' ? <AlertCircle size={12} /> : event.state === 'undone' ? <RefreshCw size={12} /> : event.state === 'running' ? <LoaderCircle size={12} className="spin" /> : <Check size={12} />}</span>
                            <span className="task-timeline-copy"><strong>{event.title}</strong><small>{event.detail}</small></span>
                            {event.time && <time>{event.time}</time>}
                          </li>)}</ol>}
                        </section>}
                        {message.verification && <div className={`verification-card ${message.verification.ok ? 'passed' : 'failed'}`}><strong>{message.verification.ok ? 'Verification' : 'Checks need attention'}</strong>{message.verification.message && <p>{message.verification.message}</p>}{(message.verification.results || []).map((result, index) => <div className="verification-result" key={`${result.command}-${index}`}><span className={result.exitCode === 0 ? 'check-pass' : 'check-fail'}>{result.exitCode === 0 ? 'PASS' : 'FAIL'}</span><code>{result.command}</code>{result.output && <pre>{result.output.slice(0, 1600)}</pre>}</div>)}</div>}
                      </div>
                    )}
                    {message.suggestions?.length > 0 && messages.length === 1 && <div className="suggestion-list">{message.suggestions.map((suggestion) => <button key={suggestion} onClick={() => sendAssistantMessage(suggestion)}>{suggestion}<ArrowRight size={12} /></button>)}</div>}
                  </div>
                </article>
              ))}
              {assistantBusy && <div className="thinking-row"><div className="message-avatar"><Sparkles size={12} /></div><span><LoaderCircle size={13} className="spin" /> Thinking…</span></div>}
            </div>
            <div className="assistant-context-row"><div className="context-file-icon"><Files size={13} /></div><span>{allFilePaths.length} workspace files · {mindState.memoryCount || 0} memories</span><label className="memory-recall-control" title="Include relevant local memory excerpts with this provider request"><input type="checkbox" checked={memoryEnabled} disabled={!activeAgentCanUseMemory} onChange={(event) => updateMemoryEnabled(event.target.checked)} /><span>Recall</span></label><button title="Manage local memory" onClick={() => setActiveActivity('mind')}><Info size={13} /></button></div>
            <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); sendAssistantMessage(); }}>
              <textarea ref={chatInputRef} value={assistantDraft} onChange={(event) => setAssistantDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendAssistantMessage(); } }} placeholder={assistantMode === 'ask' ? 'Ask about your code…' : assistantMode === 'plan' ? 'What would you like to plan?' : assistantMode === 'quest' ? 'Describe the outcome; Quest will spec it and map the steps…' : 'Describe a change to make…'} rows={2} />
              <div className="composer-bottom"><div className="composer-hint"><span>↵</span> to send · <span>⇧ ↵</span> for new line</div><button type="submit" className="send-button" aria-label="Send message" disabled={!assistantDraft.trim() || assistantBusy}><Send size={14} /></button></div>
            </form>
            <div className="assistant-footer"><span><ShieldCheck size={12} /> Private by default</span><button onClick={() => setSettingsOpen(true)}>Configure AI</button></div>
          </aside>
        )}
      </div>

      <footer className="statusbar">
        <div className="status-left"><button onClick={() => { setActiveActivity('source'); }}><GitBranch size={12} /> main</button><button title="Workspace sync status"><CircleCheck size={12} /> 0</button><span className="status-sync"><Circle size={8} /> {desktopWorkspaceRoot ? 'Disk workspace' : 'Browser workspace'}</span></div>
        <div className="status-right"><button onClick={() => { setPanelTab('terminal'); setPanelOpen((current) => !current); }}><SquareTerminal size={12} /> Terminal</button><button onClick={() => setSettingsOpen(true)}><Sparkles size={12} /> {activeProviderStatus?.configured ? 'AI configured' : 'AI setup'}</button><span>Codereo IDE · Preview</span></div>
      </footer>

      {paletteOpen && (
        <div className="modal-backdrop palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
          <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
            <div className="palette-search"><Search size={17} /><input ref={paletteInputRef} value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && paletteActions.length) { event.preventDefault(); setPaletteIndex((index) => (index + 1) % paletteActions.length); }
              else if (event.key === 'ArrowUp' && paletteActions.length) { event.preventDefault(); setPaletteIndex((index) => (index - 1 + paletteActions.length) % paletteActions.length); }
              else if (event.key === 'Enter' && paletteActions[paletteIndex]) { event.preventDefault(); runPaletteAction(paletteActions[paletteIndex]); }
            }} placeholder="Search files and commands…" /><kbd>ESC</kbd></div>
            <div className="palette-section-label">{paletteQuery ? 'RESULTS' : 'SUGGESTED'}</div>
            <div className="palette-results">{paletteActions.length ? paletteActions.slice(0, 10).map((action, index) => <button key={`${action.type}-${action.label}`} className={`palette-result ${paletteIndex === index ? 'active' : ''}`} onClick={() => runPaletteAction(action)}>{action.icon}<span>{action.label}</span><small>{action.detail}</small><ArrowRight size={13} /></button>) : <div className="palette-no-results">No matching files or commands</div>}</div>
            <div className="palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span><span><kbd>↵</kbd> to select</span></div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="settings-header"><div className="settings-header-icon"><Settings2 size={18} /></div><div><h2 id="settings-title">AI provider settings</h2><p>Connect a private provider endpoint to enable the assistant.</p></div><button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={17} /></button></div>
            <div className="settings-connection-card"><div className={`settings-status-icon ${activeProviderStatus?.configured ? 'connected' : ''}`}>{activeProviderStatus?.configured ? <CircleCheck size={17} /> : <AlertCircle size={17} />}</div><div><strong>{activeProviderStatus?.configured ? `${activeProviderMetadata.label} configured` : `${activeProviderMetadata.label} not configured`}</strong><span>{activeProviderStatus?.configured ? `Model: ${activeProviderStatus.model}` : 'Choose a provider below, add its server-side values, then restart.'}</span></div><button className="mini-icon-button" title="Refresh provider status" onClick={() => fetch('/api/health').then((response) => response.json()).then(setHealth).catch(() => {})}><RefreshCw size={14} /></button></div>
            <div className="provider-profile-grid">
              {PROVIDER_OPTIONS.map((provider) => {
                const status = health.providers?.find((item) => item.id === provider.id);
                return <button key={provider.id} className={`provider-profile ${activeProvider === provider.id ? 'active' : ''}`} onClick={() => selectProvider(provider.id)}><span className="provider-profile-mark">{provider.label.slice(0, 1)}</span><span className="provider-profile-copy"><strong>{provider.label}</strong><small>{status?.configured ? status.model : provider.secret}</small></span><span className={`provider-profile-state ${status?.configured ? 'ready' : ''}`}>{status?.configured ? 'CONFIGURED' : 'SETUP'}</span></button>;
              })}
            </div>
            <div className="settings-section"><div className="settings-section-heading"><span>{activeProviderMetadata.label.toUpperCase()}</span><span className="settings-tag">SERVER-SIDE ONLY</span></div><p>Set the selected provider values in <code>.env</code> and restart the app. Secrets are not saved to browser storage or sent to Codereo.</p><div className="env-snippet">
              {activeProvider === 'openai-compatible' && <><div><span>AI_PROVIDER</span><code>openai-compatible</code></div><div><span>OPENAI_BASE_URL</span><code>https://api.openai.com/v1</code></div><div><span>OPENAI_MODEL</span><code>gpt-4o-mini</code></div><div><span>OPENAI_API_KEY</span><code>your-key-here</code></div></>}
              {activeProvider === 'anthropic' && <><div><span>AI_PROVIDER</span><code>anthropic</code></div><div><span>ANTHROPIC_BASE_URL</span><code>https://api.anthropic.com/v1</code></div><div><span>ANTHROPIC_MODEL</span><code>claude-sonnet-4-5</code></div><div><span>ANTHROPIC_API_KEY</span><code>your-key-here</code></div></>}
              {activeProvider === 'gemini' && <><div><span>AI_PROVIDER</span><code>gemini</code></div><div><span>GEMINI_BASE_URL</span><code>generativelanguage.googleapis.com/v1beta</code></div><div><span>GEMINI_MODEL</span><code>gemini-2.5-flash</code></div><div><span>GEMINI_API_KEY</span><code>your-key-here</code></div></>}
              {activeProvider === 'ollama' && <><div><span>AI_PROVIDER</span><code>ollama</code></div><div><span>OLLAMA_BASE_URL</span><code>http://127.0.0.1:11434/v1</code></div><div><span>OLLAMA_MODEL</span><code>qwen2.5-coder:7b</code></div></>}
              <button onClick={copyEnvSnippet}><Copy size={13} /> Copy setup snippet</button></div></div>
            <div className="settings-local-note"><ShieldCheck size={15} /><span>{activeProvider === 'ollama' ? 'Ollama uses a local OpenAI-compatible endpoint. In the browser preview, localhost refers to the preview server; use desktop/local development for a model running on your own machine.' : 'Provider credentials are read by the local server only. HTTPS is required for hosted providers; only loopback HTTP endpoints are accepted for local models.'}</span></div>
            <div className="settings-footer"><span><LockKeyholeIcon /> Your key stays on the app server</span><button className="settings-done-button" onClick={() => setSettingsOpen(false)}>Done</button></div>
          </section>
        </div>
      )}

      {toast && <div className="toast-message"><CircleCheck size={15} />{toast}</div>}
    </div>
  );
}

function LockKeyholeIcon() {
  return <ShieldCheck size={13} />;
}

export default App;
