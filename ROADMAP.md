# Codereo IDE — 440-feature direction

Codereo IDE is a proprietary, agent-first coding workspace for browser and desktop. This is a product direction, not a delivery promise or a claim that every item exists today. Items marked **[x]** are in the current foundation; unchecked items are candidates to refine, sequence, or drop with user feedback. Near-term priority is reliable, user-governed edit → test → repair—not maximizing the feature count.

## 01 · Workspaces and projects (20)
- [x] WS-01 — Start with a ready-to-edit browser workspace.
- [x] WS-02 — Open a local project folder in the desktop app.
- [x] WS-03 — Load bounded text files while skipping secrets and generated directories.
- [x] WS-04 — Persist browser workspace edits locally.
- [x] WS-05 — Save approved desktop edits back to the selected folder.
- [ ] WS-06 — Open and manage multiple project roots in one workspace.
- [ ] WS-07 — Switch between recent projects without losing editor state.
- [ ] WS-08 — Pin favorite projects and folders.
- [ ] WS-09 — Search and filter the recent-project list.
- [ ] WS-10 — Create projects from configurable starter templates.
- [ ] WS-11 — Generate framework-aware project scaffolds.
- [ ] WS-12 — Import a project from a local ZIP archive.
- [ ] WS-13 — Export a browser workspace as a ZIP archive.
- [ ] WS-14 — Drag files and folders into the project explorer.
- [ ] WS-15 — Create files and directories from the explorer.
- [ ] WS-16 — Rename and move files with reference-aware updates.
- [ ] WS-17 — Recover deleted files from a workspace recycle area.
- [ ] WS-18 — Save named workspace snapshots and restore them.
- [ ] WS-19 — Configure per-project editor, build, and agent defaults.
- [ ] WS-20 — Provide guided first-run setup for empty and existing projects.

## 02 · Editor and code authoring (20)
- [x] ED-01 — Edit source files in a syntax-highlighted code editor.
- [x] ED-02 — Keep multiple files open as editor tabs.
- [ ] ED-03 — Show unsaved-change state and reliable save controls.
- [ ] ED-04 — Add configurable autosave and save-on-focus-loss.
- [ ] ED-05 — Format a file or selection with the project formatter.
- [ ] ED-06 — Offer language-aware completion and signature help.
- [ ] ED-07 — Support language-server diagnostics and quick fixes.
- [ ] ED-08 — Add semantic symbol and reference highlighting.
- [ ] ED-09 — Provide code folding, bracket matching, and indentation guides.
- [ ] ED-10 — Search and replace within a file with regex and case controls.
- [ ] ED-11 — Perform project-wide find and replace with a review step.
- [ ] ED-12 — Add multi-cursor and column-selection editing.
- [ ] ED-13 — Compare two files or revisions in a side-by-side diff editor.
- [ ] ED-14 — Preview and edit Markdown, JSON, and structured data formats.
- [ ] ED-15 — Support configurable editor themes, fonts, and line spacing.
- [ ] ED-16 — Add sticky scope, breadcrumbs, and current-symbol navigation.
- [ ] ED-17 — Display inline diagnostics with accessible explanations.
- [ ] ED-18 — Recover editor buffers after a crash or reload.
- [ ] ED-19 — Add Vim-style and user-defined keybinding profiles.
- [ ] ED-20 — Provide a distraction-free writing and coding layout.

## 03 · Navigation, search, and commands (20)
- [ ] NV-01 — Open files by fuzzy name search.
- [ ] NV-02 — Jump to symbols across the workspace.
- [ ] NV-03 — Navigate to definitions, declarations, and implementations.
- [ ] NV-04 — Browse references and call hierarchies.
- [ ] NV-05 — Search files with include and exclude globs.
- [x] NV-06 — Search across file contents with context previews.
- [ ] NV-07 — Add a command palette for all IDE actions.
- [ ] NV-08 — Let users create, edit, and reorder keyboard shortcuts.
- [ ] NV-09 — Display recent files, symbols, and navigation history.
- [ ] NV-10 — Support workspace breadcrumbs and folder-scoped navigation.
- [ ] NV-11 — Find TODO, FIXME, and project-defined markers.
- [ ] NV-12 — Search commit messages and Git history.
- [ ] NV-13 — Filter explorer entries by file type and status.
- [ ] NV-14 — Add quick-open filters for symbols, files, and commands.
- [ ] NV-15 — Navigate to errors from build and test output.
- [ ] NV-16 — Link stack traces to source locations.
- [ ] NV-17 — Offer recent-search history with privacy controls.
- [ ] NV-18 — Support saved searches and reusable search scopes.
- [ ] NV-19 — Add project-wide dependency and API symbol search.
- [ ] NV-20 — Make all navigation actions keyboard accessible.

