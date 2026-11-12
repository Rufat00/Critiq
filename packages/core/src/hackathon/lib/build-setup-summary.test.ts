import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSetupSummary } from './build-setup-summary';
import type { SetupSnapshot } from './read-setup-snapshot';
import { snapshot } from './setup-snapshot.fixture';

test('home track count includes Overall and valid configuration has no readiness issues', () => {
  const summary = buildSetupSummary(snapshot());
  assert.deepEqual(summary.counts, {
    projects: 1,
    judges: 1,
    categories: 0,
    tracks: 1,
    challenges: 0,
    rooms: 1,
    invitations: 0,
  });
  assert.deepEqual(summary.blockers, []);
  assert.deepEqual(summary.warnings, []);
});

test('home track count includes specialized tracks and excludes challenges', () => {
  const data = snapshot();
  data.hackathon.categories.push(
    {
      ...data.hackathon.categories[0]!,
      id: 'special',
      kind: 'TRACK',
      track: { ...data.hackathon.categories[0]!.track!, id: 'special-track' },
    },
    {
      ...data.hackathon.categories[0]!,
      id: 'challenge',
      kind: 'CHALLENGE',
      track: null,
    },
  );
  const summary = buildSetupSummary(data);
  assert.equal(summary.counts.tracks, 2);
  assert.equal(summary.counts.challenges, 1);
});

test('configuration edits invalidate readiness confirmation', () => {
  const data = snapshot();
  const before = buildSetupSummary(data).fingerprint;
  data.hackathon.projects[0]!.name = 'Changed project';
  assert.notEqual(buildSetupSummary(data).fingerprint, before);
});

test('readiness ignores missing judges, category access, and judge-only changes', () => {
  const data = snapshot();
  const before = buildSetupSummary(data).fingerprint;
  data.judges = [];
  data.hackathon.categories[0]!.judges = [];
  const summary = buildSetupSummary(data);
  assert.deepEqual(summary.blockers, []);
  assert.deepEqual(summary.warnings, []);
  assert.equal(summary.counts.judges, 0);
  assert.equal(summary.fingerprint, before);
});

test('every active eligible project needs both a room and table number', () => {
  for (const location of [
    { roomId: null, tableNumber: null },
    { roomId: null, tableNumber: 1 },
    { roomId: 'room', tableNumber: null },
  ]) {
    const data = snapshot();
    Object.assign(data.hackathon.projects[0]!, location);
    const summary = buildSetupSummary(data);
    assert.ok(
      summary.blockers.some((s) => s.includes('room and table number')),
    );
    assert.deepEqual(summary.warnings, []);
  }
});

test('inactive and disqualified projects do not require locations', () => {
  const data = snapshot();
  for (const status of [
    { isActive: false, isDisqualified: false },
    { isActive: true, isDisqualified: true },
  ]) {
    data.hackathon.projects.push({
      ...data.hackathon.projects[0]!,
      ...status,
      id: `excluded-${data.hackathon.projects.length}`,
      roomId: null,
      tableNumber: null,
    });
  }
  assert.deepEqual(buildSetupSummary(data).blockers, []);
});

test('assigned rooms must be active, in scope, and configured for the project track', () => {
  for (const change of [
    'missing',
    'inactive',
    'wrong-track',
    'zero-capacity',
  ]) {
    const data = snapshot();
    const room = data.hackathon.rooms[0]!;
    if (change === 'missing') data.hackathon.rooms = [];
    if (change === 'inactive') room.isActive = false;
    if (change === 'wrong-track') room.trackRooms[0]!.trackId = 'other-track';
    if (change === 'zero-capacity') room.trackRooms[0]!.capacity = 0;
    assert.ok(buildSetupSummary(data).blockers.length > 0, change);
  }
});

test('readiness validates track room capacity, including occupied spots of inactive projects', () => {
  const data = snapshot();
  const project = data.hackathon.projects[0]!;
  project.roomId = 'room';
  project.tableNumber = 1;
  data.hackathon.rooms[0]!.trackRooms[0]!.capacity = 1;
  assert.deepEqual(buildSetupSummary(data).blockers, []);
  data.hackathon.projects.push({
    ...project,
    id: 'inactive',
    name: 'Inactive project',
    isActive: false,
    tableNumber: 2,
  });
  assert.ok(
    buildSetupSummary(data).blockers.some((message) =>
      message.includes('room capacity'),
    ),
  );
  data.hackathon.rooms[0]!.trackRooms[0]!.capacity = 2;
  assert.deepEqual(buildSetupSummary(data).blockers, []);
  data.hackathon.rooms[0]!.trackRooms[0]!.isActive = false;
  assert.ok(
    buildSetupSummary(data).blockers.some((message) =>
      message.includes('room capacity'),
    ),
  );
});

test('rubric criteria are required even without active judges', () => {
  const data = snapshot();
  data.hackathon.categories[0]!.method = 'RUBRIC';
  data.judges[0]!.isActive = false;
  const summary = buildSetupSummary(data);
  assert.ok(summary.blockers.some((s) => s.includes('criterion')));
  assert.equal(summary.blockers.length, 1);
});

