import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  planProjectLocations,
  type PlacementRoom,
} from './plan-project-locations';
const projects = (count: number, trackId = 'overall') =>
  Array.from({ length: count }, (_, i) => ({
    id: `project-${i + 1}`,
    trackId,
  }));
const room = (
  ranges: number[][],
  roomId = 'hall',
  trackId = 'overall',
): PlacementRoom => ({
  roomId,
  trackId,
  tableRanges: ranges.map(([fromNumber, toNumber]) => ({
    fromNumber: fromNumber!,
    toNumber: toNumber!,
  })),
});

test('registration order fills ascending sparse ranges without repeating overlapping tables', () => {
  const placed = planProjectLocations(projects(8), [
    room([
      [9, 10],
      [1, 3],
      [2, 5],
    ]),
  ]);
  assert.deepEqual(
    placed.map((p) => p.tableNumber),
    [1, 2, 3, 4, 5, 9, 10, null],
  );
  assert.equal(placed[7]!.roomId, null);
});
test('configured room order determines which room fills first', () => {
  const placed = planProjectLocations(projects(4), [
    room([[7, 8]], 'first'),
    room([[1, 3]], 'second'),
  ]);
  assert.deepEqual(
    placed.map((p) => [p.roomId, p.tableNumber]),
    [
      ['first', 7],
      ['first', 8],
      ['second', 1],
      ['second', 2],
    ],
  );
});
test('tracks share physical tables without duplicate locations, with earlier registrations first', () => {
  const entered = [
    { id: 'first-ai', trackId: 'ai' },
    { id: 'first-overall', trackId: 'overall' },
    { id: 'second-ai', trackId: 'ai' },
    { id: 'second-overall', trackId: 'overall' },
  ];
  const placed = planProjectLocations(entered, [
    room([[1, 3]]),
    room([[1, 3]], 'hall', 'ai'),
  ]);
  assert.deepEqual(
    placed.map((p) => p.tableNumber),
    [1, 2, 3, null],
  );
});
test('unconfigured tracks and exhausted ranges stay unassigned', () => {
  assert.deepEqual(planProjectLocations(projects(1), []), [
    { id: 'project-1', roomId: null, tableNumber: null },
  ]);
  assert.equal(
    planProjectLocations(projects(1), [room([[1, 10]], 'hall', 'other')])[0]!
      .roomId,
    null,
  );
});
test('table numbers are local to each room and large ranges are consumed lazily', () => {
  assert.deepEqual(
    planProjectLocations(projects(2), [
      room([[1, 1]], 'a'),
      room([[1, 1]], 'b'),
    ]).map((p) => [p.roomId, p.tableNumber]),
    [
      ['a', 1],
      ['b', 1],
    ],
  );
  assert.deepEqual(
    planProjectLocations(projects(3), [room([[0, 2147483647]])]).map(
      (p) => p.tableNumber,
    ),
    [0, 1, 2],
  );
});
test('recalculation compacts deleted or moved projects deterministically', () => {
  const original = projects(3);
  const configuration = [room([[1, 3]])];
  assert.deepEqual(
    planProjectLocations(
      original.filter((p) => p.id !== 'project-1'),
      configuration,
    ).map((p) => [p.id, p.tableNumber]),
    [
      ['project-2', 1],
      ['project-3', 2],
    ],
  );
  assert.deepEqual(
    planProjectLocations(original, configuration),
    planProjectLocations(original, configuration),
  );
});
