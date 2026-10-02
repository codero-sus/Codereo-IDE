const IGNORED_SEGMENTS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', 'coverage', 'release',
  '.next', '.nuxt', '.svelte-kit', '.turbo', '.venv', 'venv', 'target',
]);
const BLOCKED_NAMES = new Set([
  '.npmrc', '.netrc', '.pypirc', 'credentials', 'credentials.json',
  'id_rsa', 'id_ed25519',
]);
const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'been', 'before', 'being', 'could',
  'does', 'from', 'have', 'into', 'just', 'more', 'most', 'other', 'should',
  'some', 'such', 'than', 'that', 'their', 'there', 'these', 'they', 'this',
  'those', 'through', 'using', 'very', 'what', 'when', 'where', 'which', 'while',
  'with', 'would', 'your', 'please', 'code', 'file', 'files', 'project', 'repo',
]);
const PROJECT_RULE_FILES = [
  'AGENTS.md', 'CODEREO.md', '.github/copilot-instructions.md',
  '.github/instructions/codereo.md',
];
const MANIFEST_FILES = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'go.mod',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'Gemfile', 'composer.json',
];
const EDITOR_CONFIG_FILES = [
  'tsconfig.json', 'vite.config.js', 'vite.config.ts', 'webpack.config.js',
  'eslint.config.js', '.eslintrc.json', 'pytest.ini', 'Makefile', 'justfile',
];
const LANGUAGE_NAMES = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  py: 'Python', pyw: 'Python', pyi: 'Python',
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less',
  json: 'JSON', md: 'Markdown', mdx: 'Markdown',
  rs: 'Rust', go: 'Go', java: 'Java', kt: 'Kotlin', kts: 'Kotlin',
  c: 'C', h: 'C/C++', cc: 'C++', cpp: 'C++', cxx: 'C++', hh: 'C++', hpp: 'C++', hxx: 'C++',
  cs: 'C#', fs: 'F#', fsx: 'F#', rb: 'Ruby', php: 'PHP', swift: 'Swift',
  sql: 'SQL', sh: 'Shell', bash: 'Shell', zsh: 'Shell', ps1: 'PowerShell',
  yml: 'YAML', yaml: 'YAML', toml: 'TOML', xml: 'XML', vue: 'Vue', svelte: 'Svelte',
};
const TEXT_FILE_LIMIT = 2_000;
const CONTEXT_FILE_LIMIT = 40;
const CONTEXT_CHAR_LIMIT = 64_000;
const CONTEXT_FILE_CHAR_LIMIT = 10_000;

function tokens(text, limit = 20) {
  return [...new Set((String(text || '').toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) || [])
    .filter((token) => !STOPWORDS.has(token)))].slice(0, limit);
}

export function isIndexablePath(input) {
  if (typeof input !== 'string' || !input || input.length > 240 || input.includes('\0')) return false;
  const normalized = input.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return false;
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return false;
  if (parts.some((part) => {
    const lower = part.toLowerCase();
    return lower.startsWith('.env') || IGNORED_SEGMENTS.has(lower) || BLOCKED_NAMES.has(lower);
  })) return false;
  return !/\.(pem|key|p12|pfx)$/i.test(normalized);
}

function readableFiles(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return [];
  return Object.entries(files)
    .filter(([filePath, content]) => isIndexablePath(filePath) && typeof content === 'string')
    .slice(0, TEXT_FILE_LIMIT)
    .map(([path, content]) => ({ path: path.replaceAll('\\', '/'), content }));
}

function countOccurrences(text, token, limit = 3) {
  let count = 0;
  let offset = 0;
  while (count < limit) {
    const at = text.indexOf(token, offset);
    if (at < 0) break;
    const before = at === 0 ? '' : text[at - 1];
    const after = at + token.length >= text.length ? '' : text[at + token.length];
    const isWord = (char) => !char || !/[\p{L}\p{N}_]/u.test(char);
    if (isWord(before) && isWord(after)) count += 1;
    offset = at + token.length;
  }
  return count;
}