## 04 · Git and change management (20)
- [ ] GT-01 — Show repository status and changed-file indicators.
- [ ] GT-02 — Review line-level working-tree diffs.
- [ ] GT-03 — Stage and unstage selected hunks.
- [ ] GT-04 — Create commits with an editable, agent-suggested message.
- [ ] GT-05 — Browse branches and switch with dirty-worktree checks.
- [ ] GT-06 — Create and delete local branches.
- [ ] GT-07 — Compare branches and commits.
- [ ] GT-08 — Resolve merge conflicts in a guided editor.
- [ ] GT-09 — Review incoming changes before merge or rebase.
- [ ] GT-10 — Display blame and line history.
- [ ] GT-11 — Restore selected files or hunks from a prior revision.
- [ ] GT-12 — Manage stashes with preview and apply controls.
- [ ] GT-13 — Show worktree and submodule status.
- [ ] GT-14 — Detect and explain ignored or untracked files.
- [ ] GT-15 — Require confirmation for destructive Git actions.
- [ ] GT-16 — Keep agent edits isolated in an optional task branch.
- [ ] GT-17 — Create a reviewable patch bundle from an agent task.
- [ ] GT-18 — Sign commits where the local Git configuration supports it.
- [ ] GT-19 — Integrate hosted pull-request review without leaking credentials.
- [ ] GT-20 — Provide a clear recovery path for interrupted Git operations.

## 05 · Build, run, debug, and runtime tools (20)
- [ ] RT-01 — Detect project runtimes and package managers.
- [ ] RT-02 — Show configured build, test, lint, and typecheck tasks.
- [ ] RT-03 — Run approved tasks with bounded logs and execution time.
- [ ] RT-04 — Stream task output with pause, clear, and copy controls.
- [ ] RT-05 — Link compiler and linter messages to source files.
- [ ] RT-06 — Provide configurable launch and debug profiles.
- [ ] RT-07 — Integrate source-level breakpoints and stepping.
- [ ] RT-08 — Inspect variables, watches, and call stacks.
- [ ] RT-09 — Support attach-to-process debugging with explicit consent.
- [ ] RT-10 — Manage multiple local app processes and preview ports.
- [ ] RT-11 — Surface port conflicts and offer safe resolution steps.
- [ ] RT-12 — Add task cancellation and process-tree cleanup.
- [ ] RT-13 — Define project-specific task presets.
- [ ] RT-14 — Support containerized build and debug profiles.
- [ ] RT-15 — Explain missing runtime and dependency prerequisites.
- [ ] RT-16 — Cache safe build metadata for faster project startup.
- [ ] RT-17 — Show resource use for running project processes.
- [ ] RT-18 — Support test filtering and rerunning failed tests.
- [ ] RT-19 — Integrate browser console and network diagnostics.
- [ ] RT-20 — Keep browser-only runtime tools isolated from the host machine.

