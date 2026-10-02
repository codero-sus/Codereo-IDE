from __future__ import annotations

import os
import re
import signal
import subprocess
import threading
from pathlib import Path
from typing import Any

MAX_FILES = 1000
MAX_FILE_BYTES = 256 * 1024
MAX_WORKSPACE_BYTES = 8 * 1024 * 1024
MAX_OUTPUT_CHARS = 14_000
COMMAND_TIMEOUT_SECONDS = 120
IGNORED_DIRS = {
    '.git', 'node_modules', 'dist', 'build', 'out', 'coverage', 'release',
    '.next', '.nuxt', '.svelte-kit', '.turbo', '.venv', 'venv', 'target',
}
SECRET_NAMES = {'.npmrc', '.netrc', '.pypirc', 'credentials', 'credentials.json', 'id_rsa', 'id_ed25519'}
SAFE_VALIDATION_COMMANDS = {
    'npm test', 'npm run test', 'npm run build', 'npm run lint', 'npm run typecheck', 'npm run check',
    'pnpm test', 'pnpm run test', 'pnpm run build', 'pnpm run lint', 'pnpm run typecheck', 'pnpm run check',
    'yarn test', 'yarn build', 'yarn lint', 'yarn typecheck', 'yarn check',
    'bun test', 'bun run build', 'bun run lint', 'bun run typecheck',
    'pytest', 'python -m pytest', 'python3 -m pytest', 'cargo test', 'go test ./...',
}


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def safe_relative_path(raw: Any) -> Path | None:
    if not isinstance(raw, str) or not raw or len(raw) > 240 or '\x00' in raw:
        return None
    normalized = raw.replace('\\', '/')
    parts = normalized.split('/')
    if normalized.startswith('/') or re.match(r'^[A-Za-z]:', normalized) or any(part in {'', '.', '..'} for part in parts):
        return None
    lowered = [part.lower() for part in parts]
    if any(part.startswith('.env') or part in SECRET_NAMES or part in IGNORED_DIRS for part in lowered):
        return None
    if Path(normalized).suffix.lower() in {'.pem', '.key', '.p12', '.pfx'}:
        return None
    return Path(*parts)


def is_inside(root: Path, candidate: Path) -> bool:
    try:
        candidate.relative_to(root)
        return True
    except ValueError:
        return False


def load_workspace(root: Path) -> tuple[dict[str, str], int]:
    files: dict[str, str] = {}
    skipped = 0
    total_bytes = 0
    for current, dirs, names in os.walk(root, followlinks=False):
        base = Path(current)
        dirs[:] = [name for name in dirs if name.lower() not in IGNORED_DIRS and not (base / name).is_symlink()]
        for name in names:
            item = base / name
            if len(files) >= MAX_FILES or item.is_symlink():
                skipped += 1
                continue
            rel = item.relative_to(root).as_posix()
            if not safe_relative_path(rel):
                skipped += 1
                continue
            try:
                size = item.stat().st_size
                if size > MAX_FILE_BYTES or total_bytes + size > MAX_WORKSPACE_BYTES:
                    skipped += 1
                    continue
                raw = item.read_bytes()
                if b'\x00' in raw[:4096]:
                    skipped += 1
                    continue
                text = raw.decode('utf-8')
            except (OSError, UnicodeDecodeError):
                skipped += 1
                continue
            files[rel] = text
            total_bytes += size
    return files, skipped


