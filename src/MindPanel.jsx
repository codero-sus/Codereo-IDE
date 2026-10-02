import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, BrainCircuit, Check, Circle, Download, FileUp, LoaderCircle, Plus, Search, Sparkles, Trash2, Users, X } from 'lucide-react';

const CAPABILITIES = [
  ['read-workspace', 'Read project context'],
  ['use-memory', 'Use saved memory'],
  ['explain', 'Explain code'],
  ['plan', 'Plan work'],
  ['propose-edits', 'Propose edits'],
  ['request-validation', 'Request safe checks'],
];
const EMPTY_STATE = { memoryCount: 0, memories: [], notes: [], tasks: [], goals: [], agents: [] };

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

function formatDate(value) {
  if (!value) return 'Just now';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function MindPanel({ selectedAgentId, onSelectAgent, memoryEnabled, onMemoryToggle, onStateChange }) {
  const [state, setState] = useState(EMPTY_STATE);
  const [tab, setTab] = useState('memory');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [memoryQuery, setMemoryQuery] = useState('');
  const [memoryResults, setMemoryResults] = useState([]);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryText, setMemoryText] = useState('');
  const [taskText, setTaskText] = useState('');
  const [goalText, setGoalText] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentMission, setAgentMission] = useState('');
  const [agentCapabilities, setAgentCapabilities] = useState(['read-workspace', 'plan']);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchResults, setResearchResults] = useState([]);
  const selectedProfile = state.agents.find((agent) => agent.id === selectedAgentId);
  const profileCanUseMemory = selectedProfile ? selectedProfile.capabilities.includes('use-memory') : selectedAgentId === 'operator';

  const reload = useCallback(async () => {
    const next = await requestJson('/api/mind/state');
    setState(next);
    onStateChange?.(next);
    return next;
  }, [onStateChange]);

  useEffect(() => { reload().catch((cause) => setError(cause.message)); }, [reload]);

  const mutate = async (url, method, body) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await requestJson(url, {
        method,
        headers: body instanceof ArrayBuffer ? { 'Content-Type': 'application/octet-stream' } : { 'Content-Type': 'application/json' },
        body: body instanceof ArrayBuffer ? body : body === undefined ? undefined : JSON.stringify(body),
      });
      if (result.state) {
        setState(result.state);
        onStateChange?.(result.state);
      } else if (result.agents) {
        await reload();
      } else {
        await reload();
      }
      return result;
    } catch (cause) {
      setError(cause.message || 'Mind service unavailable.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const searchMemories = async (event) => {
    event?.preventDefault();
    if (!memoryQuery.trim()) { setMemoryResults([]); return; }
    setBusy(true);
    setError('');
    try {
      const result = await requestJson(`/api/mind/memories?q=${encodeURIComponent(memoryQuery)}`);
      setMemoryResults(result.results || []);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };

  const saveMemory = async (event) => {
    event.preventDefault();
    const result = await mutate('/api/mind/memories', 'POST', { title: memoryTitle, content: memoryText, source: 'user' });
    if (result) { setMemoryTitle(''); setMemoryText(''); setNotice('Saved locally. Recall stays off until you enable it.'); }
  };

  const importHistory = async () => {
    if (!importFile) return;
    setBusy(true);
    setError('');
    setNotice('');
    setImportResult(null);
    try {
      const url = `/api/mind/import?filename=${encodeURIComponent(importFile.name)}`;
      const result = await requestJson(url, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: await importFile.arrayBuffer() });
      setImportResult(result);
      setNotice(`Imported ${result.imported} turns from ${result.threads} conversation(s).`);
      await reload();
    } catch (cause) { setError(cause.message || 'Could not import this chat export.'); }
    finally { setBusy(false); }
  };

  const runResearch = async (event) => {
    event.preventDefault();
    if (!researchQuery.trim()) return;
    setBusy(true);
    setError('');
    setResearchResults([]);
    try {
      const result = await requestJson('/api/mind/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: researchQuery }) });
      setResearchResults(result.sources || []);
      if (!result.sources?.length) setNotice('No source summaries found.');
    } catch (cause) { setError(cause.message || 'Research failed.'); }
    finally { setBusy(false); }
  };

  const tabs = useMemo(() => [
    { id: 'memory', label: 'Memory', icon: BrainCircuit, count: state.memoryCount },
    { id: 'agents', label: 'Agents', icon: Users, count: state.agents.length },
    { id: 'desk', label: 'Desk', icon: BookOpen, count: state.tasks.filter((task) => !task.done).length },
    { id: 'research', label: 'Research', icon: Search },
    { id: 'import', label: 'Import', icon: FileUp },
  ], [state]);

  return (
    <section className="mind-panel">
      <div className="panel-title-row mind-title-row"><span><BrainCircuit size={13} /> CODEREO MIND</span><span className="mind-local-label">LOCAL</span></div>
      <div className="mind-tab-strip" role="tablist" aria-label="Codereo Mind">
        {tabs.map(({ id, label, icon: Icon, count }) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setError(''); }} title={label}><Icon size={13} /><span>{label}</span>{Number.isFinite(count) && <small>{count}</small>}</button>)}
      </div>

      {error && <div className="mind-message mind-error"><AlertCircle size={13} />{error}</div>}
      {notice && !error && <div className="mind-message"><Check size={13} />{notice}</div>}

      {tab === 'memory' && <div className="mind-section">
        <label className="mind-toggle-row"><span><strong>Recall from memory</strong><small>{profileCanUseMemory ? 'Relevant saved/imported excerpts may be sent with assistant requests.' : 'This specialist profile is not allowed to read saved memory.'}</small></span><input type="checkbox" checked={memoryEnabled} disabled={!profileCanUseMemory} onChange={(event) => onMemoryToggle(event.target.checked)} /></label>
        <form className="mind-search-form" onSubmit={searchMemories}><input value={memoryQuery} onChange={(event) => setMemoryQuery(event.target.value)} placeholder="Search saved context" /><button type="submit" disabled={busy || !memoryQuery.trim()} title="Search memory"><Search size={14} /></button></form>
        {memoryResults.length > 0 && <div className="mind-list-label">SEARCH RESULTS</div>}
        {memoryResults.map((memory) => <article className="mind-memory-card" key={`search-${memory.id}`}><div><strong>{memory.title}</strong><button onClick={() => mutate(`/api/mind/memories/${memory.id}`, 'DELETE')} title="Forget this memory"><Trash2 size={12} /></button></div><p>{memory.content}</p><small>{memory.source} · {formatDate(memory.created)}</small></article>)}
        {!memoryResults.length && <div className="mind-list-label">RECENT · {state.memoryCount} STORED</div>}
        {!memoryResults.length && state.memories.slice(0, 6).map((memory) => <article className="mind-memory-card" key={memory.id}><div><strong>{memory.title}</strong><button onClick={() => mutate(`/api/mind/memories/${memory.id}`, 'DELETE')} title="Forget this memory"><Trash2 size={12} /></button></div><p>{memory.content}</p><small>{memory.source} · {formatDate(memory.created)}</small></article>)}
        <form className="mind-create-form" onSubmit={saveMemory}><div className="mind-form-title">ADD A MEMORY</div><input value={memoryTitle} onChange={(event) => setMemoryTitle(event.target.value)} placeholder="Short title (optional)" /><textarea value={memoryText} onChange={(event) => setMemoryText(event.target.value)} placeholder="A project fact, decision, or preference to remember" rows={3} /><button disabled={busy || memoryText.trim().length < 3}><Plus size={13} /> Save locally</button></form>
        <p className="mind-privacy-note">Memory is stored locally by this Codereo server. Nothing is added to model context unless recall is enabled above.</p>
      </div>}

      {tab === 'agents' && <div className="mind-section">
        <div className="mind-intro"><Sparkles size={14} /><span>Specialist profiles shape planning and review. They do not bypass patch or command approvals.</span></div>
        {state.agents.map((agent) => <article className={`mind-agent-card ${selectedAgentId === agent.id ? 'selected' : ''}`} key={agent.id}><div className="mind-agent-card-head"><div><strong>{agent.name}</strong><small>{agent.capabilities.length} allowed focus areas</small></div><button className={selectedAgentId === agent.id ? 'selected' : ''} onClick={() => onSelectAgent(agent.id)}>{selectedAgentId === agent.id ? <><Check size={12} /> Active</> : 'Use agent'}</button></div><p>{agent.mission}</p><div className="mind-chip-row">{agent.capabilities.map((capability) => <span key={capability}>{capability.replaceAll('-', ' ')}</span>)}</div></article>)}
        <form className="mind-create-form" onSubmit={async (event) => { event.preventDefault(); const result = await mutate('/api/mind/agents', 'POST', { name: agentName, mission: agentMission, capabilities: agentCapabilities }); if (result?.agent) { setAgentName(''); setAgentMission(''); onSelectAgent(result.agent.id); setNotice('Specialist saved locally.'); } }}><div className="mind-form-title">CREATE SPECIALIST</div><input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Name" /><textarea value={agentMission} onChange={(event) => setAgentMission(event.target.value)} placeholder="Mission — e.g. find regressions and propose focused tests" rows={2} /><div className="mind-capability-list">{CAPABILITIES.map(([id, label]) => <label key={id}><input type="checkbox" checked={agentCapabilities.includes(id)} onChange={(event) => setAgentCapabilities((current) => event.target.checked ? [...current, id] : current.filter((item) => item !== id))} /><span>{label}</span></label>)}</div><button disabled={busy || !agentName.trim() || !agentMission.trim()}><Plus size={13} /> Save specialist</button></form>
      </div>}

      {tab === 'desk' && <div className="mind-section">
        <form className="mind-inline-form" onSubmit={async (event) => { event.preventDefault(); const result = await mutate('/api/mind/tasks', 'POST', { title: taskText, source: 'user' }); if (result) setTaskText(''); }}><input value={taskText} onChange={(event) => setTaskText(event.target.value)} placeholder="Add a project task" /><button disabled={busy || taskText.trim().length < 2}><Plus size={14} /></button></form>
        <div className="mind-list-label">TASKS · {state.tasks.filter((task) => !task.done).length} OPEN</div>
        {state.tasks.map((task) => <div className={`mind-task-row ${task.done ? 'done' : ''}`} key={task.id}><button className="mind-task-check" onClick={() => mutate(`/api/mind/tasks/${task.id}`, 'PATCH', { done: !task.done })} title={task.done ? 'Reopen task' : 'Complete task'}>{task.done ? <Check size={12} /> : <Circle size={12} />}</button><span>{task.title}</span><button className="mind-delete-button" onClick={() => mutate(`/api/mind/tasks/${task.id}`, 'DELETE')} title="Delete task"><X size={12} /></button></div>)}
        <form className="mind-create-form" onSubmit={async (event) => { event.preventDefault(); const result = await mutate('/api/mind/goals', 'POST', { title: goalText, why: 'User-defined goal' }); if (result) setGoalText(''); }}><div className="mind-form-title">GOALS</div><div className="mind-goal-list">{state.goals.map((goal) => <div className="mind-goal-row" key={goal.id}><div><strong>{goal.title}</strong><small>{goal.why}</small></div><input aria-label={`Progress for ${goal.title}`} type="range" min="0" max="100" step="25" value={Math.round((goal.progress || 0) * 100)} onChange={(event) => mutate(`/api/mind/goals/${goal.id}`, 'PATCH', { progress: Number(event.target.value) / 100 })} /></div>)}</div><div className="mind-inline-form"><input value={goalText} onChange={(event) => setGoalText(event.target.value)} placeholder="Add a goal" /><button type="button" disabled={busy || goalText.trim().length < 2} onClick={async () => { const result = await mutate('/api/mind/goals', 'POST', { title: goalText, why: 'User-defined goal' }); if (result) setGoalText(''); }}><Plus size={14} /></button></div></form>
        <form className="mind-create-form" onSubmit={async (event) => { event.preventDefault(); const result = await mutate('/api/mind/notes', 'POST', { title: noteTitle, content: noteText }); if (result) { setNoteTitle(''); setNoteText(''); } }}><div className="mind-form-title">NOTES</div><input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Note title" /><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Keep a local project note" rows={2} /><button disabled={busy || !noteTitle.trim() || !noteText.trim()}><Plus size={13} /> Save note</button>{state.notes.slice(0, 5).map((note) => <div className="mind-note-row" key={note.id}><div><strong>{note.title}</strong><small>{note.content}</small></div><button type="button" onClick={() => mutate(`/api/mind/notes/${note.id}`, 'DELETE')} title="Delete note"><Trash2 size={12} /></button></div>)}</form>
      </div>}

      {tab === 'research' && <div className="mind-section">
        <div className="mind-intro"><Search size={14} /><span>Source-grounded quick research via Wikipedia. No arbitrary URLs or private network requests.</span></div>
        <form className="mind-search-form" onSubmit={runResearch}><input value={researchQuery} onChange={(event) => setResearchQuery(event.target.value)} placeholder="Research a topic" /><button type="submit" disabled={busy || researchQuery.trim().length < 2}><Search size={14} /></button></form>
        {researchResults.map((source) => <article className="mind-research-card" key={source.url}><div><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><button onClick={() => mutate('/api/mind/memories', 'POST', { title: source.title, content: source.extract, source: 'research' })} title="Save source excerpt to local memory"><Download size={12} /></button></div>{source.description && <small>{source.description}</small>}<p>{source.extract}</p></article>)}
        {!researchResults.length && <div className="mind-empty-state">Research returns short article summaries with source links. Save anything useful to Mind memory.</div>}
      </div>}

      {tab === 'import' && <div className="mind-section">
        <div className="mind-intro"><FileUp size={14} /><span>Import a personal chat export as searchable local episodes. Import does not train a model.</span></div>
        <label className="mind-file-picker"><input type="file" accept=".json,.jsonl,.csv,.txt,.md,.zip,application/json,text/plain,text/csv,application/zip" onChange={(event) => { setImportFile(event.target.files?.[0] || null); setImportResult(null); }} /><FileUp size={16} /><strong>{importFile?.name || 'Choose a chat export'}</strong><small>ChatGPT · Claude · Telegram · WhatsApp · JSONL · CSV · ZIP · 25 MB max</small></label>
        <button className="mind-primary-button" disabled={busy || !importFile} onClick={importHistory}>{busy ? <LoaderCircle className="spin" size={13} /> : <FileUp size={13} />} Import to local memory</button>
        {importResult && <div className="mind-import-result"><Check size={13} /><span>{importResult.imported} turns · {importResult.threads} threads · {importResult.skipped} skipped</span></div>}
        <div className="mind-privacy-note">Imported text stays in the local Codereo data folder. It reaches an AI provider only when you turn on <strong>Recall from memory</strong> and send a request.</div>
      </div>}

      {busy && <div className="mind-busy-indicator"><LoaderCircle size={12} className="spin" /> Working…</div>}
    </section>
  );
}
