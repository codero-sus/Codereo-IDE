# Codereo IDE

Codereo IDE is an agentic coding workspace owned by `codero-sus`. This IDE is proprietary/closed-source; no open-source license is added here. Its sibling Codereo-sus projects are open source, as confirmed by the owner.

## Agentic coding foundation

This first working slice establishes the browser workspace and desktop shell:

- Dark, responsive IDE layout with file explorer, tabs, syntax-highlighted editor, command palette, status bar, and keyboard shortcuts.
- Local starter workspace persisted in the current browser. The starter HTML/CSS/JavaScript app runs in a sandboxed preview iframe.
- Small read-only browser terminal (`help`, `pwd`, `ls`, `cat`, `clear`). It deliberately does not execute arbitrary shell commands.
- Agent-first **Ask**, **Plan**, and **Agent** modes with OpenAI-compatible, Anthropic, Gemini, and local Ollama provider profiles. Provider keys stay on the server.
- Task approval gates multi-file agent edits. In desktop mode, one approval can authorize the patch plus allowlisted local test/build checks; the agent can make up to two repair passes. Commands outside that allowlist are never auto-run: the desktop can request separate native confirmation for one plain command at a time (no shell operators or quoting), with a 120-second timeout and bounded output. Browser mode never executes host commands.
- **Codereo Mind** adapts owner-authorized capabilities from CORTEX/AGI and MyGPT: specialist profiles with capability gates, opt-in local memory recall, persistent notes/tasks/goals, source-linked Wikipedia research, and chat-history import for ChatGPT/Claude/Telegram/WhatsApp/JSONL/CSV/ZIP. Import parsing uses Python's standard library; imported text is not used for training and is sent to a model only when memory recall is explicitly enabled.
- **Codereo Repo Atlas** builds a local project map from the files already loaded in the workspace: languages, stack manifests, entry points, directory shape, scripts, project guidance, and relative module links. Full-text search finds matching source lines, and assistant context is ranked against the current request instead of taking the first files alphabetically. `.env`, credentials, generated output, and dependencies stay excluded; indexing does not make a network request.
- Python/PySide6 desktop shell that hosts the shared React IDE, exposes a narrow Qt WebChannel bridge for folder open/save and guarded local checks, and keeps workspace file/command permissions in native Python code.

The 400+ advanced-feature direction is captured as 440 scoped items across 22 areas in [ROADMAP.md](ROADMAP.md). It is a multi-phase product direction, not a feature count this initial slice claims to have completed. The current checkout had no application code, so this establishes the foundation to expand from.

## Run in a browser

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

The server binds to `0.0.0.0:4173` by default. Open the address printed in the terminal. Use **Run preview** (or `Ctrl/Cmd + Enter`) to render the current `index.html`, `src/style.css`, and `src/main.js` in an isolated iframe. Browser workspaces stay in browser storage; they are not written to the host filesystem.

## Connect an AI provider

Copy `.env.example` to `.env`, choose `AI_PROVIDER`, and fill in the matching server-side key. Supported profiles are `openai-compatible`, `anthropic`, `gemini`, and `ollama`; the settings panel shows a provider-specific snippet. For example:

```dotenv
AI_PROVIDER=openai-compatible
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your-key-here
```

Restart `npm run dev` after changing the environment. Provider keys are read only by the local server and never put in frontend code or browser storage. Ollama uses a local OpenAI-compatible endpoint such as `http://127.0.0.1:11434/v1` and can run without a key.

## Desktop

The selected desktop UI is **Python 3.11+ with PySide6/Qt WebEngine**. It hosts the same React IDE used in the browser, while native Python owns folder access and command approvals.

```sh
npm install
python -m pip install -r requirements-desktop.txt
npm run desktop
```

`npm run desktop` builds the browser bundle, starts the local Node API on a loopback port, and opens the Python/Qt window. For a hot-reload desktop session, run `npm run desktop:dev`. Use the project selector (or File → Open project folder) to choose a workspace. Text files are loaded and written through a constrained Qt WebChannel bridge; `.env`, credentials, binaries, symlinks, and large/dependency folders are excluded. Provider settings and Mind data live in the OS application-data directory. Out-of-allowlist commands require a native confirmation dialog.

A legacy Electron shell is retained as an optional development fallback with `npm run desktop:electron`. Python/Qt installer packaging is not yet configured; the desktop command currently runs from a source checkout with Node.js available.

## Development checks

```sh
npm test
npm run test:python
npm run build
```

The Node tests cover persistent Mind data, capability filtering, Wikipedia redirect boundaries, the provider/import API, source search/ranking, and Repo Atlas generation. Python tests cover chat-export parsing and desktop workspace/command boundaries.

## Capability sources and scope

The repository owner authorized these open-source companion projects as feature references; Codereo IDE itself remains proprietary and has no open-source license added:

- [`codero-sus/agi`, branch `arena/01a0d380-agi` (`cf814aeb`)](https://github.com/codero-sus/agi/tree/arena/01a0d380-agi) — named, capability-scoped agents; research with linked sources; long-term memory, notes, and goals.
- [`codero-sus/MyGPT`, branch `arena/01a0f6e2-mygpt` (`2a045711`)](https://github.com/codero-sus/MyGPT/tree/arena/01a0f6e2-mygpt) — chat-export parsing, episodic recall, feedback-oriented memory, and local Mind/Growth workflow patterns.

Codereo adapts the useful product capabilities rather than importing either project's model-training runtime. Chat import uses the Python standard-library parser; memory is local and opt-in for provider requests. Wikipedia is the only live research host in this slice. Dynamic skill-code execution, self-modifying skills, and automatic weight training are deliberately not enabled.
