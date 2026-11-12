import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSetupSummary } from './build-setup-summary';
import type { SetupSnapshot } from './read-setup-snapshot';
import { snapshot } from './setup-snapshot.fixture';

test('home track count includes Overall and readiness has only configuration warnings', () => {
  const summary = buildSetupSummary(snapshot());
  assert.deepEqual(summary.counts, {
    projects: 1,
    judges: 1,
    categories: 0,
    tracks: 1,
    challenges: 0,
    rooms: 0,
    invitations: 0,
  });
  assert.deepEqual(summary.blockers, []);
  assert.deepEqual(summary.warnings, [
    '1 project needs a room or table location.',
  ]);
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

test('rubric criteria and actual assigned judge accounts are required', () => {
  const data = snapshot();
  data.hackathon.categories[0]!.method = 'RUBRIC';
  data.judges[0]!.isActive = false;
  const summary = buildSetupSummary(data);
  assert.ok(summary.blockers.some((s) => s.includes('criterion')));
  assert.ok(summary.blockers.some((s) => s.includes('category access')));
});

test('visibility does not disable a category and Overall excludes specialized-track projects', () => {
  const data = snapshot();
  data.hackathon.categories[0]!.isVisible = false;
  data.hackathon.projects[0]!.trackId = 'track';
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

test('projects with only conflicting judges cannot run', () => {
  const data = snapshot();
  data.judges[0]!.conflicts = [
    { projectId: 'project' },
  ] as SetupSnapshot['judges'][number]['conflicts'];
  assert.ok(
    buildSetupSummary(data).blockers.some((s) => s.includes('conflicts')),
  );
});

test('only active rooms count and unnamed events block readiness', () => {
  const data = snapshot();
  data.hackathon.rooms.push({
    id: 'room',
    isActive: true,
    trackRooms: [],
  } as unknown as SetupSnapshot['hackathon']['rooms'][number]);
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
