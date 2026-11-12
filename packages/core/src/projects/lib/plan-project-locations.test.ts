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
  capacity: number,
  roomId = 'hall',
  trackId = 'overall',
): PlacementRoom => ({ roomId, trackId, capacity });

test('registration order fills spot counts across rooms with one global sequence', () => {
  const placed = planProjectLocations(projects(5), [
    room(2, 'first'),
    room(2, 'second'),
  ]);
  assert.deepEqual(
    placed.map((p) => [p.roomId, p.tableNumber]),
    [
      ['first', 1],
      ['first', 2],
      ['second', 3],
      ['second', 4],
      [null, null],
    ],
  );
});
test('101 projects across tracks and rooms receive exactly numbers 1 through 101', () => {
  const entered = projects(101).map((project, index) => ({
    ...project,
    trackId: index % 2 ? 'ai' : 'overall',
  }));
  const config = [
    room(25, 'a'),
    room(26, 'b'),
    room(30, 'a', 'ai'),
    room(20, 'b', 'ai'),
  ];
  const before = structuredClone(config);
  const placed = planProjectLocations(entered, config);
  assert.deepEqual(
    placed.map((project) => project.tableNumber).sort((a, b) => a! - b!),
    Array.from({ length: 101 }, (_, index) => index + 1),
  );
  assert.equal(placed.filter((project) => project.roomId === 'a').length, 55);
  assert.deepEqual(
    placed
      .filter((project) => project.roomId === 'a')
      .map((project) => project.tableNumber),
    Array.from({ length: 55 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    placed
      .filter((project) => project.roomId === 'b')
      .map((project) => project.tableNumber),
    Array.from({ length: 46 }, (_, index) => index + 56),
  );
  assert.deepEqual(config, before);
});

test('mixed tracks get consecutive room blocks after a room is deleted', () => {
  const entered = projects(8).map((project, index) => ({
    ...project,
    trackId: index % 2 ? 'ai' : 'overall',
  }));
  const config = [
    room(1, 'a'),
    room(3, 'a', 'ai'),
    room(1, 'deleted'),
    room(3, 'b'),
    room(1, 'b', 'ai'),
  ];
  const placed = planProjectLocations(
    entered,
    config.filter((link) => link.roomId !== 'deleted'),
  );
  assert.deepEqual(
    placed
      .filter((project) => project.roomId === 'a')
      .map((project) => [project.id, project.tableNumber]),
    [
      ['project-1', 1],
      ['project-2', 2],
      ['project-4', 3],
      ['project-6', 4],
    ],
  );
  assert.deepEqual(
    placed
      .filter((project) => project.roomId === 'b')
      .map((project) => [project.id, project.tableNumber]),
    [
      ['project-3', 5],
      ['project-5', 6],
      ['project-7', 7],
      ['project-8', 8],
    ],
  );
});
test('zero spots, missing tracks and track-specific overflow remain unassigned without numbering gaps', () => {
  const placed = planProjectLocations(
    [
      { id: 'waiting', trackId: 'missing' },
      { id: 'ai', trackId: 'ai' },
      { id: 'overall', trackId: 'overall' },
      { id: 'overflow', trackId: 'ai' },
    ],
    [room(0, 'zero', 'ai'), room(1, 'hall', 'ai'), room(1)],
  );
  assert.deepEqual(placed, [
    { id: 'waiting', roomId: null, tableNumber: null },
    { id: 'ai', roomId: 'hall', tableNumber: 1 },
    { id: 'overall', roomId: 'hall', tableNumber: 2 },
    { id: 'overflow', roomId: null, tableNumber: null },
  ]);
});
test('capacity edits, deletions and track moves deterministically recalculate placements', () => {
  const entered = projects(3);
  const reduced = [room(1, 'a'), room(1, 'b')];
  assert.deepEqual(
    planProjectLocations(entered, reduced).map((p) => p.tableNumber),
    [1, 2, null],
  );
  assert.deepEqual(planProjectLocations(entered.slice(1), reduced), [
    { id: 'project-2', roomId: 'a', tableNumber: 1 },
    { id: 'project-3', roomId: 'b', tableNumber: 2 },
  ]);
  assert.deepEqual(
    planProjectLocations(
      [{ ...entered[0]!, trackId: 'ai' }, ...entered.slice(1)],
      reduced,
    ).map((p) => p.tableNumber),
    [null, 1, 2],
  );
  assert.deepEqual(
    planProjectLocations(entered, reduced),
    planProjectLocations(entered, reduced),
  );
});
test('large capacities do not expand into slot arrays', () => {
  assert.deepEqual(
    planProjectLocations(projects(3), [room(2147483647)]).map(
      (p) => p.tableNumber,
    ),
    [1, 2, 3],
  );
});