## 06 · Agent task orchestration (20)
- [x] AG-01 — Accept natural-language coding tasks in an assistant panel.
- [x] AG-02 — Ask the agent for a structured plan and proposed file changes.
- [x] AG-03 — Gate a multi-file patch behind an explicit task approval.
- [x] AG-04 — Apply approved changes to the active workspace.
- [x] AG-05 — Run inferred, allowlisted project checks in desktop mode.
- [x] AG-06 — Give the agent failed-check output for bounded repair passes.
- [x] AG-07 — Limit the current repair loop to two automatic iterations.
- [x] AG-08 — Show a bounded per-file line diff, with omitted-line markers, before approving each patch.
- [ ] AG-09 — Support task plans with editable goals and acceptance criteria.
- [ ] AG-10 — Break large tasks into resumable, independently reviewable steps.
- [ ] AG-11 — Track task state, tool calls, files, and verification evidence.
- [ ] AG-12 — Pause, resume, cancel, and safely retry agent tasks.
- [x] AG-13 — Let users approve a plan while excluding individual file edits from apply and repair passes.
- [ ] AG-14 — Keep agent-generated edits in a separate review buffer.
- [ ] AG-15 — Let agents explain tradeoffs before selecting an implementation.
- [ ] AG-16 — Support read-only investigation before proposing any edit.
- [ ] AG-17 — Add task templates for bug fixes, features, and refactors.
- [ ] AG-18 — Resume a task from a saved checkpoint after app restart.
- [ ] AG-19 — Coordinate specialized agents through a visible orchestrator.
- [ ] AG-20 — Export a task summary with plan, patch, checks, and outcome.

## 07 · Autonomy, approvals, and command safety (20)
- [x] AU-01 — Require user approval before applying an agent patch.
- [x] AU-02 — Restrict automatic desktop checks to a fixed command allowlist.
- [x] AU-03 — Withhold unapproved commands from automatic execution.
- [x] AU-04 — Ask for separate native confirmation before a withheld desktop command.
- [x] AU-05 — Bound confirmed-command runtime and captured output.
- [x] AU-06 — Keep browser mode from executing host commands.
- [ ] AU-07 — Classify proposed tools by read-only, write, network, and destructive risk.
- [ ] AU-08 — Show the exact scope and side effects of every proposed tool call.
- [ ] AU-09 — Add per-action approval, task-level approval, and policy presets.
- [ ] AU-10 — Require a second confirmation for irreversible file or Git actions.
- [ ] AU-11 — Let users define denied paths and protected file patterns.
- [ ] AU-12 — Preview file deletion, moves, and bulk edits before execution.
- [ ] AU-13 — Prevent commands from escaping the selected workspace by default.
- [ ] AU-14 — Offer a disposable sandbox for untrusted build and test scripts.
- [ ] AU-15 — Add network-domain allowlists for agent-requested web access.
- [ ] AU-16 — Ask before installing packages or changing lockfiles.
- [ ] AU-17 — Require confirmation before publishing, deploying, or pushing changes.
- [ ] AU-18 — Provide a global stop control that terminates active agent tools.
- [ ] AU-19 — Record approval decisions in a local, inspectable task log.
- [ ] AU-20 — Add organization policy controls without removing user visibility.

## 08 · Repository understanding and context (20)
- [ ] CX-01 — Build a searchable symbol and dependency index.
- [ ] CX-02 — Map key modules, entry points, and runtime flows.
- [ ] CX-03 — Generate architecture summaries grounded in repository files.
- [ ] CX-04 — Explain unfamiliar code with source-linked evidence.
- [ ] CX-05 — Detect project conventions from existing code and config.
- [ ] CX-06 — Let users pin files and symbols as task context.
- [ ] CX-07 — Show which context the model will receive before sending.
- [ ] CX-08 — Estimate context size and explain truncation.
- [ ] CX-09 — Retrieve relevant code with language-aware ranking.
- [ ] CX-10 — Include related tests and configuration in task context.
- [ ] CX-11 — Respect ignore files and configurable context exclusions.
- [x] CX-12 — Keep secrets, credentials, and generated files out of context.
- [ ] CX-13 — Explain why a file was included in a model request.
- [ ] CX-14 — Refresh indexes incrementally as files change.
- [ ] CX-15 — Support large monorepos with package-level context boundaries.
- [ ] CX-16 — Add dependency-graph and impact-analysis views.
- [ ] CX-17 — Build a project glossary from symbols and documentation.
- [ ] CX-18 — Detect stale documentation related to changed code.
- [x] CX-19 — Support user-supplied, versioned repository guidance files.
- [ ] CX-20 — Let users inspect and clear local retrieval indexes.