function relevanceScore(file, queryTokens, query) {
  const lowerPath = file.path.toLowerCase();
  const lowerContent = file.content.toLowerCase();
  const basename = lowerPath.slice(lowerPath.lastIndexOf('/') + 1);
  let score = 0;
  if (query && lowerPath.includes(query)) score += 18;
  for (const token of queryTokens) {
    if (lowerPath.includes(token)) score += basename.includes(token) ? 7 : 3;
    const occurrences = countOccurrences(lowerContent, token, 3);
    if (occurrences) score += 2.5 + Math.log1p(occurrences) * 1.4;
  }
  if (query && lowerContent.includes(query)) score += 2;
  if (file.path === 'README.md' || file.path === 'readme.md') score += 1.25;
  if (MANIFEST_FILES.includes(file.path)) score += 1.5;
  if (PROJECT_RULE_FILES.includes(file.path)) score += 2.5;
  return score;
}

function orderedFiles(files, query, preferredPaths = []) {
  const allFiles = readableFiles(files);
  const normalizedQuery = String(query || '').trim().toLowerCase().slice(0, 300);
  const queryTokens = tokens(normalizedQuery, 16);
  const scoreByPath = new Map(allFiles.map((file) => [file.path, relevanceScore(file, queryTokens, normalizedQuery)]));
  const preferred = [...new Set(preferredPaths.filter((item) => typeof item === 'string').map((item) => item.replaceAll('\\', '/')))]
    .filter((item) => allFiles.some((file) => file.path === item));
  const essential = [...PROJECT_RULE_FILES, 'README.md', 'readme.md', ...MANIFEST_FILES, ...EDITOR_CONFIG_FILES]
    .filter((item) => allFiles.some((file) => file.path === item));
  const priority = [...new Set(essential)];
  const priorityRank = new Map(priority.map((filePath, index) => [filePath, index]));
  const preferredRank = new Map(preferred.map((filePath, index) => [filePath, index]));
  const score = (filePath) => (scoreByPath.get(filePath) || 0) + (preferredRank.has(filePath) ? Math.max(1, 3 - preferredRank.get(filePath) * 0.1) : 0);
  const sorted = [...allFiles].sort((a, b) => {
    const scoreDelta = score(b.path) - score(a.path);
    if (Math.abs(scoreDelta) > 0.001) return scoreDelta;
    const rankA = preferredRank.has(a.path) ? preferredRank.get(a.path) : Number.MAX_SAFE_INTEGER;
    const rankB = preferredRank.has(b.path) ? preferredRank.get(b.path) : Number.MAX_SAFE_INTEGER;
    return rankA - rankB || a.path.localeCompare(b.path);
  });
  const priorityFiles = priority.map((filePath) => allFiles.find((file) => file.path === filePath)).filter(Boolean);
  return [...priorityFiles, ...sorted.filter((file) => !priorityRank.has(file.path))];
}

export function rankWorkspaceFiles(files, query = '', options = {}) {
  const maxFiles = Math.max(1, Math.min(CONTEXT_FILE_LIMIT, Number(options.maxFiles) || CONTEXT_FILE_LIMIT));
  const maxChars = Math.max(1_000, Math.min(CONTEXT_CHAR_LIMIT, Number(options.maxChars) || CONTEXT_CHAR_LIMIT));
  const maxFileChars = Math.max(1_000, Math.min(CONTEXT_FILE_CHAR_LIMIT, Number(options.maxFileChars) || CONTEXT_FILE_CHAR_LIMIT));
  let remaining = maxChars;
  const selected = [];
  for (const file of orderedFiles(files, query, options.preferredPaths || [])) {
    if (selected.length >= maxFiles || remaining <= 0) break;
    const content = file.content.slice(0, Math.min(maxFileChars, remaining));
    selected.push({ path: file.path, content });
    remaining -= content.length;
  }
  return selected;
}

function lineSnippet(line, query, limit = 240) {
  const cleanLine = line.trim();
  if (cleanLine.length <= limit) return cleanLine;
  const lower = cleanLine.toLowerCase();
  const at = lower.indexOf(query);
  const start = Math.max(0, (at < 0 ? 0 : at) - Math.floor(limit / 3));
  return `${start ? '…' : ''}${cleanLine.slice(start, start + limit)}${start + limit < cleanLine.length ? '…' : ''}`;
}