test('visibility does not disable a category and Overall excludes specialized-track projects', () => {
  const data = snapshot();
  data.hackathon.categories[0]!.isVisible = false;
  data.hackathon.projects[0]!.trackId = 'track';
  data.hackathon.rooms[0]!.trackRooms.push({
    ...data.hackathon.rooms[0]!.trackRooms[0]!,
    trackId: 'track',
  });
  data.hackathon.categories.push({
    ...data.hackathon.categories[0]!,
    id: 'special',
    name: 'Special',
    kind: 'TRACK',
    track: { ...data.hackathon.categories[0]!.track!, id: 'track' },
  } as SetupSnapshot['hackathon']['categories'][number]);
  data.hackathon.categories[0]!.method = 'RUBRIC';
  assert.equal(buildSetupSummary(data).blockers.length, 0);
  data.hackathon.projects.push({
    ...data.hackathon.projects[0]!,
    id: 'overall-project',
    name: 'Overall project',
    trackId: 'overall-track',
  });
  assert.ok(
    buildSetupSummary(data).blockers.some((s) =>
      s.startsWith('Overall: add at least one rubric criterion'),
    ),
  );
  data.hackathon.categories[0]!.method = 'RELATIVE';
  assert.equal(buildSetupSummary(data).blockers.length, 0);
  data.hackathon.categories[1]!.method = 'RUBRIC';
  assert.ok(
    buildSetupSummary(data).blockers.some((s) => s.includes('Special')),
  );
  data.hackathon.categories[1]!.isEnabled = false;
  assert.equal(buildSetupSummary(data).blockers.length, 0);
});

test('judge conflicts do not block readiness', () => {
  const data = snapshot();
  data.judges[0]!.conflicts = [
    { projectId: 'project' },
  ] as SetupSnapshot['judges'][number]['conflicts'];
  assert.deepEqual(buildSetupSummary(data).blockers, []);
});

test('only active rooms count and unnamed events block readiness', () => {
  const data = snapshot();
  assert.equal(buildSetupSummary(data).counts.rooms, 1);
  data.hackathon.rooms[0]!.isActive = false;
  assert.equal(buildSetupSummary(data).counts.rooms, 0);
  for (const name of [null, '', '   ']) {
    data.hackathon.name = name;
    assert.ok(
      buildSetupSummary(data).blockers.includes('Add your hackathon name.'),
    );
  }
});

test('category methods respect track and challenge compatibility', () => {
  const data = snapshot();
  data.hackathon.categories[0]!.method = 'RATING_SCALE';
  assert.ok(
    buildSetupSummary(data).blockers.some((s) => s.includes('supported')),
  );
  data.hackathon.categories[0]!.method = 'RELATIVE';
  data.hackathon.categories.push({
    ...data.hackathon.categories[0]!,
    id: 'challenge',
    name: 'Challenge',
    kind: 'CHALLENGE',
    method: 'RELATIVE',
  });
  assert.ok(
    buildSetupSummary(data).blockers.some((s) => s.includes('supported')),
  );
  data.hackathon.categories[1]!.method = 'RATING_SCALE';
  assert.ok(
    !buildSetupSummary(data).blockers.some(
      (s) => s.includes('supported') || s.includes('criterion'),
    ),
  );
  data.hackathon.categories[1]!.method = 'RUBRIC';
  assert.ok(
    buildSetupSummary(data).blockers.some((s) => s.includes('criterion')),
  );
});

test('challenge eligibility honors explicit Overall membership and rejects unlinked restricted tracks', () => {
  const data = snapshot();
  const challenge = {
    ...data.hackathon.categories[0]!,
    id: 'challenge-category',
    name: 'Challenge',
    kind: 'CHALLENGE',
    method: 'RATING_SCALE',
    challenge: {
      id: 'challenge',
      allowedTracks: [{ trackId: 'overall-track', challengeId: 'challenge' }],
    },
  } as SetupSnapshot['hackathon']['categories'][number];
  data.hackathon.categories.push(challenge);
  data.hackathon.projects[0]!.challenges = [
    { challengeId: 'challenge' },
  ] as SetupSnapshot['hackathon']['projects'][number]['challenges'];
  assert.ok(
    !buildSetupSummary(data).blockers.some((s) => s.includes('not eligible')),
  );
  challenge.challenge!.allowedTracks = [
    { trackId: 'other-track', challengeId: 'challenge' },
  ];
  assert.ok(
    buildSetupSummary(data).blockers.some((s) => s.includes('not eligible')),
  );
  challenge.challenge!.allowedTracks = [];
  assert.ok(
    buildSetupSummary(data).blockers.some((s) => s.includes('not eligible')),
  );
});

test('including Overall never grants challenge eligibility to unselected specialized tracks', () => {
  const data = snapshot();
  const challenge = {
    ...data.hackathon.categories[0]!,
    id: 'challenge-category',
    name: 'Challenge',
    kind: 'CHALLENGE',
    method: 'RATING_SCALE',
    challenge: {
      id: 'challenge',
      allowedTracks: [
        { trackId: 'overall-track', challengeId: 'challenge' },
        { trackId: 'chosen-track', challengeId: 'challenge' },
      ],
    },
  } as SetupSnapshot['hackathon']['categories'][number];
  data.hackathon.categories.push(challenge);
  data.hackathon.projects[0]!.trackId = 'new-track';
  data.hackathon.projects[0]!.challenges = [
    { challengeId: 'challenge' },
  ] as SetupSnapshot['hackathon']['projects'][number]['challenges'];
  assert.ok(
    buildSetupSummary(data).blockers.some((s) => s.includes('not eligible')),
  );
  data.hackathon.projects[0]!.trackId = 'chosen-track';
  assert.ok(
    !buildSetupSummary(data).blockers.some((s) => s.includes('not eligible')),
  );
});