## 09 · Code quality, refactoring, and maintenance (20)
- [ ] QR-01 — Explain lint and type errors with a suggested fix.
- [ ] QR-02 — Apply small, reviewable refactors with semantic checks.
- [ ] QR-03 — Rename symbols across references safely.
- [ ] QR-04 — Detect duplicate code and propose shared abstractions.
- [ ] QR-05 — Identify dead code and show evidence before removal.
- [ ] QR-06 — Find likely null, bounds, and resource-lifetime defects.
- [ ] QR-07 — Review error handling and failure-path coverage.
- [ ] QR-08 — Detect risky dependency and API usage patterns.
- [ ] QR-09 — Suggest type improvements without broad unrelated rewrites.
- [ ] QR-10 — Explain complexity and maintainability hotspots.
- [ ] QR-11 — Generate focused documentation comments on request.
- [ ] QR-12 — Update docs and examples alongside approved code changes.
- [ ] QR-13 — Modernize deprecated APIs with migration previews.
- [ ] QR-14 — Detect accessibility issues in UI source code.
- [ ] QR-15 — Identify performance hotspots and propose measurements.
- [ ] QR-16 — Offer framework-aware migration playbooks.
- [ ] QR-17 — Create codemods with preview, dry run, and rollback.
- [ ] QR-18 — Suggest smaller changes when a task scope expands.
- [ ] QR-19 — Compare alternative implementations with tradeoff notes.
- [ ] QR-20 — Track code health trends without grading individual developers.

## 10 · Tests, verification, and evidence (20)
- [x] TV-01 — Infer common project checks from package and language metadata.
- [x] TV-02 — Run approved checks sequentially with a timeout and output cap.
- [x] TV-03 — Show check outcomes and captured output in the task thread.
- [ ] TV-04 — Discover test frameworks and explain how test selection works.
- [ ] TV-05 — Generate focused regression tests for an approved bug fix.
- [ ] TV-06 — Map changed lines to relevant existing tests.
- [ ] TV-07 — Rerun only affected tests when confidence is high.
- [ ] TV-08 — Let users select checks before approving a task.
- [ ] TV-09 — Add test coverage deltas for changed code.
- [ ] TV-10 — Detect flaky tests and separate them from deterministic failures.
- [ ] TV-11 — Compare test output before and after an agent patch.
- [ ] TV-12 — Require user review when no relevant checks can be inferred.
- [ ] TV-13 — Validate generated code with format, lint, type, and test layers.
- [ ] TV-14 — Attach reproducible environment details to verification results.
- [ ] TV-15 — Preserve logs and test evidence with local task snapshots.
- [ ] TV-16 — Support test matrices across runtimes and operating systems.
- [ ] TV-17 — Integrate browser end-to-end tests with isolated test data.
- [ ] TV-18 — Run security and dependency checks only with clear consent.
- [ ] TV-19 — Explain confidence limits when checks are incomplete.
- [ ] TV-20 — Prevent a green status from implying checks that never ran.

## 11 · Providers, models, and inference controls (20)
- [x] MP-01 — Choose the active provider in Settings.
- [x] MP-02 — Support OpenAI-compatible API endpoints.
- [x] MP-03 — Support Anthropic Messages API.
- [x] MP-04 — Support Google Gemini API.
- [x] MP-05 — Support an Ollama-compatible local endpoint.
- [x] MP-06 — Keep provider secrets on the server side, not in browser requests.
- [ ] MP-07 — Add per-task model selection and capability hints.
- [ ] MP-08 — Support multiple named profiles per provider.
- [ ] MP-09 — Test provider connectivity without sending workspace content.
- [ ] MP-10 — Show rate limits, quota errors, and retry guidance.
- [ ] MP-11 — Add user-controlled timeout and retry policies.
- [ ] MP-12 — Route tasks by model capability, cost, and privacy preference.
- [ ] MP-13 — Allow local-first routing with an explicit cloud fallback gate.
- [ ] MP-14 — Add request and token-cost estimates before submission.
- [ ] MP-15 — Offer context and output budgets per task.
- [ ] MP-16 — Support compatible structured-output and tool-call formats.
- [ ] MP-17 — Add provider-specific reasoning and sampling controls.
- [ ] MP-18 — Add model aliases and project-level defaults.
- [ ] MP-19 — Make provider failover visible and user-configurable.
- [ ] MP-20 — Provide a clear data-flow summary for each provider profile.