def save_workspace(root: Path, files: Any) -> dict:
    if not isinstance(files, dict):
        return {'ok': False, 'message': 'Invalid workspace payload.'}
    root = root.resolve(strict=True)
    prepared: list[tuple[Path, str]] = []
    total_bytes = 0
    skipped = 0
    for raw_path, content in list(files.items())[:MAX_FILES]:
        rel = safe_relative_path(raw_path)
        if rel is None or not isinstance(content, str):
            skipped += 1
            continue
        encoded = content.encode('utf-8')
        if len(encoded) > MAX_FILE_BYTES or total_bytes + len(encoded) > MAX_WORKSPACE_BYTES:
            skipped += 1
            continue
        destination = root / rel
        try:
            if not is_inside(root, destination.resolve(strict=False)):
                skipped += 1
                continue
            cursor = root
            for part in rel.parts[:-1]:
                cursor = cursor / part
                if cursor.exists() and cursor.is_symlink():
                    raise OSError('symlink parent')
            if destination.exists() and (destination.is_symlink() or not destination.is_file()):
                skipped += 1
                continue
        except OSError:
            skipped += 1
            continue
        prepared.append((destination, content))
        total_bytes += len(encoded)
    written = 0
    for destination, content in prepared:
        try:
            destination.parent.mkdir(parents=True, exist_ok=True)
            if not is_inside(root, destination.parent.resolve(strict=True)):
                skipped += 1
                continue
            flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
            if hasattr(os, 'O_NOFOLLOW'):
                flags |= os.O_NOFOLLOW
            fd = os.open(destination, flags, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8', newline='') as handle:
                handle.write(content)
            written += 1
        except OSError:
            skipped += 1
    return {'ok': True, 'written': written, 'skipped': skipped}


def validation_environment() -> dict[str, str]:
    keys = ('PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'PATHEXT', 'ComSpec', 'APPDATA', 'LOCALAPPDATA')
    env = {key: os.environ[key] for key in keys if os.environ.get(key)}
    env.update({'CI': '1', 'NODE_ENV': 'test', 'npm_config_offline': 'true'})
    return env


def confirmed_environment() -> dict[str, str]:
    env = validation_environment()
    env.pop('npm_config_offline', None)
    return env


def normalize_validation_command(raw: Any) -> str | None:
    if not isinstance(raw, str) or len(raw) > 160:
        return None
    forbidden = (';', '|', '&', '<', '>', '`', '$', '\\', '\n', '\r')
    if any(char in raw for char in forbidden):
        return None
    normalized = ' '.join(raw.strip().split(' '))
    normalized = ' '.join(part for part in normalized.split(' ') if part)
    return normalized if normalized in SAFE_VALIDATION_COMMANDS else None


def normalize_confirmed_command(raw: Any) -> list[str] | None:
    if not isinstance(raw, str) or len(raw) > 220:
        return None
    forbidden = (';', '|', '&', '<', '>', '`', '$', '%', '!', '^', '(', ')', '"', "'", '\\', '\x00', '\n', '\r')
    if any(char in raw for char in forbidden):
        return None
    parts = [part for part in raw.strip().split(' ') if part]
    return parts or None


def run_command(root: Path, command: str, env: dict[str, str]) -> dict:
    is_windows = os.name == 'nt'
    if is_windows:
        args = [os.environ.get('ComSpec', 'cmd.exe'), '/d', '/s', '/c', command]
        start_kwargs: dict[str, Any] = {'creationflags': getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)}
    else:
        args = command.split(' ')
        start_kwargs = {'start_new_session': True}
    try:
        process = subprocess.Popen(
            args,
            cwd=str(root),
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            shell=False,
            **start_kwargs,
        )
    except OSError as error:
        return {'command': command, 'exitCode': -1, 'timedOut': False, 'output': f'Could not start command: {error}'}

    captured = bytearray()
    truncated = False

    def drain_output() -> None:
        nonlocal truncated
        assert process.stdout is not None
        while True:
            chunk = process.stdout.read(8192)
            if not chunk:
                break
            remaining = MAX_OUTPUT_CHARS * 4 - len(captured)
            if remaining > 0:
                captured.extend(chunk[:remaining])
            if len(chunk) > remaining:
                truncated = True

    reader = threading.Thread(target=drain_output, daemon=True)
    reader.start()
    timed_out = False
    try:
        process.wait(timeout=COMMAND_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        timed_out = True
        try:
            if is_windows:
                subprocess.run(['taskkill', '/T', '/F', '/PID', str(process.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5, shell=False)
            else:
                os.killpg(process.pid, signal.SIGTERM)
        except (OSError, subprocess.SubprocessError):
            process.kill()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    reader.join(timeout=3)
    text = captured.decode('utf-8', errors='replace')
    if truncated:
        text += '\n… output truncated …'
    if timed_out and not text:
        text = f'Timed out after {COMMAND_TIMEOUT_SECONDS} seconds.'
    return {'command': command, 'exitCode': process.returncode if process.returncode is not None else -1, 'timedOut': timed_out, 'output': text}
