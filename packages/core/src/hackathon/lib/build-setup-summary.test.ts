import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSetupSummary } from './build-setup-summary';
import type { SetupSnapshot } from './read-setup-snapshot';
import { snapshot } from './setup-snapshot.fixture';

test('configured entries allow manual completion and Overall is excluded from counts', () => {
  const summary = buildSetupSummary(snapshot());
  assert.equal(summary.completeCount, 1);
  assert.equal(summary.progress, 20);
  assert.equal(summary.sections.length, 5);
  assert.equal(summary.sections[1]!.count, 0);
  assert.equal(summary.sections[1]!.canComplete, false);
  assert.equal(summary.sections[2]!.canComplete, true);
  assert.equal(summary.counts.categories, 0);
  assert.equal(summary.sections[4]!.id, 'rooms');
  assert.equal(summary.blockers.length, 0);
  assert.equal(summary.warnings.length, 4);
});

test('saved completions match fingerprints and relevant edits invalidate them', () => {
  const data = snapshot();
  const summary = buildSetupSummary(data);
  data.hackathon.setupCompletions = summary.sections
    .filter((s) => s.canComplete)
    .map((s) => ({
      section: s.id,
      fingerprint: s.fingerprint,
    })) as SetupSnapshot['hackathon']['setupCompletions'];
  assert.equal(buildSetupSummary(data).progress, 60);
  data.hackathon.projects[0]!.name = 'Changed project';
  const changed = buildSetupSummary(data);
  assert.equal(changed.sections.find((s) => s.id === 'projects')!.done, false);
  assert.equal(changed.sections.find((s) => s.id === 'event')!.done, true);
  assert.notEqual(changed.fingerprint, summary.fingerprint);
});

test('rubric criteria and actual assigned judge accounts are required', () => {
  const data = snapshot();
  data.hackathon.categories[0]!.method = 'RUBRIC';
  data.judges[0]!.isActive = false;
  const summary = buildSetupSummary(data);
  assert.ok(summary.blockers.some((s) => s.includes('criterion')));
  assert.ok(summary.blockers.some((s) => s.includes('category access')));
  assert.equal(summary.sections.find((s) => s.id === 'judges')!.done, false);
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
    track: { id: 'track', disqualifiesFromOverall: true },
  } as SetupSnapshot['hackathon']['categories'][number]);
  data.hackathon.categories[0]!.method = 'RUBRIC';
  assert.equal(buildSetupSummary(data).blockers.length, 0);
  data.hackathon.projects.push({
    ...data.hackathon.projects[0]!,
    id: 'overall-project',
    name: 'Overall project',
    trackId: null,
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

test('rooms and custom categories can complete all five checklist steps', () => {
  const data = snapshot();
  data.hackathon.rooms.push({
    id: 'room',
    isActive: true,
    trackRooms: [],
  } as unknown as SetupSnapshot['hackathon']['rooms'][number]);
  data.hackathon.categories.push({
    ...data.hackathon.categories[0]!,
    id: 'challenge',
    name: 'Challenge',
    kind: 'CHALLENGE',
    method: 'RATING_SCALE',
    isEnabled: false,
  });
  const summary = buildSetupSummary(data);
  assert.equal(summary.counts.categories, 1);
  assert.equal(summary.counts.rooms, 1);
  data.hackathon.setupCompletions = summary.sections.map((s) => ({
    section: s.id,
    fingerprint: s.fingerprint,
  })) as SetupSnapshot['hackathon']['setupCompletions'];
  assert.equal(buildSetupSummary(data).completeCount, 5);
  assert.equal(buildSetupSummary(data).progress, 100);
  data.hackathon.rooms[0]!.isActive = false;
  const changed = buildSetupSummary(data);
  assert.equal(changed.sections.find((s) => s.id === 'rooms')!.done, false);
  assert.equal(changed.counts.rooms, 0);
});

test('event creation is automatically done when named and does not depend on manual completion', () => {
  const data = snapshot();
  const event = () =>
    buildSetupSummary(data).sections.find((s) => s.id === 'event')!;
  assert.equal(event().title, 'Create your event');
  assert.equal(event().done, true);
  assert.equal(data.hackathon.setupCompletions.length, 0);
  data.hackathon.scoreScale = 10;
  assert.equal(event().done, true);
  data.hackathon.name = 'Renamed event';
  assert.equal(event().done, true);
  for (const name of [null, '', '   ']) {
    data.hackathon.name = name;
    assert.equal(event().done, false);
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

test('challenge eligibility honors includesOverall and rejects unlinked restricted tracks', () => {
  const data = snapshot();
  const challenge = {
    ...data.hackathon.categories[0]!,
    id: 'challenge-category',
    name: 'Challenge',
    kind: 'CHALLENGE',
    method: 'RATING_SCALE',
    challenge: {
      id: 'challenge',
      includesOverall: true,
      allowedTracks: [{ trackId: 'other-track' }],
    },
  } as SetupSnapshot['hackathon']['categories'][number];
  data.hackathon.categories.push(challenge);
  data.hackathon.projects[0]!.challenges = [
    { challengeId: 'challenge' },
  ] as SetupSnapshot['hackathon']['projects'][number]['challenges'];
  assert.ok(
    !buildSetupSummary(data).blockers.some((s) => s.includes('not eligible')),
  );
  challenge.challenge!.includesOverall = false;
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
      includesOverall: true,
      allowedTracks: [{ trackId: 'chosen-track' }],
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