## 12 · Integrations and tool protocols (20)
- [ ] IN-01 — Add a documented, permissioned tool-adapter interface.
- [ ] IN-02 — Support Model Context Protocol servers with per-tool consent.
- [ ] IN-03 — Add issue-tracker context through user-authorized connectors.
- [ ] IN-04 — Link tasks to pull requests and review discussions.
- [ ] IN-05 — Integrate documentation search with source citations.
- [ ] IN-06 — Offer a browser search tool behind explicit network policy.
- [ ] IN-07 — Add a database explorer with read-only defaults.
- [ ] IN-08 — Support API clients with redacted credential handling.
- [ ] IN-09 — Integrate container and dev-environment tooling.
- [ ] IN-10 — Connect to user-selected observability traces and logs.
- [ ] IN-11 — Support design handoff references without copying private assets.
- [ ] IN-12 — Provide webhook and event adapters for local workflows.
- [ ] IN-13 — Add project-specific tool manifests with signed provenance.
- [ ] IN-14 — Display every connected service and granted permission.
- [ ] IN-15 — Let users revoke integration tokens and sessions.
- [ ] IN-16 — Sandbox third-party tools from workspace credentials.
- [ ] IN-17 — Offer import adapters for authorized companion-project features.
- [ ] IN-18 — Keep integrations optional and disabled until configured.
- [ ] IN-19 — Version integration APIs and report compatibility clearly.
- [ ] IN-20 — Add a connector test mode that avoids modifying external data.

## 13 · Browser IDE and live preview (20)
- [x] WB-01 — Serve the IDE as a browser app with a live preview.
- [x] WB-02 — Keep browser terminal commands read-only.
- [ ] WB-03 — Add isolated per-workspace browser storage controls.
- [ ] WB-04 — Provide a browser-safe virtual filesystem abstraction.
- [ ] WB-05 — Support browser-based project import and export.
- [ ] WB-06 — Add preview device sizes and responsive breakpoints.
- [ ] WB-07 — Inspect preview console errors next to source locations.
- [ ] WB-08 — Capture preview screenshots for task reviews.
- [ ] WB-09 — Support multiple preview routes and browser tabs.
- [ ] WB-10 — Add network request inspection with sensitive-value redaction.
- [ ] WB-11 — Refresh previews incrementally when relevant files change.
- [ ] WB-12 — Show preview build status and last successful build.
- [ ] WB-13 — Offer safe starter sandboxes for common UI frameworks.
- [ ] WB-14 — Support service-worker and offline-preview diagnostics.
- [ ] WB-15 — Add browser-only collaboration without host filesystem access.
- [ ] WB-16 — Communicate storage limits and browser persistence behavior.
- [ ] WB-17 — Keep preview content isolated from the IDE application origin.
- [ ] WB-18 — Add keyboard and screen-reader workflows for preview controls.
- [ ] WB-19 — Support custom preview port forwarding through a trusted proxy.
- [ ] WB-20 — Provide a one-click reset for disposable browser workspaces.

## 14 · Desktop app and native workflow (20)
- [x] DT-01 — Package a desktop application with a context-isolated preload bridge.
- [x] DT-02 — Open a local project folder and safely write approved text edits.
- [x] DT-03 — Keep host command execution behind desktop IPC handlers.
- [x] DT-04 — Show a native confirmation before a withheld command runs.
- [ ] DT-05 — Add signed installers and a secure update channel.
- [ ] DT-06 — Support multiple native windows and detachable panels.
- [ ] DT-07 — Add system tray and background task controls.
- [ ] DT-08 — Restore window layout and workspace tabs after restart.
- [ ] DT-09 — Support native file watchers with debounce and ignore rules.
- [ ] DT-10 — Integrate OS keychain storage for provider credentials.
- [ ] DT-11 — Add configurable native notifications for task completion.
- [ ] DT-12 — Support system proxy and certificate configuration.
- [ ] DT-13 — Add safe file and folder reveal actions.
- [ ] DT-14 — Support platform accessibility APIs and high-contrast modes.
- [ ] DT-15 — Add crash recovery and unsaved-buffer restoration.
- [ ] DT-16 — Provide a sandboxed shell profile as a separate opt-in capability.
- [ ] DT-17 — Document and test macOS, Windows, and Linux packaging.
- [ ] DT-18 — Add native app diagnostics with secret redaction.
- [ ] DT-19 — Support custom workspace roots with clear trust boundaries.
- [ ] DT-20 — Provide an uninstall and local-data removal workflow.

