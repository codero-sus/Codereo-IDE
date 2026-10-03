import test from 'node:test';
import assert from 'node:assert/strict';
import { createChangeReview, findStaleProposalPaths, selectProposalChanges } from '../../src/change-review.mjs';

test('change review summarizes line edits and preserves surrounding context', () => {
  const result = createChangeReview('alpha\nbeta\ngamma\ndelta', 'alpha\nBETA\ngamma\ndelta');
  assert.equal(result.added, 1);
  assert.equal(result.removed, 1);
  assert.deepEqual(result.lines.map((line) => line.type), ['context', 'removed', 'added', 'context', 'context']);
});

test('new files are represented as additions', () => {
  const result = createChangeReview(null, 'first\nsecond');
  assert.equal(result.isNewFile, true);
  assert.equal(result.added, 2);
  assert.equal(result.removed, 0);
});

test('empty files do not create a synthetic blank diff line', () => {
  const result = createChangeReview(null, '');
  assert.equal(result.isNewFile, true);
  assert.equal(result.added, 0);
  assert.deepEqual(result.lines, []);
});

test('file selection applies only included paths and rejects stale baselines', () => {
  const changes = [
    { path: 'src/keep.js', content: 'new content' },
    { path: 'src/exclude.js', content: 'excluded content' },
    { path: 'src/new.js', content: 'new file' },
  ];
  const selected = selectProposalChanges(changes, ['src/exclude.js']);
  assert.deepEqual(selected.map(({ path }) => path), ['src/keep.js', 'src/new.js']);
  assert.deepEqual(findStaleProposalPaths(selected, { 'src/keep.js': 'before', 'src/new.js': null }, {
    'src/keep.js': 'changed after review',
    'src/exclude.js': 'excluded content',
    'src/new.js': 'created after review',
  }), ['src/keep.js', 'src/new.js']);
  assert.deepEqual(findStaleProposalPaths(selected, { 'src/keep.js': 'before', 'src/new.js': null }, {
    'src/keep.js': 'before',
  }), []);
});

test('large diffs stay bounded and expose omitted-line markers', () => {
  const before = Array.from({ length: 900 }, (_, index) => `before-${index}`).join('\n');
  const after = Array.from({ length: 900 }, (_, index) => `after-${index}`).join('\n');
  const result = createChangeReview(before, after, 40);
  assert.equal(result.added, 900);
  assert.equal(result.removed, 900);
  assert.equal(result.truncated, true);
  assert.ok(result.lines.length <= 42);
  assert.ok(result.lines.some((line) => line.type === 'omitted'));
});
