from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from PySide6.QtCore import QObject, QRunnable, QStandardPaths, QThreadPool, QUrl, Signal, Slot
from PySide6.QtGui import QAction, QCloseEvent, QDesktopServices
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineCore import QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QApplication, QFileDialog, QMainWindow, QMessageBox, QToolBar
from local_capabilities import confirmed_environment, delete_workspace_files, load_workspace, normalize_confirmed_command, normalize_validation_command, project_root, run_command, save_workspace, validation_environment



class _JobSignals(QObject):
    finished = Signal(str, str)


class _CommandJob(QRunnable):
    def __init__(self, job_id: str, root: Path, commands: list[str], confirmed: bool = False) -> None:
        super().__init__()
        self.job_id = job_id
        self.root = root
        self.commands = commands
        self.confirmed = confirmed
        self.signals = _JobSignals()

    def run(self) -> None:
        env = confirmed_environment() if self.confirmed else validation_environment()
        results = [run_command(self.root, command, env) for command in self.commands]
        payload = {'ok': all(result['exitCode'] == 0 and not result['timedOut'] for result in results), 'results': results}
        if self.confirmed:
            payload = results[0] | {'ok': results[0]['exitCode'] == 0 and not results[0]['timedOut']}
        self.signals.finished.emit(self.job_id, json.dumps(payload, ensure_ascii=False))


class DesktopBridge(QObject):
    commandFinished = Signal(str, str)

    def __init__(self, window: 'IDEWindow') -> None:
        super().__init__(window)
        self.window = window
        self.jobs: dict[str, _CommandJob] = {}
        self.job_skipped: dict[str, int] = {}
        self.pool = QThreadPool(self)
        self.pool.setMaxThreadCount(3)

    @Slot(result='QVariant')
    def openWorkspace(self) -> dict:
        folder = QFileDialog.getExistingDirectory(self.window, 'Open project folder', str(self.window.workspace_root or project_root()))
        if not folder:
            return {'canceled': True}
        try:
            root = Path(folder).resolve(strict=True)
            files, skipped = load_workspace(root)
        except OSError as error:
            return {'canceled': True, 'error': f'Could not read that folder: {error}'}
        self.window.workspace_root = root
        return {'canceled': False, 'root': str(root), 'name': root.name, 'files': files, 'skipped': skipped}

    @Slot('QVariant', 'QVariant', result='QVariant')
    def saveWorkspace(self, files: Any, expected_baselines: Any = None) -> dict:
        if not self.window.workspace_root:
            return {'ok': False, 'message': 'Open a folder before saving to disk.'}
        try:
            return save_workspace(self.window.workspace_root, files, expected_baselines)
        except OSError as error:
            return {'ok': False, 'message': f'Could not save to the selected folder: {error}'}

    @Slot('QVariant', result='QVariant')
    def deleteWorkspaceFiles(self, paths: Any) -> dict:
        if not self.window.workspace_root:
            return {'ok': False, 'message': 'Open a folder before undoing task-created files.', 'deleted': 0, 'skipped': 0}
        try:
            return delete_workspace_files(self.window.workspace_root, paths)
        except OSError as error:
            return {'ok': False, 'message': f'Could not undo task-created files: {error}', 'deleted': 0, 'skipped': 0}

    @Slot('QVariant', result='QVariant')
    def runValidation(self, requested: Any) -> dict:
        if not self.window.workspace_root:
            return {'ok': False, 'message': 'Open a folder before running project checks.', 'results': []}
        if not isinstance(requested, list):
            return {'ok': False, 'message': 'Invalid validation command list.', 'results': []}
        commands = []
        for item in requested[:4]:
            raw = item if isinstance(item, str) else item.get('command') if isinstance(item, dict) else None
            normalized = normalize_validation_command(raw)
            if normalized and normalized not in commands:
                commands.append(normalized)
        skipped = max(0, len(requested) - len(commands))
        if not commands:
            return {'ok': False, 'message': 'No allowlisted local test/build commands were provided.', 'results': [], 'skipped': skipped}
        return self._start_job(commands, confirmed=False, skipped=skipped)

    @Slot(str, result='QVariant')
    def runConfirmedCommand(self, raw: str) -> dict:
        if not self.window.workspace_root:
            return {'ok': False, 'command': raw, 'output': 'Open a folder before running a command.'}
        parts = normalize_confirmed_command(raw)
        if not parts:
            return {'ok': False, 'command': raw, 'output': 'Command rejected: use a plain executable and arguments without shell operators or quoting.'}
        raw = ' '.join(parts)
        choice = QMessageBox.warning(
            self.window,
            'Approve agent-requested command',
            f'Run this command in the selected project folder?\n\n{raw}\n\nIt may change files or access the network. Review carefully before approving.',
            QMessageBox.StandardButton.Cancel | QMessageBox.StandardButton.Yes,
            QMessageBox.StandardButton.Cancel,
        )
        if choice != QMessageBox.StandardButton.Yes:
            return {'ok': False, 'canceled': True, 'command': raw, 'output': 'Canceled by user.'}
        return self._start_job([raw], confirmed=True)

    def _start_job(self, commands: list[str], confirmed: bool, skipped: int = 0) -> dict:
        job_id = uuid.uuid4().hex
        job = _CommandJob(job_id, self.window.workspace_root, commands, confirmed)
        job.signals.finished.connect(self._finish_job)
        self.jobs[job_id] = job
        self.job_skipped[job_id] = skipped
        self.pool.start(job)
        return {'jobId': job_id}

    @Slot(str, str)
    def _finish_job(self, job_id: str, payload: str) -> None:
        self.jobs.pop(job_id, None)
        skipped = self.job_skipped.pop(job_id, 0)
        if skipped:
            try:
                data = json.loads(payload)
                data['skipped'] = skipped
                payload = json.dumps(data, ensure_ascii=False)
            except (json.JSONDecodeError, TypeError):
                pass
        self.commandFinished.emit(job_id, payload)