export function searchWorkspace(files, query, limit = 40) {
  const normalizedQuery = typeof query === 'string' ? query.trim().toLowerCase().slice(0, 180) : '';
  if (!normalizedQuery) return [];
  const queryTokens = tokens(normalizedQuery, 10);
  const maxResults = Math.max(1, Math.min(100, Number(limit) || 40));
  const results = [];
  for (const file of readableFiles(files)) {
    const lowerPath = file.path.toLowerCase();
    const pathMatch = lowerPath.includes(normalizedQuery);
    let best = null;
    if (pathMatch) best = { path: file.path, line: 0, excerpt: 'File path match', score: 30 + normalizedQuery.length };
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const lowerLine = lines[index].toLowerCase();
      const phraseMatch = lowerLine.includes(normalizedQuery);
      const matchingTerms = queryTokens.filter((token) => lowerLine.includes(token)).length;
      if (!phraseMatch && (!queryTokens.length || matchingTerms !== queryTokens.length)) continue;
      const score = (phraseMatch ? 20 : 8 + matchingTerms) + (pathMatch ? 2 : 0);
      if (!best || score > best.score) best = {
        path: file.path,
        line: index + 1,
        excerpt: lineSnippet(lines[index], normalizedQuery),
        score,
      };
      if (phraseMatch) break;
    }
    if (best) results.push(best);
  }
  return results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.line - b.line).slice(0, maxResults);
}

function extensionOf(filePath) {
  const basename = filePath.slice(filePath.lastIndexOf('/') + 1);
  const index = basename.lastIndexOf('.');
  return index > 0 ? basename.slice(index + 1).toLowerCase() : '';
}

function detectStack(files) {
  const byPath = new Map(files.map((file) => [file.path, file.content]));
  const frameworks = new Set();
  const packageSource = byPath.get('package.json');
  let packageJson = {};
  try { packageJson = JSON.parse(packageSource || '{}'); } catch { /* Keep the source-derived map useful for an incomplete manifest. */ }
  const dependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
  const packageText = Object.keys(dependencies).join(' ').toLowerCase();
  if (/\breact\b/.test(packageText)) frameworks.add('React');
  if (/\bvite\b/.test(packageText)) frameworks.add('Vite');
  if (/\bnext\b/.test(packageText)) frameworks.add('Next.js');
  if (/\bexpress\b/.test(packageText)) frameworks.add('Express');
  if (/\bvue\b/.test(packageText)) frameworks.add('Vue');
  if (/\bsvelte\b/.test(packageText)) frameworks.add('Svelte');
  if (/\bfastapi\b/i.test(packageText)) frameworks.add('FastAPI');
  if (/\bdjango\b/i.test(packageText)) frameworks.add('Django');
  if (/\bflask\b/i.test(packageText)) frameworks.add('Flask');
  if (/\bpyside6\b/i.test(packageText)) frameworks.add('PySide6');
  if (byPath.has('tsconfig.json')) frameworks.add('TypeScript');
  if (byPath.has('Cargo.toml')) frameworks.add('Cargo / Rust');
  if (byPath.has('go.mod')) frameworks.add('Go modules');
  const requirements = files.filter((file) => /(^|\/)(requirements[^/]*\.txt|pyproject\.toml)$/i.test(file.path)).map((file) => file.content).join('\n').toLowerCase();
  for (const [needle, label] of [['fastapi', 'FastAPI'], ['django', 'Django'], ['flask', 'Flask'], ['pyside6', 'PySide6'], ['pytest', 'pytest']]) {
    if (requirements.includes(needle)) frameworks.add(label);
  }
  return { frameworks: [...frameworks], package: packageJson, dependencies };
}

function resolveRelativeImport(fromPath, specifier, pathSet) {
  const baseParts = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')).split('/') : [];
  for (const part of specifier.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') baseParts.pop();
    else baseParts.push(part);
  }
  const base = baseParts.join('/');
  const candidates = [base, ...['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.json'].map((ext) => `${base}${ext}`),
    ...['index.js', 'index.jsx', 'index.ts', 'index.tsx', '__init__.py'].map((name) => `${base}/${name}`)];
  return candidates.find((candidate) => pathSet.has(candidate)) || null;
}

