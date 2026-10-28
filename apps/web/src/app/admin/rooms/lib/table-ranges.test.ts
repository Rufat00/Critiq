import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countCoveredTables, constrainTableRange } from './table-ranges';
test('table counts use the union of inclusive sparse and overlapping ranges', () => {
  assert.equal(countCoveredTables([]), 0);
  assert.equal(
    countCoveredTables([
      { fromNumber: 1, toNumber: 5 },
      { fromNumber: 3, toNumber: 8 },
      { fromNumber: 20, toNumber: 22 },
      { fromNumber: 4, toNumber: 4 },
    ]),
    11,
  );
  assert.equal(
    countCoveredTables([{ fromNumber: 1, toNumber: 2147483647 }]),
    2147483647,
  );
});

test('range slider caps table coverage while allowing numbering to continue', () => {
  assert.deepEqual(
    constrainTableRange(
      { fromNumber: 25, toNumber: 120 },
      { fromNumber: 25, toNumber: 50 },
      [],
      77,
    ),
    { fromNumber: 25, toNumber: 101 },
  );
  assert.deepEqual(
    constrainTableRange(
      { fromNumber: 10, toNumber: 101 },
      { fromNumber: 25, toNumber: 101 },
      [],
      77,
    ),
    { fromNumber: 25, toNumber: 101 },
  );
  assert.deepEqual(
    constrainTableRange(
      { fromNumber: 25, toNumber: 120 },
      { fromNumber: 25, toNumber: 50 },
      [{ fromNumber: 1, toNumber: 24 }],
      101,
    ),
    { fromNumber: 25, toNumber: 101 },
  );
  assert.deepEqual(
    constrainTableRange(
      { fromNumber: 5, toNumber: 12 },
      { fromNumber: 5, toNumber: 8 },
      [{ fromNumber: 1, toNumber: 10 }],
      12,
    ),
    { fromNumber: 5, toNumber: 12 },
  );
});