## 15 · Collaboration and review (20)
- [ ] CO-01 — Share a read-only task summary with teammates.
- [ ] CO-02 — Review and comment on proposed agent diffs.
- [ ] CO-03 — Attribute agent-authored changes in the task record.
- [ ] CO-04 — Add optional pair-programming presence indicators.
- [ ] CO-05 — Collaborate on a workspace with explicit edit ownership.
- [ ] CO-06 — Support review requests and approval workflows.
- [ ] CO-07 — Resolve concurrent edits with understandable conflict views.
- [ ] CO-08 — Share reproducible test outcomes without sharing secrets.
- [ ] CO-09 — Create team task templates and coding conventions.
- [ ] CO-10 — Add ephemeral review links with revocation and expiry.
- [ ] CO-11 — Support comments anchored to lines and symbols.
- [ ] CO-12 — Compare reviewer feedback against the original task plan.
- [ ] CO-13 — Keep private drafts separate from shared project history.
- [ ] CO-14 — Add optional team agent profiles with visible policy boundaries.
- [ ] CO-15 — Notify reviewers when a requested change is ready.
- [ ] CO-16 — Export a human-readable review bundle for offline review.
- [ ] CO-17 — Track requested changes and resolution evidence.
- [ ] CO-18 — Add team presence without exposing editor contents by default.
- [ ] CO-19 — Integrate approved code-review services through user-owned accounts.
- [ ] CO-20 — Make collaboration features opt-in and auditable.

## 16 · Security, privacy, and trust (20)
- [x] SP-01 — Keep API keys out of frontend code and health responses.
- [x] SP-02 — Filter unsafe paths and common secret-file patterns from agent edits.
- [x] SP-03 — Bound request bodies, project file counts, and file sizes.
- [ ] SP-04 — Add a threat model for browser, desktop, server, and provider boundaries.
- [ ] SP-05 — Redact secrets from logs, prompts, and diagnostic bundles.
- [ ] SP-06 — Show exact files and content sent to a remote provider.
- [ ] SP-07 — Add configurable local-only and no-retention provider modes.
- [ ] SP-08 — Scan workspace context for accidental credentials before upload.
- [ ] SP-09 — Offer a secret manager integration without plaintext settings files.
- [ ] SP-10 — Enforce content-security policy and trusted-origin rules.
- [ ] SP-11 — Add dependency and supply-chain review for release artifacts.
- [ ] SP-12 — Sign update manifests and verify downloaded installers.
- [ ] SP-13 — Protect workspace writes against symlinks and path traversal.
- [ ] SP-14 — Add optional per-project trust prompts before enabling tools.
- [ ] SP-15 — Provide data export, deletion, and retention controls.
- [ ] SP-16 — Add privacy-preserving error reports with user preview.
- [ ] SP-17 — Document local data locations and credential storage.
- [ ] SP-18 — Support vulnerability disclosure and security response procedures.
- [ ] SP-19 — Audit permission changes and external data transfers.
- [ ] SP-20 — Publish a security posture summary for each release.

## 17 · Interface, accessibility, and usability (20)
- [x] UX-01 — Use a dark, developer-tool interface as the default visual direction.
- [x] UX-02 — Provide a responsive workspace with explorer, editor, preview, and assistant areas.
- [ ] UX-03 — Add light, dim, and high-contrast theme options.
- [ ] UX-04 — Meet WCAG-oriented keyboard and screen-reader expectations.
- [ ] UX-05 — Add configurable panel layouts and saved arrangements.
- [ ] UX-06 — Improve small-screen and tablet workflows.
- [ ] UX-07 — Support reduced motion and text scaling preferences.
- [ ] UX-08 — Use clear loading, empty, error, and recovery states.
- [ ] UX-09 — Explain provider setup and failures in plain language.
- [ ] UX-10 — Add contextual onboarding that can be skipped or replayed.
- [ ] UX-11 — Provide accessible focus, selection, and contrast indicators.
- [ ] UX-12 — Offer user-adjustable density and information hierarchy.
- [ ] UX-13 — Keep destructive controls visually distinct and deliberate.
- [ ] UX-14 — Add internationalization and locale-aware formatting.
- [ ] UX-15 — Support right-to-left layouts where appropriate.
- [ ] UX-16 — Make status indicators explain what they do and do not verify.
- [ ] UX-17 — Improve discoverability without modal overload.
- [ ] UX-18 — Provide actionable help and shortcuts in context.
- [ ] UX-19 — Run usability testing with new and experienced developers.
- [ ] UX-20 — Track accessibility regressions in release checks.

