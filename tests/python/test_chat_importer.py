import io
import json
import sys
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'python'))
from codereo_capabilities.chat_importer import parse


class ChatImportTests(unittest.TestCase):
    def test_chatgpt_json_becomes_user_and_assistant_episodes(self):
        data = json.dumps({
            'title': 'A saved conversation',
            'messages': [
                {'role': 'user', 'content': 'Remember the local test preference.'},
                {'role': 'assistant', 'content': 'I will keep it local.'},
            ],
        }).encode()
        threads = parse('conversations.json', data)
        self.assertEqual(len(threads), 1)
        self.assertEqual(threads[0].title, 'A saved conversation')
        self.assertEqual([turn.role for turn in threads[0].turns], ['user', 'agi'])

    def test_jsonl_and_whatsapp_text_parse(self):
        jsonl = b'{"role":"user","content":"one"}\n{"role":"assistant","content":"two"}'
        self.assertEqual(len(parse('export.jsonl', jsonl)[0].turns), 2)
        whatsapp = b'12/31/23, 10:15 PM - Alice: First\n12/31/23, 10:16 PM - Bob: Second\n12/31/23, 10:17 PM - Alice: Third'
        parsed = parse('chat.txt', whatsapp)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(len(parsed[0].turns), 3)
        self.assertEqual(parsed[0].source, 'whatsapp')

    def test_zip_import_reads_supported_text_exports_without_extracting_files(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('export.json', json.dumps({'messages': [{'role': 'user', 'content': 'zip memory'}, {'role': 'assistant', 'content': 'parsed safely'}]}))
            archive.writestr('../outside.txt', 'ignored')
        threads = parse('export.zip', output.getvalue())
        self.assertEqual(sum(len(thread.turns) for thread in threads), 2)
        self.assertEqual(threads[0].turns[0].content, 'zip memory')


if __name__ == '__main__':
    unittest.main()