function importGraph(files) {
  const pathSet = new Set(files.map((file) => file.path));
  const edges = [];
  const expression = /\b(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const file of files) {
    if (!/\.(jsx?|tsx?|mjs|cjs)$/i.test(file.path)) continue;
    expression.lastIndex = 0;
    for (const match of file.content.matchAll(expression)) {
      const target = resolveRelativeImport(file.path, match[1], pathSet);
      if (target && target !== file.path && !edges.some((edge) => edge.from === file.path && edge.to === target)) {
        edges.push({ from: file.path, to: target });
        if (edges.length >= 600) return edges;
      }
    }
  }
  const pythonFrom = /^\s*from\s+([A-Za-z_][\w.]*)\s+import\b/gm;
  for (const file of files) {
    if (!/\.pyi?$/i.test(file.path)) continue;
    pythonFrom.lastIndex = 0;
    for (const match of file.content.matchAll(pythonFrom)) {
      const module = match[1].replaceAll('.', '/');
      const target = [
        `${module}.py`, `${module}/__init__.py`,
        `${file.path.slice(0, file.path.lastIndexOf('/') + 1)}${module}.py`,
      ].find((candidate) => pathSet.has(candidate));
      if (target && target !== file.path && !edges.some((edge) => edge.from === file.path && edge.to === target)) {
        edges.push({ from: file.path, to: target });
        if (edges.length >= 600) return edges;
      }
    }
  }
  return edges;
}

export function buildRepoWiki(inputFiles, fallbackName = 'Workspace') {
  const files = readableFiles(inputFiles);
  const { frameworks, package: packageJson, dependencies } = detectStack(files);
  const languageCounts = new Map();
  let characterCount = 0;
  for (const file of files) {
    const language = LANGUAGE_NAMES[extensionOf(file.path)];
    if (language) languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
    characterCount += file.content.length;
  }
  const languages = [...languageCounts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const directories = new Map();
  for (const file of files) {
    const parts = file.path.split('/');
    const directory = parts.length > 1 ? parts.slice(0, Math.min(2, parts.length - 1)).join('/') : '(project root)';
    directories.set(directory, (directories.get(directory) || 0) + 1);
  }
  const directoryMap = [...directories].map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)).slice(0, 16);
  const candidateEntrypoints = [
    'index.html', 'src/main.jsx', 'src/main.tsx', 'src/main.js', 'src/index.tsx', 'src/index.js',
    'server/index.mjs', 'main.py', 'src/main.py', 'app.py', 'manage.py', 'Cargo.toml', 'go.mod',
  ];
  const pathSet = new Set(files.map((file) => file.path));
  const entrypoints = candidateEntrypoints.filter((filePath) => pathSet.has(filePath));
  const configurationFiles = [...new Set([...MANIFEST_FILES, ...EDITOR_CONFIG_FILES, '.gitignore', 'Dockerfile', 'docker-compose.yml'])]
    .filter((filePath) => pathSet.has(filePath));
  const instructions = PROJECT_RULE_FILES.filter((filePath) => pathSet.has(filePath)).map((filePath) => ({
    path: filePath,
    preview: (files.find((file) => file.path === filePath)?.content || '').trim().slice(0, 360),
  }));
  const edges = importGraph(files);
  const incoming = new Map();
  for (const edge of edges) incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
  const keyModules = [...incoming].map(([path, references]) => ({ path, references }))
    .sort((a, b) => b.references - a.references || a.path.localeCompare(b.path)).slice(0, 8);
  let readmeHeading = '';
  const readme = files.find((file) => /^readme\.md$/i.test(file.path) || /^docs\/readme\.md$/i.test(file.path));
  if (readme) readmeHeading = readme.content.match(/^#\s+(.+)$/m)?.[1]?.trim().slice(0, 80) || '';
  const name = String(packageJson.name || readmeHeading || fallbackName || 'Workspace').slice(0, 100);
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? Object.entries(packageJson.scripts).slice(0, 12).map(([label, command]) => ({ label, command: String(command).slice(0, 180) })) : [];
  return {
    name,
    fileCount: files.length,
    characterCount,
    languages,
    frameworks,
    entrypoints,
    configurationFiles,
    directories: directoryMap,
    instructions,
    keyModules,
    importCount: edges.length,
    dependencies: Object.keys(dependencies).slice(0, 80),
    scripts,
    hasReadme: Boolean(readme),
  };
}

export { PROJECT_RULE_FILES };