## 18 · Extensibility and customization (20)
- [ ] EX-01 — Define a stable extension API with explicit permissions.
- [ ] EX-02 — Add a curated extension catalog with provenance checks.
- [ ] EX-03 — Support user-installed themes and icon packs.
- [ ] EX-04 — Let extensions contribute commands and editor actions.
- [ ] EX-05 — Add language and formatter adapters.
- [ ] EX-06 — Support custom task runners with approval policies.
- [ ] EX-07 — Add project templates maintained by trusted publishers.
- [ ] EX-08 — Provide extension sandboxing and resource limits.
- [ ] EX-09 — Show extension permissions before installation and use.
- [ ] EX-10 — Offer per-workspace extension enablement.
- [ ] EX-11 — Allow local private extensions for internal teams.
- [ ] EX-12 — Version extension APIs and provide compatibility checks.
- [ ] EX-13 — Add extension signing and update verification.
- [ ] EX-14 — Provide starter kits and test harnesses for extension authors.
- [ ] EX-15 — Keep extensions from reading secrets without consent.
- [ ] EX-16 — Let users disable or remove an extension cleanly.
- [ ] EX-17 — Support custom provider adapters through a documented interface.
- [ ] EX-18 — Allow custom agent roles with visible tool policies.
- [ ] EX-19 — Add extension health and crash diagnostics.
- [ ] EX-20 — Maintain a compatibility matrix for supported extensions.

## 19 · Remote development and cloud workspaces (20)
- [ ] CL-01 — Connect to a user-managed SSH workspace.
- [ ] CL-02 — Support dev containers with explicit volume and port review.
- [ ] CL-03 — Add remote file browsing with bounded transfer controls.
- [ ] CL-04 — Run approved checks in a remote workspace.
- [ ] CL-05 — Support reconnect and recovery after network interruption.
- [ ] CL-06 — Add remote environment profiles without storing passwords in projects.
- [ ] CL-07 — Show where code and model inference are running.
- [ ] CL-08 — Support cloud workspace snapshots and expiry controls.
- [ ] CL-09 — Provide ephemeral sandboxes for untrusted repositories.
- [ ] CL-10 — Offer remote preview tunnels with access protection.
- [ ] CL-11 — Add resource budgets and shutdown timers for cloud environments.
- [ ] CL-12 — Support self-hosted workspace backends.
- [ ] CL-13 — Encrypt remote workspace traffic and stored snapshots.
- [ ] CL-14 — Keep secrets out of remote agent context by default.
- [ ] CL-15 — Add region and residency choices where supported.
- [ ] CL-16 — Provide remote environment logs and diagnostics.
- [ ] CL-17 — Support offline editing with safe synchronization.
- [ ] CL-18 — Detect and explain local/remote file divergence.
- [ ] CL-19 — Add team-managed workspace images and setup scripts.
- [ ] CL-20 — Make cloud use optional; preserve a local desktop path.

## 20 · Preferences, data, and workflow settings (20)
- [ ] DS-01 — Centralize user and workspace preferences with clear scope.
- [ ] DS-02 — Validate settings and explain invalid values inline.
- [ ] DS-03 — Export and import non-secret preferences.
- [ ] DS-04 — Keep provider secrets in a dedicated secure store.
- [ ] DS-05 — Add per-project model and approval defaults.
- [ ] DS-06 — Configure task timeout and repair-pass limits.
- [ ] DS-07 — Manage ignored files and context exclusions in the UI.
- [ ] DS-08 — Control local history, snapshots, and retention.
- [ ] DS-09 — Add keyboard shortcut and command customization screens.
- [ ] DS-10 — Provide notification and sound preferences.
- [ ] DS-11 — Configure preview and terminal panel behavior.
- [ ] DS-12 — Set editor formatting and language defaults.
- [ ] DS-13 — Add proxy, certificate, and network preferences.
- [ ] DS-14 — Import/export settings bundles with secret scrubbing.
- [ ] DS-15 — Restore safe defaults without deleting workspace files.
- [ ] DS-16 — Show storage usage and cleanup opportunities.
- [ ] DS-17 — Keep a local change history for settings.
- [ ] DS-18 — Add data portability for tasks and review records.
- [ ] DS-19 — Provide a privacy dashboard for model and tool activity.
- [ ] DS-20 — Support documented environment-variable overrides.

