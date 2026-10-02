import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepoWiki, isIndexablePath, rankWorkspaceFiles, searchWorkspace } from '../../src/workspace-index.mjs';

test('workspace context ranks relevant files and excludes secrets and generated paths', () => {
  const files = {
    'README.md': '# Example project',
    'package.json': '{"name":"example","scripts":{"test":"node --test"}}',
    'AGENTS.md': 'Use small focused patches.',
    'src/a-unrelated.js': 'export const background = "a calm editor theme";',
    'src/security/session.js': 'export function refreshSession(token, expiresAt) { return token && expiresAt; }',
    '.env.local': 'SECRET=never include this',
    'node_modules/secret/index.js': 'dependency internals',
  };
  const ranked = rankWorkspaceFiles(files, 'refresh session token expiry', { preferredPaths: ['src/a-unrelated.js'] });
  assert.equal(ranked[0].path, 'AGENTS.md');
  assert.ok(ranked.some((file) => file.path === 'src/security/session.js'));
  assert.ok(ranked.findIndex((file) => file.path === 'src/security/session.js') < ranked.findIndex((file) => file.path === 'src/a-unrelated.js'));
  assert.ok(ranked.every((file) => isIndexablePath(file.path)));
  assert.equal(ranked.some((file) => file.content.includes('SECRET=')), false);
});

test('workspace search finds content lines and path matches with locations', () => {
  const results = searchWorkspace({
    'src/session.ts': 'export function open() {\n  return refreshSession(userToken);\n}',
    'docs/session-lifecycle.md': '# Session lifecycle\nTokens expire after thirty minutes.',
    'private/credentials.json': '{"token":"do-not-index"}',
  }, 'refresh session');
  assert.deepEqual(results.map((result) => result.path), ['src/session.ts']);
  assert.equal(results[0].line, 2);
  assert.match(results[0].excerpt, /refreshSession/);
  assert.equal(searchWorkspace({ 'src/app.js': 'nothing here' }, 'missing token').length, 0);
});

test('Repo Atlas summarizes manifests, entry points, instructions, and local imports', () => {
  const wiki = buildRepoWiki({
    'README.md': '# Atlas sample\nA local app.',
    'AGENTS.md': 'Prefer explicit error handling.',
    'package.json': JSON.stringify({ name: 'atlas-sample', dependencies: { react: '^19.0.0', vite: '^6.0.0' }, scripts: { test: 'node --test' } }),
    'tsconfig.json': '{}',
    'src/main.jsx': "import View from './components/view.jsx';\nexport default View;",
    'src/components/view.jsx': 'export default function View() { return null; }',
    'src/styles.css': 'body { color: white; }',
    '.env': 'PRIVATE=not-visible',
  }, 'Fallback name');
  assert.equal(wiki.name, 'atlas-sample');
  assert.equal(wiki.fileCount, 7);
  assert.ok(wiki.frameworks.includes('React'));
  assert.ok(wiki.frameworks.includes('Vite'));
  assert.ok(wiki.frameworks.includes('TypeScript'));
  assert.ok(wiki.entrypoints.includes('src/main.jsx'));
  assert.deepEqual(wiki.instructions.map((item) => item.path), ['AGENTS.md']);
  assert.equal(wiki.importCount, 1);
  assert.equal(wiki.keyModules[0].path, 'src/components/view.jsx');
});

test('workspace index blocks traversal, credentials, and hidden secret files', () => {
  for (const filePath of ['../outside.py', '/etc/passwd', 'C:/private.txt', '.ENV.production', 'nested/id_rsa', '.git/config', 'target/release/app']) {
    assert.equal(isIndexablePath(filePath), false, filePath);
  }
});
