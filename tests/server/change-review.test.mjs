import test from 'node:test';
import assert from 'node:assert/strict';
import { createChangeReview } from '../../src/change-review.mjs';

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