BRIDGE_SCRIPT = r'''(function () {
  if (window.__codereoPythonBridgeInstalling || window.codereoDesktop?.isAvailable) return;
  window.__codereoPythonBridgeInstalling = true;
  const script = document.createElement('script');
  script.src = 'qrc:///qtwebchannel/qwebchannel.js';
  script.onload = function () {
    new QWebChannel(qt.webChannelTransport, function (channel) {
      const bridge = channel.objects.codereo;
      const pending = new Map();
      const early = new Map();
      bridge.commandFinished.connect(function (jobId, payload) {
        const resolve = pending.get(jobId);
        if (resolve) { pending.delete(jobId); resolve(JSON.parse(payload)); }
        else early.set(jobId, payload);
      });
      function run(method, value) {
        return new Promise(function (resolve) {
          bridge[method](value, function (result) {
            if (!result || !result.jobId) { resolve(result || {}); return; }
            if (early.has(result.jobId)) { const payload = early.get(result.jobId); early.delete(result.jobId); resolve(JSON.parse(payload)); return; }
            pending.set(result.jobId, resolve);
          });
        });
      }
      window.codereoDesktop = Object.freeze({
        isAvailable: true,
        platform: 'python-desktop',
        openWorkspace: function () { return new Promise(function (resolve) { bridge.openWorkspace(resolve); }); },
        saveWorkspace: function (files, expectedBaselines) { return new Promise(function (resolve) { bridge.saveWorkspace(files, expectedBaselines, resolve); }); },
        deleteWorkspaceFiles: function (paths) { return new Promise(function (resolve) { bridge.deleteWorkspaceFiles(paths, resolve); }); },
        runValidation: function (commands) { return run('runValidation', commands); },
        runConfirmedCommand: function (command) { return run('runConfirmedCommand', command); }
      });
      window.dispatchEvent(new Event('codereo-desktop-ready'));
    });
  };
  (document.head || document.documentElement).appendChild(script);
})();'''


