const MAX_MATRIX_CELLS = 260_000;
const MAX_VISIBLE_LINES = 120;

function splitLines(value) {
  const text = String(value ?? '');
  return text ? text.split(/\r\n|\n|\r/) : [];
}

function trimOperations(operations, limit) {
  if (operations.length <= limit) return { lines: operations, truncated: false };
  const changeIndexes = [];
  for (let index = 0; index < operations.length; index += 1) {
    if (operations[index].type !== 'context') changeIndexes.push(index);
  }
  if (!changeIndexes.length) return { lines: operations.slice(0, limit), truncated: true };
  const padding = Math.max(3, Math.floor(limit / 5));
  const start = Math.max(0, changeIndexes[0] - padding);
  const end = Math.min(operations.length, Math.max(start + limit, changeIndexes.at(-1) + padding + 1));
  const window = operations.slice(start, end);
  if (window.length <= limit) return {
    lines: [
      ...(start ? [{ type: 'omitted', count: start }] : []),
      ...window,
      ...(end < operations.length ? [{ type: 'omitted', count: operations.length - end }] : []),
    ],
    truncated: true,
  };
  const visible = operations.slice(changeIndexes[0], changeIndexes[0] + Math.max(1, limit - padding));
  return {
    lines: [
      ...(changeIndexes[0] ? [{ type: 'omitted', count: changeIndexes[0] }] : []),
      ...visible,
      ...(operations.length > changeIndexes[0] + visible.length ? [{ type: 'omitted', count: operations.length - changeIndexes[0] - visible.length }] : []),
    ],
    truncated: true,
  };
}

function coarseOperations(before, after) {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix += 1;
  const operations = [];
  if (prefix) operations.push(...before.slice(0, Math.min(4, prefix)).map((text) => ({ type: 'context', text })));
  if (prefix > 4) operations.push({ type: 'omitted', count: prefix - 4 });
  operations.push(...before.slice(prefix, before.length - suffix).map((text) => ({ type: 'removed', text })));
  operations.push(...after.slice(prefix, after.length - suffix).map((text) => ({ type: 'added', text })));
  if (suffix > 4) operations.push({ type: 'omitted', count: suffix - 4 });
  if (suffix) operations.push(...before.slice(before.length - Math.min(4, suffix)).map((text) => ({ type: 'context', text })));
  return operations;
}

function lcsOperations(before, after) {
  const rows = before.length + 1;
  const columns = after.length + 1;
  const matrix = new Uint32Array(rows * columns);
  for (let left = before.length - 1; left >= 0; left -= 1) {
    const row = left * columns;
    const nextRow = (left + 1) * columns;
    for (let right = after.length - 1; right >= 0; right -= 1) {
      matrix[row + right] = before[left] === after[right]
        ? matrix[nextRow + right + 1] + 1
        : Math.max(matrix[nextRow + right], matrix[row + right + 1]);
    }
  }
  const operations = [];
  let left = 0;
  let right = 0;
  while (left < before.length && right < after.length) {
    if (before[left] === after[right]) {
      operations.push({ type: 'context', text: before[left] });
      left += 1;
      right += 1;
    } else if (matrix[(left + 1) * columns + right] >= matrix[left * columns + right + 1]) {
      operations.push({ type: 'removed', text: before[left] });
      left += 1;
    } else {
      operations.push({ type: 'added', text: after[right] });
      right += 1;
    }
  }
  while (left < before.length) operations.push({ type: 'removed', text: before[left++] });
  while (right < after.length) operations.push({ type: 'added', text: after[right++] });
  return operations;
}

export function createChangeReview(beforeValue, afterValue, lineLimit = MAX_VISIBLE_LINES) {
  const isNewFile = beforeValue === null || beforeValue === undefined;
  const before = isNewFile ? [] : splitLines(beforeValue);
  const after = splitLines(afterValue);
  const maxLines = Math.max(10, Math.min(MAX_VISIBLE_LINES, Number(lineLimit) || MAX_VISIBLE_LINES));
  const operations = before.length * after.length <= MAX_MATRIX_CELLS
    ? lcsOperations(before, after)
    : coarseOperations(before, after);
  const added = operations.filter((item) => item.type === 'added').length;
  const removed = operations.filter((item) => item.type === 'removed').length;
  const visible = trimOperations(operations, maxLines);
  return {
    added,
    removed,
    isNewFile,
    lines: visible.lines,
    truncated: visible.truncated,
  };
}
