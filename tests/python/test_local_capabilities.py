import tempfile
import unittest
from pathlib import Path

from desktop.local_capabilities import (
    delete_workspace_files,
    load_workspace,
    normalize_confirmed_command,
    normalize_validation_command,
    safe_relative_path,
    save_workspace,
)


class WorkspaceBoundaryTests(unittest.TestCase):
    def test_secret_and_traversal_paths_are_rejected(self):
        for name in ('../outside.txt', '/absolute.txt', 'C:/outside.txt', '.env', 'nested/.env.local', 'private/key.pem', '.git/config', 'node_modules/pkg/index.js', 'credentials.json'):
            self.assertIsNone(safe_relative_path(name), name)
        self.assertEqual(safe_relative_path('src/main.py'), Path('src/main.py'))

    def test_loader_skips_secrets_binary_and_dependencies(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'src').mkdir()
            (root / 'src' / 'main.py').write_text('print("safe")', encoding='utf-8')
            (root / '.env').write_text('SECRET=do-not-read', encoding='utf-8')
            (root / 'image.bin').write_bytes(b'\x00binary')
            (root / 'node_modules').mkdir()
            (root / 'node_modules' / 'hidden.js').write_text('ignored', encoding='utf-8')
            files, skipped = load_workspace(root)
            self.assertEqual(files, {'src/main.py': 'print("safe")'})
            self.assertGreaterEqual(skipped, 2)

    def test_save_does_not_follow_symlink_outside_workspace(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'workspace'
            outside = Path(tmp) / 'outside'
            root.mkdir()
            outside.mkdir()
            (root / 'linked').symlink_to(outside, target_is_directory=True)
            result = save_workspace(root, {'src/new.py': 'print(1)', 'linked/escape.txt': 'no'})
            self.assertEqual(result['written'], 1)
            self.assertGreaterEqual(result['skipped'], 1)
            self.assertEqual((root / 'src' / 'new.py').read_text(), 'print(1)')
            self.assertFalse((outside / 'escape.txt').exists())

    def test_save_checks_task_baselines_before_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'workspace'
            root.mkdir()
            tracked = root / 'tracked.txt'
            tracked.write_text('disk version', encoding='utf-8')
            stale = save_workspace(root, {'tracked.txt': 'task version'}, {'tracked.txt': 'older version'})
            self.assertFalse(stale['ok'])
            self.assertEqual(tracked.read_text(encoding='utf-8'), 'disk version')

            unloaded = root / 'unloaded.txt'
            unloaded.write_text('unseen disk file', encoding='utf-8')
            unexpected = save_workspace(root, {'unloaded.txt': 'task version'}, {'unloaded.txt': None})
            self.assertFalse(unexpected['ok'])
            self.assertEqual(tracked.read_text(encoding='utf-8'), 'disk version')
            self.assertEqual(unloaded.read_text(encoding='utf-8'), 'unseen disk file')

            matched = save_workspace(root, {'tracked.txt': 'task version'}, {'tracked.txt': 'disk version'})
            self.assertTrue(matched['ok'])
            self.assertEqual(tracked.read_text(encoding='utf-8'), 'task version')
            created = save_workspace(root, {'new.txt': 'task file'}, {'new.txt': None})
            self.assertTrue(created['ok'])
            self.assertEqual((root / 'new.txt').read_text(encoding='utf-8'), 'task file')

    def test_undo_deletes_only_safe_regular_workspace_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'workspace'
            outside = Path(tmp) / 'outside.txt'
            root.mkdir()
            outside.write_text('keep outside', encoding='utf-8')
            (root / 'new.txt').write_text('created by task', encoding='utf-8')
            (root / 'linked.txt').symlink_to(outside)
            result = delete_workspace_files(root, ['new.txt', '../outside.txt', 'linked.txt'])
            self.assertEqual(result['deleted'], 1)
            self.assertGreaterEqual(result['skipped'], 2)
            self.assertFalse((root / 'new.txt').exists())
            self.assertTrue((root / 'linked.txt').is_symlink())
            self.assertEqual(outside.read_text(encoding='utf-8'), 'keep outside')


class CommandPolicyTests(unittest.TestCase):
    def test_validation_commands_are_allowlisted(self):
        self.assertEqual(normalize_validation_command('  npm   test  '), 'npm test')
        for command in ('npm install', 'rm -rf /', 'npm test && curl example.com', 'npm test; whoami'):
            self.assertIsNone(normalize_validation_command(command), command)

    def test_confirmed_commands_reject_shell_syntax(self):
        self.assertEqual(normalize_confirmed_command('npm install'), ['npm', 'install'])
        for command in ('npm test && rm -rf /', 'python -c "print(1)"', 'npm %PATH%'):
            self.assertIsNone(normalize_confirmed_command(command), command)


if __name__ == '__main__':
    unittest.main()