class IDEWindow(QMainWindow):
    def __init__(self, app: QApplication, dev: bool = False) -> None:
        super().__init__()
        self.app = app
        self.root = project_root()
        self.workspace_root: Path | None = None
        self.server: subprocess.Popen[bytes] | None = None
        app_data = QStandardPaths.writableLocation(QStandardPaths.StandardLocation.AppLocalDataLocation)
        self.data_dir = Path(app_data) if app_data else Path.home() / '.codereo'
        self.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            self.data_dir.chmod(0o700)
        except OSError:
            pass
        self.server_port = self._start_server(dev)
        self.setWindowTitle('Codereo IDE · Python Desktop')
        self.setMinimumSize(920, 640)
        self.resize(1512, 960)
        self.setStyleSheet('QMainWindow { background: #101216; } QToolBar { background: #171a1f; border: 0; spacing: 8px; padding: 5px; } QToolBar QToolButton { color: #cbd3c6; padding: 5px 10px; }')
        self.view = QWebEngineView(self)
        self.view.settings().setAttribute(QWebEngineSettings.WebAttribute.JavascriptCanOpenWindows, False)
        self.view.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, False)
        self.setCentralWidget(self.view)
        self.bridge = DesktopBridge(self)
        self.channel = QWebChannel(self.view.page())
        self.channel.registerObject('codereo', self.bridge)
        self.view.page().setWebChannel(self.channel)
        self.view.page().newWindowRequested.connect(self._open_external)
        self.view.loadFinished.connect(self._install_bridge)
        self._build_native_menus()
        self.view.load(QUrl(f'http://127.0.0.1:{self.server_port}'))
        self.statusBar().showMessage('Private local workspace · Python / PySide6')

    def _start_server(self, dev: bool) -> int:
        node = shutil.which('node')
        if not node:
            raise RuntimeError('Node.js 20 or newer is required to run the Codereo workspace server.')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        env = dict(os.environ)
        env.update({
            'HOST': '127.0.0.1',
            'PORT': str(port),
            'CODEREO_APP_ROOT': str(self.root),
            'CODEREO_DATA_DIR': str(self.data_dir / 'mind'),
            'DOTENV_CONFIG_PATH': str(self._ensure_env_file()),
            'CODEREO_CHAT_IMPORTER': str(self.root / 'python' / 'codereo_capabilities' / 'chat_importer.py'),
        })
        production = (self.root / 'dist' / 'index.html').exists() and not dev
        env['NODE_ENV'] = 'production' if production else 'development'
        args = [node, str(self.root / 'server' / 'index.mjs')]
        if production:
            args.append('--production')
        creationflags = getattr(subprocess, 'CREATE_NO_WINDOW', 0) if os.name == 'nt' else 0
        self.server = subprocess.Popen(args, cwd=str(self.root), env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=creationflags)
        health_url = f'http://127.0.0.1:{port}/api/health'
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            if self.server.poll() is not None:
                raise RuntimeError(f'Codereo server exited with code {self.server.returncode}.')
            try:
                with urlopen(health_url, timeout=1.2) as response:
                    if response.status == 200:
                        return port
            except Exception:
                time.sleep(0.25)
        self._stop_server()
        raise RuntimeError('Codereo local server did not become ready in time.')

    def _ensure_env_file(self) -> Path:
        env_file = self.data_dir / '.env'
        if not env_file.exists():
            env_file.write_text('\n'.join([
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
            ]), encoding='utf-8')
            try:
                env_file.chmod(0o600)
            except OSError:
                pass
        return env_file

    def _build_native_menus(self) -> None:
        file_menu = self.menuBar().addMenu('&File')
        open_action = QAction('&Open project folder…', self)
        open_action.setShortcut('Ctrl+O')
        open_action.triggered.connect(self._open_from_native_menu)
        file_menu.addAction(open_action)
        save_action = QAction('&Save workspace', self)
        save_action.setShortcut('Ctrl+S')
        save_action.triggered.connect(lambda: self.view.page().runJavaScript("window.dispatchEvent(new Event('codereo-save-workspace'))"))
        file_menu.addAction(save_action)
        file_menu.addSeparator()
        quit_action = QAction('&Quit', self)
        quit_action.setShortcut('Ctrl+Q')
        quit_action.triggered.connect(self.close)
        file_menu.addAction(quit_action)
        view_menu = self.menuBar().addMenu('&View')
        reload_action = QAction('&Reload workspace', self)
        reload_action.setShortcut('Ctrl+R')
        reload_action.triggered.connect(self.view.reload)
        view_menu.addAction(reload_action)
        toolbar = QToolBar('Workspace', self)
        toolbar.setMovable(False)
        self.addToolBar(toolbar)
        toolbar.addAction(open_action)
        toolbar.addAction(save_action)
        toolbar.addAction(reload_action)

    def _open_from_native_menu(self) -> None:
        self.view.page().runJavaScript("window.dispatchEvent(new Event('codereo-open-workspace'))")

    def _install_bridge(self, ok: bool) -> None:
        if ok:
            self.view.page().runJavaScript(BRIDGE_SCRIPT)

    def _open_external(self, request: Any) -> None:
        url = request.requestedUrl()
        if url.scheme() == 'https':
            QDesktopServices.openUrl(url)

    def _stop_server(self) -> None:
        if not self.server or self.server.poll() is not None:
            return
        self.server.terminate()
        try:
            self.server.wait(timeout=3)
        except subprocess.TimeoutExpired:
            self.server.kill()
            self.server.wait(timeout=2)

    def closeEvent(self, event: QCloseEvent) -> None:
        self._stop_server()
        event.accept()


def main() -> int:
    app = QApplication(sys.argv)
    app.setOrganizationName('Codereo')
    app.setApplicationName('Codereo IDE')
    dev = '--dev' in sys.argv
    try:
        window = IDEWindow(app, dev=dev)
    except Exception as error:
        QMessageBox.critical(None, 'Codereo IDE could not start', str(error))
        return 1
    window.show()
    return app.exec()


if __name__ == '__main__':
    raise SystemExit(main())
