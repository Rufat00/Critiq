import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTableRangePreview } from './get-table-range-preview';

test('preview contains exactly the configured tables without filling gaps or padding to 24', () => {
  const preview = getTableRangePreview([
    { trackId: 'a', ranges: [{ fromNumber: 1, toNumber: 3 }] },
    { trackId: 'b', ranges: [{ fromNumber: 30, toNumber: 31 }] },
  ]);
  assert.equal(preview.total, 5);
  assert.deepEqual(
    preview.tables.map((table) => table.table),
    [1, 2, 3, 30, 31],
  );
  assert.deepEqual(
    preview.tables.map((table) => table.trackId),
    ['a', 'a', 'a', 'b', 'b'],
  );
  assert.equal(getTableRangePreview([]).total, 0);
});

test('pagination reaches every table across range boundaries', () => {
  const tracks = [
    { trackId: 'a', ranges: [{ fromNumber: 1, toNumber: 95 }] },
    { trackId: 'b', ranges: [{ fromNumber: 200, toNumber: 224 }] },
  ];
  const first = getTableRangePreview(tracks);
  const last = getTableRangePreview(tracks, 1);
  assert.equal(first.total, 120);
  assert.equal(first.tables.length, 100);
  assert.equal(first.tables.at(-1)?.table, 204);
  assert.equal(last.tables.length, 20);
  assert.equal(last.tables[0]?.table, 205);
  assert.equal(last.tables.at(-1)?.table, 224);
  assert.equal(getTableRangePreview(tracks, 99).current, 1);
});

test('large layouts retain their full count without expanding every table', () => {
  const preview = getTableRangePreview(
    [{ trackId: 'a', ranges: [{ fromNumber: 1, toNumber: 2147483647 }] }],
    21474836,
  );
  assert.equal(preview.total, 2147483647);
  assert.equal(preview.tables.length, 47);
  assert.equal(preview.tables.at(-1)?.table, 2147483647);
});
