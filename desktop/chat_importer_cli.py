"""Console entry point for bundled chat-export parsing."""

from __future__ import annotations

import json
import sys
from pathlib import Path

bundle_root = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[1])).resolve()
sys.path.insert(0, str(bundle_root / 'python'))

from codereo_capabilities.chat_importer import MAX_BYTES, MAX_MSGS, parse


def main() -> int:
    filename = Path(sys.argv[1]).name if len(sys.argv) > 1 else 'import.json'
    raw = sys.stdin.buffer.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        print(json.dumps({'error': 'Import is limited to 25 MB.'}))
        return 2
    threads = parse(filename, raw)
    output = []
    total_turns = 0
    for thread in threads:
        turns = []
        for turn in thread.turns:
            if total_turns >= MAX_MSGS:
                break
            turns.append({'role': turn.role, 'name': turn.name, 'content': turn.content[:4000], 'ts': turn.ts})
            total_turns += 1
        output.append({'title': thread.title[:120], 'source': thread.source[:40], 'turns': turns})
        if total_turns >= MAX_MSGS:
            break
    print(json.dumps({'threads': output, 'turns': total_turns}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
