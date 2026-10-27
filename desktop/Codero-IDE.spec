# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import os
import sys

from PyInstaller.building.datastruct import Tree

root = Path(SPECPATH).resolve().parent
node_binary = Path(os.environ['CODERO_NODE_BINARY']).resolve(strict=True)

# The Python desktop shell starts its bundled Node API locally. Keep its server,
# production UI, Python importer, and production-only npm dependencies beside it.
datas = []
for directory in ('dist', 'server', 'node_modules', 'python'):
    source = root / directory
    if not source.is_dir():
        raise SystemExit(f'Missing desktop bundle input: {source}')
    datas.extend(
        (source_path, Path(target_path).parent.as_posix())
        for target_path, source_path, _typecode in Tree(str(source), prefix=directory)
    )
datas.append((str(root / 'package.json'), '.'))

analysis = Analysis(
    [str(root / 'desktop' / 'main.py')],
    pathex=[str(root / 'desktop'), str(root)],
    binaries=[(str(node_binary), 'runtime')],
    datas=datas,
    hiddenimports=[
        'PySide6.QtWebChannel',
        'PySide6.QtWebEngineCore',
        'PySide6.QtWebEngineWidgets',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(analysis.pure)
exe = EXE(
    pyz,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name='Codero-IDE',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
parser_analysis = Analysis(
    [str(root / 'desktop' / 'chat_importer_cli.py')],
    pathex=[str(root)],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
parser_pyz = PYZ(parser_analysis.pure)
parser_exe = EXE(
    parser_pyz,
    parser_analysis.scripts,
    parser_analysis.binaries,
    parser_analysis.datas,
    [],
    name='Codero-IDE-ChatImporter',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

collected = COLLECT(
    exe,
    parser_exe,
    analysis.binaries,
    analysis.datas,
    strip=False,
    upx=False,
    name='Codero-IDE',
)

if sys.platform == 'darwin':
    app = BUNDLE(
        collected,
        name='Codero-IDE.app',
        icon=None,
        bundle_identifier='ai.codereo.ide',
        info_plist={
            'CFBundleDisplayName': 'Codero-IDE',
            'CFBundleName': 'Codero-IDE',
            'NSHighResolutionCapable': True,
        },
    )