## 21 · Team and enterprise administration (20)
- [ ] EN-01 — Add organization-managed provider profiles.
- [ ] EN-02 — Support single sign-on through supported identity providers.
- [ ] EN-03 — Define team roles for settings, policies, and integrations.
- [ ] EN-04 — Publish enforceable agent approval policies.
- [ ] EN-05 — Manage approved model and endpoint catalogs.
- [ ] EN-06 — Offer self-hosted inference and gateway configurations.
- [ ] EN-07 — Add license and seat administration for commercial deployments.
- [ ] EN-08 — Provide audit exports for administrative events.
- [ ] EN-09 — Support deployment rings and staged updates.
- [ ] EN-10 — Add policy exceptions with expiry and recorded rationale.
- [ ] EN-11 — Integrate enterprise secret managers.
- [ ] EN-12 — Support managed certificates and private network routing.
- [ ] EN-13 — Provide data retention and residency controls.
- [ ] EN-14 — Add organization-level extension allowlists.
- [ ] EN-15 — Offer fleet diagnostics with opt-in and redaction.
- [ ] EN-16 — Support team templates and centrally maintained guidance.
- [ ] EN-17 — Provide procurement and compliance documentation.
- [ ] EN-18 — Add accessibility and security review artifacts for buyers.
- [ ] EN-19 — Define support and incident escalation workflows.
- [ ] EN-20 — Keep administrator controls transparent to end users.

## 22 · Documentation, learning, release, and operations (20)
- [x] OP-01 — Document browser and desktop setup in the project README.
- [x] OP-02 — Document provider environment variables and the agent validation loop.
- [ ] OP-03 — Maintain a user guide with task and safety examples.
- [ ] OP-04 — Add a searchable help center and in-app troubleshooting.
- [ ] OP-05 — Publish provider compatibility and tested-model notes.
- [ ] OP-06 — Maintain a feature-status page distinguishing shipped from planned.
- [ ] OP-07 — Add release notes with migration and security details.
- [ ] OP-08 — Automate build, unit, integration, and packaging checks.
- [ ] OP-09 — Add end-to-end tests for browser and desktop task flows.
- [ ] OP-10 — Test provider adapters with local contract-test fixtures.
- [ ] OP-11 — Test command and filesystem boundaries on every platform.
- [ ] OP-12 — Create reproducible installer and update pipelines.
- [ ] OP-13 — Monitor crashes and service health with privacy controls.
- [ ] OP-14 — Add performance budgets for startup, indexing, and editor response.
- [ ] OP-15 — Publish a roadmap review cadence and decision log.
- [ ] OP-16 — Offer interactive tutorials for editor and agent workflows.
- [ ] OP-17 — Add sample projects covering supported languages and frameworks.
- [ ] OP-18 — Provide migration guides from common IDE workflows.
- [ ] OP-19 — Establish support, feedback, and responsible-disclosure channels.
- [ ] OP-20 — Collect product feedback without telemetry by default.

## Suggested sequencing

1. **Reliability and safety:** automated tests for provider adapters, file writes, task approvals, command gates, and desktop packaging.
2. **Agent review quality:** patch diffs, selectable checks, checkpoints, stronger context transparency, and cancellation.
3. **Daily coding loop:** editor navigation, Git review, language services, debugging, and project-aware test selection.
4. **Scale deliberately:** integrations, collaboration, extensions, remote development, and team administration after trust and security controls mature.

The 440 items are intentionally broad. Prioritize from user research and measurable reliability; do not ship a feature merely to satisfy a count.
